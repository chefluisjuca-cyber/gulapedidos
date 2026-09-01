const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendMessagePayload {
  phone: string;
  message: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { phone, message } = await req.json() as SendMessagePayload;

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: "phone and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = (Deno.env.get("WHATSAPP_API_KEY") || "").trim();
    const instanceId = (Deno.env.get("WHATSAPP_INSTANCE_ID") || "").trim();

    if (!apiKey || !instanceId) {
      console.error("whatsapp-send: WHATSAPP_API_KEY or WHATSAPP_INSTANCE_ID not configured");
      return new Response(
        JSON.stringify({ error: "WhatsApp API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const digitsOnly = phone.replace(/\D/g, "");
    const normalizedPhone = digitsOnly.length <= 11 ? `55${digitsOnly}` : digitsOnly;
    const endpoint = `https://api.w-api.app/v1/message/send-text?instanceId=${instanceId}`;

    console.log("whatsapp-send: Chave utilizada final:", apiKey.slice(-4));

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        phone: normalizedPhone,
        message,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("whatsapp-send: W-API returned error", response.status, errorBody);
      return new Response(
        JSON.stringify({ error: `W-API error: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json().catch(() => ({}));

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("whatsapp-send error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
