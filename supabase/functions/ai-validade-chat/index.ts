import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DAILY_LIMIT = 10;

const SYSTEM_PROMPT = `Você é o "Gula Especialista", um agente de IA especialista em segurança alimentar e validade de produtos alimentícios.
Sua tarefa: responder perguntas sobre prazo de validade, armazenamento e temperatura de alimentos.
Diretrizes:
- Base-se nas normas da ANVISA (RDC 216/2004, RDC 265/2003) e boas práticas de manipulação.
- Para produtos manipulados, considere a validade após o preparo.
- Para industrializados, considere a validade após aberto.
- Seja conservador (melhor prevenir).
- Responda em português, de forma clara e objetiva.
- Estruture a resposta em 3 partes: **Validade**, **Armazenamento** e **Temperatura**.
- Inclua uma observação de segurança quando relevante (ex: risco de contaminação cruzada).
- Se o usuário perguntar algo fora do escopo de alimentos/validade, diga educadamente que você só responde sobre validade de alimentos.
- Mantenha a resposta concisa (máximo 4-5 linhas por parte).`;

// Base de conhecimento local para responder quando a OpenAI está indisponível.
const LOCAL_KB: { keywords: string[]; answer: string }[] = [
  { keywords: ["maionese", "salada", "salpicão"], answer: "**Validade:** 24 horas após o preparo (manipulada).\n\n**Armazenamento:** Refrigerado entre 2°C e 4°C em recipiente fechado.\n\n**Temperatura:** Manter abaixo de 4°C. Não deixar em temperatura ambiente por mais de 30 minutos.\n\n⚠️ Risco alto de contaminação por Salmonella e Listeria. Descarte após 24h." },
  { keywords: ["arroz", "feijão", "refeição", "marmita"], answer: "**Validade:** 3 dias após o preparo em refrigeração; 30 dias congelado.\n\n**Armazenamento:** Refrigerado 2-4°C em recipiente fechado ou congelado a -18°C.\n\n**Temperatura:** Refrigerar abaixo de 4°C em até 2 horas após o cozimento.\n\n⚠️ Reaquecer a pelo menos 70°C antes de consumir. Não recongelar após descongelar." },
  { keywords: ["carne", "frango", "peixe", "frutos do mar"], answer: "**Validade:** 2 dias refrigerado após aberto/manipulado; 90 dias congelado.\n\n**Armazenamento:** Refrigerado 0-4°C em recipiente fechado ou congelado a -18°C.\n\n**Temperatura:** Manter abaixo de 4°C. Cozinhar a pelo menos 70°C interno.\n\n⚠️ Nunca recongelar carne descongelada. Risco de contaminação cruzada — use utensílios separados." },
  { keywords: ["leite", "queijo", "iogurte", "requeijão"], answer: "**Validade:** 5 dias após aberto (refrigerado). Verificar data de validade da embalagem.\n\n**Armazenamento:** Refrigerado 2-4°C, manter na prateleira superior (mais fria).\n\n**Temperatura:** Abaixo de 4°C. Não deixar fora da geladeira por mais de 30 minutos.\n\n⚠️ Descartar se houver alteração de cor, odor ou consistência." },
  { keywords: ["bolo", "doce", "sobremesa", "pudim"], answer: "**Validade:** 3 dias após o preparo em refrigeração.\n\n**Armazenamento:** Refrigerado 2-4°C em recipiente fechado.\n\n**Temperatura:** Manter abaixo de 4°C.\n\n⚠️ Produtos com creme/leite são mais perecíveis. Descartar após 3 dias." },
  { keywords: ["pão", "massa", "pizza"], answer: "**Validade:** 3 dias em temperatura ambiente; 7 dias refrigerado.\n\n**Armazenamento:** Local seco e arejado em saco plástico ou refrigerado.\n\n**Temperatura:** Temperatura ambiente (18-25°C) ou refrigerado.\n\n⚠️ Descartar se houver mofo. Não consumir pão mofado nem cortando a parte mofada." },
  { keywords: ["enlatado", "lata", "sardinha", "atum", "conserva"], answer: "**Validade:** 3 dias após aberto (refrigerado). Lacrado, seguir validade da embalagem.\n\n**Armazenamento:** Após aberto, transferir para recipiente de vidro ou plástico com tampa e refrigerar.\n\n**Temperatura:** Refrigerado 2-4°C após aberto.\n\n⚠️ Não guardar na lata aberta (risco de contaminação metálica e botulismo)." },
  { keywords: ["molho", "catchup", "mostarda"], answer: "**Validade:** 30 dias após aberto (refrigerado).\n\n**Armazenamento:** Refrigerado após aberto, embalagem bem fechada.\n\n**Temperatura:** Abaixo de 4°C após aberto.\n\n⚠️ Descartar se houver mudança de cor, odor ou separação de fases." },
  { keywords: ["suco", "vitamina", "smoothie", "bebida"], answer: "**Validade:** 24 horas após o preparo em refrigeração.\n\n**Armazenamento:** Refrigerado 2-4°C em recipiente fechado.\n\n**Temperatura:** Abaixo de 4°C.\n\n⚠️ Consumir imediatamente é o ideal. Descartar após 24h." },
  { keywords: ["anvisa", "norma", "legislação", "rdc"], answer: "As principais normas de segurança alimentar no Brasil são:\n\n- **RDC 216/2004**: Regulamento técnico sobre boas práticas para serviços de alimentação.\n- **RDC 265/2003**: Regulamento técnico de procedimentos operacionais padronizados aplicados a estabelecimentos produtores/industrializadores de alimentos.\n- **RDC 275/2002**: Regulamento técnico de procedimentos operacionados padronizados aplicados a indústrias de produtos de origem animal.\n\nConsulte o site oficial da ANVISA para mais detalhes." },
];

