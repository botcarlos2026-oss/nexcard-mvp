import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_RECIPIENTS = [
  'carlos.alvarez.contreras@gmail.com',
  'bot.carlos.2026@gmail.com',
];

const log = (level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) => {
  console.log(JSON.stringify({ level, event, data, ts: new Date().toISOString() }));
};

async function requireInternalAlertAccess(req: Request, supabaseUrl: string, serviceRoleKey: string, anonKey: string) {
  const authHeader = req.headers.get('Authorization') || '';
  const apikey = req.headers.get('apikey') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : '';

  if (bearer && (bearer === serviceRoleKey || apikey === serviceRoleKey)) {
    return { mode: 'service_role' as const };
  }

  if (!bearer) {
    return { error: new Response(JSON.stringify({ error: 'Authorization requerida' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    }) };
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await admin.auth.getUser(bearer);
  if (authError || !authData?.user) {
    return { error: new Response(JSON.stringify({ error: 'Sesión inválida o expirada' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    }) };
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
  const { data: isAdmin, error: roleError } = await caller.rpc('has_role', { required_role: 'admin' });
  if (roleError || !isAdmin) {
    return { error: new Response(JSON.stringify({ error: 'Solo admins pueden enviar alertas ejecutivas' }), {
      status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
    }) };
  }

  return { mode: 'admin' as const, userId: authData.user.id, email: authData.user.email || null };
}

const encoder = new TextEncoder();
async function sha256(input: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY no configurado' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const access = await requireInternalAlertAccess(req, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY);
    if (access.error) return access.error;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const payload = body?.payload || {};
    const dryRun = body?.dry_run !== false;
    const alertKey = body?.alert_key || 'executive_score';

    if (!payload?.band || payload?.score == null) {
      return new Response(JSON.stringify({ error: 'payload.band y payload.score son requeridos' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const requestedRecipients = Array.isArray(body?.recipients) ? body.recipients.filter(Boolean) : [];
    const recipients = requestedRecipients.length > 0 ? requestedRecipients : ADMIN_RECIPIENTS;
    const payloadHash = await sha256(JSON.stringify({ alertKey, payload, recipients }));
    const { data: existingHash } = await supabase
      .from('kpi_alert_history')
      .select('id, created_at, provider_message_id')
      .eq('alert_key', alertKey)
      .eq('payload_hash', payloadHash)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingHash) {
      await supabase.from('kpi_alert_history').insert({
        alert_key: alertKey,
        alert_band: payload.band,
        payload_hash: payloadHash,
        channel: 'email',
        status: 'omitted',
        provider: 'resend',
        payload,
        metadata: { reason: 'duplicate_payload_hash', dry_run: body?.dry_run !== false, actor_email: access.email || null, recipients },
      });
      return new Response(JSON.stringify({ skipped: true, reason: 'duplicate_payload_hash', existing: existingHash }), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const subject = `[NexCard] ${String(payload.band || '').toUpperCase()} · Executive score ${payload.score}`;
    const reasons = Array.isArray(payload.reasons) ? payload.reasons : [];
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:20px">
  <div style="max-width:620px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#09090B;padding:28px;text-align:center">
      <h1 style="color:white;margin:0;font-size:24px;font-weight:900">Nex<span style="color:#10B981">Card</span></h1>
      <p style="color:${payload.band === 'critical' ? '#f87171' : '#f59e0b'};margin:8px 0 0;font-size:14px;font-weight:700">Alerta ejecutiva automática</p>
    </div>
    <div style="padding:28px">
      <div style="background:#f4f4f5;border-radius:14px;padding:18px 20px;margin-bottom:18px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;color:#71717a;font-weight:700">Executive score</div>
        <div style="font-size:34px;font-weight:900;color:#111827;margin-top:6px">${payload.score}</div>
        <div style="font-size:13px;color:#52525b;margin-top:4px">Banda: <strong>${payload.band}</strong></div>
      </div>
      <p style="color:#27272a;font-size:14px;line-height:1.6;margin:0 0 16px">${payload.summary || 'Sin resumen disponible.'}</p>
      <div style="border:1px solid #e4e4e7;border-radius:12px;padding:16px 18px;margin-bottom:18px">
        <p style="margin:0 0 10px;font-size:12px;font-weight:800;color:#71717a;text-transform:uppercase">Drivers</p>
        <ul style="margin:0;padding-left:18px;color:#3f3f46;font-size:14px;line-height:1.6">${reasons.map((r: string) => `<li>${r}</li>`).join('') || '<li>Sin drivers explícitos</li>'}</ul>
      </div>
      <p style="margin:0;color:#71717a;font-size:12px">Generado: ${payload.generated_at || new Date().toISOString()}</p>
      <p style="margin:8px 0 0;color:#71717a;font-size:12px">Modo: ${dryRun ? 'dry-run' : 'real dispatch'}</p>
    </div>
  </div>
</body></html>`;

    let providerMessageId = null;
    let status = dryRun ? 'dry_run' : 'sent';

    if (!dryRun) {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'NexCard <hola@nexcard.cl>',
          to: recipients,
          subject,
          html,
        }),
      });
      const resendData = await resendRes.json();
      if (!resendRes.ok) {
        await supabase.from('kpi_alert_history').insert({
          alert_key: alertKey,
          alert_band: payload.band,
          payload_hash: payloadHash,
          channel: 'email',
          status: 'failed',
          provider: 'resend',
          payload,
          metadata: { resend_error: resendData, dry_run: false, actor_email: access.email || null },
        });
        return new Response(JSON.stringify({ success: false, error: resendData }), {
          status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      providerMessageId = resendData?.id || null;
    }

    await supabase.from('kpi_alert_history').insert({
      alert_key: alertKey,
      alert_band: payload.band,
      payload_hash: payloadHash,
      channel: 'email',
      status,
      provider: 'resend',
      provider_message_id: providerMessageId,
      payload,
      metadata: { dry_run: dryRun, actor_email: access.email || null, recipients },
    });

    await supabase.from('kpi_alert_state').upsert({
      alert_key: alertKey,
      last_band: payload.band,
      last_score: payload.score,
      last_payload: payload,
      last_sent_at: new Date().toISOString(),
    }, { onConflict: 'alert_key' });

    try {
      await supabase.rpc('log_email_event', {
        p_recipient_email: recipients[0],
        p_email_type: 'internal_notification',
        p_subject: subject,
        p_status: status,
        p_provider: 'resend',
        p_provider_message_id: providerMessageId,
        p_metadata: { audience: 'internal', alert_key: alertKey, payload_hash: payloadHash, dry_run: dryRun, recipients },
      });
    } catch {
      // no crítico
    }

    log('info', 'executive_alert_processed', { alert_key: alertKey, dry_run: dryRun, payload_hash: payloadHash, provider_message_id: providerMessageId });

    return new Response(JSON.stringify({ success: true, dry_run: dryRun, payload_hash: payloadHash, provider_message_id: providerMessageId }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    log('error', 'send_executive_alert_exception', { message: err.message });
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
