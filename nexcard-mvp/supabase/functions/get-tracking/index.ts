import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const log = (level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) => {
  console.log(JSON.stringify({ level, event, data, ts: new Date().toISOString() }));
};

// ─── Normalized types ──────────────────────────────────────────────────────

interface TrackingEvent {
  timestamp: string;
  status: string;
  description: string;
  location?: string;
}

interface TrackingResult {
  carrier: string;
  tracking_code: string;
  current_status: string;
  estimated_delivery?: string;
  events: TrackingEvent[];
  recipient_name?: string;
}

// ─── BlueExpress adapter ───────────────────────────────────────────────────
// Docs: https://developers.bx.cl (requires business account credentials)
// Auth: Bearer token obtained via POST /auth/token with client_id + client_secret
// Endpoint: GET /tracking/shipments/{tracking_code}

async function fetchBlueExpress(trackingCode: string): Promise<TrackingResult> {
  const clientId     = Deno.env.get('BX_CLIENT_ID');
  const clientSecret = Deno.env.get('BX_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    log('warn', 'bx_credentials_missing', { tracking_code: trackingCode });
    // Return a graceful degraded response so the page still renders
    return {
      carrier: 'blueexpress',
      tracking_code: trackingCode,
      current_status: 'pending_credentials',
      events: [],
    };
  }

  // Step 1 — obtain OAuth token
  const tokenRes = await fetch('https://developers.bx.cl/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    log('error', 'bx_token_failed', { status: tokenRes.status, body });
    throw new Error('BlueExpress: error al obtener token de autenticación');
  }

  const { access_token } = await tokenRes.json();

  // Step 2 — fetch shipment status
  const trackRes = await fetch(
    `https://developers.bx.cl/tracking/shipments/${encodeURIComponent(trackingCode)}`,
    { headers: { Authorization: `Bearer ${access_token}` } },
  );

  if (!trackRes.ok) {
    const body = await trackRes.text();
    log('error', 'bx_tracking_failed', { status: trackRes.status, tracking_code: trackingCode, body });
    throw new Error(`BlueExpress: no se encontró el seguimiento para ${trackingCode}`);
  }

  const raw = await trackRes.json();
  log('info', 'bx_tracking_fetched', { tracking_code: trackingCode, status: raw?.status });

  // ─── Normalize BlueExpress response → TrackingResult ──────────────────
  // BlueExpress returns: { shipmentNumber, status, events: [{ date, time, description, location }] }
  const events: TrackingEvent[] = (raw.events || []).map((e: Record<string, string>) => ({
    timestamp: `${e.date}T${e.time || '00:00:00'}`,
    status: mapBxStatus(e.description),
    description: e.description,
    location: e.location || undefined,
  }));

  // Sort newest first
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    carrier: 'blueexpress',
    tracking_code: trackingCode,
    current_status: mapBxStatus(raw.status || ''),
    estimated_delivery: raw.estimatedDeliveryDate,
    recipient_name: raw.recipientName,
    events,
  };
}

function mapBxStatus(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('entregado') || s.includes('delivered'))         return 'delivered';
  if (s.includes('en tránsito') || s.includes('en camino'))       return 'in_transit';
  if (s.includes('en reparto') || s.includes('out for delivery')) return 'out_for_delivery';
  if (s.includes('recibido') || s.includes('ingresado'))          return 'received';
  if (s.includes('devuelto') || s.includes('returned'))           return 'returned';
  if (s.includes('no entregado') || s.includes('ausente'))        return 'failed_attempt';
  return 'unknown';
}

// ─── Future adapters (add here as carriers are onboarded) ─────────────────
// async function fetchChilexpress(code: string): Promise<TrackingResult> { ... }
// async function fetchStarken(code: string): Promise<TrackingResult>     { ... }

// ─── Dispatch ─────────────────────────────────────────────────────────────

async function getTracking(carrier: string, trackingCode: string): Promise<TrackingResult> {
  switch (carrier) {
    case 'blueexpress': return fetchBlueExpress(trackingCode);
    default:
      throw new Error(`Carrier "${carrier}" no soportado todavía`);
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const url        = new URL(req.url);
    const orderId    = url.searchParams.get('order_id');

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'order_id requerido' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load carrier + tracking_code from the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, carrier, tracking_code, fulfillment_status, customer_name, amount_cents, delivery_address')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      log('warn', 'order_not_found', { order_id: orderId });
      return new Response(JSON.stringify({ error: 'Orden no encontrada' }), {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (!order.carrier || !order.tracking_code) {
      return new Response(JSON.stringify({
        order_id: orderId,
        fulfillment_status: order.fulfillment_status,
        tracking_available: false,
        message: 'Esta orden aún no tiene código de seguimiento asignado.',
      }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    log('info', 'tracking_requested', { order_id: orderId, carrier: order.carrier, tracking_code: order.tracking_code });

    const result = await getTracking(order.carrier, order.tracking_code);

    return new Response(JSON.stringify({
      order_id: orderId,
      customer_name: order.customer_name,
      fulfillment_status: order.fulfillment_status,
      tracking_available: true,
      ...result,
    }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    log('error', 'get_tracking_exception', { message: err.message });
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
