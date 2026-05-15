import {
  buildOrdersDashboardFunnelSnapshot,
  buildOrdersDashboardStats,
  buildOrdersAuditQueryString,
  buildQaDecisionTimeline,
  buildTestReasonCounts,
  filterOrdersDashboardRows,
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
