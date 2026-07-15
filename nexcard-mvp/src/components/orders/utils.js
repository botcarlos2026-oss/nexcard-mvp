import { deriveOrderTestClassification, isManualTestReason } from '../../utils/orderOperationalSegmentation';

export const currency = (cents) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(cents);
};

export const formatLabel = (value) => (value ? String(value).replace(/_/g, ' ') : '—');

export const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

export const formatActorLabel = (entry) => {
  if (!entry) return 'sistema';
  if (entry.actor_label) return entry.actor_label;
  if (entry.actor_role === 'service_role') return 'service_role';
  if (entry.actor_user_id) return `admin ${String(entry.actor_user_id).slice(0, 8)}`;
  if (entry.actor_role) return entry.actor_role;
  return 'sistema';
};

export const buildQaDecisionTimeline = (order, history = []) => {
  if (!order) return [];

  const events = [];
  const pushEvent = (event) => {
    if (!event?.at) return;
    events.push(event);
  };

  pushEvent({
    key: `classified-${order.id}`,
    type: 'classified',
    title: order.isNonOperational ? 'Clasificación QA detectada' : 'Clasificación operativa real',
    at: order.created_at,
    actor: 'sistema',
    tone: order.isNonOperational ? 'warning' : 'default',
    detail: order.testReasonResolved
      ? `Motivo inicial: ${formatLabel(order.testReasonResolved)}`
      : 'Sin motivo de exclusión inicial.',
  });

  const sortedHistory = [...history].sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());

  sortedHistory.forEach((entry, index) => {
    if (entry.field === 'is_test') {
      const turnedQa = entry.new_value === 'true';
      pushEvent({
        key: `override-${index}-${entry.changed_at}`,
        type: turnedQa ? 'override_to_qa' : 'restore_real',
        title: turnedQa ? 'Override manual a QA/test' : 'Restore manual a operación real',
        at: entry.changed_at,
        actor: formatActorLabel(entry),
        tone: turnedQa ? 'warning' : 'success',
        detail: turnedQa ? 'La orden fue excluida manualmente de la operación real.' : 'La orden volvió manualmente a operación real.',
      });
    }

    if (entry.field === 'qa_reviewed_at') {
      pushEvent({
        key: `review-${index}-${entry.changed_at}`,
        type: 'reviewed',
        title: 'Revisión QA registrada',
        at: entry.changed_at,
        actor: formatActorLabel(entry),
        tone: 'info',
        detail: order.qa_review_note ? `Nota: ${order.qa_review_note}` : 'Sin nota de auditoría.',
      });
    }
  });

  if (order.qa_override_at && !sortedHistory.some((entry) => entry.field === 'is_test' && entry.new_value === 'true')) {
    pushEvent({
      key: `override-fallback-${order.id}`,
      type: 'override_to_qa',
      title: 'Override manual a QA/test',
      at: order.qa_override_at,
      actor: order.qa_override_by_label || 'admin',
      tone: 'warning',
      detail: 'Reconstruido desde campos persistidos de SLA QA.',
    });
  }

  if (order.qa_reviewed_at && !sortedHistory.some((entry) => entry.field === 'qa_reviewed_at')) {
    pushEvent({
      key: `review-fallback-${order.id}`,
      type: 'reviewed',
      title: 'Revisión QA registrada',
      at: order.qa_reviewed_at,
      actor: order.qa_reviewed_by_label || 'admin',
      tone: 'info',
      detail: order.qa_review_note ? `Nota: ${order.qa_review_note}` : 'Sin nota de auditoría.',
    });
  }

  if (order.qa_override_resolved_at && !sortedHistory.some((entry) => entry.field === 'is_test' && entry.new_value === 'false')) {
    pushEvent({
      key: `restore-fallback-${order.id}`,
      type: 'restore_real',
      title: 'Restore manual a operación real',
      at: order.qa_override_resolved_at,
      actor: 'admin',
      tone: 'success',
      detail: 'Reconstruido desde timestamp de resolución del override.',
    });
  }

  return events
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .map((event, index, list) => ({
      ...event,
      isLast: index === list.length - 1,
    }));
};

