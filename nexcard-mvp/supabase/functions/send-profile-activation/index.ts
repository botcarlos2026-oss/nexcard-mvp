import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const APP_URL = Deno.env.get('APP_URL') || 'https://nexcard.cl';

    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY no configurado');

    const { order_id } = await req.json();
    if (!order_id) throw new Error('order_id requerido');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: claim, error: claimError } = await supabase
      .from('profile_claims')
      .select('claim_token, customer_email, quantity, status')
      .eq('order_id', order_id)
      .maybeSingle();

    const { data: order } = await supabase
      .from('orders')
      .select('id, folio, customer_name, customer_email, amount_cents')
      .eq('id', order_id)
      .maybeSingle();

    if (claimError || !claim || !order) {
      return new Response(JSON.stringify({ success: false, error: 'Claim u orden no encontrados' }), {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (claim.status !== 'pending') {
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const activationUrl = `${APP_URL}/activar/${claim.claim_token}`;
    const folio = order.folio || '#' + String(order.id).slice(0, 8).toUpperCase();

    const html = `<!DOCTYPE html><html lang="es"><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><div style="max-width:560px;margin:32px auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06)"><div style="background:#09090b;padding:32px 40px;text-align:center"><p style="margin:0;color:#10B981;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase">NexCard</p><h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:900">Activa tu perfil digital</h1></div><div style="padding:32px 40px"><p style="color:#52525b;font-size:15px;line-height:1.6">Hola <strong style="color:#09090b">${order.customer_name || 'cliente'}</strong>, tu pago para <strong style="color:#09090b">${folio}</strong> fue confirmado.</p><p style="color:#52525b;font-size:15px;line-height:1.6">Ahora activa tu NexCard para completar tu perfil digital y dejar lista la tarjeta para asignación/uso.</p><div style="background:#f4f4f5;border-radius:16px;padding:20px 24px;margin:24px 0"><p style="margin:0 0 6px;color:#71717a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Email comprador</p><p style="margin:0;color:#09090b;font-size:14px;font-weight:800">${claim.customer_email}</p><p style="margin:16px 0 6px;color:#71717a;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Tarjetas en esta activación</p><p style="margin:0;color:#09090b;font-size:14px;font-weight:800">${claim.quantity}</p></div><div style="text-align:center;margin:28px 0"><a href="${activationUrl}" style="display:inline-block;background:#10B981;color:#fff;font-size:14px;font-weight:900;text-decoration:none;padding:14px 32px;border-radius:100px">Activar mi NexCard →</a></div><p style="color:#71717a;font-size:12px;line-height:1.6">Si tú no hiciste esta compra, responde este correo o escríbenos por WhatsApp antes de activar.</p></div><div style="padding:20px 40px;border-top:1px solid #f4f4f5;text-align:center"><p style="margin:0;color:#a1a1aa;font-size:11px">NexCard · nexcard.cl · hola@nexcard.cl</p></div></div></body></html>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NexCard <hola@nexcard.cl>',
        to: [claim.customer_email],
        subject: `Activa tu NexCard — ${folio}`,
        html,
      }),
    });

    const resendData = await resendRes.json();
    if (!resendRes.ok) {
      log('error', 'profile_activation_email_failed', { order_id, resend_error: resendData });
      return new Response(JSON.stringify({ success: false, error: resendData }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    log('info', 'profile_activation_email_sent', { order_id, resend_id: resendData.id, email: claim.customer_email });

    try {
      await supabase.rpc('log_email_event', {
        p_recipient_email: claim.customer_email,
        p_email_type: 'profile_activation',
        p_order_id: order_id,
        p_subject: `Activa tu NexCard — ${folio}`,
        p_status: 'sent',
        p_provider: 'resend',
        p_provider_message_id: resendData?.id || null,
        p_metadata: {
          audience: 'customer',
          claim_status: claim.status,
          quantity: claim.quantity,
        },
      });
    } catch (logErr) {
      log('warn', 'profile_activation_email_log_failed', { order_id, error: logErr.message });
    }

    return new Response(JSON.stringify({ success: true, resend_id: resendData.id, activation_url: activationUrl }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log('error', 'send_profile_activation_exception', { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
