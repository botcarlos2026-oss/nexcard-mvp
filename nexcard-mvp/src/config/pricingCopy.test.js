import { buildPricingPlan } from './pricingCopy';

describe('pricingCopy', () => {
  it('expone SKU de display alineado con la cantidad de tarjetas', () => {
    expect(buildPricingPlan({ sku: 'BASIC-5', price_cents: 39990 }).displaySku).toBe('NEXCARD-3');
    expect(buildPricingPlan({ sku: 'PREMIUM-10', price_cents: 59990 }).displaySku).toBe('NEXCARD-5');
    expect(buildPricingPlan({ sku: 'PREMIUM-20', price_cents: 74990 }).displaySku).toBe('NEXCARD-7');
  });

  it('mantiene el SKU original cuando no hay copia conocida', () => {
    expect(buildPricingPlan({ sku: 'CUSTOM-99', price_cents: 1000, cards: 99 }).displaySku).toBe('CUSTOM-99');
  });
});
