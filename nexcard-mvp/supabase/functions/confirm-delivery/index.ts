import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.0";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const log = (level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) => {
  console.log(JSON.stringify({ level, event, data, ts: new Date().toISOString() }));
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.order_id || '').trim();
    const deliveryToken = String(body?.delivery_token || '').trim();

    if (!orderId || !deliveryToken) {
      return new Response(JSON.stringify({ error: 'order_id y delivery_token son requeridos' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, customer_name, fulfillment_status, delivered_at, delivery_confirmed_by, delivery_token, delivery_token_expires_at')
      .eq('id', orderId)
      .eq('delivery_token', deliveryToken)
      .maybeSingle();

    if (error || !order) {
      log('warn', 'delivery_confirm_order_not_found', { order_id: orderId, error: error?.message || null });
      return new Response(JSON.stringify({ status: 'invalid', error: 'Enlace inválido' }), {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (order.delivery_token_expires_at && new Date(order.delivery_token_expires_at).getTime() < Date.now()) {
      log('warn', 'delivery_confirm_token_expired', { order_id: orderId });
      return new Response(JSON.stringify({ status: 'expired', error: 'Este enlace expiró' }), {
        status: 410,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (order.delivered_at || order.delivery_confirmed_by) {
      return new Response(JSON.stringify({ status: 'already_confirmed', order }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (order.fulfillment_status !== 'shipped') {
      return new Response(JSON.stringify({ status: 'invalid_state', error: 'La orden no está en estado despachado' }), {
        status: 409,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const deliveredAt = new Date().toISOString();
    const { data: result, error: rpcError } = await supabase.rpc('confirm_order_delivery_by_token', {
      target_order_id: orderId,
      provided_delivery_token: deliveryToken,
      confirmed_by: 'customer',
    });

    if (rpcError) {
      log('error', 'delivery_confirm_update_failed', { order_id: orderId, error: rpcError.message });
      if (rpcError.message?.includes('expiró')) {
        return new Response(JSON.stringify({ status: 'expired', error: rpcError.message }), {
          status: 410,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      if (rpcError.message?.includes('despachado')) {
        return new Response(JSON.stringify({ status: 'invalid_state', error: rpcError.message }), {
          status: 409,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      throw rpcError;
    }

    if (result?.status === 'already_confirmed') {
      return new Response(JSON.stringify({ status: 'already_confirmed', order: result }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    log('info', 'delivery_confirmed', { order_id: orderId });
    return new Response(JSON.stringify({
      status: 'success',
      order: {
        ...order,
        fulfillment_status: 'delivered',
        delivered_at: result?.delivered_at || deliveredAt,
        delivery_confirmed_by: result?.delivery_confirmed_by || 'customer',
      },
    }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    log('error', 'confirm_delivery_exception', { message: err.message });
    return new Response(JSON.stringify({ status: 'error', error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
