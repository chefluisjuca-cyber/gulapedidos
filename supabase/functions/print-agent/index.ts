import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Agent-Token",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "";
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // ── LINK: validate API key and return restaurant_id ─────────────
    if (action === "link") {
      const rawKey = body.apiKey ?? body.linkCode ?? body.code ?? body.key;
      if (!rawKey) {
        return json({ error: "Chave de API é obrigatória." }, 400);
      }
      const apiKey = String(rawKey).trim();
      if (apiKey.length < 10) {
        return json({ error: "Chave de API inválida." }, 400);
      }

      const { data: restaurant, error: restErr } = await supabase
        .from("restaurants")
        .select("id, name, print_agent_api_key")
        .eq("print_agent_api_key", apiKey)
        .maybeSingle();

      if (restErr) {
        console.error("[link] Supabase query error:", JSON.stringify(restErr));
        return json({ error: `Erro no banco: ${restErr.message}` }, 500);
      }
      if (!restaurant) {
        console.error("[link] No restaurant found for api_key:", apiKey.slice(0, 8) + "...");
        return json({ error: "Chave de API inválida. Verifique a chave no painel web." }, 404);
      }

      console.log("[link] Successfully authenticated restaurant:", restaurant.id, restaurant.name);
      return json({
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        apiKey: restaurant.print_agent_api_key,
      });
    }

    // ── All subsequent actions require X-Agent-Token (the API key) ──
    const apiKey = req.headers.get("X-Agent-Token") ?? body.apiKey;
    if (!apiKey) {
      return json({ error: "apiKey is required" }, 401);
    }

    const { data: restaurant, error: restErr } = await supabase
      .from("restaurants")
      .select("id, name")
      .eq("print_agent_api_key", apiKey.trim())
      .maybeSingle();

    if (restErr || !restaurant) {
      console.error("[auth] Invalid API key:", apiKey.slice(0, 8) + "...");
      return json({ error: "invalid api key" }, 403);
    }

    const restaurantId = restaurant.id;

    // ── SAVE-CONFIG: persist selected printer names to the restaurant row ──
    if (action === "save-config") {
      const { caixaPrinter, cozinhaPrinter, samePrinter } = body;
      const now = new Date().toISOString();
      const { error: cfgErr } = await supabase
        .from("restaurants")
        .update({
          cashier_printer: caixaPrinter ?? null,
          kitchen_printer: cozinhaPrinter ?? null,
          same_printer: samePrinter ?? false,
          is_connected: true,
          last_seen: now,
          updated_at: now,
        })
        .eq("id", restaurantId);
      if (cfgErr) {
        console.error("[save-config] update error:", JSON.stringify(cfgErr));
        return json({ error: cfgErr.message }, 500);
      }
      console.log("[save-config] Saved printer config for restaurant", restaurantId);
      return json({ ok: true });
    }

    // ── HEARTBEAT ─────────────────────────────────────────────────
    if (action === "heartbeat") {
      const { machineName, version, printers } = body;

      // Upsert a print_agents row for this restaurant (one per API key)
      const { data: agent, error: agentErr } = await supabase
        .from("print_agents")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

      const now = new Date().toISOString();
      const update: Record<string, unknown> = {
        last_seen_at: now,
        status: "connected",
      };
      if (machineName) update.machine_name = machineName;
      if (version) update.version = version;

      if (agentErr) {
        console.error("[heartbeat] agent lookup error:", JSON.stringify(agentErr));
      }

      let agentId: string;

      if (agent) {
        await supabase.from("print_agents").update(update).eq("id", agent.id);
        agentId = agent.id;
      } else {
        const { data: newAgent, error: insertErr } = await supabase
          .from("print_agents")
          .insert({
            restaurant_id: restaurantId,
            agent_token: apiKey.trim(),
            status: "connected",
            last_seen_at: now,
            machine_name: machineName ?? null,
            version: version ?? null,
          })
          .select("id")
          .single();
        if (insertErr) {
          console.error("[heartbeat] agent insert error:", JSON.stringify(insertErr));
          return json({ error: insertErr.message }, 500);
        }
        agentId = newAgent.id;
      }

      // Mark the restaurant as connected and update last_seen
      await supabase
        .from("restaurants")
        .update({ is_connected: true, last_seen: now, updated_at: now })
        .eq("id", restaurantId);

      // If the agent reports its detected printers, upsert them
      if (Array.isArray(printers) && printers.length > 0) {
        for (const p of printers) {
          const { data: existing } = await supabase
            .from("printers")
            .select("id")
            .eq("restaurant_id", restaurantId)
            .eq("printer_name", p.name)
            .maybeSingle();

          if (!existing) {
            await supabase.from("printers").insert({
              restaurant_id: restaurantId,
              agent_id: agentId,
              printer_name: p.name,
              sector: p.sector ?? "caixa",
              paper_width: p.paperWidth ?? 80,
              status: p.status ?? "online",
            });
          } else {
            await supabase
              .from("printers")
              .update({ status: p.status ?? "online", agent_id: agentId })
              .eq("id", existing.id);
          }
        }
      }

      return json({ ok: true, agentId });
    }

    // ── POLL: agent fetches pending print jobs ─────────────────────
    if (action === "poll") {
      const { data: agentPrinters } = await supabase
        .from("printers")
        .select("id, sector, printer_name, paper_width")
        .eq("restaurant_id", restaurantId);

      if (!agentPrinters || agentPrinters.length === 0) {
        return json({ jobs: [] });
      }

      const printerIds = agentPrinters.map((p) => p.id);

      const { data: jobs } = await supabase
        .from("print_jobs")
        .select("id, printer_id, sector, job_type, payload, attempts, max_attempts")
        .in("printer_id", printerIds)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(10);

      if (!jobs || jobs.length === 0) {
        return json({ jobs: [] });
      }

      const jobIds = jobs.map((j) => j.id);
      await supabase
        .from("print_jobs")
        .update({ status: "printing", updated_at: new Date().toISOString() })
        .in("id", jobIds);

      const enriched = jobs.map((job) => {
        const printer = agentPrinters.find((p) => p.id === job.printer_id);
        return {
          jobId: job.id,
          sector: job.sector,
          jobType: job.job_type,
          payload: job.payload,
          printerName: printer?.printer_name ?? "",
          paperWidth: printer?.paper_width ?? 80,
          attempts: job.attempts,
          maxAttempts: job.max_attempts,
        };
      });

      return json({ jobs: enriched });
    }

    // ── ACK: agent reports print result ───────────────────────────
    if (action === "ack") {
      const { jobId, success, error } = body;
      if (!jobId) return json({ error: "jobId is required" }, 400);

      if (success) {
        await supabase
          .from("print_jobs")
          .update({
            status: "printed",
            printed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      } else {
        const { data: job } = await supabase
          .from("print_jobs")
          .select("attempts, max_attempts")
          .eq("id", jobId)
          .maybeSingle();

        if (!job) return json({ error: "job not found" }, 404);

        const newAttempts = (job.attempts ?? 0) + 1;
        if (newAttempts >= (job.max_attempts ?? 5)) {
          await supabase
            .from("print_jobs")
            .update({
              status: "failed",
              attempts: newAttempts,
              error_message: error ?? "max retries exceeded",
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId);
        } else {
          await supabase
            .from("print_jobs")
            .update({
              status: "pending",
              attempts: newAttempts,
              error_message: error ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId);
        }
      }
      return json({ ok: true });
    }

    // ── TEST: create a test print job ──────────────────────────────
    if (action === "test") {
      const { printerId, sector } = body;
      if (!printerId) return json({ error: "printerId is required" }, 400);

      const idempotencyKey = `test-${restaurantId}-${printerId}-${Date.now()}`;
      const { data, error } = await supabase
        .from("print_jobs")
        .insert({
          restaurant_id: restaurantId,
          printer_id: printerId,
          sector: sector ?? "caixa",
          job_type: "test",
          payload: { message: "Teste de impressao - Gula Print Agent" },
          idempotency_key: idempotencyKey,
          status: "pending",
        })
        .select("id")
        .single();

      if (error) return json({ error: error.message }, 500);
      return json({ jobId: data.id, ok: true });
    }

    // ── UNREGISTER: disconnect agent ──────────────────────────────
    if (action === "unregister") {
      const now = new Date().toISOString();
      await supabase
        .from("print_agents")
        .update({ status: "disconnected", updated_at: now })
        .eq("restaurant_id", restaurantId);
      await supabase
        .from("restaurants")
        .update({ is_connected: false, updated_at: now })
        .eq("id", restaurantId);
      return json({ ok: true });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[print-agent] Unhandled error:", msg);
    return json({ error: msg }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
