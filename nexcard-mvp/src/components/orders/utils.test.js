import {
  buildOrdersDashboardFunnelSnapshot,
  buildOrdersDashboardStats,
  buildOrdersKanbanGroups,
  buildOrdersKanbanSummary,
  buildOrdersAuditQueryString,
  buildQaDecisionTimeline,
  buildTestReasonCounts,
  deriveActivationStatus,
  deriveOrderNextAction,
  deriveOrderSlaAlert,
  filterOrdersDashboardRows,
  filterOrdersKanbanRows,
  getKanbanLaneKey,
  isOrderReadyForDispatch,
  KANBAN_PRIORITY_ORDER,
  matchesOperationalFilter,
  normalizeOrdersForDashboard,
  parseOrdersAuditQueryState,
  deriveManualOverrideSeverity,
  formatLabel,
} from './utils';

describe('orders utils', () => {
  it('formatea labels con guiones bajos', () => {
    expect(formatLabel('manual_override')).toBe('manual override');
  });

  it('arma timeline QA con clasificación y review fallback', () => {
    const timeline = buildQaDecisionTimeline({
      id: 'order-1',
      created_at: '2026-05-14T10:00:00Z',
      isNonOperational: true,
      testReasonResolved: 'manual_admin_override_qa',
      qa_reviewed_at: '2026-05-14T12:00:00Z',
      qa_review_note: 'ok',
    }, []);

    expect(timeline[0].type).toBe('classified');
    expect(timeline[1].type).toBe('reviewed');
  });

  it('eleva severidad de override manual pagado y envejecido', () => {
    const order = {
      testReasonResolved: 'manual_admin_override_qa',
      qa_override_at: '2026-05-10T10:00:00Z',
      payment_status: 'paid',
      fulfillment_status: 'new',
      activation_completed: false,
    };

    const result = deriveManualOverrideSeverity(order);
    expect(['high', 'critical']).toContain(result.level);
    expect(result.score).toBeGreaterThan(0);
  });

  it('normaliza órdenes para el dashboard con clasificación QA', () => {
    const [result] = normalizeOrdersForDashboard([{
      id: 'o1',
      customer_name: 'Carlos',
      amount_cents: 10000,
      payment_status: 'paid',
      items: [{ quantity: 2, unit_cost_cents: 1000 }],
      payments: [{ provider: 'mercado_pago', transaction_reference: 'tx-1', paid_at: '2026-05-15T10:00:00Z' }],
      test_reason: 'manual_admin_override_qa',
      is_test: true,
    }]);

    expect(result.customerLabel).toBe('Carlos');
    expect(result.totalCostCents).toBe(2000);
    expect(result.paymentProvider).toBe('mercado_pago');
    expect(result.isNonOperational).toBe(true);
  });

  it('filtra y prioriza overrides manuales por score y edad', () => {
    const rows = filterOrdersDashboardRows({
      auditScopedOrders: [
        { id: '1', created_at: '2026-05-15T10:00:00Z', payment_status: 'paid', fulfillment_status: 'new', customerLabel: 'A', manualOverrideSeverity: { score: 2, ageHours: 10 }, testReasonResolved: 'manual_admin_override_qa' },
        { id: '2', created_at: '2026-05-15T10:00:00Z', payment_status: 'paid', fulfillment_status: 'new', customerLabel: 'B', manualOverrideSeverity: { score: 5, ageHours: 50 }, testReasonResolved: 'manual_admin_override_qa' },
      ],
      testReasonFilter: 'manual_override_only',
    });

    expect(rows.map((row) => row.id)).toEqual(['2', '1']);
  });

  it('deriva estados de activación operativos claros', () => {
    expect(deriveActivationStatus({ active_cards_count: 1 }).label).toBe('Activa');
    expect(deriveActivationStatus({ programmed_cards_count: 1 }).label).toBe('NFC programado');
    expect(deriveActivationStatus({ related_cards: [{}] }).label).toBe('Card vinculada');
    expect(deriveActivationStatus({ activation_claim: { status: 'pending' } }).label).toBe('Claim pendiente');
    expect(deriveActivationStatus({}).label).toBe('Sin claim');
  });

  it('aplica filtros operativos rápidos', () => {
    expect(matchesOperationalFilter({ payment_status: 'paid', fulfillment_status: 'ready' }, 'ready_to_ship')).toBe(true);
    expect(matchesOperationalFilter({ fulfillment_status: 'shipped' }, 'shipped_pending_delivery')).toBe(true);
    expect(matchesOperationalFilter({ fulfillment_status: 'delivered', activation_completed: false }, 'delivered_pending_activation')).toBe(true);
    expect(matchesOperationalFilter({ observability_alerts: ['alerta'] }, 'alerts')).toBe(true);

    const rows = filterOrdersDashboardRows({
      auditScopedOrders: [
        { id: '1', created_at: '2026-05-15T10:00:00Z', payment_status: 'paid', fulfillment_status: 'ready', customerLabel: 'A' },
        { id: '2', created_at: '2026-05-15T10:00:00Z', payment_status: 'paid', fulfillment_status: 'shipped', customerLabel: 'B' },
      ],
      operationalFilter: 'ready_to_ship',
    });

    expect(rows.map((row) => row.id)).toEqual(['1']);
  });

  it('agrupa órdenes en Kanban operativo y prioriza problemas', () => {
    const orders = [
      { id: 'paid-new', created_at: new Date().toISOString(), payment_status: 'paid', fulfillment_status: 'new' },
      { id: 'ready', created_at: new Date().toISOString(), payment_status: 'paid', fulfillment_status: 'ready', related_cards: [{}] },
      { id: 'delivered-risk', created_at: new Date().toISOString(), payment_status: 'paid', fulfillment_status: 'delivered', activation_completed: false },
      { id: 'alert', created_at: new Date().toISOString(), payment_status: 'paid', fulfillment_status: 'in_production', observability_alerts: ['drift'] },
    ];

    expect(getKanbanLaneKey(orders[0])).toBe('paid_new');
    expect(getKanbanLaneKey(orders[2])).toBe('alerts');
    expect(deriveOrderNextAction(orders[1])).toBe('Asignar courier y tracking');

    const groups = buildOrdersKanbanGroups(orders);
    expect(groups.paid_new.map((order) => order.id)).toEqual(['paid-new']);
    expect(groups.ready_to_ship.map((order) => order.id)).toEqual(['ready']);
    expect(groups.alerts.map((order) => order.id)).toEqual(['delivered-risk', 'alert']);

    expect(buildOrdersKanbanSummary(orders)).toMatchObject({
      today: 4,
      paidNew: 1,
      readyToShip: 1,
      alerts: 2,
    });
  });

  it('protege prioridad y readiness del Kanban', () => {
    expect(KANBAN_PRIORITY_ORDER.slice(0, 2)).toEqual(['alerts', 'ready_to_ship']);
    expect(isOrderReadyForDispatch({ payment_status: 'paid', fulfillment_status: 'in_production', activation_claim: { status: 'pending' } })).toBe(false);
    expect(isOrderReadyForDispatch({ payment_status: 'paid', fulfillment_status: 'in_production', related_cards: [{ nfc_url: 'https://nexcard.cl/demo' }] })).toBe(true);
    expect(isOrderReadyForDispatch({ payment_status: 'paid', fulfillment_status: 'new', programmed_cards_count: 1 })).toBe(false);
  });

  it('oculta QA/test del Kanban operativo por defecto', () => {
    const orders = [
      { id: 'real-problem', isNonOperational: false },
      { id: 'qa-problem', isNonOperational: true },
    ];

    expect(filterOrdersKanbanRows(orders).map((order) => order.id)).toEqual(['real-problem']);
    expect(filterOrdersKanbanRows(orders, { showQa: true }).map((order) => order.id)).toEqual(['real-problem', 'qa-problem']);
  });

  it('cubre fixture sintético completo de columnas Kanban', () => {
    const now = new Date('2026-07-07T12:00:00Z');
    const orders = [
      { id: 'paid-new', created_at: now.toISOString(), payment_status: 'paid', fulfillment_status: 'new' },
      { id: 'in-production', created_at: now.toISOString(), payment_status: 'paid', fulfillment_status: 'in_production', activation_claim: { status: 'pending' } },
      { id: 'ready', created_at: now.toISOString(), ready_at: new Date().toISOString(), payment_status: 'paid', fulfillment_status: 'ready', related_cards: [{ nfc_url: 'https://nexcard.cl/ready' }] },
      { id: 'shipped', created_at: now.toISOString(), shipped_at: new Date().toISOString(), payment_status: 'paid', fulfillment_status: 'shipped', activation_completed: true, related_cards: [{}] },
      { id: 'delivered', created_at: now.toISOString(), payment_status: 'paid', fulfillment_status: 'delivered', activation_completed: true, related_cards: [{}] },
      { id: 'delivered-no-activation', created_at: now.toISOString(), payment_status: 'paid', fulfillment_status: 'delivered', activation_completed: false, related_cards: [{}] },
      { id: 'observability-alert', created_at: now.toISOString(), payment_status: 'paid', fulfillment_status: 'in_production', observability_alerts: ['drift'] },
    ];

    const groups = buildOrdersKanbanGroups(orders);
    expect(groups.paid_new.map((order) => order.id)).toEqual(['paid-new']);
    expect(groups.in_production.map((order) => order.id)).toEqual(['in-production']);
    expect(groups.ready_to_ship.map((order) => order.id)).toEqual(['ready']);
    expect(groups.shipped_pending_delivery.map((order) => order.id)).toEqual(['shipped']);
    expect(groups.delivered.map((order) => order.id)).toEqual(['delivered']);
    expect(groups.alerts.map((order) => order.id)).toEqual(['delivered-no-activation', 'observability-alert']);
  });

  it('deriva alertas SLA visuales para operación diaria', () => {
    const now = new Date('2026-07-07T12:00:00Z');
    expect(deriveOrderSlaAlert({ payment_status: 'paid', fulfillment_status: 'new', paid_at: '2026-07-06T10:00:00Z' }, now)?.label).toBe('>24h sin producción');
    expect(deriveOrderSlaAlert({ payment_status: 'paid', fulfillment_status: 'ready', ready_at: '2026-07-06T23:00:00Z', related_cards: [{}] }, now)?.label).toBe('>12h sin tracking');
    expect(deriveOrderSlaAlert({ payment_status: 'paid', fulfillment_status: 'shipped', shipped_at: '2026-07-04T10:00:00Z', related_cards: [{}] }, now)?.label).toBe('>72h sin entrega');
    expect(deriveOrderSlaAlert({ payment_status: 'paid', fulfillment_status: 'delivered', delivered_at: '2026-07-06T10:00:00Z', activation_completed: false, related_cards: [{}] }, now)?.label).toBe('>24h sin activación');
    expect(getKanbanLaneKey({ payment_status: 'paid', fulfillment_status: 'new', paid_at: '2026-07-06T10:00:00Z' })).toBe('alerts');
  });

  it('construye counts y stats del dashboard', () => {
    const orders = [
      { id: '1', testReasonResolved: 'manual_admin_override_qa', payment_status: 'paid', totalCents: 10000, activation_completed: false, created_at: '2026-05-15T10:00:00Z', updated_at: '2026-05-15T10:00:00Z' },
      { id: '2', testReasonResolved: null, payment_status: 'pending', totalCents: 5000, activation_completed: false, created_at: '2026-05-15T10:00:00Z', updated_at: '2026-05-15T10:00:00Z' },
    ];

    expect(buildTestReasonCounts(orders)).toEqual({ manual_admin_override_qa: 1, unclassified: 1 });
    expect(buildOrdersDashboardStats(orders)).toHaveLength(4);
    expect(buildOrdersDashboardFunnelSnapshot(orders).counts).toHaveLength(5);
  });

  it('parsea estado QA desde querystring con sanitización', () => {
    const result = parseOrdersAuditQueryState({
      search: '?audit=excluded&test_reason=manual_override_only&override_age=72h&review_status=pending&risk=paid_blocked&order_id=o-1',
    });

    expect(result).toEqual({
      auditFilter: 'excluded',
      testReasonFilter: 'manual_override_only',
      overrideAgeFilter: '72h',
      reviewStatusFilter: 'pending',
      riskFilter: 'paid_blocked',
      selectedOrderId: 'o-1',
    });
  });

  it('construye querystring limpia para filtros QA', () => {
    expect(buildOrdersAuditQueryString({
      auditFilter: 'excluded',
      testReasonFilter: 'manual_override_only',
      reviewStatusFilter: 'pending',
      riskFilter: 'paid_blocked',
      orderId: 'abc',
    })).toBe('/admin/orders?audit=excluded&test_reason=manual_override_only&review_status=pending&risk=paid_blocked&order_id=abc');

    expect(buildOrdersAuditQueryString()).toBe('/admin/orders');
  });
});
