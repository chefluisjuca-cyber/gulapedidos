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

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "";
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // ── REGISTER: create a new print agent and return a token ──────
    if (action === "register") {
      const { restaurantId, machineName, version } = body;
      if (!restaurantId) {
        return json({ error: "restaurantId is required" }, 400);
      }
      const agentToken = crypto.randomUUID() + crypto.randomUUID();
      const { data, error } = await supabase
        .from("print_agents")
        .insert({
          restaurant_id: restaurantId,
          agent_token: agentToken,
          machine_name: machineName ?? null,
          version: version ?? null,
          status: "connected",
          last_seen_at: new Date().toISOString(),
        })
        .select("id, agent_token")
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ agentId: data.id, agentToken: data.agent_token });
    }

    // ── All subsequent actions require agentToken ────────────────
    const agentToken = req.headers.get("X-Agent-Token") ?? body.agentToken;
    if (!agentToken) {
      return json({ error: "agentToken is required" }, 401);
    }

    const { data: agent, error: agentErr } = await supabase
      .from("print_agents")
      .select("id, restaurant_id, status")
      .eq("agent_token", agentToken)
      .single();
    if (agentErr || !agent) {
      return json({ error: "invalid agent token" }, 403);
    }

    // Update heartbeat on every authenticated request
    await supabase
      .from("print_agents")
      .update({ last_seen_at: new Date().toISOString(), status: "connected" })
      .eq("id", agent.id);

    // ── HEARTBEAT ─────────────────────────────────────────────────
    if (action === "heartbeat") {
      const { machineName, version, printers } = body;
      const update: Record<string, unknown> = {
        last_seen_at: new Date().toISOString(),
        status: "connected",
      };
      if (machineName) update.machine_name = machineName;
      if (version) update.version = version;
      await supabase.from("print_agents").update(update).eq("id", agent.id);

      // If the agent reports its detected printers, upsert them
      if (Array.isArray(printers) && printers.length > 0) {
        for (const p of printers) {
          // Check if a printer with this name+sector already exists for this restaurant
          const { data: existing } = await supabase
            .from("printers")
            .select("id")
            .eq("restaurant_id", agent.restaurant_id)
            .eq("printer_name", p.name)
            .maybeSingle();

          if (!existing) {
            await supabase.from("printers").insert({
              restaurant_id: agent.restaurant_id,
              agent_id: agent.id,
              printer_name: p.name,
              sector: p.sector ?? "caixa",
              paper_width: p.paperWidth ?? 80,
              status: p.status ?? "online",
            });
          } else {
            await supabase
              .from("printers")
              .update({ status: p.status ?? "online", agent_id: agent.id })
              .eq("id", existing.id);
          }
        }
      }

      // Mark agent as disconnected if not seen in 60s (checked on next poll)
      return json({ ok: true });
    }

    // ── POLL: agent fetches pending print jobs ─────────────────────
    if (action === "poll") {
      // Get printers linked to this agent
      const { data: agentPrinters } = await supabase
        .from("printers")
        .select("id, sector, printer_name, paper_width")
        .eq("restaurant_id", agent.restaurant_id)
        .eq("agent_id", agent.id);

      if (!agentPrinters || agentPrinters.length === 0) {
        return json({ jobs: [] });
      }

      const printerIds = agentPrinters.map((p) => p.id);

      // Fetch pending jobs for this agent's printers
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

      // Mark jobs as "printing" to prevent re-pickup by duplicate polls
      const jobIds = jobs.map((j) => j.id);
      await supabase
        .from("print_jobs")
        .update({ status: "printing", attempts: supabase.rpc ? undefined : undefined, updated_at: new Date().toISOString() })
        .in("id", jobIds);

      // Enrich each job with printer info
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
        // Increment attempts; if under max, requeue as pending; else mark failed
        const { data: job } = await supabase
          .from("print_jobs")
          .select("attempts, max_attempts")
          .eq("id", jobId)
          .single();

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

      const idempotencyKey = `test-${agent.restaurant_id}-${printerId}-${Date.now()}`;
      const { data, error } = await supabase
        .from("print_jobs")
        .insert({
          restaurant_id: agent.restaurant_id,
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
      await supabase
        .from("print_agents")
        .update({ status: "disconnected", updated_at: new Date().toISOString() })
        .eq("id", agent.id);
      return json({ ok: true });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return json({ error: msg }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
