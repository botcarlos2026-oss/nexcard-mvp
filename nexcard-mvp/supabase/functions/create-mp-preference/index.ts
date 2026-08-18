import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.0";
import { getCorsHeaders } from "../_shared/cors.ts";

const log = (level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) => {
  console.log(JSON.stringify({ level, event, data, ts: new Date().toISOString() }));
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const text = await req.text();
    const { orderId, clientCheckoutAttemptId, clientCheckoutFingerprint } = JSON.parse(text);

    if (!orderId) {
      log('warn', 'missing_order_id');
      return new Response(
        JSON.stringify({ error: 'orderId es requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!clientCheckoutAttemptId || !clientCheckoutFingerprint) {
      log('warn', 'missing_checkout_proof', { order_id: orderId });
      return new Response(
        JSON.stringify({ error: 'Falta prueba del intento de checkout' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!MP_ACCESS_TOKEN) throw new Error('MP_ACCESS_TOKEN no configurado');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase service role no configurado');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: withinLimit, error: rateLimitError } = await supabase.rpc('check_and_record_rate_limit', {
      p_bucket: 'create_mp_preference',
      p_key: orderId,
      p_max_count: 10,
      p_window_seconds: 300,
    });

    if (rateLimitError) {
      log('warn', 'rate_limit_check_failed', { order_id: orderId, error: rateLimitError.message });
    } else if (withinLimit === false) {
      log('warn', 'rate_limited', { order_id: orderId });
      return new Response(
        JSON.stringify({ error: 'Demasiados intentos de pago para esta orden. Intenta de nuevo en unos minutos.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_email, amount_cents, currency, payment_status, client_checkout_attempt_id, client_checkout_fingerprint')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      log('warn', 'order_not_found', { order_id: orderId, order_error: orderError?.message });
      return new Response(
        JSON.stringify({ error: 'Orden no encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (
      order.client_checkout_attempt_id !== clientCheckoutAttemptId
      || order.client_checkout_fingerprint !== clientCheckoutFingerprint
    ) {
      log('warn', 'checkout_proof_mismatch', { order_id: orderId });
      return new Response(
        JSON.stringify({ error: 'No autorizado para iniciar el pago de esta orden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['pending', 'failed'].includes(order.payment_status)) {
      log('warn', 'order_not_payable', { order_id: orderId, payment_status: order.payment_status });
      return new Response(
        JSON.stringify({ error: 'La orden no está disponible para generar un nuevo link de pago' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('product_id, quantity, unit_price_cents')
      .eq('order_id', orderId);

    if (itemsError || !orderItems?.length) {
      log('warn', 'order_items_missing', { order_id: orderId, items_error: itemsError?.message });
      return new Response(
        JSON.stringify({ error: 'La orden no tiene ítems válidos' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const productIds = [...new Set(orderItems.map((item: any) => item.product_id).filter(Boolean))];
    const { data: products } = await supabase
      .from('products')
      .select('id, name')
      .in('id', productIds);

    const productNameMap = Object.fromEntries((products || []).map((product: any) => [product.id, product.name]));
    const subtotal = orderItems.reduce(
      (sum: number, item: any) => sum + (Number(item.unit_price_cents) || 0) * (Number(item.quantity) || 0),
      0,
    );
    const totalUnits = orderItems.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
    const firstItem = orderItems[0];
    const finalTotal = Number(order.amount_cents) || 0;

    if (finalTotal <= 0 || finalTotal > subtotal) {
      log('error', 'order_total_mismatch', { order_id: orderId, order_amount: order.amount_cents, subtotal });
      return new Response(
        JSON.stringify({ error: 'La orden quedó desalineada. Revisa el total antes de cobrar.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const preferenceTitle = totalUnits <= 1
      ? (productNameMap[firstItem?.product_id] || 'NexCard Pack')
      : `Pedido NexCard (${totalUnits} ítems)`;

    log('info', 'creating_preference', { order_id: orderId, subtotal_cents: subtotal, total_cents: finalTotal });

    const preference = {
      items: [{
        id: orderId,
        title: preferenceTitle,
        quantity: 1,
        unit_price: Math.round(finalTotal),
        currency_id: order.currency || 'CLP',
      }],
      payer: {
        email: order.customer_email,
      },
      external_reference: orderId,
      back_urls: {
        success: `https://nexcard.cl?payment=success&order=${orderId}`,
        failure: `https://nexcard.cl?payment=failure&order=${orderId}`,
        pending: `https://nexcard.cl?payment=pending&order=${orderId}`,
      },
      auto_return: 'approved',
      notification_url: `https://ghiremuuyprohdqfrxsy.supabase.co/functions/v1/mp-webhook`,
      statement_descriptor: 'NEXCARD',
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });

    const data = await response.json();

    if (!data.init_point) {
      log('error', 'mp_preference_failed', { order_id: orderId, mp_response: data });
      throw new Error(`MP error: ${JSON.stringify(data)}`);
    }

    log('info', 'preference_created', { order_id: orderId, preference_id: data.id });

    return new Response(
      JSON.stringify({ init_point: data.init_point, preference_id: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    log('error', 'create_preference_exception', { message: error?.message || String(error), stack: error?.stack || null });
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
