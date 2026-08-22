import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// iFood event type → our status mapping
const STATUS_MAP: Record<string, string> = {
  PLACED:          "PLACED",
  CONFIRMED:       "CONFIRMED",
  READY_TO_PICKUP: "CONFIRMED",
  DISPATCHED:      "DISPATCHED",
  CONCLUDED:       "DELIVERED",
  DELIVERED:       "DELIVERED",
  CANCELLATION_REQUESTED: "PLACED",
  CANCELLED:       "CANCELLED",
  // New API event names
  "ORDER_STATUS_UPDATE": "PLACED",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Parse body
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // ── Resolve restaurant via iFood Client ID in the Authorization header
    // iFood sends a Bearer token that corresponds to the client_id/secret pair
    // registered by each restaurant. We look up the restaurant by matching the
    // ifood_client_id stored in delivery_settings.
    //
    // The payload always includes the `merchantId` (iFood's identifier for the
    // restaurant). We use that to look up the restaurant in our database.
    const merchantId = (payload.merchantId as string | undefined)
      ?? (payload.restaurant as Record<string, string> | undefined)?.id
      ?? null;

    // Determine restaurant_id — first try merchantId lookup, then fall back to
    // a query param (?restaurant_id=) for debugging/testing purposes.
    let restaurantId: string | null = null;

    if (merchantId) {
      const { data: ds } = await supabase
        .from("delivery_settings")
        .select("restaurant_id")
        .eq("ifood_merchant_id", merchantId)
        .maybeSingle();
      if (ds) restaurantId = ds.restaurant_id;
    }

    // Fallback: query string ?restaurant_id=<uuid> (useful for sandbox tests)
    if (!restaurantId) {
      const url = new URL(req.url);
      restaurantId = url.searchParams.get("restaurant_id");
    }

    if (!restaurantId) {
      // Log the attempt but respond 200 so iFood doesn't retry
      console.warn("ifood-webhook: could not resolve restaurant_id", { merchantId, payload });
      return json({ received: true, warning: "restaurant not mapped" });
    }

    // ── Handle batch event arrays (iFood v3 sends events[])
    const events: Record<string, unknown>[] = Array.isArray(payload.events)
      ? (payload.events as Record<string, unknown>[])
      : [payload];

    for (const event of events) {
      const ifoodOrderId =
        (event.orderId as string | undefined) ??
        (event.id as string | undefined) ??
        (payload.orderId as string | undefined) ??
        null;

      if (!ifoodOrderId) continue;

      // Map event code → our status
      const eventCode =
        (event.code as string | undefined) ??
        (event.status as string | undefined) ??
        "PLACED";
      const status = STATUS_MAP[eventCode] ?? "PLACED";

      // If this is a new order (PLACED), try to fetch full details from the payload
      const orderPayload = (event.fullCode === "PLACED" || eventCode === "PLACED" || !event.code)
        ? (payload.order as Record<string, unknown> | undefined) ?? payload
        : null;

      const customer = (orderPayload?.customer as Record<string, unknown> | undefined) ?? null;
      const displayId =
        (orderPayload?.displayId as string | undefined) ??
        (payload.displayId as string | undefined) ??
        null;
      const customerName =
        (customer?.name as string | undefined) ??
        (payload.customerName as string | undefined) ??
        null;

      // Address
      const delivery = (orderPayload?.delivery as Record<string, unknown> | undefined) ?? null;
      const addr = (delivery?.deliveryAddress as Record<string, unknown> | undefined)
        ?? (orderPayload?.deliveryAddress as Record<string, unknown> | undefined)
        ?? null;

      const coordinates = (addr?.coordinates as Record<string, unknown> | undefined) ?? null;
      const latitude = coordinates
        ? parseFloat(String(coordinates.latitude ?? "")) || null
        : null;
      const longitude = coordinates
        ? parseFloat(String(coordinates.longitude ?? "")) || null
        : null;

      const row = {
        ifood_order_id: ifoodOrderId,
        restaurant_id: restaurantId,
        status,
        ...(customerName !== null && { customer_name: customerName }),
        ...(displayId !== null && { display_id: displayId }),
        ...(addr !== null && {
          street: (addr.streetName as string | undefined) ?? (addr.street as string | undefined) ?? null,
          number: (addr.streetNumber as string | undefined) ?? (addr.number as string | undefined) ?? null,
          neighborhood: (addr.neighborhood as string | undefined) ?? null,
          complement: (addr.complement as string | undefined) ?? null,
          postal_code: (addr.postalCode as string | undefined) ?? null,
          latitude,
          longitude,
        }),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("ifood_orders_integration")
        .upsert(row, { onConflict: "ifood_order_id,restaurant_id" });

      if (error) {
        console.error("ifood-webhook: upsert error", error.message, { ifoodOrderId, status });
      }
    }

    // iFood expects HTTP 200 — always respond success so it stops retrying
    return json({ received: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("ifood-webhook: unhandled error", msg);
    // Still return 200 to prevent iFood infinite retries on transient errors
    return json({ received: true, error: msg });
  }
});
