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
    const { price_id, slug, customer_email } = await req.json();
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

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price_id, quantity: 1 }],
      client_reference_id: slug,
      customer_email: customer_email || undefined,
      metadata: { slug, price_id },
      subscription_data: { metadata: { slug, price_id } },
      success_url: `${origin}/${slug}/etiquetas/faturamento?status=success`,
      cancel_url: `${origin}/${slug}/etiquetas/faturamento?status=cancel`,
    });

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
