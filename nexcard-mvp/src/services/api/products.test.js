import { filterPublicProducts, isPrelaunchTestProduct } from './products';

describe('products public visibility', () => {
  const standard = { id: 'prod-1', sku: 'NEXCARD-1', name: 'Individual', status: 'active' };
  const mpTestBySku = { id: 'prod-test', sku: 'NEXCARD-MP-TEST-1000', name: 'Tarjeta prueba MP', status: 'active' };
  const mpTestByMetadata = { id: 'prod-meta', sku: 'QA-1000', name: 'QA MP', status: 'active', metadata: { test_product: true } };

  it('detecta productos de prueba de Mercado Pago por SKU o metadata', () => {
    expect(isPrelaunchTestProduct(standard)).toBe(false);
    expect(isPrelaunchTestProduct(mpTestBySku)).toBe(true);
    expect(isPrelaunchTestProduct(mpTestByMetadata)).toBe(true);
  });

  it('oculta productos de prueba en catálogo público por defecto', () => {
    expect(filterPublicProducts([standard, mpTestBySku, mpTestByMetadata]).map((p) => p.sku)).toEqual(['NEXCARD-1']);
  });

  it('mantiene productos de prueba disponibles cuando el link controlado los solicita', () => {
    expect(filterPublicProducts([standard, mpTestBySku], { includeTestProducts: true }).map((p) => p.sku)).toEqual([
      'NEXCARD-1',
      'NEXCARD-MP-TEST-1000',
    ]);
  });
});
