import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.0";

const CORS = {
  'Access-Control-Allow-Origin': 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ops-secret',
};

const log = (level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) => {
  console.log(JSON.stringify({ level, event, data, ts: new Date().toISOString() }));
};

function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  if (ba.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ba.length; i += 1) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

function requireOpsSecret(req: Request): Response | null {
  const expected = Deno.env.get('OPS_SHARED_SECRET') || '';
  const provided = req.headers.get('x-ops-secret') || '';
  if (!expected || !safeEqual(provided, expected)) {
    log('warn', 'unauthorized_ops_call', { path: new URL(req.url).pathname });
    return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  return null;
}

const normalizeProvider = (paymentMethod: string | null | undefined) => {
  const value = String(paymentMethod || '').trim().toLowerCase();
  if (!value) return 'legacy_backfill';
  if (['mercado-pago', 'mercadopago', 'mercado_pago', 'mp'].includes(value)) return 'mercado_pago';
  if (value === 'webpay') return 'webpay';
  if (value === 'transbank') return 'webpay';
  return value.replace(/[^a-z0-9]+/g, '_') || 'legacy_backfill';
};

const isEligible = (order: any) => {
  if (!order) return { eligible: false, reason: 'order_not_found' };
  if (order.deleted_at) return { eligible: false, reason: 'order_deleted' };
  if (['paid', 'refunded', 'failed'].includes(order.payment_status)) return { eligible: true, reason: 'terminal_or_paid_status' };
  if (order.mp_payment_id) return { eligible: true, reason: 'has_mp_payment_id' };
  return { eligible: false, reason: 'pending_without_reference' };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const unauthorized = requireOpsSecret(req);
  if (unauthorized) return unauthorized;

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'Supabase env faltante' }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const trigger = String(body?.trigger || 'manual').trim() || 'manual';
    const dryRun = body?.dry_run === true;
    const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 200);

    const { data: queueRows, error: queueError } = await supabase
      .from('order_payment_reconciliation_queue')
      .select('order_id, order_payment_status, payment_statuses, active_payments, drift_reason')
      .eq('active_payments', 0)
      .limit(limit);

    if (queueError) throw new Error(`No se pudo leer cola de backfill: ${queueError.message}`);

    const orderIds = (queueRows || []).map((row: any) => row.order_id).filter(Boolean);
    const { data: orders, error: ordersError } = orderIds.length > 0
      ? await supabase
          .from('orders')
          .select('id, customer_name, customer_email, payment_status, payment_method, mp_payment_id, amount_cents, currency, created_at, updated_at, deleted_at')
          .in('id', orderIds)
      : { data: [], error: null } as any;

    if (ordersError) throw new Error(`No se pudo consultar órdenes candidatas: ${ordersError.message}`);

    const orderMap = Object.fromEntries((orders || []).map((order: any) => [order.id, order]));
    const summary = {
      scanned: (queueRows || []).length,
      eligible: 0,
      inserted: 0,
      skipped: 0,
      failed: 0,
    };
    const results = [] as any[];

    for (const row of queueRows || []) {
      const order = orderMap[row.order_id] || null;
      const eligibility = isEligible(order);

      if (!eligibility.eligible) {
        summary.skipped += 1;
        results.push({
          order_id: row.order_id,
          customer_name: order?.customer_name || null,
          status: 'skipped',
          reason: eligibility.reason,
          order_payment_status: row.order_payment_status,
          mp_payment_id: order?.mp_payment_id || null,
        });
        continue;
      }

      summary.eligible += 1;

      const payload = {
        source: 'historical_payment_ledger_backfill',
        trigger,
        backfilled_at: new Date().toISOString(),
        order_payment_status: order.payment_status,
        order_updated_at: order.updated_at,
        order_created_at: order.created_at,
        payment_method: order.payment_method || null,
        mp_payment_id: order.mp_payment_id || null,
      };

      const candidate = {
        order_id: row.order_id,
        customer_name: order?.customer_name || null,
        payment_status: order.payment_status,
        provider: normalizeProvider(order.payment_method),
        external_id: order.mp_payment_id || null,
        amount_cents: Number(order.amount_cents || 0),
        currency: order.currency || 'CLP',
        reason: eligibility.reason,
      };

      if (dryRun) {
        results.push({ status: 'eligible', ...candidate });
        continue;
      }

      const { data: existingPayments, error: existingError } = await supabase
        .from('payments')
        .select('id')
        .eq('order_id', row.order_id)
        .is('deleted_at', null)
        .limit(1);

      if (existingError) {
        summary.failed += 1;
        results.push({ status: 'failed', order_id: row.order_id, customer_name: order?.customer_name || null, error: existingError.message });
        continue;
      }

      if ((existingPayments || []).length > 0) {
        summary.skipped += 1;
        results.push({ status: 'skipped', order_id: row.order_id, customer_name: order?.customer_name || null, reason: 'payment_appeared_during_run' });
        continue;
      }

      const { data: inserted, error: insertError } = await supabase
        .from('payments')
        .insert({
          order_id: row.order_id,
          provider: candidate.provider,
          status: order.payment_status,
          amount_cents: candidate.amount_cents,
          currency: candidate.currency,
          external_id: candidate.external_id,
          payload,
        })
        .select('id, order_id, status, provider, external_id')
        .single();

      if (insertError) {
        summary.failed += 1;
        results.push({ status: 'failed', order_id: row.order_id, customer_name: order?.customer_name || null, error: insertError.message });
        log('error', 'backfill_insert_failed', { order_id: row.order_id, error: insertError.message });
        continue;
      }

      try {
        await supabase.from('audit_log').insert({
          actor_user_id: null,
          actor_role: 'service_role',
          entity_type: 'payment',
          entity_id: inserted.id,
          action: 'payment_ledger_backfill',
          before: null,
          after: inserted,
          context: {
            source: 'backfill-payment-ledger',
            trigger,
            order_id: row.order_id,
            reason: eligibility.reason,
          },
        });
      } catch {
        // audit best-effort; no bloquear backfill
      }

      summary.inserted += 1;
      results.push({ status: 'inserted', ...candidate, payment_id: inserted.id });
    }

    const responsePayload = {
      success: true,
      trigger,
      dry_run: dryRun,
      limit,
      summary,
      headline: dryRun
        ? `Backfill dry-run: ${summary.eligible} elegibles de ${summary.scanned}`
        : `Backfill ejecutado: ${summary.inserted} insertados · ${summary.skipped} omitidos · ${summary.failed} fallidos`,
      results: results.slice(0, 50),
    };

    log('info', 'payment_ledger_backfill_completed', { trigger, dry_run: dryRun, summary });

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log('error', 'payment_ledger_backfill_failed', { message: error.message });
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
