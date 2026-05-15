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
}) => {
  const term = searchTerm.trim().toLowerCase();
  const now = new Date();

  const baseOrders = auditScopedOrders.filter((order) => {
    const matchesPayment = paymentFilter === 'all' || order.payment_status === paymentFilter;
    const matchesFulfillment = fulfillmentFilter === 'all' || order.fulfillment_status === fulfillmentFilter;

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

    if (!matchesPayment || !matchesFulfillment) return false;
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
