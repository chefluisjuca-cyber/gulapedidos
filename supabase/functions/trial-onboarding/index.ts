import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TrialRestaurant {
  id: string;
  name: string;
  phone: string | null;
  slug: string;
  created_at: string;
  trial_ends_at: string | null;
  whatsapp_step: number;
}

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const apiKey = (Deno.env.get("WHATSAPP_API_KEY") || "").trim();
  const instanceId = (Deno.env.get("WHATSAPP_INSTANCE_ID") || "").trim();

  if (!apiKey || !instanceId) {
    console.error("trial-onboarding: WHATSAPP_API_KEY or WHATSAPP_INSTANCE_ID not configured");
    return false;
  }

  const digitsOnly = phone.replace(/\D/g, "");
  const normalizedPhone = digitsOnly.length <= 11 ? `55${digitsOnly}` : digitsOnly;
  const endpoint = `https://api.w-api.app/v1/message/send-text?instanceId=${instanceId}`;

  console.log("trial-onboarding: Chave utilizada final:", apiKey.slice(-4));

  console.log(`trial-onboarding: sending WhatsApp to ${normalizedPhone} via ${endpoint}`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ phone: normalizedPhone, message }),
  });

  const responseBody = await response.text();
  console.log(`trial-onboarding: W-API response for ${normalizedPhone}`, response.status, responseBody);

  if (!response.ok) {
    console.error(`trial-onboarding: W-API error for ${normalizedPhone}`, response.status, responseBody);
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

    const linkCheckout = Deno.env.get("LINK_CHECKOUT_PLANOS") || "https://gulapedidos.com.br/#planos";

    const now = new Date();

    // Fetch all active-trial restaurants with a phone number
    const { data: restaurants, error } = await supabase
      .from("restaurants")
      .select("id, name, phone, slug, created_at, trial_ends_at, whatsapp_step")
      .eq("trial_status", "active")
      .not("phone", "is", null)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch trial restaurants: ${error.message}`);
    }

    const trialRestaurants = (restaurants ?? []) as TrialRestaurant[];
    const results: { restaurant_id: string; step: number; sent: boolean; reason?: string }[] = [];

    for (const restaurant of trialRestaurants) {
      const createdAt = new Date(restaurant.created_at);
      const daysSinceCreated = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      let stepToSend = 0;
      let message = "";

      // Determine which reminder to send based on days since creation and current step.
      // Step 1 (welcome) is sent immediately at signup, so we only handle steps 2 and 3 here.
      if (daysSinceCreated >= 3 && daysSinceCreated < 6 && restaurant.whatsapp_step < 2) {
        stepToSend = 2;
        message = `Oi, ${restaurant.name}! Passando pra lembrar que seu teste grátis do Gula está valendo. ⏳

Preparamos vídeos diretos ao ponto para te ajudar a configurar tudo sem complicação.
🎥 Acesse nossa central de tutoriais: https://gulapedidos.com.br/tutoriais

Aproveite para deixar seu sistema rodando!`;
      } else if (daysSinceCreated >= 6 && restaurant.whatsapp_step < 3) {
        stepToSend = 3;
        message = `Fala, ${restaurant.name}! Amanhã é o último dia do seu teste grátis no Gula. ⚠️

Para continuar usando o sistema sem interrupções, escolha o seu plano direto no link abaixo:
👉 Garantir assinatura: ${linkCheckout}

(Dica: No plano anual você garante o maior desconto mensal).`;
      }

      if (stepToSend === 0) {
        continue;
      }

      const phone = restaurant.phone!;
      const sent = await sendWhatsApp(phone, message);

      if (sent) {
        // Update whatsapp_step
        const { error: updateError } = await supabase
          .from("restaurants")
          .update({ whatsapp_step: stepToSend })
          .eq("id", restaurant.id);

        if (updateError) {
          console.error(`trial-onboarding: failed to update whatsapp_step for ${restaurant.id}`, updateError.message);
        }
      }

      results.push({
        restaurant_id: restaurant.id,
        step: stepToSend,
        sent,
        reason: sent ? undefined : "WhatsApp API error",
      });
    }

    // Check for expired trials (trial_ends_at < now and still active)
    const { error: expireError } = await supabase
      .from("restaurants")
      .update({ trial_status: "expired" })
      .eq("trial_status", "active")
      .lt("trial_ends_at", now.toISOString());

    if (expireError) {
      console.error("trial-onboarding: failed to expire trials", expireError.message);
    }

    return new Response(
      JSON.stringify({
        processed: trialRestaurants.length,
        sent: results.filter((r) => r.sent).length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("trial-onboarding error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
