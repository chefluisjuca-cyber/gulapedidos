import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateSubPayload {
  restaurant_id: string;
  plan_type: string; // essencial | profissional | premium | etiquetas | fila | feedback
  billing_cycle: string; // monthly | semiannual | annual
  payer_email: string;
}

// Base monthly prices (BRL)
const PLAN_PRICES: Record<string, number> = {
  essencial: 69.99,
  profissional: 69.99,
  premium: 99.99,
  etiquetas: 39.99,
  fila: 49.99,
  feedback: 29.99,
};

const PLAN_NAMES: Record<string, string> = {
  essencial: "Gula Pedidos Essencial",
  profissional: "Gula Pedidos Profissional",
  premium: "Gula Pedidos Premium",
  etiquetas: "Gula Etiquetas",
  fila: "Gula Fila",
  feedback: "Gula Feedback",
};

const CYCLE_MONTHS: Record<string, number> = {
  monthly: 1,
  semiannual: 6,
  annual: 12,
};

const CYCLE_LABELS: Record<string, string> = {
  monthly: "Mensal",
  semiannual: "Semestral",
  annual: "Anual",
};

// ~25% OFF main plans annual, ~10% OFF semiannual.
// Standalone modules: annual 20% OFF, semiannual 10% OFF.
const STANDALONE_PLANS = new Set(["etiquetas", "fila", "feedback"]);

function priceFor(planType: string, cycle: string): number {
  const base = PLAN_PRICES[planType];
  if (!base) throw new Error(`Unknown plan_type: ${planType}`);
  if (cycle === "monthly") return base;
  const discount = cycle === "semiannual" ? 0.10 : STANDALONE_PLANS.has(planType) ? 0.20 : 0.25;
  return Math.round(base * (1 - discount) * 100) / 100;
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
    const { restaurant_id, plan_type, billing_cycle, payer_email } = await req.json() as CreateSubPayload;

    if (!restaurant_id || !plan_type || !billing_cycle || !payer_email) {
      return new Response(
        JSON.stringify({ error: "restaurant_id, plan_type, billing_cycle and payer_email are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    if (!PLAN_PRICES[plan_type] || !CYCLE_MONTHS[billing_cycle]) {
      return new Response(
        JSON.stringify({ error: "Invalid plan_type or billing_cycle" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const accessToken = (Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN") || "").trim();
    if (!accessToken) {
      console.error("create-mp-subscription: MERCADO_PAGO_ACCESS_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "Mercado Pago não configurado" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Check whether the free trial was already consumed for this restaurant
    const { data: restaurantRow, error: restErr } = await supabase
      .from("restaurants")
      .select("id, name, slug, mp_trial_used, trial_ends_at, status")
      .eq("id", restaurant_id)
      .maybeSingle();

    if (restErr || !restaurantRow) {
      return new Response(
        JSON.stringify({ error: "Restaurante não encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const trialStillValid =
      restaurantRow.status === "trial" &&
      restaurantRow.trial_ends_at &&
      new Date(restaurantRow.trial_ends_at) > new Date();

    const applyFreeTrial = !restaurantRow.mp_trial_used && !trialStillValid;

    const transactionAmount = priceFor(plan_type, billing_cycle);
    const origin = req.headers.get("origin") ?? "https://gulapedidos.com";
    const backUrl = `${origin}/${restaurantRow.slug}/etiquetas/faturamento?status=subscription`;

    const preapprovalBody: Record<string, unknown> = {
      reason: `${PLAN_NAMES[plan_type]} — ${CYCLE_LABELS[billing_cycle]}`,
      external_reference: JSON.stringify({
        restaurant_id,
        plan_type,
        billing_cycle,
      }),
      payer_email,
      // back_url must be a plain string for the preapproval API (the
      // success/pending/failure object form is only for /checkout/preferences).
      back_url: backUrl,
      auto_recurring: {
        frequency: CYCLE_MONTHS[billing_cycle],
        frequency_type: "months",
        transaction_amount: transactionAmount,
        currency_id: "BRL",
        ...(applyFreeTrial
          ? { free_trial: { frequency: 7, frequency_type: "days" } }
          : {}),
      },
    };

    const mpRes = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preapprovalBody),
    });

    if (!mpRes.ok) {
      const errorBody = await mpRes.text();
      console.error("create-mp-subscription: Mercado Pago error", mpRes.status, errorBody);
      let mpMessage = errorBody;
      try {
        const parsed = JSON.parse(errorBody) as {
          error?: string;
          message?: string;
          cause?: Array<{ code?: string; description?: string }>;
        };
        const causes = (parsed.cause ?? [])
          .map((c) => `${c.code ?? ""}: ${c.description ?? ""}`.trim())
          .join("; ");
        mpMessage = [parsed.message ?? parsed.error, causes].filter(Boolean).join(" | ") || errorBody;
      } catch {
        // keep raw body
      }
      return new Response(
        JSON.stringify({ error: `Erro do Mercado Pago (${mpRes.status}): ${mpMessage}`.slice(0, 800) }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const mpData = await mpRes.json();
    const initPoint: string | undefined = mpData.init_point;

    if (!initPoint) {
      console.error("create-mp-subscription: no init_point in response", JSON.stringify(mpData).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "Resposta inesperada do Mercado Pago" }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Track subscription intent + mark trial as used if granted
    const update: Record<string, unknown> = {
      plan_type,
      billing_cycle,
      updated_at: new Date().toISOString(),
    };
    if (applyFreeTrial) update.mp_trial_used = true;

    await supabase
      .from("restaurants")
      .update(update)
      .eq("id", restaurant_id);

    return new Response(
      JSON.stringify({ init_point: initPoint, preapproval_id: mpData.id ?? null }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("create-mp-subscription error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