function localAnswer(message: string): string | null {
  const lower = message.toLowerCase();
  for (const item of LOCAL_KB) {
    if (item.keywords.some(k => lower.includes(k))) {
      return item.answer;
    }
  }
  return null;
}

async function callOpenAIWithRetry(
  apiKey: string,
  messages: { role: string; content: string }[],
  temperature: number,
  maxTokens: number,
  retries = 2,
): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature,
          max_tokens: maxTokens,
          messages,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) return await res.json();

      const errText = await res.text();
      console.error("OpenAI error:", res.status, errText);

      if (res.status === 429 && attempt < retries) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw new Error(
        res.status === 429
          ? "Limite de requisições da IA excedido. Tente novamente em instantes."
          : `IA retornou erro (${res.status})`,
      );
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof DOMException && err.name === "AbortError") {
        if (attempt < retries) continue;
        throw new Error("Tempo limite ao contatar a IA");
      }
      throw err;
    }
  }
  throw new Error("Falha ao contatar a IA");
}

async function getTodayUsage(supabase: any, restaurantId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("ai_validade_usage")
    .select("count")
    .eq("restaurant_id", restaurantId)
    .eq("usage_date", today)
    .maybeSingle();
  return data?.count ?? 0;
}

async function incrementUsage(supabase: any, restaurantId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase
    .from("ai_validade_usage")
    .select("id, count")
    .eq("restaurant_id", restaurantId)
    .eq("usage_date", today)
    .maybeSingle();

  if (existing) {
    const newCount = existing.count + 1;
    await supabase
      .from("ai_validade_usage")
      .update({ count: newCount, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    return newCount;
  } else {
    await supabase
      .from("ai_validade_usage")
      .insert({ restaurant_id: restaurantId, usage_date: today, count: 1 });
    return 1;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const body = await req.json() as {
      message: string;
      history?: { role: string; content: string }[];
      restaurant_id?: string;
    };

    if (!body.message?.trim()) {
      return new Response(JSON.stringify({ error: "message é obrigatório" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY não configurada" }), {
        status: 503,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ── Daily limit enforcement ──────────────────────────────────────────
    let usageToday = 0;
    let limitReached = false;

    if (body.restaurant_id) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      usageToday = await getTodayUsage(supabase, body.restaurant_id);

      if (usageToday >= DAILY_LIMIT) {
        limitReached = true;
        return new Response(JSON.stringify({
          error: "Você atingiu seu limite diário de 10 consultas de IA hoje. Utilize seus insumos salvos no cadastro para imprimir normalmente!",
          limit_reached: true,
          usage_today: usageToday,
          daily_limit: DAILY_LIMIT,
        }), {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const messages: { role: string; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (body.history && Array.isArray(body.history)) {
      for (const msg of body.history.slice(-10)) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    messages.push({ role: "user", content: body.message });

    let content: string;
    try {
      const openaiData = await callOpenAIWithRetry(openaiKey, messages, 0.3, 600);
      content = openaiData?.choices?.[0]?.message?.content ?? "";
      if (!content) throw new Error("Resposta vazia da IA");
    } catch (apiErr) {
      const apiMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
      console.warn("OpenAI indisponível, usando base local:", apiMsg);
      const lastUser = [...messages].reverse().find(m => m.role === "user");
      const userText = lastUser?.content ?? "";
      const local = localAnswer(userText);
      content = local
        ? `${local}\n\n_(Resposta da base local — a IA está temporariamente indisponível)_`
        : `No momento a IA está indisponível (limite de requisições excedido). Tente novamente em alguns instantes.\n\nPara dúvidas comuns sobre validade, você pode perguntar sobre: arroz, feijão, carnes, maionese, leite, queijo, bolos, pães, enlatados, molhos, sucos, ou normas da ANVISA.`;
    }

    // Increment usage after a successful (or fallback) response
    if (body.restaurant_id) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      usageToday = await incrementUsage(supabase, body.restaurant_id);
    }

    return new Response(JSON.stringify({
      reply: content,
      usage_today: usageToday,
      daily_limit: DAILY_LIMIT,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("ai-validade-chat error:", msg);
    return new Response(JSON.stringify({ error: `Erro interno: ${msg}` }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
