import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LEGAL_FOOTER = (email: string) => `
  <div style="margin-top:40px;padding-top:20px;border-top:1px solid #27272a;text-align:center">
    <p style="margin:0 0 6px;color:#71717a;font-size:12px">
      Este email fue enviado por <strong>NexCard</strong> · <a href="https://nexcard.cl" style="color:#10B981;text-decoration:none">nexcard.cl</a>
    </p>
    <p style="margin:0 0 6px;color:#71717a;font-size:12px">
      Lo recibes porque compraste o te registraste en NexCard.
    </p>
    <p style="margin:0;font-size:12px">
      <a href="https://nexcard.cl/baja?email=${encodeURIComponent(email)}" style="color:#a1a1aa;text-decoration:underline">
        Cancelar suscripción
      </a>
    </p>
  </div>
`;

async function requireCampaignAccess(req: Request, supabaseUrl: string, serviceRoleKey: string, anonKey: string) {
  const authHeader = req.headers.get('Authorization') || '';
  const apikey = req.headers.get('apikey') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : '';

  if (bearer && (bearer === serviceRoleKey || apikey === serviceRoleKey)) {
    return { mode: 'service_role' as const };
  }

  if (!bearer) {
    return { error: new Response(JSON.stringify({ error: 'Authorization requerida' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }) };
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await admin.auth.getUser(bearer);
  if (authError || !authData?.user) {
    return { error: new Response(JSON.stringify({ error: 'Sesión inválida o expirada' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }) };
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
  const { data: isAdmin, error: roleError } = await caller.rpc('has_role', { required_role: 'admin' });

  if (roleError || !isAdmin) {
    return { error: new Response(JSON.stringify({ error: 'Solo admins pueden enviar campañas' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }) };
  }

  return { mode: 'admin' as const, userId: authData.user.id };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, subject, html, email_type, order_id } = await req.json();

    if (!to || !subject || !html || !email_type) {
      return new Response(
        JSON.stringify({ success: false, error: 'Faltan campos: to, subject, html, email_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY no configurada');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Variables de Supabase no configuradas');
    if (!SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY no configurada');

    const access = await requireCampaignAccess(req, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY);
    if (access.error) return access.error;

    if (String(subject).length > 180) throw new Error('Subject demasiado largo');
    if (String(html).length > 200000) throw new Error('HTML demasiado largo');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verificar si el email está en la lista de bajas
    const { data: unsubscribed } = await supabase
      .from('email_unsubscribe')
      .select('email')
      .eq('email', to.toLowerCase().trim())
      .maybeSingle();

    if (unsubscribed) {
      return new Response(
        JSON.stringify({ success: false, skipped_reason: 'unsubscribed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Inyectar footer legal en el HTML
    const fullHTML = html.replace('</body>', `${LEGAL_FOOTER(to)}</body>`);

    // Enviar via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NexCard <hola@nexcard.cl>',
        to: [to],
        subject,
        html: fullHTML,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend error:', resendData);
      return new Response(
        JSON.stringify({ success: false, error: resendData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Registrar en email_log
    await supabase.rpc('log_email_event', {
      p_recipient_email: to.toLowerCase().trim(),
      p_email_type: email_type,
      p_order_id: order_id || null,
      p_subject: subject,
      p_status: 'sent',
      p_provider: 'resend',
      p_provider_message_id: resendData?.id || null,
      p_metadata: {
        audience: 'campaign',
        access_mode: access.mode,
      },
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('send-campaign-email error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
