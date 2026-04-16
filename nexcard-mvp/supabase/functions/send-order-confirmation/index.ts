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

    if (!text || text.trim() === '') {
      throw new Error('Body vacío');
    }

    const { order, items, card_customization } = JSON.parse(text);

    log('info', 'request_received', { order_id: order?.id });

    if (!order || !order.customer_email) {
      throw new Error('Datos de orden incompletos');
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY no configurada');

    const itemsHTML = (items || []).map((item: any) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0">${item.product_name || item.product_id || 'Producto'}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:center">${item.quantity || 1}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right">$${((item.unit_price_cents || 0) * (item.quantity || 1)).toLocaleString('es-CL')}</td>
      </tr>
    `).join('');

    const emailHTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:20px">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#09090B;padding:32px;text-align:center">
      <h1 style="color:white;margin:0;font-size:28px;font-weight:900">Nex<span style="color:#10B981">Card</span></h1>
    </div>
    <div style="padding:32px">
      <h2 style="color:#09090B;font-size:22px;margin:0 0 8px">¡Orden confirmada! 🎉</h2>
      <p style="color:#6b7280;margin:0 0 24px">Hola ${order.customer_name || 'Cliente'}, recibimos tu pedido correctamente.</p>
      <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-weight:700;text-transform:uppercase">Número de orden</p>
        <p style="margin:0;font-size:14px;font-weight:700;color:#09090B;font-family:monospace">${order.id}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <thead>
          <tr style="border-bottom:2px solid #f0f0f0">
            <th style="text-align:left;padding:8px 0;font-size:12px;color:#9ca3af;font-weight:700;text-transform:uppercase">Producto</th>
            <th style="text-align:center;padding:8px 0;font-size:12px;color:#9ca3af;font-weight:700;text-transform:uppercase">Qty</th>
            <th style="text-align:right;padding:8px 0;font-size:12px;color:#9ca3af;font-weight:700;text-transform:uppercase">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemsHTML}</tbody>
      </table>
      <div style="border-top:2px solid #09090B;padding-top:16px">
        <span style="font-weight:900;font-size:18px">Total: </span>
        <span style="font-weight:900;font-size:24px;color:#10B981">$${(order.amount_cents || 0).toLocaleString('es-CL')}</span>
      </div>
      <div style="margin-top:24px;padding:16px;background:#ecfdf5;border-radius:12px;border:1px solid #a7f3d0">
        <p style="margin:0;color:#065f46;font-size:14px">
          <strong>¿Qué sigue?</strong><br>
          Nos contactaremos contigo pronto para coordinar el despacho.
          Ante cualquier duda escríbenos a
          <a href="https://wa.me/56993183021" style="color:#10B981">WhatsApp</a>.
        </p>
      </div>
      ${(card_customization || order.card_customization) ? (() => {
        const c = card_customization || order.card_customization;
        const templateNames: Record<string, string> = { minimal: 'Minimalista', dark: 'Dark premium', corporate: 'Corporativo', colorful: 'Colorido' };
        const rows = [
          c.full_name ? `<tr><td style="padding:4px 8px 4px 0;color:#6b7280;font-size:13px;white-space:nowrap">Nombre</td><td style="padding:4px 0;font-size:13px;font-weight:600">${c.full_name}</td></tr>` : '',
          c.job_title ? `<tr><td style="padding:4px 8px 4px 0;color:#6b7280;font-size:13px;white-space:nowrap">Cargo</td><td style="padding:4px 0;font-size:13px;font-weight:600">${c.job_title}</td></tr>` : '',
          c.company ? `<tr><td style="padding:4px 8px 4px 0;color:#6b7280;font-size:13px;white-space:nowrap">Empresa</td><td style="padding:4px 0;font-size:13px;font-weight:600">${c.company}</td></tr>` : '',
          c.template ? `<tr><td style="padding:4px 8px 4px 0;color:#6b7280;font-size:13px;white-space:nowrap">Plantilla</td><td style="padding:4px 0;font-size:13px;font-weight:600">${templateNames[c.template] || c.template}</td></tr>` : '',
          c.primary_color ? `<tr><td style="padding:4px 8px 4px 0;color:#6b7280;font-size:13px;white-space:nowrap">Color</td><td style="padding:4px 0;font-size:13px;font-weight:600"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${c.primary_color};vertical-align:middle;margin-right:6px"></span>${c.primary_color}</td></tr>` : '',
          c.notes ? `<tr><td style="padding:4px 8px 4px 0;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top">Notas</td><td style="padding:4px 0;font-size:13px;font-weight:600">${c.notes}</td></tr>` : '',
        ].join('');
        return `<div style="margin-top:24px;padding:16px;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0">
          <p style="margin:0 0 12px;color:#065f46;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Tu tarjeta será personalizada con:</p>
          <table style="border-collapse:collapse">${rows}</table>
        </div>`;
      })() : ''}
    </div>
    <div style="background:#f9fafb;padding:24px;text-align:center;border-top:1px solid #f0f0f0">
      <p style="margin:0;color:#9ca3af;font-size:12px">© 2026 NexCard · nexcard.cl</p>
    </div>
  </div>
</body>
</html>`;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NexCard <hola@nexcard.cl>',
        to: [order.customer_email],
        subject: `✅ Orden confirmada #${order.id?.slice(0, 8).toUpperCase()}`,
        html: emailHTML,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      log('error', 'resend_customer_email_failed', { order_id: order.id, status: resendResponse.status, resend_error: resendData });
      return new Response(
        JSON.stringify({ success: false, error: resendData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log('info', 'customer_email_sent', { order_id: order.id, resend_id: resendData?.id });

    // Notificación interna
    const internalResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NexCard <hola@nexcard.cl>',
        to: ['carlos.alvarez.contreras@gmail.com'],
        subject: `🛒 Nueva orden — ${order.customer_name} $${(order.amount_cents || 0).toLocaleString('es-CL')}`,
        html: `<p><strong>${order.customer_name}</strong> — ${order.customer_email}</p><p>Total: $${(order.amount_cents || 0).toLocaleString('es-CL')} CLP</p><p>Método: ${order.payment_method}</p><a href="https://nexcard.cl/admin/orders">Ver en admin →</a>`,
      }),
    });

    const internalData = await internalResponse.json();

    if (!internalResponse.ok) {
      log('warn', 'resend_internal_email_failed', { order_id: order.id, status: internalResponse.status, resend_error: internalData });
    } else {
      log('info', 'internal_notification_sent', { order_id: order.id, resend_id: internalData?.id });
    }

    return new Response(
      JSON.stringify({ success: true, resend: resendData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    log('error', 'send_confirmation_exception', { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
