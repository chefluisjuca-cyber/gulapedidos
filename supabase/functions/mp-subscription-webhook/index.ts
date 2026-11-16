import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PreapprovalData {
  id: string;
  status: string;
  payer_email?: string;
  payer_id?: number | string;
  external_reference?: string;
  next_payment_date?: string;
  auto_recurring?: { next_payment_date?: string };
}

interface WebhookBody {
  type?: string;
  topic?: string;
  action?: string;
  data?: { id?: string };
  resource?: string;
}

// Map MP preapproval status -> our subscription_status
function mapStatus(mpStatus: string): string | null {
  switch (mpStatus) {
    case "authorized":
      return "active";
    case "paused":
    case "pending":
      return "past_due";
    case "cancelled":
      return "canceled";
    default:
      return null;
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
    const accessToken = (Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN") || "").trim();
    if (!accessToken) {
      console.error("mp-subscription-webhook: MERCADO_PAGO_ACCESS_TOKEN not configured");
      return new Response(JSON.stringify({ error: "Mercado Pago não configurado" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = await req.json() as WebhookBody;
    const topic = body.type ?? body.topic ?? "";
    const preapprovalId = body.data?.id ?? null;

    // Only handle subscription and payment topics
    if (!topic.includes("subscription_preapproval") || !preapprovalId) {
      // Acknowledge other topics (e.g. plain "payment") without action
      console.log("mp-subscription-webhook: ignored topic", topic);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch the authoritative preapproval state from Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!mpRes.ok) {
      const errorBody = await mpRes.text();
      console.error("mp-subscription-webhook: MP fetch error", mpRes.status, errorBody);
      return new Response(JSON.stringify({ error: `Erro do Mercado Pago (${mpRes.status})` }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const preapproval = await mpRes.json() as PreapprovalData;
    const newStatus = mapStatus(preapproval.status);
    if (!newStatus) {
      console.warn("mp-subscription-webhook: unmapped status", preapproval.status);
      return new Response(JSON.stringify({ received: true, warning: "unmapped status" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Find the restaurant by stored preapproval id, or by external_reference as fallback
    let restaurantId: string | null = null;
    let externalRef: { plan_type?: string; billing_cycle?: string } = {};

    const { data: byPreapproval } = await supabase
      .from("restaurants")
      .select("id, plan_type, billing_cycle")
      .eq("mp_preapproval_id", preapprovalId)
      .maybeSingle();

    if (byPreapproval) {
      restaurantId = byPreapproval.id;
      externalRef = { plan_type: byPreapproval.plan_type ?? undefined, billing_cycle: byPreapproval.billing_cycle ?? undefined };
    } else if (preapproval.external_reference) {
      try {
        const ref = JSON.parse(preapproval.external_reference) as { restaurant_id?: string; plan_type?: string; billing_cycle?: string };
        restaurantId = ref.restaurant_id ?? null;
        externalRef = { plan_type: ref.plan_type, billing_cycle: ref.billing_cycle };
      } catch {
        restaurantId = null;
      }
    }

    if (!restaurantId) {
      console.error("mp-subscription-webhook: no restaurant found for preapproval", preapprovalId);
      return new Response(JSON.stringify({ received: true, warning: "restaurant not found" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const now = new Date().toISOString();
    const nextPaymentDate = preapproval.auto_recurring?.next_payment_date ?? preapproval.next_payment_date ?? null;

    const update: Record<string, unknown> = {
      subscription_status: newStatus,
      mp_payer_id: preapproval.payer_id !== undefined ? String(preapproval.payer_id) : undefined,
      updated_at: now,
    };

    if (newStatus === "active") {
      update.status = "active";
      if (nextPaymentDate) update.current_period_end = nextPaymentDate;
      if (externalRef.plan_type) update.plan_type = externalRef.plan_type;
      if (externalRef.billing_cycle) update.billing_cycle = externalRef.billing_cycle;
    } else if (newStatus === "canceled") {
      update.status = "suspended";
    }

    const { error: updateErr } = await supabase
      .from("restaurants")
      .update(update)
      .eq("id", restaurantId);

    if (updateErr) {
      console.error("mp-subscription-webhook: failed to update restaurant", updateErr.message);
      return new Response(JSON.stringify({ received: true, error: updateErr.message }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("mp-subscription-webhook: restaurant updated", {
      restaurantId,
      preapprovalId,
      status: newStatus,
    });

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("mp-subscription-webhook error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
