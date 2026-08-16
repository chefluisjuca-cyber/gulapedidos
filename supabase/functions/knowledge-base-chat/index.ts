import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type AgentType = "etiquetas" | "geral";

const SYSTEM_PROMPTS: Record<AgentType, string> = {
  etiquetas: `Você é o "Gula Especialista em Etiquetas", um agente de IA especialista em segurança alimentar, validade de produtos e operação do módulo Gula Etiquetas.
Sua tarefa: responder perguntas sobre prazo de validade, produtos abertos vs manipulados, armazenamento, temperatura e normas da Vigilância Sanitária (ANVISA RDC 216/2004, RDC 265/2003).
Diretrizes:
- Use PRIMARIAMENTE as informações da Base de Conhecimento fornecida para responder.
- Se a pergunta não estiver na base, use seu conhecimento geral sobre segurança alimentar.
- Para produtos manipulados, considere a validade após o preparo.
- Para industrializados, considere a validade após aberto.
- Seja conservador (melhor prevenir).
- Responda em português, de forma clara e objetiva.
- Estruture a resposta em 3 partes quando relevante: **Validade**, **Armazenamento** e **Temperatura**.
- Inclua uma observação de segurança quando relevante (ex: risco de contaminação cruzada).
- Se o usuário perguntar sobre pedidos, delivery, fidelidade, gestão ou configurações do sistema, diga educadamente que seu escopo é apenas etiquetas e segurança alimentar, e sugira consultar o Assistente Geral.
- Mantenha a resposta concisa (máximo 5-6 linhas por parte).`,

  geral: `Você é o "Assistente Gula", um agente de IA especialista no ecossistema SaaS Gula.
Sua tarefa: responder perguntas sobre TODOS os módulos da plataforma Gula.
Diretrizes:
- Use PRIMARIAMENTE as informações da Base de Conhecimento fornecida para responder.
- Se a pergunta não estiver na base, use seu conhecimento geral sobre a plataforma.
- Você cobre TODOS os módulos: Gula Pedidos (KDS, fila de pedidos, status), Gula Delivery (taxas por KM, rastreio, motoboys), Gula Fidelidade (cashback, pontos, disparos push), Gestão & Analytics (faturamento, relatórios CSV), Gula Etiquetas (validade, etiquetas) e Configurações Gerais.
- NUNCA recuse responder perguntas sobre o ecossistema Gula. Se souber a resposta, responda.
- Responda em português, de forma clara e objetiva.
- Se o usuário perguntar algo totalmente fora do escopo da plataforma (ex: política, esportes), diga educadamente que você só responde sobre o ecossistema Gula.
- Mantenha a resposta concisa (máximo 5-6 linhas).`,
};

interface KnowledgeItem {
  category: string;
  question: string;
  answer: string;
  keywords: string[];
}

async function fetchKnowledgeBase(
  supabase: any,
  agent: AgentType,
  restaurantId?: string,
): Promise<KnowledgeItem[]> {
  let query = supabase
    .from("knowledge_base")
    .select("category,question,answer,keywords")
    .eq("active", true)
    .eq("agent", agent)
    .order("sort_order", { ascending: true });

  if (restaurantId) {
    query = query.or(`restaurant_id.is.null,restaurant_id.eq.${restaurantId}`);
  } else {
    query = query.is("restaurant_id", null);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching knowledge base:", error.message);
    return [];
  }
  return (data ?? []) as KnowledgeItem[];
}

function buildKnowledgeContext(items: KnowledgeItem[]): string {
  if (items.length === 0) return "";
  const lines = items.map(
    (item, i) =>
      `${i + 1}. [${item.category}] P: ${item.question}\n   R: ${item.answer}${item.keywords?.length ? `\n   Keywords: ${item.keywords.join(", ")}` : ""}`,
  );
  return `=== BASE DE CONHECIMENTO ===\n${lines.join("\n\n")}\n=== FIM DA BASE ===`;
}

function findRelevantItems(items: KnowledgeItem[], message: string): KnowledgeItem[] {
  const lower = message.toLowerCase();
  const scored = items.map(item => {
    let score = 0;
    if (item.question.toLowerCase().includes(lower) || lower.includes(item.question.toLowerCase())) score += 5;
    for (const kw of item.keywords ?? []) {
      if (lower.includes(kw.toLowerCase())) score += 3;
    }
    if (lower.includes(item.category.toLowerCase())) score += 1;
    for (const word of lower.split(/\s+/)) {
      if (word.length > 3 && item.answer.toLowerCase().includes(word)) score += 1;
    }
    return { item, score };
  });
  const relevant = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
  return relevant.length > 0 ? relevant.slice(0, 5).map(s => s.item) : items.slice(0, 5);
}

async function callOpenAI(
  apiKey: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 600,
        messages,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenAI error:", res.status, errText);
      throw new Error(`IA retornou erro (${res.status})`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    clearTimeout(timeout);
    throw err;
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
      agent?: string;
    };

    if (!body.message?.trim()) {
      return new Response(JSON.stringify({ error: "message é obrigatório" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const agent: AgentType = body.agent === "etiquetas" ? "etiquetas" : "geral";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const allItems = await fetchKnowledgeBase(supabase, agent, body.restaurant_id);
    const relevantItems = findRelevantItems(allItems, body.message);
    const kbContext = buildKnowledgeContext(relevantItems);

    const messages: { role: string; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPTS[agent] },
    ];

    if (kbContext) {
      messages.push({
        role: "system",
        content: `Use a seguinte base de conhecimento para responder. Priorize estas informações:\n\n${kbContext}`,
      });
    }

    if (body.history && Array.isArray(body.history)) {
      for (const msg of body.history.slice(-10)) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    messages.push({ role: "user", content: body.message });

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    let reply: string;

    if (openaiKey) {
      try {
        reply = await callOpenAI(openaiKey, messages);
        if (!reply) throw new Error("Resposta vazia da IA");
      } catch (apiErr) {
        console.warn("OpenAI indisponível, usando base local:", apiErr);
        if (relevantItems.length > 0) {
          const best = relevantItems[0];
          reply = `${best.answer}\n\n_(Resposta baseada na Base de Conhecimento — a IA está temporariamente indisponível)_`;
        } else {
          reply = "No momento a IA está indisponível. Tente novamente em alguns instantes.";
        }
      }
    } else {
      if (relevantItems.length > 0) {
        const best = relevantItems[0];
        reply = `${best.answer}\n\n_(Resposta baseada na Base de Conhecimento)_`;
      } else {
        reply = "OPENAI_API_KEY não configurada e nenhum tópico relevante encontrado na base de conhecimento.";
      }
    }

    return new Response(JSON.stringify({
      reply,
      agent,
      matched_topics: relevantItems.length,
      total_topics: allItems.length,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("knowledge-base-chat error:", msg);
    return new Response(JSON.stringify({ error: `Erro interno: ${msg}` }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