export const deriveManualOverrideSeverity = (order) => {
  if (!isManualTestReason(order?.testReasonResolved || order?.test_reason)) {
    return { level: null, score: 0, ageHours: 0 };
  }
  const overrideAtMs = new Date(order?.qa_override_at || order?.updated_at || order?.created_at).getTime();
  const ageHours = Number.isNaN(overrideAtMs) ? 0 : Math.round((Date.now() - overrideAtMs) / (1000 * 60 * 60));
  const isPaid = order?.payment_status === 'paid';
  const notShipped = !['shipped', 'delivered'].includes(order?.fulfillment_status);
  const notActivated = !order?.activation_completed;
  const notReady = !['ready', 'shipped', 'delivered'].includes(order?.fulfillment_status);
  let level = 'low';
  let score = 1;
  if (ageHours >= 72) { level = 'medium'; score += 2; }
  else if (ageHours >= 24) { level = 'low'; score += 1; }
  if (isPaid && notActivated) { level = 'high'; score += 3; }
  if (isPaid && notShipped && notActivated && ageHours >= 72) { level = 'critical'; score += 4; }
  else if (isPaid && notReady && ageHours >= 24) { level = level === 'critical' ? 'critical' : 'high'; score += 2; }
  return { level, score, ageHours };
};

export const paymentBadgeVariant = (status) => {
  if (status === 'paid') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'failed' || status === 'cancelled') return 'danger';
  if (status === 'refunded') return 'default';
  return 'default';
};

export const fulfillmentBadgeVariant = (status) => {
  if (status === 'delivered') return 'success';
  if (status === 'shipped' || status === 'in_production') return 'info';
  if (status === 'new') return 'warning';
  if (status === 'cancelled') return 'danger';
  if (status === 'ready') return 'success';
  return 'default';
};

export const deriveActivationStatus = (order) => {
  if (order?.active_cards_count > 0 || order?.activation_completed) return { label: 'Activa', variant: 'success' };
  if (order?.programmed_cards_count > 0 || order?.activation_ready) return { label: 'NFC programado', variant: 'info' };
  if (order?.related_cards?.length > 0) return { label: 'Card vinculada', variant: 'info' };
  if (order?.activation_claim?.status === 'claimed') return { label: 'Claim tomado', variant: 'success' };
  if (order?.activation_claim?.status === 'pending') return { label: 'Claim pendiente', variant: 'warning' };
  return { label: 'Sin claim', variant: 'default' };
};

const HOURS_MS = 60 * 60 * 1000;

const ageHours = (dateValue, now = new Date()) => {
  if (!dateValue) return 0;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, (now.getTime() - date.getTime()) / HOURS_MS);
};

export const deriveOrderSlaAlert = (order, now = new Date()) => {
  if (!order) return null;
  if (order.payment_status === 'paid' && !order.related_cards?.length && ['ready', 'shipped', 'delivered'].includes(order.fulfillment_status)) {
    return { label: 'Pagada sin card', level: 'critical' };
  }
  if (order.payment_status === 'paid' && order.fulfillment_status === 'new' && ageHours(order.paid_at || order.created_at, now) > 24) {
    return { label: '>24h sin producción', level: 'warning' };
  }
  if (order.payment_status === 'paid' && order.fulfillment_status === 'ready' && !order.tracking_code && ageHours(order.ready_at || order.updated_at || order.created_at, now) > 12) {
    return { label: '>12h sin tracking', level: 'warning' };
  }
  if (order.fulfillment_status === 'shipped' && ageHours(order.shipped_at || order.updated_at || order.created_at, now) > 72) {
    return { label: '>72h sin entrega', level: 'warning' };
  }
  if (order.fulfillment_status === 'delivered' && !order.activation_completed && ageHours(order.delivered_at || order.updated_at || order.created_at, now) > 24) {
    return { label: '>24h sin activación', level: 'critical' };
  }
  return null;
};

