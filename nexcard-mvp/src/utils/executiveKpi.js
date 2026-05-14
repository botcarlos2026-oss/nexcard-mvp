export const round1 = (value) => Math.round(value * 10) / 10;

export const percentage = (num, den) => (den > 0 ? round1((num / den) * 100) : null);

export const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return round1(sorted[index]);
};

export const deltaPercent = (current, previous) => {
  if (!previous) return current ? 100 : 0;
  return round1(((current - previous) / previous) * 100);
};

export const buildWowAlerts = ({ kpiComparisons, effectiveWowThresholds, carrierStats, previousCarrierRateMap, productStats }) => {
  const wowAlerts = [];
  if ((kpiComparisons.revenue_7d?.delta_pct ?? 0) <= effectiveWowThresholds.revenue_drop_pct) {
    wowAlerts.push({
      key: 'revenue_drop',
      severity: 'danger',
      title: 'Revenue 7d cayó fuerte vs período previo',
      detail: `${kpiComparisons.revenue_7d.delta_pct}% vs ventana previa`,
    });
  }
  if ((kpiComparisons.payment_rate_7d?.delta_pts ?? 0) <= effectiveWowThresholds.payment_rate_drop_pts) {
    wowAlerts.push({
      key: 'payment_rate_drop',
      severity: 'warning',
      title: 'Tasa de pago cayó WoW',
      detail: `${kpiComparisons.payment_rate_7d.delta_pts} pts vs ventana previa`,
    });
  }
  carrierStats.forEach((carrier) => {
    const previousRate = previousCarrierRateMap[carrier.key];
    if (previousRate != null && carrier.delivery_rate != null && (carrier.delivery_rate - previousRate) <= effectiveWowThresholds.carrier_delivery_rate_drop_pts) {
      wowAlerts.push({
        key: `carrier_${carrier.key}`,
        severity: 'warning',
        title: `Carrier ${carrier.label} empeoró tasa de entrega`,
        detail: `${round1(carrier.delivery_rate - previousRate)} pts vs ventana previa`,
      });
    }
  });
  productStats.forEach((product) => {
    if ((product.claim_rate ?? 0) >= effectiveWowThresholds.sku_claim_rate_pct) {
      wowAlerts.push({
        key: `sku_claim_${product.key}`,
        severity: 'danger',
        title: `SKU con claim rate alto: ${product.label}`,
        detail: `${product.claim_rate}% claim rate sobre ${product.order_count} órdenes`,
      });
    }
  });
  return wowAlerts;
};

export const computeExecutiveScore = ({ kpiComparisons, slaBreachesCount, wowAlerts, productStats }) => {
  let score = 100;
  const reasons = [];
  const revenueDelta = kpiComparisons.revenue_7d?.delta_pct ?? 0;
  const paymentRateDelta = kpiComparisons.payment_rate_7d?.delta_pts ?? 0;
  if (revenueDelta < 0) {
    const penalty = Math.min(25, Math.abs(revenueDelta) * 0.6);
    score -= penalty;
    reasons.push(`Revenue 7d ${revenueDelta}%`);
  }
  if (paymentRateDelta < 0) {
    const penalty = Math.min(20, Math.abs(paymentRateDelta) * 1.5);
    score -= penalty;
    reasons.push(`Pago ${paymentRateDelta} pts`);
  }
  score -= Math.min(20, (slaBreachesCount || 0) * 2);
  score -= Math.min(15, wowAlerts.length * 3);
  const avgClaimRate = productStats.length ? productStats.reduce((sum, item) => sum + (item.claim_rate || 0), 0) / productStats.length : 0;
  if (avgClaimRate > 0) {
    score -= Math.min(20, avgClaimRate * 1.2);
    reasons.push(`Claim avg ${round1(avgClaimRate)}%`);
  }
  const finalScore = Math.max(0, round1(score));
  const band = finalScore >= 85 ? 'strong' : finalScore >= 70 ? 'healthy' : finalScore >= 50 ? 'watch' : 'critical';
  return {
    score: finalScore,
    band,
    reasons: reasons.slice(0, 4),
    avgClaimRate: round1(avgClaimRate || 0),
  };
};
