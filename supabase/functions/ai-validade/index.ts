import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `Você é um especialista em segurança alimentar e validade de produtos alimentícios.
Sua tarefa: analisar os dados de um produto e sugerir o prazo de validade em dias.
Responda SOMENTE em JSON válido com este formato exato:
{"validade_dias": <número inteiro>, "armazenamento": "<texto curto>", "observacao": "<texto curto e objetivo>"}
Regras:
- Considere normas da ANVISA e boas práticas de manipulação.
- Para produtos manipulados, considere validade após preparo.
- Para industrializados, considere validade após aberto.
- Seja conservador (melhor prevenir). Máximo 365 dias.
- observacao: máximo 120 caracteres, sem aspas extras.
- Não inclua nenhum texto fora do JSON.`;

// Fallback local: estimativas conservadoras baseadas em categoria e subcategoria
// quando a OpenAI está indisponível (429 / erro / sem crédito).
const FALLBACK_RULES: { match: (b: RequestBody) => boolean; dias: number; armazenamento: string; observacao: string }[] = [
  // Manipulados - curtos
  { match: b => b.categoria === "manipulado" && /salada|salpicão|maionese/i.test(b.nome), dias: 1, armazenamento: "Refrigerado 2-4°C", observacao: "Conservar em refrigeração; consumir em 24h pelo risco de contaminação." },
  { match: b => b.categoria === "manipulado" && /sand[uú]iche|lanche|hamb[uú]rguer|cachorro/i.test(b.nome), dias: 1, armazenamento: "Refrigerado 2-4°C", observacao: "Consumir em até 24h após o preparo." },
  { match: b => b.categoria === "manipulado" && /sopa|caldo|molho/i.test(b.nome), dias: 3, armazenamento: "Refrigerado 2-4°C", observacao: "Manter tampado em refrigeração; reaquecer bem antes de consumir." },
  { match: b => b.categoria === "manipulado" && /bolo|doce|sobremesa|pudim|iogurte/i.test(b.nome), dias: 3, armazenamento: "Refrigerado 2-4°C", observacao: "Conservar em refrigeração até o consumo." },
  { match: b => b.categoria === "manipulado" && /p[aã]o|massa|pizza/i.test(b.nome), dias: 3, armazenamento: "Temperatura ambiente ou refrigerado", observacao: "Manter em local seco e arejado." },
  { match: b => b.categoria === "manipulado" && /carne|frango|peixe|frutos do mar/i.test(b.nome), dias: 2, armazenamento: "Refrigerado 0-4°C ou congelado -18°C", observacao: "Manter em refrigeração; não recongelar após descongelar." },
  { match: b => b.categoria === "manipulado" && /suco|vitamina|smoothie/i.test(b.nome), dias: 1, armazenamento: "Refrigerado 2-4°C", observacao: "Consumir em até 24h." },
  // Industrializados - médios
  { match: b => b.categoria === "industrializado" && /leite|queijo|requeij[aã]o/i.test(b.nome), dias: 5, armazenamento: "Refrigerado 2-4°C", observacao: "Após aberto, consumir em até 5 dias; manter refrigerado." },
  { match: b => b.categoria === "industrializado" && /molho|catchup|mostarda|maionese/i.test(b.nome), dias: 30, armazenamento: "Refrigerado após aberto", observacao: "Após aberto, manter refrigerado e consumir em até 30 dias." },
  { match: b => b.categoria === "industrializado" && /conserva|picles|azeite|azeitona/i.test(b.nome), dias: 30, armazenamento: "Temperatura ambiente; refrigerar após aberto", observacao: "Manter submerso no líquido; refrigerar após aberto." },
  { match: b => b.categoria === "industrializado" && /enlatado|lata|sardinha|atum/i.test(b.nome), dias: 3, armazenamento: "Refrigerado após aberto", observacao: "Após aberto, transferir para recipiente fechado e consumir em 3 dias." },
  { match: b => b.categoria === "industrializado" && /biscoito|bolacha|barrinha|cereral/i.test(b.nome), dias: 15, armazenamento: "Temperatura ambiente, local seco", observacao: "Manter embalagem fechada; consumir em 15 dias após aberto." },
  { match: b => b.categoria === "industrializado" && /doce|chocolate|balas|bombom/i.test(b.nome), dias: 30, armazenamento: "Temperatura ambiente, local seco", observacao: "Evitar calor e umidade; consumir em 30 dias após aberto." },
  { match: b => b.categoria === "industrializado" && /snack|salgadinho|pipoca/i.test(b.nome), dias: 7, armazenamento: "Temperatura ambiente, local seco", observacao: "Manter embalagem bem fechada após aberto." },
  // Defaults
  { match: b => b.categoria === "manipulado", dias: 2, armazenamento: "Refrigerado 2-4°C", observacao: "Produto manipulado: consumir em até 2 dias; manter refrigerado." },
  { match: b => b.categoria === "industrializado", dias: 7, armazenamento: "Consultar embalagem; refrigerar após aberto se perecível", observacao: "Após aberto, consumir em até 7 dias ou conforme embalagem." },
  { match: () => true, dias: 3, armazenamento: "Refrigerado 2-4°C", observacao: "Conservar em refrigeração e consumir rapidamente após aberto." },
];

