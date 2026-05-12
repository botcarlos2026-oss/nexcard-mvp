export function createPaymentsApi({ supabase, hasSupabase, fetchOrders }) {
  const transitionOrderState = async (orderId, { payment_status, fulfillment_status, reason }) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { data, error } = await supabase.rpc('admin_transition_order_state', {
      target_order_id: orderId,
      next_payment_status: payment_status ?? null,
      next_fulfillment_status: fulfillment_status ?? null,
      reason: reason || null,
    });
    if (error) throw new Error(error.message);
    const orders = await fetchOrders();
    return { ...orders, transition: data };
  };

  const getRefundForOrder = async (orderId) => {
    if (!hasSupabase) return null;
    const { data, error } = await supabase
      .from('refunds')
      .select('*')
      .eq('order_id', orderId)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  };

  const createRefund = async ({ orderId, reason, amount_cents, notes }) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('payment_status, fulfillment_status, amount_cents')
      .eq('id', orderId)
      .single();
    if (orderError) throw new Error(orderError.message);
    if (order?.payment_status !== 'paid') throw new Error('Solo puedes reembolsar órdenes pagadas');
    if (order?.fulfillment_status === 'delivered') throw new Error('No puedes reembolsar una orden ya entregada desde este flujo');
    if (Number(amount_cents) <= 0) throw new Error('Monto de reembolso inválido');
    if (Number(amount_cents) > Number(order?.amount_cents || 0)) throw new Error('El reembolso no puede superar el total de la orden');

    const { data: refund, error: insertError } = await supabase
      .from('refunds')
      .insert([{ order_id: orderId, reason, amount_cents, notes: notes || null, status: 'pending' }])
      .select()
      .single();
    if (insertError) throw new Error(insertError.message);

    const { data: fnData, error: fnError } = await supabase.functions.invoke('process-refund', {
      body: JSON.stringify({ orderId, amount_cents, reason, refundId: refund.id }),
      headers: { 'Content-Type': 'application/json' },
    });

    if (fnError) throw new Error(fnError.message || 'Error al procesar reembolso en MP');
    if (!fnData?.success) throw new Error(fnData?.error || 'Mercado Pago rechazó el reembolso');

    return {
      refund: { ...refund, status: 'processed', mp_refund_id: fnData.mp_refund_id },
      mp_refund_id: fnData.mp_refund_id,
    };
  };

  const getPendingRefundsCount = async () => {
    if (!hasSupabase) return 0;
    const { count } = await supabase
      .from('refunds')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    return count || 0;
  };

  return {
    transitionOrderState,
    getRefundForOrder,
    createRefund,
    getPendingRefundsCount,
  };
}