export const OPERATIONAL_FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'paid_new', label: 'Pagadas nuevas' },
  { key: 'in_production', label: 'En producción' },
  { key: 'ready_to_ship', label: 'Listas despacho' },
  { key: 'shipped_pending_delivery', label: 'Despachadas' },
  { key: 'delivered_pending_activation', label: 'Entrega sin activación' },
  { key: 'alerts', label: 'Con alerta' },
];

export const KANBAN_LANES = [
  { key: 'paid_new', label: 'Pagadas nuevas', description: 'Compras pagadas que todavía no entran a producción' },
  { key: 'in_production', label: 'En producción', description: 'Pedidos en armado, diseño o programación NFC' },
  { key: 'ready_to_ship', label: 'Listas despacho', description: 'Órdenes listas para asignar courier y tracking' },
  { key: 'shipped_pending_delivery', label: 'Despachadas', description: 'En ruta, pendientes de confirmación de entrega' },
  { key: 'delivered', label: 'Entregadas', description: 'Entregadas y sin alertas activas' },
  { key: 'alerts', label: 'Problemas', description: 'Excepciones, activaciones pendientes o drift operativo' },
];

export const KANBAN_PRIORITY_ORDER = [
  'alerts',
  'ready_to_ship',
  'paid_new',
  'in_production',
  'shipped_pending_delivery',
  'delivered',
];

export const matchesOperationalFilter = (order, filter = 'all') => {
  if (filter === 'all') return true;
  if (filter === 'paid_new') return order.payment_status === 'paid' && order.fulfillment_status === 'new';
  if (filter === 'in_production') return order.payment_status === 'paid' && order.fulfillment_status === 'in_production';
  if (filter === 'ready_to_ship') return order.payment_status === 'paid' && order.fulfillment_status === 'ready';
  if (filter === 'shipped_pending_delivery') return order.fulfillment_status === 'shipped';
  if (filter === 'delivered_pending_activation') return order.fulfillment_status === 'delivered' && !order.activation_completed;
  if (filter === 'alerts') return (order.observability_alerts || []).length > 0 || !!deriveOrderSlaAlert(order);
  return true;
};

export const getKanbanLaneKey = (order, now = new Date()) => {
  const hasAlerts = (order?.observability_alerts || []).length > 0;
  const hasSlaAlert = !!deriveOrderSlaAlert(order, now);
  const deliveredWithoutActivation = order?.fulfillment_status === 'delivered' && !order?.activation_completed;
  if (hasAlerts || hasSlaAlert || deliveredWithoutActivation) return 'alerts';
  if (order?.payment_status === 'paid' && order?.fulfillment_status === 'new') return 'paid_new';
  if (order?.payment_status === 'paid' && order?.fulfillment_status === 'in_production') return 'in_production';
  if (order?.payment_status === 'paid' && order?.fulfillment_status === 'ready') return 'ready_to_ship';
  if (order?.fulfillment_status === 'shipped') return 'shipped_pending_delivery';
  if (order?.fulfillment_status === 'delivered') return 'delivered';
  return null;
};

export const deriveOrderNextAction = (order) => {
  const activation = deriveActivationStatus(order);
  const hasAlerts = (order?.observability_alerts || []).length > 0;
  const slaAlert = deriveOrderSlaAlert(order);
  if (hasAlerts) return 'Revisar alerta operativa';
  if (slaAlert) return `Resolver SLA: ${slaAlert.label}`;
  if (order?.fulfillment_status === 'delivered' && !order?.activation_completed) return 'Reenviar o revisar activación';
  if (order?.payment_status !== 'paid') return 'Validar pago antes de operar';
  if (order?.fulfillment_status === 'new') return 'Pasar a producción';
  if (order?.fulfillment_status === 'in_production') {
    if (activation.label === 'Sin claim' || activation.label === 'Claim pendiente') return 'Vincular card / programar NFC';
    return 'Marcar lista para despacho';
  }
  if (order?.fulfillment_status === 'ready') return 'Asignar courier y tracking';
  if (order?.fulfillment_status === 'shipped') return 'Confirmar entrega';
  if (order?.fulfillment_status === 'delivered') return 'Cerrar seguimiento';
  return 'Revisar orden';
};

