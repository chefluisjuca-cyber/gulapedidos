import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AlertSettings {
  restaurant_id: string;
  restaurant_name: string;
  responsavel_nome: string | null;
  responsavel_whatsapp: string | null;
}

interface ExpiringProduct {
  produto: string;
  data_validade: string;
}

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const apiKey = (Deno.env.get("WHATSAPP_API_KEY") || "").trim();
  const instanceId = (Deno.env.get("WHATSAPP_INSTANCE_ID") || "").trim();

  if (!apiKey || !instanceId) {
    console.error("validade-alert: WHATSAPP_API_KEY or WHATSAPP_INSTANCE_ID not configured");
    return false;
  }

  const digitsOnly = phone.replace(/\D/g, "");
  const normalizedPhone = digitsOnly.length <= 11 ? `55${digitsOnly}` : digitsOnly;
  const endpoint = `https://api.w-api.app/v1/message/send-text?instanceId=${instanceId}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ phone: normalizedPhone, message }),
  });

  const responseBody = await response.text();
  console.log(`validade-alert: W-API response for ${normalizedPhone}`, response.status, responseBody);

  if (!response.ok) {
    console.error(`validade-alert: W-API error for ${normalizedPhone}`, response.status, responseBody);
    return false;
  }

  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date().toISOString().slice(0, 10);

    // Find all restaurants that have validade alerts enabled
    const { data: settings, error: settingsError } = await supabase
      .from("restaurant_settings")
      .select(`
        restaurant_id,
        validade_responsavel_nome,
        validade_responsavel_whatsapp,
        validade_notificacoes_ativas,
        restaurants!inner ( id, name )
      `)
      .eq("validade_notificacoes_ativas", true)
      .not("validade_responsavel_whatsapp", "is", null);

    if (settingsError) {
      throw new Error(`Failed to fetch alert settings: ${settingsError.message}`);
    }

    const alertSettings = (settings ?? []).map((s: Record<string, unknown>) => ({
      restaurant_id: s.restaurant_id as string,
      restaurant_name: (s.restaurants as Record<string, unknown>).name as string,
      responsavel_nome: s.validade_responsavel_nome as string | null,
      responsavel_whatsapp: s.validade_responsavel_whatsapp as string | null,
    })) as AlertSettings[];

    const results: { restaurant_id: string; sent: boolean; count: number; reason?: string }[] = [];

    for (const cfg of alertSettings) {
      if (!cfg.responsavel_whatsapp) {
        results.push({ restaurant_id: cfg.restaurant_id, sent: false, count: 0, reason: "No WhatsApp number" });
        continue;
      }

      // Fetch etiqueta_registros expiring today, still active
      const { data: expiring, error: expiringError } = await supabase
        .from("etiqueta_registros")
        .select("produto, data_validade")
        .eq("restaurant_id", cfg.restaurant_id)
        .eq("status", "ativo")
        .eq("data_validade", today);

      if (expiringError) {
        console.error(`validade-alert: failed to fetch expiring etiquetas for ${cfg.restaurant_id}`, expiringError.message);
        results.push({ restaurant_id: cfg.restaurant_id, sent: false, count: 0, reason: expiringError.message });
        continue;
      }

      const produtos = (expiring ?? []) as ExpiringProduct[];

      if (produtos.length === 0) {
        results.push({ restaurant_id: cfg.restaurant_id, sent: false, count: 0, reason: "No products expiring today" });
        continue;
      }

      const primeiroNome = (cfg.responsavel_nome || "Responsável").trim().split(/\s+/)[0] || "Responsável";
      const lista = produtos.map(p => `• ${p.produto}`).join("\n");
      const message = `*Gula Etiquetas - Alerta de Validade*\n\nOlá ${primeiroNome}!\n\nOs seguintes produtos vencem HOJE e precisam de atenção:\n\n${lista}\n\nAcesse o Controle de Validade para dar saída.`;

      const sent = await sendWhatsApp(cfg.responsavel_whatsapp, message);
      results.push({ restaurant_id: cfg.restaurant_id, sent, count: produtos.length });
    }

    return new Response(
      JSON.stringify({
        processed: alertSettings.length,
        sent: results.filter((r) => r.sent).length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("validade-alert error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
