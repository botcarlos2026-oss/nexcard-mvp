import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const limit = Math.min(Math.max(Number(body?.limit) || 20, 1), 100);

    const { data: queueRows, error: queueError } = await supabase
      .from('order_payment_reconciliation_queue')
      .select('*')
      .or('has_drift.eq.true,drift_reason.not.is.null')
      .limit(limit);

    if (queueError) throw new Error(`No se pudo leer la cola de reconciliación: ${queueError.message}`);

    const rows = queueRows || [];
    const orderIds = rows.map((row: any) => row.order_id).filter(Boolean);
    const orderMap = orderIds.length > 0
      ? Object.fromEntries(
          ((await supabase
            .from('orders')
            .select('id, customer_name, customer_email, payment_status, fulfillment_status, updated_at')
            .in('id', orderIds)).data || []).map((order: any) => [order.id, order])
        )
      : {};

    const summary = {
      scanned: rows.length,
      auto_reconciled: 0,
      already_aligned: 0,
      missing_active_payment_ledger: 0,
      manual_review_required: 0,
      no_recommendation: 0,
      failed: 0,
    };

    const results = [] as any[];

    for (const row of rows) {
      const meta = orderMap[row.order_id] || {};

      if (dryRun) {
        let status = 'manual_review_required';
        if (row.active_payments === 0) status = 'missing_active_payment_ledger';
        else if (!row.has_drift) status = 'already_aligned';
        else if (row.order_payment_status === 'paid' && !['paid', 'refunded'].includes(row.suggested_order_payment_status || '')) status = 'manual_review_required';
        else if (row.order_payment_status === 'refunded' && row.suggested_order_payment_status !== 'refunded') status = 'manual_review_required';
        else if (!row.suggested_order_payment_status) status = 'no_recommendation';
        else status = 'eligible_for_auto_reconcile';

        if (status === 'eligible_for_auto_reconcile') summary.auto_reconciled += 1;
        else if (status in summary) summary[status as keyof typeof summary] += 1;

        results.push({
          order_id: row.order_id,
          customer_name: meta.customer_name || null,
          order_payment_status: row.order_payment_status,
          payment_statuses: row.payment_statuses,
          suggested_order_payment_status: row.suggested_order_payment_status,
          status,
          drift_reason: row.drift_reason,
        });
        continue;
      }

      const { data, error } = await supabase.rpc('reconcile_order_payment_status', {
        target_order_id: row.order_id,
        actor_id: null,
        reason: `auto_reconcile_${trigger}`,
      });

      if (error) {
        summary.failed += 1;
        results.push({
          order_id: row.order_id,
          customer_name: meta.customer_name || null,
          status: 'failed',
          error: error.message,
          order_payment_status: row.order_payment_status,
          suggested_order_payment_status: row.suggested_order_payment_status,
          payment_statuses: row.payment_statuses,
        });
        log('error', 'reconcile_row_failed', { order_id: row.order_id, error: error.message });
        continue;
      }

      const status = data?.status || 'unknown';
      if (status === 'reconciled') summary.auto_reconciled += 1;
      else if (status === 'already_aligned') summary.already_aligned += 1;
      else if (status === 'missing_active_payment_ledger') summary.missing_active_payment_ledger += 1;
      else if (status === 'manual_review_required') summary.manual_review_required += 1;
      else if (status === 'no_recommendation') summary.no_recommendation += 1;

      results.push({
        order_id: row.order_id,
        customer_name: meta.customer_name || null,
        ...data,
      });
    }

    const manualReview = results.filter((item) => item.status === 'manual_review_required' || item.status === 'missing_active_payment_ledger').slice(0, 10);
    const failedRows = results.filter((item) => item.status === 'failed').slice(0, 10);

    const responsePayload = {
      success: true,
      trigger,
      dry_run: dryRun,
      limit,
      summary,
      headline: summary.failed > 0
        ? `Reconciliación con fallas: ${summary.failed} error(es)`
        : summary.manual_review_required > 0 || summary.missing_active_payment_ledger > 0
          ? `Reconciliación parcial: ${summary.auto_reconciled} auto · ${summary.manual_review_required + summary.missing_active_payment_ledger} revisión manual`
          : `Reconciliación limpia: ${summary.auto_reconciled} auto · 0 revisión manual`,
      manual_review: manualReview,
      failed_rows: failedRows,
      results: results.slice(0, 25),
    };

    log('info', 'reconciliation_completed', {
      trigger,
      dry_run: dryRun,
      summary,
      manual_review: manualReview.length,
      failed_rows: failedRows.length,
    });

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log('error', 'reconciliation_unhandled_exception', { message: error.message });
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
