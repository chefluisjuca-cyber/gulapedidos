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

  let body: {
    name?: string;
    email?: string;
    password?: string;
    phone?: string;
    slug?: string;
    plan?: string;
  };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const phone = (body.phone ?? "").trim() || null;
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
    return json({ error: authError.message }, 400);
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
      modules,
      plan,
      trial_ends_at: trialEndsAt,
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
    return json({ error: dbError.message }, 500);
  }

  return json({
    success: true,
    restaurant: { id: restaurant.id, slug: restaurant.slug, name: restaurant.name },
    trial_ends_at: trialEndsAt,
  });
});