export const isOrderReadyForDispatch = (order) => {
  if (order?.payment_status !== 'paid' || order?.fulfillment_status !== 'in_production') return false;
  return Boolean(
    order?.programmed_cards_count > 0
    || order?.activation_ready
    || order?.related_cards?.some((card) => card?.nfc_url || card?.programmed_at)
  );
};

export const buildOrdersKanbanGroups = (orders = [], options = {}) => {
  const now = options.now || new Date();
  const groups = KANBAN_LANES.reduce((acc, lane) => ({ ...acc, [lane.key]: [] }), {});
  orders.forEach((order) => {
    const laneKey = getKanbanLaneKey(order, now);
    if (laneKey && groups[laneKey]) groups[laneKey].push(order);
  });
  return groups;
};

export const buildOrdersKanbanSummary = (orders = []) => {
  const groups = buildOrdersKanbanGroups(orders);
  const today = new Date().toDateString();
  return {
    today: orders.filter((order) => new Date(order.created_at).toDateString() === today).length,
    paidNew: groups.paid_new.length,
    inProduction: groups.in_production.length,
    readyToShip: groups.ready_to_ship.length,
    shipped: groups.shipped_pending_delivery.length,
    alerts: groups.alerts.length,
  };
};

export const FUNNEL_STEPS = [
  { key: 'paid', label: 'Paid' },
  { key: 'ready', label: 'Ready' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'activated', label: 'Activated' },
];

export const deriveFunnelReached = (order) => ({
  paid: order.payment_status === 'paid',
  ready: order.payment_status === 'paid' && ['ready', 'shipped', 'delivered'].includes(order.fulfillment_status),
  shipped: order.payment_status === 'paid' && ['shipped', 'delivered'].includes(order.fulfillment_status),
  delivered: order.payment_status === 'paid' && order.fulfillment_status === 'delivered',
  activated: order.payment_status === 'paid' && order.activation_completed,
});

export const deriveTraceabilityMoments = (order) => {
  const payments = order.payments || [];
  const paidAt = order.paid_at || payments.find((payment) => payment?.paid_at)?.paid_at || order.paidAt || null;
  return [
    { key: 'paid', label: 'Paid', at: paidAt, done: order.payment_status === 'paid' },
    { key: 'ready', label: 'Ready', at: order.ready_at || null, done: ['ready', 'shipped', 'delivered'].includes(order.fulfillment_status) },
    { key: 'shipped', label: 'Shipped', at: order.shipped_at || null, done: ['shipped', 'delivered'].includes(order.fulfillment_status) },
    { key: 'delivered', label: 'Delivered', at: order.delivered_at || null, done: order.fulfillment_status === 'delivered' },
    { key: 'activated', label: 'Activated', at: order.activated_at || order.activation_last_at || null, done: order.activation_completed },
  ];
};

export const normalizeOrdersForDashboard = (orders = []) => orders.map((order) => {
  const items = order.order_items || order.items || [];
  const payments = order.payments || [];
  const totalCents = order.amount_cents || 0;
  const totalCostCents = items.reduce((sum, item) => sum + ((item.unit_cost_cents || 0) * (item.quantity || 0)), 0);
  const customerName = order.customer_name || order.customer_full_name || 'Cliente sin nombre';
  const paymentRecord = payments[0] || null;
  const qaClassification = deriveOrderTestClassification(order);

  return {
    ...order,
    items,
    payments,
    totalCents,
    totalCostCents,
    grossMarginCents: totalCents - totalCostCents,
    itemCount: items.reduce((sum, item) => sum + (item.quantity || 0), 0),
    customerLabel: customerName,
    paymentProvider: paymentRecord?.provider || order.payment_method || '—',
    paymentReference: paymentRecord?.transaction_reference || '—',
    paidAt: paymentRecord?.paid_at || null,
    qaClassification,
    isNonOperational: qaClassification.isTest,
    testReasonResolved: qaClassification.reason || null,
    manualOverrideSeverity: deriveManualOverrideSeverity({ ...order, testReasonResolved: qaClassification.reason || null }),
  };
});

