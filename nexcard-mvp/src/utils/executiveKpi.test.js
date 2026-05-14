import { buildWowAlerts, computeExecutiveScore, deltaPercent, percentage } from './executiveKpi';

describe('executiveKpi helpers', () => {
  it('calcula porcentajes y deltas con redondeo seguro', () => {
    expect(percentage(3, 4)).toBe(75);
    expect(percentage(0, 0)).toBeNull();
    expect(deltaPercent(120, 100)).toBe(20);
    expect(deltaPercent(0, 0)).toBe(0);
  });

  it('construye wowAlerts para revenue, payment rate, carrier y sku claims', () => {
    const alerts = buildWowAlerts({
      kpiComparisons: {
        revenue_7d: { delta_pct: -25 },
        payment_rate_7d: { delta_pts: -10 },
      },
      effectiveWowThresholds: {
        revenue_drop_pct: -20,
        payment_rate_drop_pts: -8,
        carrier_delivery_rate_drop_pts: -10,
        sku_claim_rate_pct: 8,
      },
      carrierStats: [{ key: 'starken', label: 'Starken', delivery_rate: 70 }],
      previousCarrierRateMap: { starken: 82 },
      productStats: [{ key: 'sku-1', label: 'Black Card', claim_rate: 12, order_count: 10 }],
    });

    expect(alerts.map((item) => item.key)).toEqual([
      'revenue_drop',
      'payment_rate_drop',
      'carrier_starken',
      'sku_claim_sku-1',
    ]);
  });

  it('calcula executive score con penalización por claims, wow y SLA', () => {
    const result = computeExecutiveScore({
      kpiComparisons: {
        revenue_7d: { delta_pct: -20 },
        payment_rate_7d: { delta_pts: -6 },
      },
      slaBreachesCount: 3,
      wowAlerts: [{ key: 'revenue_drop' }, { key: 'sku_claim_sku-1' }],
      productStats: [
        { key: 'sku-1', claim_rate: 10 },
        { key: 'sku-2', claim_rate: 6 },
      ],
    });

    expect(result.score).toBeLessThan(85);
    expect(['healthy', 'watch', 'critical']).toContain(result.band);
    expect(result.reasons).toContain('Revenue 7d -20%');
    expect(result.reasons).toContain('Pago -6 pts');
    expect(result.reasons.some((reason) => reason.startsWith('Claim avg'))).toBe(true);
    expect(result.avgClaimRate).toBe(8);
  });
});
