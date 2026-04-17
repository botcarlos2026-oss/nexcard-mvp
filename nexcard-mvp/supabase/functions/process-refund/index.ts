import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { orderId, amount_cents, reason, refundId } = await req.json();

    if (!orderId || !amount_cents || !refundId) {
      throw new Error('Parámetros requeridos: orderId, amount_cents, refundId');
    }

    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!MP_ACCESS_TOKEN) throw new Error('MP_ACCESS_TOKEN no configurado');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase no configurado');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Obtener la orden con mp_payment_id
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, mp_payment_id, customer_email, customer_name, amount_cents, folio')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error('Orden no encontrada');
    }

    if (!order.mp_payment_id) {
      throw new Error('Esta orden no tiene un payment_id de Mercado Pago registrado. Verifica que el webhook mp-webhook guarda mp_payment_id al confirmar el pago.');
    }

    // Llamar a la API de MP para emitir el reembolso
    // amount en CLP directo (no centavos según convención del proyecto)
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${order.mp_payment_id}/refunds`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: amount_cents }),
      }
    );

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      throw new Error(`Error MP: ${mpData.message || mpData.error || JSON.stringify(mpData)}`);
    }

    const mpRefundId = String(mpData.id);

    // Actualizar refund como procesado
    const { error: refundError } = await supabase
      .from('refunds')
      .update({
        status: 'processed',
        mp_refund_id: mpRefundId,
        processed_at: new Date().toISOString(),
        processed_by: 'admin',
      })
      .eq('id', refundId);

    if (refundError) throw new Error(`Error actualizando refund: ${refundError.message}`);

    // Actualizar orden a payment_status: refunded
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({ payment_status: 'refunded' })
      .eq('id', orderId);

    if (orderUpdateError) throw new Error(`Error actualizando orden: ${orderUpdateError.message}`);

    // Enviar email al cliente si hay RESEND_API_KEY
    if (RESEND_API_KEY && order.customer_email) {
      const folio = order.folio ? `#${order.folio}` : `#${orderId.slice(0, 8).toUpperCase()}`;
      const amountFormatted = new Intl.NumberFormat('es-CL', {
        style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
      }).format(amount_cents);

      const reasonLabel: Record<string, string> = {
        'Producto defectuoso': 'Producto defectuoso',
        'No llegó': 'Producto no recibido',
        'No cumple expectativas': 'No cumple expectativas',
        'Error en pedido': 'Error en el pedido',
        'Otro': 'Otro motivo',
      };

      const emailHTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#09090B;margin:0;padding:20px">
  <div style="max-width:560px;margin:0 auto;background:#18181b;border-radius:16px;overflow:hidden;border:1px solid #27272a">
    <div style="background:#09090B;padding:32px;text-align:center;border-bottom:1px solid #27272a">
      <h1 style="color:white;margin:0;font-size:28px;font-weight:900">Nex<span style="color:#10B981">Card</span></h1>
    </div>
    <div style="padding:32px">
      <h2 style="color:#f4f4f5;font-size:22px;margin:0 0 8px">Reembolso procesado</h2>
      <p style="color:#a1a1aa;margin:0 0 24px">Hola ${order.customer_name || 'Cliente'}, tu reembolso ha sido procesado exitosamente.</p>

      <div style="background:#09090B;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #27272a">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#a1a1aa;font-weight:700">Orden</td>
            <td style="padding:6px 0;font-size:13px;color:#f4f4f5;text-align:right;font-family:monospace">${folio}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#a1a1aa;font-weight:700">Motivo</td>
            <td style="padding:6px 0;font-size:13px;color:#f4f4f5;text-align:right">${reasonLabel[reason] || reason}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:18px;color:#a1a1aa;font-weight:900">Monto reembolsado</td>
            <td style="padding:6px 0;font-size:22px;color:#10B981;font-weight:900;text-align:right">${amountFormatted}</td>
          </tr>
        </table>
      </div>

      <div style="background:#052e16;border-radius:12px;padding:16px;border:1px solid #166534;margin-bottom:24px">
        <p style="margin:0;color:#86efac;font-size:14px;line-height:1.6">
          <strong style="color:#4ade80">¿Cuándo verás el dinero?</strong><br>
          El reembolso aparecerá en tu cuenta en <strong>5–10 días hábiles</strong> dependiendo de tu banco o emisor de tarjeta.
        </p>
      </div>

      <p style="color:#71717a;font-size:12px;margin:0">
        ¿Tienes preguntas? Escríbenos a <a href="mailto:hola@nexcard.cl" style="color:#10B981">hola@nexcard.cl</a>
      </p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #27272a;text-align:center">
      <p style="color:#52525b;font-size:11px;margin:0">
        NexCard · nexcard.cl ·
        <a href="mailto:hola@nexcard.cl?subject=Baja%20lista" style="color:#52525b">Dar de baja</a>
      </p>
    </div>
  </div>
</body>
</html>`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'NexCard <hola@nexcard.cl>',
          to: [order.customer_email],
          subject: `Reembolso procesado — NexCard ${folio}`,
          html: emailHTML,
        }),
      });
    }

    return new Response(
      JSON.stringify({ success: true, mp_refund_id: mpRefundId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('process-refund error:', err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