export const buildTestReasonCounts = (orders = []) => orders.reduce((acc, order) => {
  const reason = order.testReasonResolved || 'unclassified';
  acc[reason] = (acc[reason] || 0) + 1;
  return acc;
}, {});

export const buildTestReasonOptions = (testReasonCounts, manualOverrideCount) => {
  const base = ['all'];
  if (manualOverrideCount > 0) base.push('manual_override_only');
  return [...base, ...Object.keys(testReasonCounts).sort()];
};

export const filterAuditScopedOrders = ({
  normalizedOrders = [],
  auditFilter = 'all',
  testReasonFilter = 'all',
  overrideAgeFilter = 'all',
  reviewStatusFilter = 'all',
  riskFilter = 'all',
}) => {
  const nowMs = Date.now();
  return normalizedOrders.filter((order) => {
    const matchesAudit = auditFilter === 'all' || (auditFilter === 'excluded' && order.isNonOperational);
    const matchesReason = testReasonFilter === 'all'
      || (testReasonFilter === 'manual_override_only' && isManualTestReason(order.testReasonResolved))
      || order.testReasonResolved === testReasonFilter;
    let matchesOverrideAge = true;
    if (testReasonFilter === 'manual_override_only' && overrideAgeFilter !== 'all') {
      const updatedAtMs = new Date(order.updated_at || order.created_at).getTime();
      const ageHours = Number.isNaN(updatedAtMs) ? 0 : (nowMs - updatedAtMs) / (1000 * 60 * 60);
      matchesOverrideAge = overrideAgeFilter === '72h' ? ageHours >= 72 : ageHours >= 24;
    }
    const matchesReviewStatus = testReasonFilter !== 'manual_override_only'
      || reviewStatusFilter === 'all'
      || (reviewStatusFilter === 'pending' && !order.qa_reviewed_at)
      || (reviewStatusFilter === 'reviewed' && !!order.qa_reviewed_at);
    const matchesRisk = testReasonFilter !== 'manual_override_only'
      || riskFilter === 'all'
      || (riskFilter === 'paid_blocked'
        && order.payment_status === 'paid'
        && !['shipped', 'delivered'].includes(order.fulfillment_status)
        && !order.activation_completed);
    return matchesAudit && matchesReason && matchesOverrideAge && matchesReviewStatus && matchesRisk;
  });
};

export const filterOrdersDashboardRows = ({
  auditScopedOrders = [],
  searchTerm = '',
  paymentFilter = 'all',
  fulfillmentFilter = 'all',
  dateFilter = 'all',
  testReasonFilter = 'all',
  operationalFilter = 'all',
}) => {
  const term = searchTerm.trim().toLowerCase();
  const now = new Date();

  const baseOrders = auditScopedOrders.filter((order) => {
    const matchesPayment = paymentFilter === 'all' || order.payment_status === paymentFilter;
    const matchesFulfillment = fulfillmentFilter === 'all' || order.fulfillment_status === fulfillmentFilter;
    const matchesOperational = matchesOperationalFilter(order, operationalFilter);

    if (dateFilter !== 'all') {
      const orderDate = new Date(order.created_at);
      if (dateFilter === 'today') {
        if (orderDate.toDateString() !== now.toDateString()) return false;
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        if (orderDate < weekAgo) return false;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
        if (orderDate < monthAgo) return false;
      }
    }

    if (!matchesPayment || !matchesFulfillment || !matchesOperational) return false;
    if (!term) return true;

    const haystack = [
      order.id,
      order.customerLabel,
      order.customer_email,
      order.customer_phone,
      order.payment_method,
      order.fulfillment_status,
      order.payment_status,
      order.testReasonResolved,
    ].filter(Boolean).join(' ').toLowerCase();

    return haystack.includes(term);
  });

  if (testReasonFilter === 'manual_override_only') {
    return [...baseOrders].sort((a, b) => {
      const scoreDelta = (b.manualOverrideSeverity?.score || 0) - (a.manualOverrideSeverity?.score || 0);
      if (scoreDelta !== 0) return scoreDelta;
      return (b.manualOverrideSeverity?.ageHours || 0) - (a.manualOverrideSeverity?.ageHours || 0);
    });
  }

  return baseOrders;
};

