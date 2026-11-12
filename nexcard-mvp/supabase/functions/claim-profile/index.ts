import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { buildPublicClaimPreview, getClaimAvailability, getClaimFinalizationDecision, hasBearerAuthorization } from "./security.ts";

const log = (level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) => {
  console.log(JSON.stringify({ level, event, data, ts: new Date().toISOString() }));
};

const normalizeEmail = (email?: string | null) => (email || '').trim().toLowerCase();

serve(async (req) => {
  const CORS = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') || '';
    const bodyText = await req.text();
    const body = bodyText ? JSON.parse(bodyText) : {};
    const action = body.action || 'preview';
    const token = (body.token || '').trim();
    const claimId = (body.claim_id || '').trim();
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (action === 'finalize') {
      if (!claimId) {
        return new Response(JSON.stringify({ error: 'claim_id requerido' }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      if (!hasBearerAuthorization(authHeader)) {
        return new Response(JSON.stringify({ error: 'Debes iniciar sesión para finalizar tu activación' }), {
          status: 401,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      const finalizeJwt = authHeader.replace('Bearer ', '').trim();
      const { data: finalizeAuthData, error: finalizeAuthError } = await admin.auth.getUser(finalizeJwt);
      const finalizeUser = finalizeAuthData?.user;
      if (finalizeAuthError || !finalizeUser) {
        return new Response(JSON.stringify({ error: 'Sesión inválida o expirada' }), {
          status: 401,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      const [{ data: finalizedClaim }, { data: finalizedProfile }] = await Promise.all([
        admin
          .from('profile_claims')
          .select('id, order_id, status, claimed_by_user_id, claimed_profile_id')
          .eq('id', claimId)
          .maybeSingle(),
        admin
          .from('profiles')
          .select('id, slug')
          .eq('user_id', finalizeUser.id)
          .is('deleted_at', null)
          .maybeSingle(),
      ]);

      if (!finalizedClaim) {
        return new Response(JSON.stringify({ error: 'Activación no encontrada' }), {
          status: 404,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      const decision = getClaimFinalizationDecision(finalizedClaim, finalizeUser.id, finalizedProfile?.id || null);
      if (decision.reason !== 'ready') {
        const message = decision.reason === 'wrong_owner'
          ? 'Esta activación pertenece a otra cuenta'
          : decision.reason === 'profile_required'
            ? 'Completa tu perfil antes de finalizar la activación'
            : 'La activación no puede vincularse con este perfil';
        return new Response(JSON.stringify({ error: message }), {
          status: decision.httpStatus,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      if (!finalizedProfile) {
        return new Response(JSON.stringify({ error: 'Completa tu perfil antes de finalizar la activación' }), {
          status: 409,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      if (!finalizedClaim.claimed_profile_id) {
        const { data: linkedClaim } = await admin
          .from('profile_claims')
          .update({ claimed_profile_id: finalizedProfile.id })
          .eq('id', finalizedClaim.id)
          .eq('status', 'claimed')
          .eq('claimed_by_user_id', finalizeUser.id)
          .is('claimed_profile_id', null)
          .select('id')
          .maybeSingle();

        if (!linkedClaim) {
          const { data: concurrentClaim } = await admin
            .from('profile_claims')
            .select('claimed_profile_id')
            .eq('id', finalizedClaim.id)
            .maybeSingle();
          if (concurrentClaim?.claimed_profile_id !== finalizedProfile.id) {
            return new Response(JSON.stringify({ error: 'La activación cambió durante la vinculación' }), {
              status: 409,
              headers: { ...CORS, 'Content-Type': 'application/json' },
            });
          }
        }
      }

      const { data: finalizedReservation } = await admin
        .from('profile_slug_reservations')
        .select('slug, status')
        .eq('order_id', finalizedClaim.order_id)
        .maybeSingle();

      if (finalizedReservation?.status === 'reserved' && finalizedReservation.slug === finalizedProfile.slug) {
        await admin
          .from('profile_slug_reservations')
          .update({
            status: 'consumed',
            profile_id: finalizedProfile.id,
            reserved_by_user_id: finalizeUser.id,
            consumed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('order_id', finalizedClaim.order_id)
          .eq('slug', finalizedProfile.slug)
          .eq('status', 'reserved');
      }

      const { error: finalizeCardsError } = await admin.rpc('ensure_order_pending_cards', {
        target_order_id: finalizedClaim.order_id,
      });
      if (finalizeCardsError) {
        log('warn', 'ensure_order_pending_cards_failed', { order_id: finalizedClaim.order_id, error: finalizeCardsError.message });
      }

      await admin
        .from('cards')
        .update({
          profile_id: finalizedProfile.id,
          activation_status: 'assigned',
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', finalizedClaim.order_id)
        .is('profile_id', null);

      log('info', 'claim_profile_link_finalized', {
        claim_id: finalizedClaim.id,
        user_id: finalizeUser.id,
        profile_id: finalizedProfile.id,
      });

      return new Response(JSON.stringify({
        success: true,
        finalized: true,
        claim_id: finalizedClaim.id,
        profile_id: finalizedProfile.id,
      }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (!token) {
      return new Response(JSON.stringify({ error: 'token requerido' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const { data: claim, error: claimError } = await admin
      .from('profile_claims')
      .select('id, order_id, customer_email, quantity, status, claimed_by_user_id, claimed_profile_id, expires_at, created_at')
      .eq('claim_token', token)
      .maybeSingle();

    if (claimError || !claim) {
      log('warn', 'claim_not_found', { error: claimError?.message || null });
      return new Response(JSON.stringify({ error: 'Link de activación inválido o expirado' }), {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const availability = getClaimAvailability(claim);

    if (availability.reason === 'expired') {
      if (claim.status === 'pending') {
        await admin.from('profile_claims').update({ status: 'expired' }).eq('id', claim.id).eq('status', 'pending');
      }
      return new Response(JSON.stringify({ error: 'Este link de activación expiró' }), {
        status: availability.httpStatus,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (availability.reason === 'claimed') {
      return new Response(JSON.stringify({ error: 'Este link de activación ya fue utilizado' }), {
        status: availability.httpStatus,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (availability.reason === 'cancelled') {
      return new Response(JSON.stringify({ error: 'Este link de activación no está disponible' }), {
        status: availability.httpStatus,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'preview') {
      return new Response(JSON.stringify(buildPublicClaimPreview(claim)), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (action !== 'claim') {
      return new Response(JSON.stringify({ error: 'Acción no soportada' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (!hasBearerAuthorization(authHeader)) {
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

    const claimEmail = normalizeEmail(claim.customer_email);
    const userEmail = normalizeEmail(user.email);
    if (claimEmail && userEmail && claimEmail !== userEmail) {
      return new Response(JSON.stringify({ error: 'Este link pertenece a otro correo comprador. Cierra sesión e ingresa con el correo de la compra.' }), {
        status: 403,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const [{ data: order }, { data: slugReservation }] = await Promise.all([
      admin
        .from('orders')
        .select('id, folio, customer_name, customer_email, customer_phone, payment_status, fulfillment_status, amount_cents, card_customization, created_at')
        .eq('id', claim.order_id)
        .maybeSingle(),
      admin
        .from('profile_slug_reservations')
        .select('slug, status, expires_at, profile_id')
        .eq('order_id', claim.order_id)
        .maybeSingle(),
    ]);

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
      // Consume the bearer credential. The original email URL stops working as
      // soon as the claim wins the guarded update below.
      claim_token: crypto.randomUUID().replaceAll('-', ''),
    };

    // Guard the write with the status read earlier so two near-simultaneous claims on
    // the same token can't both pass the ownership check above and then both write:
    // only the request whose read is still accurate wins the update; the other gets 0
    // rows affected and is rejected as a conflict instead of silently overwriting
    // claimed_by_user_id.
    const { data: claimUpdateResult } = await admin
      .from('profile_claims')
      .update(updatePayload)
      .eq('id', claim.id)
      .eq('claim_token', token)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .select('id')
      .maybeSingle();

    if (!claimUpdateResult) {
      const { data: latestClaim } = await admin
        .from('profile_claims')
        .select('id, status, expires_at')
        .eq('id', claim.id)
        .maybeSingle();
      if (latestClaim) {
        const latestAvailability = getClaimAvailability(latestClaim);
        if (latestAvailability.reason === 'expired') {
          if (latestClaim.status === 'pending') {
            await admin.from('profile_claims').update({ status: 'expired' }).eq('id', latestClaim.id).eq('status', 'pending');
          }
          return new Response(JSON.stringify({ error: 'Este link de activación expiró' }), {
            status: latestAvailability.httpStatus,
            headers: { ...CORS, 'Content-Type': 'application/json' },
          });
        }
      }
      return new Response(JSON.stringify({ error: 'Este link ya fue utilizado por otra cuenta' }), {
        status: 409,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (profile?.id && slugReservation?.status === 'reserved' && slugReservation.slug === profile.slug) {
      await admin
        .from('profile_slug_reservations')
        .update({
          status: 'consumed',
          profile_id: profile.id,
          reserved_by_user_id: user.id,
          consumed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', claim.order_id)
        .eq('slug', profile.slug)
        .eq('status', 'reserved');
    }

    const { data: ensureCardsResult, error: ensureCardsError } = await admin.rpc('ensure_order_pending_cards', {
      target_order_id: claim.order_id,
    });

    if (ensureCardsError) {
      log('warn', 'ensure_order_pending_cards_failed', { order_id: claim.order_id, error: ensureCardsError.message });
    }

    if (profile?.id) {
      await admin
        .from('cards')
        .update({
          profile_id: profile.id,
          activation_status: 'assigned',
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', claim.order_id)
        .is('profile_id', null);
    }

    log('info', 'claim_consumed', {
      claim_id: claim.id,
      user_id: user.id,
      profile_id: profile?.id || null,
      ensure_cards: ensureCardsResult || null,
    });

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
      reserved_slug: slugReservation?.status === 'reserved' ? slugReservation.slug : order?.card_customization?.desired_slug || null,
      slug_reservation: slugReservation || null,
      profile: profile || null,
    }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno al procesar la activación';
    log('error', 'claim_profile_exception', { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
