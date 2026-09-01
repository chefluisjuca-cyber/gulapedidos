import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return `55${digits}`;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    let body: {
      name?: string;
      email?: string;
      password?: string;
      phone?: string;
      slug?: string;
      plan?: string;
    };
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const rawPhone = (body.phone ?? "").trim();
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    console.log("restaurant-signup: raw phone input:", rawPhone, "→ normalized:", phone);
    const requestedSlug = (body.slug ?? "").trim();
    const plan = (body.plan ?? "essencial").trim();

    if (!name) return json({ error: "Informe o nome do restaurante." }, 400);
    if (!email) return json({ error: "Informe o e-mail do responsável." }, 400);
    if (password.length < 6) return json({ error: "A senha deve ter pelo menos 6 caracteres." }, 400);

    const slug = slugify(requestedSlug || name);
    if (!slug) return json({ error: "Não foi possível gerar um slug válido." }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // 1. Check slug uniqueness first (cheap pre-flight)
    const { data: existing } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (existing) {
      return json({ error: "Este endereço (slug) já está em uso. Escolha outro." }, 409);
    }

    // 2. Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authError) {
      const msg = authError.message.toLowerCase();
      if (msg.includes("already") || msg.includes("exists")) {
        return json({ error: "Este e-mail já está cadastrado." }, 400);
      }
      return json({ error: `Falha ao criar usuário: ${authError.message}` }, 400);
    }

    // 3. Insert restaurant row with 7-day trial
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Map plan id to the modules it unlocks during the 7-day trial
    const PLAN_MODULES: Record<string, string[]> = {
      essencial: ["gula_pedidos"],
      pedidos_fidelidade: ["gula_pedidos", "gula_fidelidade"],
      pedidos_fidelidade_etiquetas: ["gula_pedidos", "gula_fidelidade", "gula_etiquetas"],
      gula_etiquetas_standalone: ["gula_etiquetas"],
    };
    const modules = PLAN_MODULES[plan] ?? PLAN_MODULES.essencial;

    const { data: restaurant, error: dbError } = await supabaseAdmin
      .from("restaurants")
      .insert({
        name,
        slug,
        owner_email: email,
        phone,
        status: "trial",
        trial_status: "active",
        modules,
        plan,
        trial_ends_at: trialEndsAt,
        whatsapp_step: 0,
      })
      .select("id, slug, name")
      .single();

    if (dbError) {
      // Best-effort cleanup of the orphaned auth user
      if (authData.user?.id) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      }
      const msg = dbError.message.toLowerCase();
      if (msg.includes("unique") || msg.includes("duplicate")) {
        return json({ error: "Este endereço (slug) já está em uso. Escolha outro." }, 409);
      }
      return json({ error: `Falha ao salvar restaurante: ${dbError.message}` }, 500);
    }

    // 4. Send WhatsApp welcome message (step 1) synchronously
    let welcomeSent = false;
    let wapiError: string | null = null;
    if (phone) {
      const linkPainel = "https://gulapedidos.com.br";
      const panelUrl = `${linkPainel}/${restaurant.slug}`;
      console.log("restaurant-signup: panel URL for welcome message:", panelUrl, "| linkPainel:", linkPainel, "| slug:", restaurant.slug);
      const welcomeMessage = `Fala, ${restaurant.name}! 🚀 Seja bem-vindo(a) ao Gula! Seu teste grátis de 7 dias tá liberado.

📲 Acesso ao painel: ${panelUrl}
🎥 Assista aos tutoriais completos de configuração aqui: https://gulapedidos.com.br/tutoriais

Dê o play no passo a passo e configure tudo rapidinho. Bom trabalho!`;

      const apiKey = (Deno.env.get("WHATSAPP_API_KEY") || "").trim();
      const instanceId = (Deno.env.get("WHATSAPP_INSTANCE_ID") || "").trim();

      console.log("restaurant-signup: phone check:", { phone, hasApiKey: !!apiKey, hasInstanceId: !!instanceId });
      console.log("restaurant-signup: Chave utilizada final:", apiKey.slice(-4));

      if (apiKey && instanceId) {
        try {
          const endpoint = `https://api.w-api.app/v1/message/send-text?instanceId=${instanceId}`;
          console.log("restaurant-signup: sending welcome WhatsApp to", phone, "via", endpoint);
          const waResponse = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ phone, message: welcomeMessage }),
          });

          const responseBody = await waResponse.text();
          console.log("restaurant-signup: W-API response status:", waResponse.status, "body:", responseBody);

          if (waResponse.ok) {
            welcomeSent = true;
            const { error: stepError } = await supabaseAdmin
              .from("restaurants")
              .update({ whatsapp_step: 1 })
              .eq("id", restaurant.id);
            if (stepError) {
              console.error("restaurant-signup: failed to update whatsapp_step to 1:", stepError.message);
            } else {
              console.log("restaurant-signup: whatsapp_step updated to 1 for restaurant", restaurant.id);
            }
          } else {
            wapiError = `W-API HTTP ${waResponse.status}: ${responseBody}`;
            console.error("restaurant-signup: W-API welcome message failed", waResponse.status, responseBody);
          }
        } catch (err) {
          wapiError = `W-API fetch error: ${err instanceof Error ? err.message : String(err)}`;
          console.error("restaurant-signup: welcome message fetch error:", wapiError);
        }
      } else {
        wapiError = "WHATSAPP_API_KEY or WHATSAPP_INSTANCE_ID not configured";
        console.warn("restaurant-signup:", wapiError, { apiKey: !!apiKey, instanceId: !!instanceId });
      }
    }

    return json({
      success: true,
      restaurant: { id: restaurant.id, slug: restaurant.slug, name: restaurant.name },
      trial_ends_at: trialEndsAt,
      welcome_message_sent: welcomeSent,
      ...(wapiError ? { wapi_error: wapiError } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("restaurant-signup: unhandled error:", msg, err instanceof Error ? err.stack : "");
    return json({ error: `Erro interno: ${msg}` }, 500);
  }
});
