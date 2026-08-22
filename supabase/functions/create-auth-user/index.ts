import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // GET — list super admins
  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("super_admins")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return json({ error: error.message }, 500);
    return json({ users: data });
  }

  // POST — create new super admin user
  if (req.method === "POST") {
    let body: { email?: string; password?: string };
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

    const { email, password } = body;
    if (!email || !password) return json({ error: "email and password are required" }, 400);
    if (password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

    // Create in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      // Handle duplicate email gracefully
      if (authError.message.toLowerCase().includes("already") || authError.message.toLowerCase().includes("exists")) {
        return json({ error: "Este e-mail já está cadastrado." }, 400);
      }
      return json({ error: authError.message }, 400);
    }

    // Record in super_admins table
    await supabaseAdmin.from("super_admins").upsert({ email }, { onConflict: "email" });

    return json({ user: { id: authData.user.id, email: authData.user.email, created_at: authData.user.created_at } });
  }

  // DELETE — remove super admin (by email in body)
  if (req.method === "DELETE") {
    let body: { email?: string; user_id?: string };
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

    const { email, user_id } = body;
    if (!email && !user_id) return json({ error: "email or user_id required" }, 400);

    if (user_id) {
      await supabaseAdmin.auth.admin.deleteUser(user_id);
    }
    if (email) {
      await supabaseAdmin.from("super_admins").delete().eq("email", email);
    }

    return json({ success: true });
  }

  return json({ error: "Method not allowed" }, 405);
});
