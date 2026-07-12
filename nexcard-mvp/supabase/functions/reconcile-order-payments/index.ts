import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ops-secret',
};

const log = (level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) => {
  console.log(JSON.stringify({ level, event, data, ts: new Date().toISOString() }));
};

async function findApprovedMercadoPagoPayment(orderId: string, token: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&sort=date_created&criteria=desc&limit=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Mercado Pago search ${response.status}: ${JSON.stringify(data)}`);
  }
  return (data?.results || []).find((payment: any) => payment?.status === 'approved' && payment?.id) || null;
}

async function reconcileApprovedMercadoPagoPayment(supabase: ReturnType<typeof createClient>, order: any, payment: any, trigger: string) {
  const paymentId = String(payment.id);
  const amountCents = Math.round(Number(payment.transaction_amount || 0));
  const currency = String(payment.currency_id || order.currency || 'CLP');

  const { data: existingPayment, error: existingError } = await supabase
    .from('payments')
    .select('id')
    .eq('provider', 'mercado_pago')
    .eq('external_id', paymentId)
    .is('deleted_at', null)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existingPayment?.id) {
    const { error } = await supabase
      .from('payments')
      .update({ status: 'paid', order_id: order.id, amount_cents: amountCents, currency, payload: payment, updated_at: new Date().toISOString() })
      .eq('id', existingPayment.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('payments')
      .insert({ order_id: order.id, provider: 'mercado_pago', status: 'paid', amount_cents: amountCents, currency, external_id: paymentId, payload: payment });
    if (error) throw error;
  }

  const nextFulfillmentStatus = order.fulfillment_status === 'new' ? 'in_production' : order.fulfillment_status;
  const { error: transitionError } = await supabase.rpc('admin_transition_order_state', {
    target_order_id: order.id,
    next_payment_status: 'paid',
    next_fulfillment_status: nextFulfillmentStatus !== order.fulfillment_status ? nextFulfillmentStatus : null,
    reason: `mp_search_reconcile_${trigger}`,
  });
  if (transitionError) throw transitionError;

  const { error: orderUpdateError } = await supabase
    .from('orders')
    .update({ mp_payment_id: paymentId, paid_at: payment.date_approved || new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', order.id);
  if (orderUpdateError) throw orderUpdateError;

  return { payment_id: paymentId, amount_cents: amountCents, fulfillment_status: nextFulfillmentStatus };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const OPS_SHARED_SECRET = Deno.env.get('OPS_SHARED_SECRET');
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'Supabase env faltante' }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (!OPS_SHARED_SECRET || req.headers.get('x-ops-secret') !== OPS_SHARED_SECRET) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), {
        status: 401,
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
            .select('id, customer_name, customer_email, payment_method, payment_status, fulfillment_status, amount_cents, currency, updated_at')
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

      if (row.active_payments === 0 && meta.payment_method === 'mercado-pago' && meta.payment_status !== 'paid' && MP_ACCESS_TOKEN) {
        try {
          const payment = await findApprovedMercadoPagoPayment(row.order_id, MP_ACCESS_TOKEN);
          if (payment) {
            const reconciled = await reconcileApprovedMercadoPagoPayment(supabase, meta, payment, trigger);
            summary.auto_reconciled += 1;
            results.push({
              order_id: row.order_id,
              customer_name: meta.customer_name || null,
              status: 'mp_payment_reconciled',
              payment_status: 'paid',
              ...reconciled,
            });
            continue;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          summary.failed += 1;
          results.push({
            order_id: row.order_id,
            customer_name: meta.customer_name || null,
            status: 'failed',
            error: message,
            order_payment_status: row.order_payment_status,
            suggested_order_payment_status: row.suggested_order_payment_status,
            payment_statuses: row.payment_statuses,
          });
          log('error', 'mp_search_reconcile_failed', { order_id: row.order_id, error: message });
          continue;
        }
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
    const message = error instanceof Error ? error.message : String(error);
    log('error', 'reconciliation_unhandled_exception', { message });
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
