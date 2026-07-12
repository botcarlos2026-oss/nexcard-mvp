export const ORDER_RESTRICTED_MUTATION_FIELDS = [
  'payment_status',
  'fulfillment_status',
  'tracking_code',
  'carrier',
  'shipped_at',
  'delivered_at',
  'inventory_decremented',
  'inventory_reserved',
];

export const buildOrderHistoryEntries = (orderId, current, payload) => Object.keys(payload)
  .filter((key) => current && String(current[key]) !== String(payload[key]))
  .map((key) => ({
    order_id: orderId,
    field: key,
    old_value: String(current?.[key] || ''),
    new_value: String(payload[key]),
  }));

export const normalizeTrackingCode = (value) => String(value || '').trim().toUpperCase();

export function createOrderOperationsApi({ supabase, hasSupabase, fetchOrders }) {
  const updateOrder = async (orderId, payload) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');

    const statusKeysPresent = ORDER_RESTRICTED_MUTATION_FIELDS.filter((key) => Object.prototype.hasOwnProperty.call(payload, key));
    if (statusKeysPresent.length > 0) {
      throw new Error(`Usa el flujo server-side correspondiente para actualizar: ${statusKeysPresent.join(', ')}`);
    }

    const { data: current } = await supabase
      .from('orders').select('*').eq('id', orderId).single();

    const { error } = await supabase.from('orders').update(payload).eq('id', orderId);
    if (error) throw new Error(error.message);

    const historyEntries = buildOrderHistoryEntries(orderId, current, payload);
    if (historyEntries.length > 0) {
      await supabase.from('order_status_history').insert(historyEntries);
    }

    return fetchOrders();
  };

  const overrideOrderTestClassification = async (orderId, { is_test, test_reason }) => {
    if (!hasSupabase) {
      throw new Error('Override QA/test requiere Supabase configurado');
    }

    if (typeof is_test !== 'boolean') {
      throw new Error('Debes indicar si la orden debe quedar marcada o no como QA/test');
    }

    const { error } = await supabase.rpc('admin_override_order_test_classification', {
      target_order_id: orderId,
      target_is_test: is_test,
      target_reason: test_reason || null,
    });

    if (error) throw new Error(error.message);

    return fetchOrders();
  };

  const reviewOrderTestClassification = async (orderId, { review_note }) => {
    if (!hasSupabase) {
      throw new Error('Revisión QA/test requiere Supabase configurado');
    }

    const { error } = await supabase.rpc('admin_review_order_test_classification', {
      target_order_id: orderId,
      review_note: review_note || null,
    });

    if (error) throw new Error(error.message);

    return fetchOrders();
  };

  const updateShipping = async (orderId, { carrier, tracking_code }) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    if (!carrier) throw new Error('Carrier requerido');
    if (!tracking_code?.trim()) throw new Error('Código de seguimiento requerido');

    const trackingCode = normalizeTrackingCode(tracking_code);
    const { data: current } = await supabase
      .from('orders').select('carrier, tracking_code, fulfillment_status, shipped_at').eq('id', orderId).single();

    const payload = {
      carrier,
      tracking_code: trackingCode,
      fulfillment_status: 'shipped',
      shipped_at: current?.shipped_at || new Date().toISOString(),
    };

    const { error } = await supabase.from('orders').update(payload).eq('id', orderId);
    if (error) throw new Error(error.message);

    const historyEntries = buildOrderHistoryEntries(orderId, current, payload);
    if (historyEntries.length > 0) {
      await supabase.from('order_status_history').insert(historyEntries);
    }

    try {
      await supabase.functions.invoke('send-shipping-notification', {
        body: JSON.stringify({ order_id: orderId }),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // Email no crítico
    }

    return fetchOrders();
  };

  const dispatchOrder = async (orderId, { carrier, tracking_code }) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    if (!carrier) throw new Error('Carrier requerido');
    if (!tracking_code?.trim()) throw new Error('Código de seguimiento requerido');

    const { data: dispatchResult, error } = await supabase.rpc('admin_dispatch_order', {
      target_order_id: orderId,
      p_carrier: carrier,
      p_tracking_code: tracking_code,
    });
    if (error) throw new Error(error.message);

    try {
      const { data: allItems } = await supabase
        .from('inventory_items')
        .select('id, sku, item, stock, min_stock, stock_alert_sent_at')
        .gt('min_stock', 0);
      const lowItems = (allItems || []).filter((item) => (item.stock || 0) <= (item.min_stock || 0));
      if (lowItems.length > 0) {
        await supabase.functions.invoke('send-low-stock-alert', {
          body: JSON.stringify({ items: lowItems.map((item) => ({ name: item.item || item.sku, sku: item.sku, stock: item.stock, min_stock: item.min_stock })) }),
          headers: { 'Content-Type': 'application/json' },
        });
        await supabase.from('inventory_items')
          .update({ stock_alert_sent_at: new Date().toISOString() })
          .in('id', lowItems.map((item) => item.id));
      }
    } catch {
      // Alerta no crítica, no bloquear despacho
    }

    try {
      await supabase.functions.invoke('send-shipping-notification', {
        body: JSON.stringify({ order_id: orderId }),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // Email no crítico
    }

    const orders = await fetchOrders();
    return { ...orders, itemsDecremented: dispatchResult?.items_decremented || [] };
  };

  const linkOrderCard = async (orderId, cardId) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { data: card, error: fetchError } = await supabase
      .from('cards')
      .select('id, order_id, profile_id, status, deleted_at')
      .eq('id', cardId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);
    if (!card) throw new Error('Card no encontrada');
    if (card.deleted_at) throw new Error('No puedes vincular una card archivada');
    if (card.order_id && card.order_id !== orderId) throw new Error('Esta card ya está vinculada a otra orden');
    if (card.profile_id) throw new Error('Esta card ya está asignada a un perfil');
    if (['revoked', 'archived'].includes(card.status)) throw new Error(`No puedes vincular una card en estado ${card.status}`);

    const { error } = await supabase
      .from('cards')
      .update({ order_id: orderId, updated_at: new Date().toISOString() })
      .eq('id', cardId);
    if (error) throw new Error(error.message);
    return fetchOrders();
  };

  const updateCardNFC = async (cardId, { nfc_url }) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase
      .from('cards')
      .update({
        nfc_url,
        programmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', cardId);
    if (error) throw new Error(error.message);
    return fetchOrders();
  };

  return {
    updateOrder,
    overrideOrderTestClassification,
    reviewOrderTestClassification,
    updateShipping,
    dispatchOrder,
    linkOrderCard,
    updateCardNFC,
  };
}