function fallbackEstimate(body: RequestBody): { validade_dias: number; armazenamento: string; observacao: string } {
  const rule = FALLBACK_RULES.find(r => r.match(body))!;
  return { validade_dias: rule.dias, armazenamento: rule.armazenamento, observacao: rule.observacao };
}

interface RequestBody {
  restaurant_id: string;
  nome: string;
  categoria: string;
  subcategoria?: string;
  armazenamento?: string;
  ingredientes_criticos?: string;
  modo_preparo?: string;
  embalagem?: string;
}

const DAILY_LIMIT = 10;

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

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function callOpenAIWithRetry(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  retries = 2,
): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          max_tokens: 200,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
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
    const body = await req.json() as RequestBody;

    if (!body.restaurant_id || !body.nome?.trim()) {
      return new Response(JSON.stringify({ error: "restaurant_id e nome são obrigatórios" }), {
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

    // Supabase client with service role to check cache and usage
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Daily limit enforcement ──────────────────────────────────────────
    const usageToday = await getTodayUsage(supabase, body.restaurant_id);
    if (usageToday >= DAILY_LIMIT) {
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

    // Build input hash for cache lookup
    const inputKey = [
      body.nome.trim().toLowerCase(),
      body.categoria,
      body.subcategoria?.trim().toLowerCase() ?? "",
      body.armazenamento?.trim().toLowerCase() ?? "",
      body.ingredientes_criticos?.trim().toLowerCase() ?? "",
      body.modo_preparo?.trim().toLowerCase() ?? "",
      body.embalagem?.trim().toLowerCase() ?? "",
    ].join("|");
    const inputHash = await sha256(inputKey);

    // Check cache first
    const { data: cached } = await supabase
      .from("etiqueta_validade_cache")
      .select("validade_dias, armazenamento, observacao")
      .eq("restaurant_id", body.restaurant_id)
      .eq("input_hash", inputHash)
      .maybeSingle();

    if (cached) {
      return new Response(JSON.stringify({
        validade_dias: cached.validade_dias,
        armazenamento: cached.armazenamento,
        observacao: cached.observacao,
        cached: true,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Build user prompt — compact to save tokens
    const userParts: string[] = [
      `Produto: ${body.nome}`,
      `Tipo: ${body.categoria}`,
    ];
    if (body.subcategoria) userParts.push(`Subcategoria: ${body.subcategoria}`);
    if (body.armazenamento) userParts.push(`Armazenamento: ${body.armazenamento}`);
    if (body.ingredientes_criticos) userParts.push(`Ingredientes críticos: ${body.ingredientes_criticos}`);
    if (body.modo_preparo) userParts.push(`Modo de preparo: ${body.modo_preparo}`);
    if (body.embalagem) userParts.push(`Embalagem: ${body.embalagem}`);
    const userPrompt = userParts.join("\n");

    // Call OpenAI with retry on 429
    let openaiData: any;
    let usedFallback = false;
    let parsed: { validade_dias?: number; armazenamento?: string; observacao?: string };

    try {
      openaiData = await callOpenAIWithRetry(openaiKey, SYSTEM_PROMPT, userPrompt);
      const content = openaiData?.choices?.[0]?.message?.content;
      if (!content) throw new Error("Resposta vazia da IA");
      parsed = JSON.parse(content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("OpenAI indisponível, usando estimativa local:", msg);
      const fb = fallbackEstimate(body);
      parsed = fb;
      usedFallback = true;
    }

    const validadeDias = Math.max(1, Math.min(365, Math.round(Number(parsed.validade_dias) || 1)));
    const armazenamento = parsed.armazenamento ?? "";
    const observacao = usedFallback
      ? `${parsed.observacao} (Estimativa automática — IA indisponível)`
      : parsed.observacao ?? "";

    // Persist to cache
    await supabase
      .from("etiqueta_validade_cache")
      .insert({
        restaurant_id: body.restaurant_id,
        input_hash: inputHash,
        validade_dias: validadeDias,
        armazenamento,
        observacao,
      });

    // Increment daily usage count
    const newUsageCount = await incrementUsage(supabase, body.restaurant_id);

    return new Response(JSON.stringify({
      validade_dias: validadeDias,
      armazenamento,
      observacao,
      cached: false,
      usage_today: newUsageCount,
      daily_limit: DAILY_LIMIT,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("ai-validade error:", msg);
    return new Response(JSON.stringify({ error: `Erro interno: ${msg}` }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
