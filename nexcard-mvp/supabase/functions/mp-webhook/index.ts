import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const log = (level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) => {
  console.log(JSON.stringify({ level, event, data, ts: new Date().toISOString() }));
};

async function mpGetJson(path: string, token: string) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`MP ${path} respondió ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

async function resolvePaymentFromWebhook(topic: string, entityId: string, token: string) {
  if (topic === 'payment') {
    return mpGetJson(`/v1/payments/${entityId}`, token);
  }

  if (topic === 'merchant_order') {
    const merchantOrder = await mpGetJson(`/merchant_orders/${entityId}`, token);
    const approvedPayment = (merchantOrder?.payments || []).find((payment: Record<string, unknown>) =>
      payment?.status === 'approved' && payment?.id
    );
    const fallbackPayment = (merchantOrder?.payments || []).find((payment: Record<string, unknown>) => payment?.id);
    const paymentId = approvedPayment?.id || fallbackPayment?.id;

    if (!paymentId) {
      throw new Error(`Merchant order ${entityId} sin payments utilizables`);
    }

    return mpGetJson(`/v1/payments/${paymentId}`, token);
  }

  throw new Error(`Topic no soportado: ${topic}`);
}

function normalizePaymentAmount(payment: Record<string, unknown>) {
  const transactionDetails = payment?.transaction_details && typeof payment.transaction_details === 'object'
    ? payment.transaction_details as Record<string, unknown>
    : null;
  const amount = Number(payment?.transaction_amount ?? transactionDetails?.total_paid_amount ?? 0);
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

async function persistPaymentLedger(
  supabase: ReturnType<typeof createClient>,
  {
    orderId,
    mpPaymentId,
    mappedStatus,
    payment,
  }: {
    orderId: string;
    mpPaymentId: string;
    mappedStatus: string;
    payment: Record<string, unknown>;
  },
) {
  const amountCents = normalizePaymentAmount(payment);
  const currency = String(payment?.currency_id || 'CLP');

  const { data: existingPayments, error: fetchPaymentError } = await supabase
    .from('payments')
    .select('id, status, external_id')
    .eq('provider', 'mercado_pago')
    .eq('external_id', mpPaymentId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (fetchPaymentError) {
    throw new Error(`No se pudo consultar ledger payments: ${fetchPaymentError.message}`);
  }

  const existingPayment = existingPayments?.[0] || null;

  if (existingPayment) {
    if (existingPayment.status !== mappedStatus || existingPayment.external_id !== mpPaymentId) {
      const { error: paymentStatusError } = await supabase.rpc('mark_payment_status', {
        target_payment_id: existingPayment.id,
        new_status: mappedStatus,
        actor_id: null,
        reason: 'mp_webhook_reconciliation',
        external_ref: mpPaymentId,
      });

      if (paymentStatusError) {
        throw new Error(`No se pudo actualizar payment ledger vía RPC: ${paymentStatusError.message}`);
      }
    }

    const { error: updatePaymentError } = await supabase
      .from('payments')
      .update({
        amount_cents: amountCents,
        currency,
        payload: payment,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingPayment.id);

    if (updatePaymentError) {
      throw new Error(`No se pudo actualizar payment ledger: ${updatePaymentError.message}`);
    }

    return { paymentId: existingPayment.id, existed: true };
  }

  const { data: insertedPayment, error: insertPaymentError } = await supabase
    .from('payments')
    .insert({
      order_id: orderId,
      provider: 'mercado_pago',
      status: mappedStatus,
      amount_cents: amountCents,
      currency,
      external_id: mpPaymentId,
      payload: payment,
    })
    .select('id')
    .single();

  if (insertPaymentError) {
    throw new Error(`No se pudo insertar payment ledger: ${insertPaymentError.message}`);
  }

  return { paymentId: insertedPayment?.id || null, existed: false };
}

async function persistOrderPaymentReference(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  currentMpPaymentId: string | null | undefined,
  nextMpPaymentId: string,
) {
  if (currentMpPaymentId === nextMpPaymentId) return;

  const { error } = await supabase
    .from('orders')
    .update({ mp_payment_id: nextMpPaymentId })
    .eq('id', orderId);

  if (error) {
    throw new Error(`No se pudo persistir mp_payment_id: ${error.message}`);
  }
}

async function applyOrderPaymentOutcome(
  supabase: ReturnType<typeof createClient>,
  {
    orderId,
    currentPaymentStatus,
    currentFulfillmentStatus,
    mappedStatus,
  }: {
    orderId: string;
    currentPaymentStatus: string;
    currentFulfillmentStatus: string;
    mappedStatus: string;
  },
) {
  const nextFulfillmentStatus = mappedStatus === 'paid' && currentFulfillmentStatus === 'new'
    ? 'in_production'
    : currentFulfillmentStatus;

  const nextPaymentStatus = currentPaymentStatus === 'paid' && mappedStatus !== 'paid'
    ? currentPaymentStatus
    : mappedStatus;

  const shouldTransitionPayment = nextPaymentStatus !== currentPaymentStatus;
  const shouldTransitionFulfillment = nextFulfillmentStatus !== currentFulfillmentStatus;

  if (!shouldTransitionPayment && !shouldTransitionFulfillment) {
    return {
      changed: false,
      nextPaymentStatus,
      nextFulfillmentStatus,
      downgradeIgnored: currentPaymentStatus === 'paid' && mappedStatus !== 'paid',
    };
  }

  const { error } = await supabase.rpc('admin_transition_order_state', {
    target_order_id: orderId,
    next_payment_status: shouldTransitionPayment ? nextPaymentStatus : null,
    next_fulfillment_status: shouldTransitionFulfillment ? nextFulfillmentStatus : null,
    reason: 'mp_webhook_reconciliation',
  });

  if (error) {
    throw new Error(`No se pudo reconciliar orden vía RPC: ${error.message}`);
  }

  return {
    changed: true,
    nextPaymentStatus,
    nextFulfillmentStatus,
    downgradeIgnored: false,
  };
}

async function ensureProfileActivationFlow(supabase: ReturnType<typeof createClient>, supabaseUrl: string, serviceRoleKey: string, orderId: string, payerEmail?: string) {
  const { data: existingClaim } = await supabase
    .from('profile_claims')
    .select('id, claim_token, status')
    .eq('order_id', orderId)
    .maybeSingle();

  let claimToken = existingClaim?.claim_token;
  let claimStatus = existingClaim?.status || null;

  if (!existingClaim) {
    const [{ data: orderRow }, { data: orderItems }] = await Promise.all([
      supabase
        .from('orders')
        .select('customer_email')
        .eq('id', orderId)
        .single(),
      supabase
        .from('order_items')
        .select('quantity')
        .eq('order_id', orderId),
    ]);

    const totalQuantity = (orderItems || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    claimToken = crypto.randomUUID().replaceAll('-', '');

    const { error: claimInsertError } = await supabase
      .from('profile_claims')
      .insert({
        order_id: orderId,
        customer_email: orderRow?.customer_email || payerEmail || 'sin-email@nexcard.cl',
        claim_token: claimToken,
        quantity: Math.max(totalQuantity, 1),
        status: 'pending',
      });

    if (claimInsertError) {
      log('error', 'profile_claim_insert_failed', { order_id: orderId, error: claimInsertError.message });
      return;
    }

    claimStatus = 'pending';
    log('info', 'profile_claim_created', { order_id: orderId });
  }

  if (!claimToken || claimStatus === 'claimed') {
    log('info', 'profile_activation_not_needed', { order_id: orderId, claim_status: claimStatus });
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-profile-activation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ order_id: orderId }),
    });

    const responseData = await response.json().catch(() => ({}));
    if (!response.ok || responseData?.success === false) {
      log('warn', 'profile_activation_trigger_failed', {
        order_id: orderId,
        status: response.status,
        response: responseData,
      });
      return;
    }

    log('info', 'profile_activation_triggered', { order_id: orderId });
  } catch (notifyError) {
    log('warn', 'profile_activation_trigger_failed', { order_id: orderId, error: notifyError.message });
  }
}

serve(async (req) => {
  try {
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!MP_ACCESS_TOKEN || !SUPABASE_SERVICE_ROLE_KEY) {
      log('error', 'missing_env_vars', {
        has_mp_token: !!MP_ACCESS_TOKEN,
        has_service_role: !!SUPABASE_SERVICE_ROLE_KEY,
      });
      return new Response('error', { status: 500 });
    }

    const url = new URL(req.url);
    const topic = url.searchParams.get('topic') || url.searchParams.get('type');
    const id = url.searchParams.get('id') || url.searchParams.get('data.id');

    log('info', 'webhook_received', { topic, id });

    // MP envía un POST con body también
    let bodyId = id;
    if (!bodyId) {
      try {
        const body = await req.json();
        bodyId = body?.data?.id || body?.id;
        log('info', 'webhook_body_parsed', { bodyId });
      } catch {
        // ignore
      }
    }

    if (!bodyId || (topic !== 'payment' && topic !== 'merchant_order')) {
      log('warn', 'webhook_ignored', { bodyId, topic });
      return new Response('ok', { status: 200 });
    }

    const payment = await resolvePaymentFromWebhook(topic, String(bodyId), MP_ACCESS_TOKEN);
    log('info', 'mp_payment_fetched', { payment_id: bodyId, topic, status: payment.status, external_reference: payment.external_reference });

    const orderId = payment.external_reference;
    const status = payment.status;

    if (!orderId) {
      log('warn', 'no_external_reference', { payment_id: bodyId });
      return new Response('ok', { status: 200 });
    }

    const paymentStatusMap: Record<string, string> = {
      approved: 'paid',
      rejected: 'failed',
      pending: 'pending',
      in_process: 'pending',
      cancelled: 'failed',
    };

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const mappedStatus = paymentStatusMap[status] ?? 'pending';
    const mpPaymentId = String(bodyId);

    // Idempotencia: verificar estado actual antes de actualizar
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('payment_status, fulfillment_status, mp_payment_id')
      .eq('id', orderId)
      .single();

    if (fetchError) {
      log('error', 'supabase_fetch_failed', { order_id: orderId, error: fetchError.message });
      return new Response('error', { status: 500 });
    }

    if (!currentOrder) {
      log('warn', 'order_not_found', { order_id: orderId });
      return new Response('ok', { status: 200 });
    }

    // Si la orden ya está pagada, no degradamos su estado por eventos tardíos o de otra fuente.
    // Solo reintentamos activación cuando corresponde.
    await persistPaymentLedger(supabase, { orderId, mpPaymentId, mappedStatus, payment });

    await persistOrderPaymentReference(supabase, orderId, currentOrder.mp_payment_id, mpPaymentId);

    const transition = await applyOrderPaymentOutcome(supabase, {
      orderId,
      currentPaymentStatus: currentOrder.payment_status,
      currentFulfillmentStatus: currentOrder.fulfillment_status,
      mappedStatus,
    });

    log('info', 'order_updated', {
      order_id: orderId,
      mapped_status: mappedStatus,
      payment_status: transition.nextPaymentStatus,
      fulfillment_status: transition.nextFulfillmentStatus,
      changed: transition.changed,
      downgrade_ignored: transition.downgradeIgnored,
    });

    if (mappedStatus === 'paid') {
      await ensureProfileActivationFlow(supabase, SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, orderId, payment.payer?.email);
    }

    return new Response('ok', { status: 200 });

  } catch (error) {
    log('error', 'webhook_unhandled_exception', { message: error.message });
    return new Response('error', { status: 500 });
  }
});
