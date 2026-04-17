import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const log = (level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) => {
  console.log(JSON.stringify({ level, event, data, ts: new Date().toISOString() }));
};

const CARRIER_NAMES: Record<string, string> = {
  blueexpress: 'BlueExpress',
  chilexpress: 'Chilexpress',
  starken: 'Starken',
  correos: 'Correos de Chile',
  dhl: 'DHL',
  fedex: 'FedEx',
  manual: 'Courier',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const RESEND_API_KEY           = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const APP_URL                  = Deno.env.get('APP_URL') || 'https://nexcard.cl';

    if (!RESEND_API_KEY) {
      log('error', 'missing_resend_key', {});
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY no configurado' }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const orderId: string = body.order_id;

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'order_id requerido' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, folio, customer_name, customer_email, carrier, tracking_code, delivery_token, delivery_address, amount_cents')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      log('warn', 'order_not_found', { order_id: orderId });
      return new Response(JSON.stringify({ error: 'Orden no encontrada' }), {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (!order.customer_email) {
      log('warn', 'no_customer_email', { order_id: orderId });
      return new Response(JSON.stringify({ error: 'La orden no tiene email de cliente' }), {
        status: 422,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const carrierName   = CARRIER_NAMES[order.carrier] || order.carrier || 'Courier';
    const trackingUrl   = `${APP_URL}/seguimiento/${orderId}`;
    const confirmUrl    = `${APP_URL}/confirmar/${orderId}/${order.delivery_token}`;
    const shortOrderId  = String(orderId).slice(0, 8).toUpperCase();
    const folio         = order.folio || null;

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06)">

    <div style="background:#09090b;padding:32px 40px;text-align:center">
      <p style="margin:0;color:#10B981;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase">NexCard</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:900">¡Tu tarjeta está en camino!</h1>
    </div>

    <div style="padding:32px 40px">
      <p style="color:#52525b;font-size:15px;line-height:1.6">
        Hola <strong style="color:#09090b">${order.customer_name}</strong>,<br>
        tu pedido <strong style="color:#09090b">${folio || '#' + shortOrderId}</strong> ya fue despachado y está en camino contigo.
      </p>

      <div style="background:#f4f4f5;border-radius:16px;padding:20px 24px;margin:24px 0">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:6px 0;color:#71717a;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Courier</td>
            <td style="padding:6px 0;color:#09090b;font-size:14px;font-weight:900;text-align:right">${carrierName}</td>
          </tr>
          ${order.tracking_code ? `
          <tr>
            <td style="padding:6px 0;color:#71717a;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Código</td>
            <td style="padding:6px 0;color:#09090b;font-size:14px;font-weight:900;text-align:right;font-family:monospace">${order.tracking_code}</td>
          </tr>` : ''}
          ${order.delivery_address ? `
          <tr>
            <td style="padding:6px 0;color:#71717a;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Dirección</td>
            <td style="padding:6px 0;color:#09090b;font-size:13px;font-weight:600;text-align:right">${order.delivery_address}</td>
          </tr>` : ''}
        </table>
      </div>

      <div style="text-align:center;margin:28px 0">
        <a href="${trackingUrl}" style="display:inline-block;background:#10B981;color:#fff;font-size:14px;font-weight:900;text-decoration:none;padding:14px 32px;border-radius:100px">
          Seguir mi pedido →
        </a>
      </div>

      <div style="border:1.5px solid #e4e4e7;border-radius:16px;padding:16px 20px;margin-top:24px">
        <p style="margin:0 0 8px;color:#52525b;font-size:13px;font-weight:700">¿Llegó tu tarjeta?</p>
        <p style="margin:0 0 12px;color:#71717a;font-size:13px;line-height:1.5">
          Una vez que la recibas, confírmanos la entrega para completar la activación de tu tarjeta NexCard.
        </p>
        <a href="${confirmUrl}" style="color:#10B981;font-size:13px;font-weight:900;text-decoration:none">
          Confirmar que la recibí ✓
        </a>
      </div>
    </div>

    <div style="padding:20px 40px;border-top:1px solid #f4f4f5;text-align:center">
      <p style="margin:0;color:#a1a1aa;font-size:11px">NexCard · nexcard.cl · hola@nexcard.cl</p>
    </div>
  </div>
</body>
</html>`;

    const resendPayload = {
      from: 'NexCard <hola@nexcard.cl>',
      to: [order.customer_email],
      subject: `Tu tarjeta NexCard está en camino — ${folio || '#' + shortOrderId} · ${carrierName}`,
      html,
    };

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      log('error', 'resend_shipping_email_failed', { order_id: orderId, resend_error: resendData });
      return new Response(JSON.stringify({ success: false, error: resendData }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    log('info', 'shipping_email_sent', { order_id: orderId, resend_id: resendData.id, customer_email: order.customer_email });

    return new Response(JSON.stringify({ success: true, resend_id: resendData.id }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    log('error', 'send_shipping_notification_exception', { message: err.message });
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
