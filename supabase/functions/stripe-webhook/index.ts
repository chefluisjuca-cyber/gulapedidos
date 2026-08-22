import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@18.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Stripe price_id → { plan code, modules, cycle }
// Annual price IDs include "gula_feedback" as a bonus module.
const PRICE_TO_PLAN: Record<string, { plan: string; modules: string[]; cycle: string }> = {
  // Plano 1 — Essencial (Promocional)
  "price_1U1Wf5RNhmPZU507wUTBXNij": { plan: "essencial", modules: ["gula_pedidos"], cycle: "mensal" },
  "price_1Tuzc8RNhmPZU50752kMT4TW": { plan: "essencial", modules: ["gula_pedidos"], cycle: "semestral" },
  "price_1Tuzc8RNhmPZU507zLjEWUPw": { plan: "essencial", modules: ["gula_pedidos"], cycle: "semestral" },
  "price_1Tuzc8RNhmPZU5076SmweTHX": { plan: "essencial", modules: ["gula_pedidos", "gula_feedback"], cycle: "anual" },
  // Plano 1 — Essencial (Regular)
  "price_1TuyrJRNhmPZU507bFE50clK": { plan: "essencial", modules: ["gula_pedidos"], cycle: "mensal" },
  "price_1Tuz5ORNhmPZU507VknLWyOF": { plan: "essencial", modules: ["gula_pedidos"], cycle: "semestral" },
  "price_1Tuz89RNhmPZU5070NrP6qzJ": { plan: "essencial", modules: ["gula_pedidos", "gula_feedback"], cycle: "anual" },
  // Plano 2 — Pedidos + Fidelidade (Promocional)
  "price_1TuzdHRNhmPZU507rVBBE8I1": { plan: "pedidos_fidelidade", modules: ["gula_pedidos", "gula_fidelidade"], cycle: "mensal" },
  "price_1TuzeXRNhmPZU507Gt3sXGyk": { plan: "pedidos_fidelidade", modules: ["gula_pedidos", "gula_fidelidade"], cycle: "semestral" },
  "price_1TuzeWRNhmPZU5076yEeYA05": { plan: "pedidos_fidelidade", modules: ["gula_pedidos", "gula_fidelidade", "gula_feedback"], cycle: "anual" },
  // Plano 2 — Pedidos + Fidelidade (Padrão)
  "price_1TuywTRNhmPZU507B54lpCTF": { plan: "pedidos_fidelidade", modules: ["gula_pedidos", "gula_fidelidade"], cycle: "mensal" },
  "price_1TuzA3RNhmPZU507T9E5KJ8M": { plan: "pedidos_fidelidade", modules: ["gula_pedidos", "gula_fidelidade"], cycle: "semestral" },
  "price_1Tuz9KRNhmPZU507Ovdijldz": { plan: "pedidos_fidelidade", modules: ["gula_pedidos", "gula_fidelidade", "gula_feedback"], cycle: "anual" },
  // Plano 3 — Completo (Pedidos + Fidelidade + Etiquetas)
  "price_1Tuz2tRNhmPZU5079NY2GmLc": { plan: "pedidos_fidelidade_etiquetas", modules: ["gula_pedidos", "gula_fidelidade", "gula_etiquetas"], cycle: "mensal" },
  "price_1TuzAkRNhmPZU507q059dt8V": { plan: "pedidos_fidelidade_etiquetas", modules: ["gula_pedidos", "gula_fidelidade", "gula_etiquetas"], cycle: "semestral" },
  "price_1TuzBCRNhmPZU507nN9G6gAP": { plan: "pedidos_fidelidade_etiquetas", modules: ["gula_pedidos", "gula_fidelidade", "gula_etiquetas", "gula_feedback"], cycle: "anual" },
  // Plano 4 — Gula Etiquetas Stand-alone
  "price_1TxU1ERNhmPZU507Ev3MmGbz": { plan: "gula_etiquetas_standalone", modules: ["gula_etiquetas"], cycle: "mensal" },
  "price_1TxU1ERNhmPZU507TMjIj8ti": { plan: "gula_etiquetas_standalone", modules: ["gula_etiquetas"], cycle: "semestral" },
  "price_1TxU1ERNhmPZU507FgeFrcya": { plan: "gula_etiquetas_standalone", modules: ["gula_etiquetas"], cycle: "semestral" },
  "price_1U1XvRRNhmPZU507MjkznLVg": { plan: "gula_etiquetas_standalone", modules: ["gula_etiquetas"], cycle: "mensal" },
  "price_1U1XvRRNhmPZU507ZKGFYQJx": { plan: "gula_etiquetas_standalone", modules: ["gula_etiquetas"], cycle: "semestral" },
  "price_1U1XvRRNhmPZU5079ladqUWN": { plan: "gula_etiquetas_standalone", modules: ["gula_etiquetas", "gula_feedback"], cycle: "anual" },
  // Gula Feedback Stand-alone
  "price_1U55mzRNhmPZU5073LPQtsDa": { plan: "gula_feedback_standalone", modules: ["gula_feedback"], cycle: "mensal" },
  "price_1U55mzRNhmPZU507N8aN2qpz": { plan: "gula_feedback_standalone", modules: ["gula_feedback"], cycle: "semestral" },
  "price_1U55mzRNhmPZU507N3TFXMl1": { plan: "gula_feedback_standalone", modules: ["gula_feedback"], cycle: "anual" },
};

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

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    return new Response(JSON.stringify({ error: "Stripe não configurado" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const stripe = new Stripe(stripeKey);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return new Response(JSON.stringify({ error: "Missing stripe-signature" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const rawBody = await req.text();
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("stripe-webhook: signature verification failed", msg);
      return new Response(JSON.stringify({ error: `Invalid signature: ${msg}` }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const slug = session.client_reference_id;
      if (!slug) {
        console.warn("stripe-webhook: checkout.session.completed without client_reference_id", session.id);
        return new Response(JSON.stringify({ received: true, warning: "no client_reference_id" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Resolve price_id from metadata first, then line_items
      let priceId: string | null = null;
      if (typeof session.metadata?.price_id === "string") {
        priceId = session.metadata.price_id;
      }
      if (!priceId) {
        // line_items is not populated in webhook events; retrieve via API
        try {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
          if (lineItems.data.length > 0) {
            priceId = lineItems.data[0].price?.id ?? null;
          }
        } catch (e) {
          console.error("stripe-webhook: failed to retrieve line_items", e instanceof Error ? e.message : String(e));
        }
      }

      const planInfo = priceId ? PRICE_TO_PLAN[priceId] : null;
      if (!planInfo) {
        console.error("stripe-webhook: unknown price_id", { slug, priceId, sessionId: session.id });
        return new Response(JSON.stringify({ received: true, warning: "unknown price" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Activate restaurant and inject modules
      const { error } = await supabase
        .from("restaurants")
        .update({
          status: "active",
          plan: planInfo.plan,
          modules: planInfo.modules,
          updated_at: new Date().toISOString(),
        })
        .eq("slug", slug);

      if (error) {
        console.error("stripe-webhook: failed to update restaurant", error.message, { slug });
        return new Response(JSON.stringify({ received: true, error: error.message }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      console.log("stripe-webhook: restaurant activated", { slug, plan: planInfo.plan });

      // Enable Gula Feedback in restaurant_settings for annual plans (bônus)
      if (planInfo.modules.includes("gula_feedback")) {
        const { data: restaurantRow } = await supabase
          .from("restaurants")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (restaurantRow?.id) {
          await supabase
            .from("restaurant_settings")
            .update({ feedback_enabled: true, updated_at: new Date().toISOString() })
            .eq("restaurant_id", restaurantRow.id);
          console.log("stripe-webhook: gula_feedback enabled for annual plan", { slug });
        }
      }
    }

    // Subscription canceled → suspend restaurant access
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const slug = sub.metadata?.slug ?? null;
      if (slug) {
        const { error } = await supabase
          .from("restaurants")
          .update({ status: "suspended", updated_at: new Date().toISOString() })
          .eq("slug", slug);
        if (error) console.error("stripe-webhook: failed to suspend", error.message, { slug });
        else console.log("stripe-webhook: restaurant suspended (subscription deleted)", { slug });
      }
    }

    // Invoice paid (renewal) → ensure restaurant stays active
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const slug = (invoice.parent?.subscription_details?.metadata as Record<string, string> | undefined)?.slug
        ?? (invoice.metadata as Record<string, string> | undefined)?.slug
        ?? null;
      if (slug) {
        const { error } = await supabase
          .from("restaurants")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("slug", slug);
        if (error) console.error("stripe-webhook: failed to reactivate on renewal", error.message, { slug });
        else console.log("stripe-webhook: restaurant reactivated on renewal", { slug });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("stripe-webhook: unhandled error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
