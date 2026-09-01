import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@18.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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

  try {
    const { price_id, slug, customer_email, plan_type } = await req.json();
    if (!price_id || !slug) {
      return new Response(JSON.stringify({ error: "price_id and slug are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe não configurado" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const stripe = new Stripe(stripeKey);

    // Origin for success/cancel URLs — derive from request or default
    const origin = req.headers.get("origin") ?? "https://gulapedidos.com";

    // Determine billing cycle limit for recurring monthly plans (semestral/anual)
    // These price IDs use monthly recurring billing with a fixed number of cycles.
    const SEMESTRAL_PRICES = new Set([
      "price_1UAYXbRNhmPZU507Qyitws9F", // Gula Feedback semestral
      "price_1UAYfDRNhmPZU507tjFn3L1C", // Essencial semestral
      "price_1UAYsURNhmPZU507wlqcehA0", // Profissional semestral
      "price_1UAYwqRNhmPZU507jzoVedPS", // Premium semestral
      "price_1UAZACRNhmPZU507qmwmBOWT", // Gula Fila semestral
      "price_1UAZFMRNhmPZU507EQN9orkH", // Gula Etiquetas semestral
    ]);
    const ANUAL_PRICES = new Set([
      "price_1UAYUNRNhmPZU507lcGxypJM", // Gula Feedback anual
      "price_1UAYgWRNhmPZU507dqQISm3W", // Essencial anual
      "price_1UAYuhRNhmPZU50716OMAKIG", // Profissional anual
      "price_1UAYy4RNhmPZU5076kRQPZTT", // Premium anual
      "price_1UAZAyRNhmPZU507jloLrvru", // Gula Fila anual
      "price_1UAZGHRNhmPZU507BxrR98yR", // Gula Etiquetas anual
    ]);
    const cycleCount = SEMESTRAL_PRICES.has(price_id) ? 6 : ANUAL_PRICES.has(price_id) ? 12 : null;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price_id, quantity: 1 }],
      client_reference_id: slug,
      customer_email: customer_email || undefined,
      metadata: { slug, price_id, ...(plan_type ? { plan_type } : {}) },
      subscription_data: {
        metadata: { slug, price_id, ...(plan_type ? { plan_type } : {}) },
        ...(cycleCount ? { billing_cycle_anchor: Math.floor(Date.now() / 1000) } : {}),
      },
      success_url: `${origin}/${slug}/etiquetas/faturamento?status=success`,
      cancel_url: `${origin}/${slug}/etiquetas/faturamento?status=cancel`,
    });

    // For semestral/anual recurring plans, create a subscription schedule to limit cycles
    if (cycleCount && session.subscription) {
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      try {
        await stripe.subscriptionSchedules.create({
          from_subscription: subscriptionId,
          phases: [
            {
              items: [{ price: price_id, quantity: 1 }],
              iterations: cycleCount,
            },
          ],
        });
      } catch (schedErr) {
        console.error("subscription schedule error:", schedErr instanceof Error ? schedErr.message : String(schedErr));
      }
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("stripe-checkout error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