export const filterOrdersKanbanRows = (orders = [], { showQa = false } = {}) => (
  showQa ? orders : orders.filter((order) => !order.isNonOperational)
);

export const buildOrdersDashboardStats = (auditScopedOrders = []) => {
  const paidOrders = auditScopedOrders.filter((order) => order.payment_status === 'paid');
  const paidRevenue = paidOrders.reduce((sum, order) => sum + order.totalCents, 0);
  const pendingOrders = auditScopedOrders.filter((order) => order.payment_status === 'paid' && !order.activation_completed).length;
  const overdueOrders = auditScopedOrders.filter((order) => {
    if (order.payment_status !== 'paid' || order.activation_completed) return false;
    const paidAtMs = new Date(order.paid_at || order.updated_at || order.created_at).getTime();
    if (Number.isNaN(paidAtMs)) return false;
    return ((Date.now() - paidAtMs) / (1000 * 60 * 60)) >= 24;
  }).length;
  const avgTicket = auditScopedOrders.length ? auditScopedOrders.reduce((sum, order) => sum + order.totalCents, 0) / auditScopedOrders.length : 0;

  return [
    { label: 'Ventas cobradas', value: currency(paidRevenue), accent: 'emerald' },
    { label: 'Pedidos abiertos', value: `${pendingOrders}`, accent: 'amber' },
    { label: 'SLA en riesgo', value: `${overdueOrders}`, accent: 'red' },
    { label: 'Ticket promedio', value: currency(avgTicket), accent: null },
  ];
};

export const buildOrdersDashboardFunnelSnapshot = (auditScopedOrders = []) => {
  const paidBase = auditScopedOrders.filter((order) => order.payment_status === 'paid').length;
  const counts = FUNNEL_STEPS.map((step) => {
    const reached = auditScopedOrders.filter((order) => deriveFunnelReached(order)[step.key]).length;
    return {
      ...step,
      count: reached,
      ratio: paidBase > 0 ? Math.round((reached / paidBase) * 100) : 0,
    };
  });

  return {
    paidBase,
    counts,
    exceptions: auditScopedOrders.filter((order) => (order.observability_alerts || []).length > 0),
  };
};

export const parseOrdersAuditQueryState = ({ search = '', forceAuditFilter = null } = {}) => {
  const params = new URLSearchParams(search);
  const requestedAudit = params.get('audit') === 'excluded' ? 'excluded' : 'all';
  const requestedReason = params.get('test_reason') || 'all';
  const requestedOverrideAge = params.get('override_age') || 'all';
  const requestedReviewStatus = params.get('review_status') || 'all';
  const requestedRisk = params.get('risk') || 'all';
  const requestedOrderId = params.get('order_id') || null;

  return {
    auditFilter: forceAuditFilter || requestedAudit,
    testReasonFilter: requestedReason,
    overrideAgeFilter: requestedOverrideAge,
    reviewStatusFilter: requestedReviewStatus === 'pending' || requestedReviewStatus === 'reviewed' ? requestedReviewStatus : 'all',
    riskFilter: requestedRisk === 'paid_blocked' ? 'paid_blocked' : 'all',
    selectedOrderId: requestedOrderId,
  };
};

export const buildOrdersAuditQueryString = ({
  auditFilter = 'all',
  testReasonFilter = 'all',
  overrideAgeFilter = 'all',
  reviewStatusFilter = 'all',
  riskFilter = 'all',
  orderId = null,
} = {}) => {
  const params = new URLSearchParams();

  if (auditFilter === 'excluded') params.set('audit', 'excluded');
  if (testReasonFilter !== 'all') params.set('test_reason', testReasonFilter);
  if (overrideAgeFilter !== 'all') params.set('override_age', overrideAgeFilter);
  if (reviewStatusFilter !== 'all') params.set('review_status', reviewStatusFilter);
  if (riskFilter !== 'all') params.set('risk', riskFilter);
  if (orderId) params.set('order_id', orderId);

  const query = params.toString();
  return query ? `/admin/orders?${query}` : '/admin/orders';
};
