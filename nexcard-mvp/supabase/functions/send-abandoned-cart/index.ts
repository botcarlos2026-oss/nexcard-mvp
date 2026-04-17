import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const log = (level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) => {
  console.log(JSON.stringify({ level, event, data, ts: new Date().toISOString() }));
};

const formatCLP = (cents: number) => `$${cents.toLocaleString('es-CL')}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY no configurada');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));

    // Modo cron: procesar todos los carritos pendientes
    if (body.trigger === 'cron') {
      log('info', 'cron_trigger_received', {});

      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: carts, error } = await supabase
        .from('abandoned_carts')
        .select('*')
        .eq('status', 'abandoned')
        .lt('created_at', cutoff)
        .is('reminder_sent_at', null);

      if (error) throw new Error(error.message);
      if (!carts || carts.length === 0) {
        log('info', 'no_carts_to_process', {});
        return new Response(JSON.stringify({ processed: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      log('info', 'processing_carts', { count: carts.length });
      let sent = 0;

      for (const cart of carts) {
        try {
          await sendReminderEmail(supabase, cart, RESEND_API_KEY);
          sent++;
        } catch (err) {
          log('error', 'cart_reminder_failed', { cart_id: cart.id, error: (err as Error).message });
        }
      }

      return new Response(JSON.stringify({ processed: sent }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Modo manual: enviar un carrito específico por ID
    const { cartId } = body;
    if (!cartId) throw new Error('cartId requerido');

    const { data: cart, error: cartError } = await supabase
      .from('abandoned_carts')
      .select('*')
      .eq('id', cartId)
      .single();

    if (cartError || !cart) throw new Error('Carrito no encontrado');
    if (cart.status === 'converted') {
      return new Response(JSON.stringify({ skipped: true, reason: 'already_converted' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await sendReminderEmail(supabase, cart, RESEND_API_KEY);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    log('error', 'send_abandoned_cart_exception', { message: (error as Error).message });
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function sendReminderEmail(supabase: any, cart: any, RESEND_API_KEY: string) {
  // Verificar unsubscribe
  const { data: unsub } = await supabase
    .from('email_unsubscribe')
    .select('email')
    .eq('email', cart.email.toLowerCase())
    .maybeSingle();

  if (unsub) {
    log('info', 'skipped_unsubscribed', { cart_id: cart.id, email: cart.email });
    await supabase.from('abandoned_carts').update({ status: 'ignored' }).eq('id', cart.id);
    return;
  }

  const customerName = cart.customer_name || 'Cliente';
  const items: Array<{ product_name: string; quantity: number; unit_price_cents: number }> = cart.items || [];

  const itemsHTML = items.map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #1f2937;font-size:14px;color:#d1d5db">
        ${item.product_name || 'Producto NexCard'} <span style="color:#6b7280">×${item.quantity}</span>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #1f2937;text-align:right;font-size:14px;font-weight:700;color:#10B981">
        ${formatCLP(item.unit_price_cents * item.quantity)}
      </td>
    </tr>
  `).join('');

  const emailHTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#09090B;margin:0;padding:20px">
  <div style="max-width:560px;margin:0 auto;background:#18181b;border-radius:16px;overflow:hidden;border:1px solid #27272a">

    <div style="background:#09090B;padding:28px 32px;text-align:center;border-bottom:1px solid #27272a">
      <h1 style="color:white;margin:0;font-size:26px;font-weight:900;letter-spacing:-0.5px">Nex<span style="color:#10B981">Card</span></h1>
    </div>

    <div style="padding:32px">
      <h2 style="color:white;font-size:20px;margin:0 0 8px;font-weight:800">¿Olvidaste algo? 🤔</h2>
      <p style="color:#9ca3af;margin:0 0 24px;font-size:15px">Hola ${customerName}, dejaste estos productos en tu carrito:</p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tbody>${itemsHTML}</tbody>
        <tfoot>
          <tr>
            <td style="padding:14px 0 0;font-size:16px;font-weight:900;color:white">Total</td>
            <td style="padding:14px 0 0;text-align:right;font-size:20px;font-weight:900;color:#10B981">${formatCLP(cart.total_cents)}</td>
          </tr>
        </tfoot>
      </table>

      <div style="text-align:center;margin-bottom:24px">
        <a href="https://nexcard.cl/preview"
           style="display:inline-block;background:#10B981;color:white;text-decoration:none;font-weight:800;font-size:15px;padding:14px 32px;border-radius:12px;letter-spacing:-0.2px">
          Completar mi compra →
        </a>
      </div>

      <div style="background:#1f2937;border-radius:10px;padding:14px 16px;border:1px solid #374151">
        <p style="margin:0;color:#9ca3af;font-size:13px;text-align:center">
          ⏰ Esta oferta expira en <strong style="color:white">48 horas</strong>
        </p>
      </div>
    </div>

    <div style="background:#09090B;padding:20px 32px;border-top:1px solid #27272a;text-align:center">
      <p style="margin:0;color:#4b5563;font-size:12px">
        © 2026 NexCard · nexcard.cl<br>
        <a href="https://nexcard.cl/unsubscribe?email=${encodeURIComponent(cart.email)}"
           style="color:#4b5563;text-decoration:underline">Darse de baja de recordatorios</a>
      </p>
    </div>

  </div>
</body>
</html>`;

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'NexCard <hola@nexcard.cl>',
      to: [cart.email],
      subject: '¿Olvidaste algo? Tu tarjeta NexCard te está esperando',
      html: emailHTML,
    }),
  });

  const resendData = await resendRes.json();
  if (!resendRes.ok) {
    log('error', 'resend_abandoned_cart_failed', { cart_id: cart.id, status: resendRes.status, resend_error: resendData });
    throw new Error(`Resend error: ${JSON.stringify(resendData)}`);
  }

  log('info', 'reminder_sent', { cart_id: cart.id, email: cart.email, resend_id: resendData?.id });

  // Actualizar estado del carrito
  await supabase
    .from('abandoned_carts')
    .update({ status: 'email_sent', reminder_sent_at: new Date().toISOString() })
    .eq('id', cart.id);

  // Registrar en email_log
  await supabase.from('email_log').insert([{
    recipient_email: cart.email,
    email_type: 'campaign',
    subject: '¿Olvidaste algo? Tu tarjeta NexCard te está esperando',
    status: 'sent',
    sent_at: new Date().toISOString(),
  }]);
}
