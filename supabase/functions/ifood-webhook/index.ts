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

// iFood event code → our internal status
const STATUS_MAP: Record<string, string> = {
  PLACED:                   "PLACED",
  CONFIRMED:                "CONFIRMED",
  READY_TO_PICKUP:          "CONFIRMED",
  DISPATCHED:               "DISPATCHED",
  CONCLUDED:                "DELIVERED",
  DELIVERED:                "DELIVERED",
  CANCELLATION_REQUESTED:   "PLACED",
  CANCELLED:                "CANCELLED",
  "ORDER_STATUS_UPDATE":    "PLACED",
};

// ── OAuth2 token management ──────────────────────────────────────────────────

interface TokenRow {
  access_token: string;
  expires_at: string;
}

async function getValidToken(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string,
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  // Check for a cached, non-expired token
  const { data: existing } = await supabase
    .from("ifood_tokens")
    .select("access_token, expires_at")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (existing) {
    const row = existing as TokenRow;
    const expiresAt = new Date(row.expires_at).getTime();
    // Use a 60-second buffer to avoid edge cases
    if (expiresAt - Date.now() > 60_000) {
      return row.access_token;
    }
  }

  // Request a new token from iFood
  const tokenUrl = "https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token";
  const body = new URLSearchParams({
    grantType: "client_credentials",
    clientId,
    clientSecret,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    console.error("ifood-webhook: OAuth token request failed", res.status, await res.text());
    return null;
  }

  const tokenData = await res.json();
  const accessToken = tokenData.accessToken as string | undefined;
  const expiresInSeconds = (tokenData.expiresIn as number | undefined) ?? 3600;

  if (!accessToken) {
    console.error("ifood-webhook: no accessToken in OAuth response");
    return null;
  }

  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  await supabase
    .from("ifood_tokens")
    .upsert(
      { restaurant_id: restaurantId, access_token: accessToken, expires_at: expiresAt },
      { onConflict: "restaurant_id" }
    );

  return accessToken;
}

// ── Fetch order details from iFood API ───────────────────────────────────────

interface IfoodDeliveryAddress {
  streetName?: string;
  streetNumber?: string;
  neighborhood?: string;
  city?: string;
  postalCode?: string;
  complement?: string;
  reference?: string;
  coordinates?: { latitude?: number; longitude?: number };
}

interface IfoodOrderDetail {
  delivery?: { deliveryAddress?: IfoodDeliveryAddress };
  customer?: { name?: string };
  displayId?: string;
}

async function fetchOrderDetails(
  accessToken: string,
  orderId: string
): Promise<IfoodOrderDetail | null> {
  const url = `https://merchant-api.ifood.com.br/order/v1.0/orders/${orderId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    console.error("ifood-webhook: order detail fetch failed", res.status, await res.text());
    return null;
  }

  return await res.json() as IfoodOrderDetail;
}

// ── Format address into a single string ──────────────────────────────────────

function formatAddress(addr: IfoodDeliveryAddress): string {
  const parts = [
    addr.streetName,
    addr.streetNumber ? `, ${addr.streetNumber}` : "",
    addr.complement ? ` (${addr.complement})` : "",
    addr.neighborhood ? ` - ${addr.neighborhood}` : "",
    addr.city ? `, ${addr.city}` : "",
    addr.postalCode ? ` · CEP ${addr.postalCode}` : "",
  ];
  return parts.join("").replace(/^,\s*/, "").trim();
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

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

  // Respond 200 immediately — iFood requires instant ack
  // We process the events but always return success
  try {
    const merchantId = (payload.merchantId as string | undefined)
      ?? (payload.restaurant as Record<string, string> | undefined)?.id
      ?? null;

    let restaurantId: string | null = null;
    let clientId: string | null = null;
    let clientSecret: string | null = null;

    if (merchantId) {
      const { data: ds } = await supabase
        .from("delivery_settings")
        .select("restaurant_id, ifood_client_id, ifood_client_secret")
        .eq("ifood_merchant_id", merchantId)
        .maybeSingle();
      if (ds) {
        restaurantId = ds.restaurant_id as string;
        clientId = ds.ifood_client_id as string | null;
        clientSecret = ds.ifood_client_secret as string | null;
      }
    }

    // Fallback: query string for debugging
    if (!restaurantId) {
      const url = new URL(req.url);
      restaurantId = url.searchParams.get("restaurant_id");
      if (restaurantId) {
        const { data: ds } = await supabase
          .from("delivery_settings")
          .select("ifood_client_id, ifood_client_secret")
          .eq("restaurant_id", restaurantId)
          .maybeSingle();
        if (ds) {
          clientId = ds.ifood_client_id as string | null;
          clientSecret = ds.ifood_client_secret as string | null;
        }
      }
    }

    if (!restaurantId) {
      console.warn("ifood-webhook: could not resolve restaurant_id", { merchantId });
      return json({ received: true, warning: "restaurant not mapped" });
    }

    // Handle batch event arrays
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

      const eventCode =
        (event.code as string | undefined) ??
        (event.status as string | undefined) ??
        "PLACED";
      const status = STATUS_MAP[eventCode] ?? "PLACED";

      // For PLACED events, fetch full order details to extract the delivery address
      let addr: IfoodDeliveryAddress | null = null;
      let customerName: string | null = null;
      let displayId: string | null = null;
      let formattedAddress: string | null = null;
      let latitude: number | null = null;
      let longitude: number | null = null;

      if (eventCode === "PLACED" && clientId && clientSecret) {
        const token = await getValidToken(supabase, restaurantId, clientId, clientSecret);
        if (token) {
          const details = await fetchOrderDetails(token, ifoodOrderId);
          if (details) {
            addr = details.delivery?.deliveryAddress ?? null;
            customerName = details.customer?.name ?? null;
            displayId = details.displayId ?? null;

            if (addr) {
              formattedAddress = formatAddress(addr);
              if (addr.coordinates) {
                latitude = addr.coordinates.latitude ?? null;
                longitude = addr.coordinates.longitude ?? null;
              }
            }
          }
        }
      }

      const row = {
        ifood_order_id: ifoodOrderId,
        restaurant_id: restaurantId,
        status,
        ...(customerName !== null && { customer_name: customerName }),
        ...(displayId !== null && { display_id: displayId }),
        ...(addr !== null && {
          street: addr.streetName ?? null,
          number: addr.streetNumber ?? null,
          neighborhood: addr.neighborhood ?? null,
          complement: addr.complement ?? null,
          postal_code: addr.postalCode ?? null,
          city: addr.city ?? null,
          reference: addr.reference ?? null,
          formatted_address: formattedAddress,
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

    return json({ received: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("ifood-webhook: unhandled error", msg);
    return json({ received: true, error: msg });
  }
});
