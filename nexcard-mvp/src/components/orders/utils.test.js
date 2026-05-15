import {
  buildQaDecisionTimeline,
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
});
