import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
    const { restaurant_id } = await req.json() as { restaurant_id?: string };
    if (!restaurant_id) {
      return new Response(JSON.stringify({ error: "restaurant_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const accessToken = (Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN") || "").trim();
    if (!accessToken) {
      console.error("mp-cancel-subscription: MERCADO_PAGO_ACCESS_TOKEN not configured");
      return new Response(JSON.stringify({ error: "Mercado Pago não configurado" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: restaurant, error: fetchErr } = await supabase
      .from("restaurants")
      .select("id, mp_preapproval_id")
      .eq("id", restaurant_id)
      .maybeSingle();

    if (fetchErr || !restaurant) {
      return new Response(JSON.stringify({ error: "Restaurante não encontrado" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!restaurant.mp_preapproval_id) {
      return new Response(JSON.stringify({ error: "Nenhuma assinatura ativa encontrada" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${restaurant.mp_preapproval_id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ status: "cancelled" }),
    });

    if (!mpRes.ok) {
      const errorBody = await mpRes.text();
      console.error("mp-cancel-subscription: MP error", mpRes.status, errorBody);
      return new Response(JSON.stringify({ error: `Erro do Mercado Pago (${mpRes.status})` }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { error: updateErr } = await supabase
      .from("restaurants")
      .update({
        subscription_status: "canceled",
        status: "suspended",
        updated_at: new Date().toISOString(),
      })
      .eq("id", restaurant_id);

    if (updateErr) {
      console.error("mp-cancel-subscription: failed to update restaurant", updateErr.message);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("mp-cancel-subscription error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
