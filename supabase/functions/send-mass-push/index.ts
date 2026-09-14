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
    const { restaurant_id, message } = await req.json();

    if (!restaurant_id || !message) {
      return new Response(
        JSON.stringify({ error: "restaurant_id and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get restaurant name and slug for notification title and URL
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("name, slug")
      .eq("id", restaurant_id)
      .maybeSingle();

    if (!restaurant) {
      return new Response(
        JSON.stringify({ error: "Restaurant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch all active push subscriptions for this restaurant
    const { data: leads, error: leadsError } = await supabase
      .from("feedback_leads")
      .select("id, push_subscription, push_enabled")
      .eq("restaurant_id", restaurant_id)
      .eq("push_enabled", true)
      .not("push_subscription", "is", null);

    if (leadsError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch leads" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, failed: 0, message: "No leads with push enabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@gula.com.br";

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Import web-push library
    const webPush = await import("npm:web-push@3.6.7");

    webPush.setVapidDetails(
      vapidSubject,
      vapidPublicKey,
      vapidPrivateKey,
    );

    const notificationTitle = restaurant.name;
    const notificationUrl = `${Deno.env.get("SUPABASE_URL")?.replace(/\.supabase\.co\/?$/, "") ?? ""}/${restaurant.slug}`;

    let sent = 0;
    let failed = 0;
    const disabledLeadIds: string[] = [];

    const payload = JSON.stringify({
      title: notificationTitle,
      body: message,
      url: notificationUrl,
      icon: "/print-agent-icon.webp",
      badge: "/print-agent-icon.webp",
    });

    // Send pushes in parallel batches
    const batchSize = 10;
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (lead) => {
          const sub = lead.push_subscription as {
            endpoint: string;
            keys: { p256dh: string; auth: string };
          };
          if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
            failed++;
            return;
          }

          try {
            await webPush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.keys.p256dh,
                  auth: sub.keys.auth,
                },
              },
              payload,
            );
            sent++;
          } catch (err: unknown) {
            const statusCode = (err as { statusCode?: number }).statusCode;
            // 404 = subscription expired, 410 = subscription unsubscribed
            if (statusCode === 404 || statusCode === 410) {
              disabledLeadIds.push(lead.id);
            }
            failed++;
          }
        }),
      );
      void results;
    }

    // Disable leads with dead tokens
    if (disabledLeadIds.length > 0) {
      await supabase
        .from("feedback_leads")
        .update({ push_enabled: false })
        .in("id", disabledLeadIds);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        disabled: disabledLeadIds.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
