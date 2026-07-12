import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const log = (level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) => {
  console.log(JSON.stringify({ level, event, data, ts: new Date().toISOString() }));
};

const truncateAccessToken = (value: unknown): string => {
  const token = String(value ?? '');
  return token ? `${token.slice(0, 6)}...` : '';
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') || '';
    const bodyText = await req.text();
    const body = bodyText ? JSON.parse(bodyText) : {};
    const action = body.action || 'preview';
    const token = (body.token || '').trim();

    if (!token) {
      return new Response(JSON.stringify({ error: 'token requerido' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: claim, error: claimError } = await admin
      .from('profile_claims')
      .select('id, order_id, customer_email, quantity, status, claimed_by_user_id, claimed_profile_id, expires_at, created_at')
      .eq('claim_token', token)
      .maybeSingle();

    if (claimError || !claim) {
      log('warn', 'claim_not_found', { token: truncateAccessToken(token), error: claimError?.message || null });
      return new Response(JSON.stringify({ error: 'Link de activación inválido o expirado' }), {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const { data: order } = await admin
      .from('orders')
      .select('id, folio, customer_name, customer_email, payment_status, fulfillment_status, amount_cents, created_at')
      .eq('id', claim.order_id)
      .maybeSingle();

    if (action === 'preview') {
      return new Response(JSON.stringify({
        claim: {
          ...claim,
          token,
          already_claimed: claim.status === 'claimed',
        },
        order,
      }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Debes iniciar sesión para activar tu NexCard' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const jwt = authHeader.replace('Bearer ', '').trim();
    const { data: authData, error: authError } = await admin.auth.getUser(jwt);
    const user = authData?.user;

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida o expirada' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (claim.status === 'claimed' && claim.claimed_by_user_id && claim.claimed_by_user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Este link ya fue utilizado por otra cuenta' }), {
        status: 409,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (claim.expires_at && new Date(claim.expires_at).getTime() < Date.now()) {
      await admin.from('profile_claims').update({ status: 'expired' }).eq('id', claim.id);
      return new Response(JSON.stringify({ error: 'Este link de activación expiró' }), {
        status: 410,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('id, slug, full_name')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    const updatePayload: Record<string, unknown> = {
      status: 'claimed',
      claimed_by_user_id: user.id,
      claimed_profile_id: profile?.id || null,
    };

    await admin.from('profile_claims').update(updatePayload).eq('id', claim.id);

    if (profile?.id) {
      await admin
        .from('cards')
        .update({ profile_id: profile.id, updated_at: new Date().toISOString() })
        .eq('order_id', claim.order_id)
        .is('profile_id', null);
    }

    log('info', 'claim_consumed', { claim_id: claim.id, user_id: user.id, profile_id: profile?.id || null });

    return new Response(JSON.stringify({
      success: true,
      requires_profile_setup: !profile,
      claim: {
        ...claim,
        status: 'claimed',
        claimed_by_user_id: user.id,
        claimed_profile_id: profile?.id || null,
      },
      order,
      profile: profile || null,
    }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log('error', 'claim_profile_exception', { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
