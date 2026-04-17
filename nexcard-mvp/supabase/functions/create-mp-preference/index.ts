import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const log = (level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) => {
  console.log(JSON.stringify({ level, event, data, ts: new Date().toISOString() }));
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const text = await req.text();
    const { orderId, items, customerEmail, totalCents } = JSON.parse(text);

    if (!orderId) {
      log('warn', 'missing_order_id');
      return new Response(
        JSON.stringify({ error: 'orderId es requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!items || items.length === 0) {
      log('warn', 'empty_items', { order_id: orderId });
      return new Response(
        JSON.stringify({ error: 'items no puede estar vacío' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');

    if (!MP_ACCESS_TOKEN) throw new Error('MP_ACCESS_TOKEN no configurado');

    log('info', 'creating_preference', { order_id: orderId, total_cents: totalCents });

    const preference = {
      items: items.map((item: any) => ({
        id: item.product_id,
        title: item.product_name || 'NexCard Pack',
        quantity: Number(item.quantity),
        unit_price: Math.round(item.unit_price_cents),
        currency_id: 'CLP',
      })),
      payer: {
        email: customerEmail,
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
    log('error', 'create_preference_exception', { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
