const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const uniqById = (rows = []) => Array.from(
  new Map((rows || []).filter(Boolean).map((row) => [row.id, row])).values()
);

const deriveOrderObservability = ({ order, claim, relatedCards }) => {
  const activeCardsCount = relatedCards.filter((card) => card.status === 'active' || card.activation_status === 'activated').length;
  const programmedCardsCount = relatedCards.filter((card) => card.nfc_url || card.programmed_at || card.status === 'programmed').length;
  const assignedCardsCount = relatedCards.filter((card) => card.profile_id || card.activation_status === 'assigned').length;
  const activationClaimed = claim?.status === 'claimed';
  const activationCompleted = Boolean(order.activated_at) || activeCardsCount > 0 || activationClaimed;
  const paymentPaid = order.payment_status === 'paid';
  const deliveryReady = paymentPaid && ['ready', 'shipped', 'delivered'].includes(order.fulfillment_status);
  const cardLifecycleReady = relatedCards.length > 0;
  const activationReady = paymentPaid && programmedCardsCount > 0;

  let funnelStage = 'pre_paid';
  if (paymentPaid) funnelStage = 'paid';
  if (paymentPaid && ['ready', 'shipped', 'delivered'].includes(order.fulfillment_status)) funnelStage = 'ready';
  if (paymentPaid && ['shipped', 'delivered'].includes(order.fulfillment_status)) funnelStage = 'shipped';
  if (paymentPaid && order.fulfillment_status === 'delivered') funnelStage = 'delivered';
  if (paymentPaid && activationCompleted) funnelStage = 'activated';

  const observabilityAlerts = [];
  if (paymentPaid && order.fulfillment_status === 'new') {
    observabilityAlerts.push('Pagada sin entrar a producción');
  }
  if (['ready', 'shipped', 'delivered'].includes(order.fulfillment_status) && relatedCards.length === 0) {
    observabilityAlerts.push('Orden avanzada sin card vinculada');
  }
  if (order.fulfillment_status === 'delivered' && !activationCompleted) {
    observabilityAlerts.push('Entregada sin activación cerrada');
  }
  if (activationCompleted && !['delivered', 'shipped'].includes(order.fulfillment_status)) {
    observabilityAlerts.push('Activación detectada antes de entrega confirmada');
  }
  if (claim?.status === 'pending' && order.fulfillment_status === 'delivered') {
    observabilityAlerts.push('Claim pendiente post-entrega');
  }

  let terminalState = null;
  if (['failed', 'cancelled', 'refunded'].includes(order.payment_status)) {
    terminalState = order.payment_status;
  } else if (activationCompleted) {
    terminalState = 'activated';
  } else if (order.fulfillment_status === 'delivered') {
    terminalState = 'delivered_pending_activation';
  } else if (order.fulfillment_status === 'cancelled') {
    terminalState = 'cancelled';
  }

  const activationLastAt = order.activated_at || (claim?.status === 'claimed'
    ? claim.updated_at
    : relatedCards
      .map((card) => card.activated_at)
      .filter(Boolean)
      .sort()
      .slice(-1)[0]) || null;

  return {
    related_cards: relatedCards,
    activation_claim: claim || null,
    active_cards_count: activeCardsCount,
    assigned_cards_count: assignedCardsCount,
    programmed_cards_count: programmedCardsCount,
    activation_ready_count: programmedCardsCount,
    activation_ready: activationReady,
    activation_completed: activationCompleted,
    card_lifecycle_ready: cardLifecycleReady,
    delivery_ready: deliveryReady,
    funnel_stage: funnelStage,
    terminal_state: terminalState,
    observability_alerts: observabilityAlerts,
    payment_paid: paymentPaid,
    activation_last_at: activationLastAt,
  };
};

