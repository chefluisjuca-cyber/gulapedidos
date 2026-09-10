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
    const { restaurant_id, order_id, amount, payment_method, customer, order_data, order_items } = await req.json();

    if (!restaurant_id || !amount || !payment_method) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // PIX requires an existing order_id (async flow — webhook updates later).
    // Card requires order_data + order_items to create the order ONLY on approval.
    if (payment_method === "pix" && !order_id) {
      return new Response(
        JSON.stringify({ error: "Missing order_id for PIX payment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (payment_method === "card" && (!order_data || !order_items || !order_id)) {
      return new Response(
        JSON.stringify({ error: "Missing order data for card payment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: paymentConfig, error: configErr } = await supabase
      .from("restaurant_payments")
      .select("online_payment_active, mp_access_token, allow_pix, allow_credit_card")
      .eq("restaurant_id", restaurant_id)
      .maybeSingle();

    if (configErr || !paymentConfig) {
      return new Response(
        JSON.stringify({ error: "Pagamento online não configurado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!paymentConfig.online_payment_active) {
      return new Response(
        JSON.stringify({ error: "Pagamento online desativado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payment_method === "pix" && !paymentConfig.allow_pix) {
      return new Response(
        JSON.stringify({ error: "Pix não disponível" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payment_method === "card" && !paymentConfig.allow_credit_card) {
      return new Response(
        JSON.stringify({ error: "Cartão não disponível" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = paymentConfig.mp_access_token;
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Token do Mercado Pago não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // order_id serves as external_reference for both flows:
    //   PIX  → the existing order's DB id
    //   Card → a pre-generated UUID that will become the new order's id
    const externalRef = order_id!;

    const mpPayload: Record<string, unknown> = {
      transaction_amount: Math.round(amount * 100) / 100,
      description: `Pedido #${externalRef.slice(0, 8)}`,
      external_reference: externalRef,
      payer: {
        email: customer?.email || "cliente@restaurante.com",
        first_name: customer?.name?.split(" ")[0] || "Cliente",
        last_name: customer?.name?.split(" ").slice(1).join(" ") || "",
        identification: customer?.cpf
          ? { type: "CPF", number: customer.cpf }
          : undefined,
      },
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
    };

    if (payment_method === "pix") {
      mpPayload.payment_method_id = "pix";
    }

    if (payment_method === "card") {
      mpPayload.token = customer?.card_token;
      mpPayload.payment_method_id = customer?.card_brand;
      mpPayload.issuer_id = customer?.issuer_id;
      mpPayload.installments = 1;
    }

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": externalRef,
      },
      body: JSON.stringify(mpPayload),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      let errorDetail = mpData.message || "Erro ao criar pagamento";
      if (mpData.cause && Array.isArray(mpData.cause) && mpData.cause.length > 0) {
        const causes = mpData.cause.map((c: { code: string; description: string }) =>
          `${c.code}: ${c.description}`
        );
        errorDetail = causes.join("; ");
      }
      if (mpData.status_detail) {
        errorDetail = mpData.status_detail;
      }
      return new Response(
        JSON.stringify({ error: errorDetail, status: mpData.status, status_detail: mpData.status_detail, raw: mpData }),
        { status: mpResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const mpPaymentMethod = mpData.payment_method_id === "pix"
      ? "pix"
      : mpData.payment_type_id === "credit_card"
        ? "credit_card"
        : mpData.payment_type_id || payment_method;

    const result: Record<string, unknown> = {
      payment_id: mpData.id,
      status: mpData.status,
      status_detail: mpData.status_detail,
      payment_method: mpPaymentMethod,
    };

    // ── SECURITY: Only create/update order when payment is approved ──────────────
    if (mpData.status === "approved") {
      if (payment_method === "card" && order_data) {
        // Card flow: create order + items ONLY on approval
        const insertPayload: Record<string, unknown> = {
          id: externalRef,
          ...order_data,
          payment_status: "paid",
          payment_method: "online_card",
          mp_payment_id: mpData.id,
          mp_payment_method: mpPaymentMethod,
          status: "pending",
          updated_at: new Date().toISOString(),
        };

        const { data: newOrder, error: orderErr } = await supabase
          .from("orders")
          .insert(insertPayload)
          .select()
          .maybeSingle();

        if (orderErr || !newOrder) {
          result.error = "Pagamento aprovado mas erro ao criar pedido. Contate o restaurante com o ID do pagamento.";
          result.order_id = null;
          return new Response(
            JSON.stringify(result),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const itemsWithOrderId = (order_items as Record<string, unknown>[]).map(item => ({
          ...item,
          order_id: newOrder.id,
        }));
        await supabase.from("order_items").insert(itemsWithOrderId);

        result.order_id = newOrder.id;
      } else if (payment_method === "pix") {
        // PIX flow: update existing order
        await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            payment_method: "online_pix",
            mp_payment_id: mpData.id,
            mp_payment_method: mpPaymentMethod,
            status: "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", externalRef);
      }
    } else {
      // Payment NOT approved — do NOT create order for card; update status for PIX
      const failedStatus = mpData.status === "rejected" || mpData.status === "cancelled"
        ? "rejected"
        : "pending";

      if (payment_method === "pix") {
        await supabase
          .from("orders")
          .update({
            payment_status: failedStatus,
            payment_method: "online_pix",
            mp_payment_id: mpData.id,
            mp_payment_method: mpPaymentMethod,
            updated_at: new Date().toISOString(),
          })
          .eq("id", externalRef);
      }
      // Card: nothing to update — order was never created
    }

    if (payment_method === "pix" && mpData.point_of_interaction?.transaction_data) {
      result.qr_code = mpData.point_of_interaction.transaction_data.qr_code;
      result.qr_code_base64 = mpData.point_of_interaction.transaction_data.qr_code_base64;
      result.ticket_url = mpData.point_of_interaction.transaction_data.ticket_url;
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
