import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const paymentId = body?.data?.id;

    if (!paymentId) {
      return new Response(
        JSON.stringify({ received: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // DEDUPLICATION: Check if this payment_id was already processed
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id, payment_status, mp_payment_id")
      .eq("mp_payment_id", Number(paymentId))
      .maybeSingle();

    // If we already have a definitive status (paid/rejected/refunded), skip
    if (existingOrder && (existingOrder.payment_status === "paid" || existingOrder.payment_status === "rejected" || existingOrder.payment_status === "refunded")) {
      return new Response(
        JSON.stringify({ received: true, message: "Duplicate event — already processed", payment_id: paymentId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Find the restaurant's access token
    // First try to find the order by external_reference (order_id)
    let restaurantId: string | null = null;
    let accessToken: string | null = null;

    // Try to find order via external_reference in the webhook body
    const externalRef = body?.data?.external_reference as string | undefined;

    if (externalRef) {
      const { data: orderRow } = await supabase
        .from("orders")
        .select("id, restaurant_id, payment_status")
        .eq("id", String(externalRef))
        .maybeSingle();

      if (orderRow?.restaurant_id) {
        restaurantId = orderRow.restaurant_id;
        const { data: config } = await supabase
          .from("restaurant_payments")
          .select("mp_access_token")
          .eq("restaurant_id", restaurantId)
          .maybeSingle();
        accessToken = config?.mp_access_token ?? null;
      }
    }

    // If we still don't have a token, try all active configs
    if (!accessToken) {
      const { data: configs } = await supabase
        .from("restaurant_payments")
        .select("restaurant_id, mp_access_token")
        .eq("online_payment_active", true)
        .not("mp_access_token", "is", null);

      for (const cfg of configs ?? []) {
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { "Authorization": `Bearer ${cfg.mp_access_token}` },
        });
        if (mpRes.ok) {
          const mpData = await mpRes.json();
          if (mpData.external_reference) {
            restaurantId = cfg.restaurant_id;
            accessToken = cfg.mp_access_token;
            return await processPayment(supabase, mpData, String(paymentId));
          }
        }
      }

      return new Response(
        JSON.stringify({ received: true, message: "Payment not matched" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch payment details from MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });

    if (!mpRes.ok) {
      return new Response(
        JSON.stringify({ received: true, error: "Failed to fetch payment" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const mpData = await mpRes.json();
    return await processPayment(supabase, mpData, String(paymentId));
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function processPayment(
  supabase: ReturnType<typeof createClient>,
  mpData: Record<string, unknown>,
  paymentId: string,
): Promise<Response> {
  const externalRef = mpData.external_reference as string;
  const status = mpData.status as string;

  if (!externalRef) {
    return new Response(
      JSON.stringify({ received: true, message: "No external reference" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Determine payment method label from MP metadata
  const mpPaymentMethod = mpData.payment_method_id === "pix"
    ? "pix"
    : mpData.payment_type_id === "credit_card"
      ? "credit_card"
      : mpData.payment_type_id || "unknown";

  // Map MP status to our payment_status
  const paymentStatus = status === "approved" ? "paid"
    : status === "rejected" || status === "cancelled" ? "rejected"
    : status === "refunded" || status === "charged_back" ? "refunded"
    : "pending";

  const updatePayload: Record<string, unknown> = {
    payment_status: paymentStatus,
    mp_payment_id: mpData.id,
    mp_payment_method: mpPaymentMethod,
    updated_at: new Date().toISOString(),
  };

  // Only confirm payment if approved — never for rejected/in_process/cancelled
  // Keep status as "pending" so the restaurant goes through the normal accept flow
  if (status === "approved") {
    updatePayload.status = "pending";
  }

  // Try to update the order. If the row doesn't exist (card flow where the
  // edge function already created it, or a race), this is a no-op — the edge
  // function is the authoritative creator for card payments.
  const { error } = await supabase
    .from("orders")
    .update(updatePayload)
    .eq("id", externalRef);

  if (error) {
    return new Response(
      JSON.stringify({ received: true, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ received: true, payment_id: paymentId, status: paymentStatus, method: mpPaymentMethod }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