export function createOrdersApi({ supabase, hasSupabase, getClerkUserId }) {
  const createOrder = async (payload) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    if (!payload.customer_name?.trim()) throw new Error('Nombre del cliente requerido');
    if (!payload.customer_email?.trim()) throw new Error('Email del cliente requerido');
    if (!payload.items?.length) throw new Error('La orden debe tener al menos un producto');

    const userId = getClerkUserId() || null;

    const orderData = {
      user_id: userId,
      customer_name: payload.customer_name.trim(),
      customer_email: payload.customer_email.trim().toLowerCase(),
      customer_phone: payload.customer_phone?.trim() || null,
      customer_address: payload.customer_address?.trim() || null,
      payment_method: payload.payment_method,
      amount_cents: payload.amount_cents,
      coupon_code: payload.coupon_code || null,
      currency: payload.currency || 'CLP',
      card_customization: payload.card_customization || null,
      requires_invoice: payload.requires_invoice || false,
      invoice_rut: payload.invoice_rut || null,
      invoice_razon_social: payload.invoice_razon_social || null,
    };

    const orderItems = payload.items.map((item) => ({
      product_id: item.product_id,
      quantity: Number(item.quantity) || 1,
      currency: payload.currency || 'CLP',
    }));

    const { data: orderId, error: rpcError } = await supabase.rpc('create_order_with_items', {
      p_order: orderData,
      p_items: orderItems,
    });

    if (rpcError) throw new Error(rpcError.message || 'No se pudo crear la orden');
    if (!orderId) throw new Error('La orden fue creada pero no retornó un ID');

    const { data: createdOrder, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !createdOrder) throw new Error('Orden creada pero no se pudo recuperar');

    const { data: storedItems } = await supabase
      .from('order_items')
      .select('product_id, quantity, unit_price_cents')
      .eq('order_id', orderId);

    const productNameMap = Object.fromEntries(
      (payload.items || []).map((item) => [item.product_id, item.product_name || item.product_id])
    );

    try {
      const emailPayload = {
        order: createdOrder,
        card_customization: payload.card_customization || null,
        items: (storedItems?.length ? storedItems : payload.items).map((item) => ({
          product_id: item.product_id,
          product_name: productNameMap[item.product_id] || item.product_id,
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
        })),
      };
      await supabase.functions.invoke('send-order-confirmation', {
        body: JSON.stringify(emailPayload),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // Email no crítico, continuar sin bloquear
    }

    return createdOrder;
  };

  const getOrders = async () => {
    if (!hasSupabase) return { orders: [] };

    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*), payments(*)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    const orders = data || [];
    if (orders.length === 0) return { orders: [] };

    const [cardsRes, orderCardsRes, claimsRes, profilesRes] = await Promise.all([
      supabase
        .from('cards')
        .select('id, order_id, profile_id, card_code, status, activation_status, nfc_url, programmed_at, assigned_at, activated_at, created_at, updated_at, deleted_at')
        .is('deleted_at', null),
      supabase
        .from('order_cards')
        .select('order_id, card_id, linked_by, created_at'),
      supabase
        .from('profile_claims')
        .select('order_id, card_id, customer_email, status, claimed_by_user_id, claimed_profile_id, created_at, updated_at, expires_at'),
      supabase
        .from('profiles')
        .select('id, slug, full_name, contact_email, deleted_at')
        .is('deleted_at', null),
    ]);

    const cards = cardsRes.data || [];
    const orderCards = orderCardsRes.data || [];
    const claims = claimsRes.data || [];
    const profiles = profilesRes.data || [];
    const profileMap = Object.fromEntries(profiles.map((profile) => [profile.id, profile]));
    const cardMap = Object.fromEntries(cards.map((card) => [card.id, card]));
    const claimByOrderId = Object.fromEntries(claims.map((claim) => [claim.order_id, claim]));

    const directCardsByOrderId = cards.reduce((acc, card) => {
      if (!card.order_id) return acc;
      if (!acc[card.order_id]) acc[card.order_id] = [];
      acc[card.order_id].push(card);
      return acc;
    }, {});

    const formalCardsByOrderId = orderCards.reduce((acc, link) => {
      const linkedCard = cardMap[link.card_id];
      if (!linkedCard) return acc;
      if (!acc[link.order_id]) acc[link.order_id] = [];
      acc[link.order_id].push({ ...linkedCard, order_card_linked_at: link.created_at });
      return acc;
    }, {});

    const cardsByEmail = cards.reduce((acc, card) => {
      const email = normalizeEmail(profileMap[card.profile_id]?.contact_email);
      if (!email) return acc;
      if (!acc[email]) acc[email] = [];
      acc[email].push(card);
      return acc;
    }, {});

    const enrichedOrders = orders.map((order) => {
      const emailKey = normalizeEmail(order.customer_email);
      const claim = claimByOrderId[order.id] || null;
      const formalCards = formalCardsByOrderId[order.id] || [];
      const directCards = directCardsByOrderId[order.id] || [];
      const heuristicCards = formalCards.length || directCards.length ? [] : (cardsByEmail[emailKey] || []);
      const relatedCards = uniqById([...formalCards, ...directCards, ...heuristicCards]).map((card) => ({
        ...card,
        profile_name: profileMap[card.profile_id]?.full_name || profileMap[card.profile_id]?.slug || null,
        order_id: order.id,
      }));

      return {
        ...order,
        related_cards_source: formalCards.length || directCards.length ? 'order_cards' : 'heuristic',
        ...deriveOrderObservability({ order, claim, relatedCards }),
      };
    });

    return { orders: enrichedOrders };
  };

  return {
    createOrder,
    getOrders,
  };
}
