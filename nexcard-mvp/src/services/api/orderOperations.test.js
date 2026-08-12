import { buildOrderHistoryEntries, normalizeNfcUrl, normalizeTrackingCode, ORDER_RESTRICTED_MUTATION_FIELDS } from './orderOperations';

describe('orderOperations helpers', () => {
  it('normaliza tracking code a uppercase sin espacios', () => {
    expect(normalizeTrackingCode(' ab-123 ')).toBe('AB-123');
  });

  it('genera historial solo para campos realmente cambiados', () => {
    const entries = buildOrderHistoryEntries('order-1', {
      carrier: 'starken',
      tracking_code: 'OLD-1',
      customer_phone: '123',
    }, {
      carrier: 'starken',
      tracking_code: 'NEW-1',
      customer_phone: '456',
    });

    expect(entries).toEqual([
      {
        order_id: 'order-1',
        field: 'tracking_code',
        old_value: 'OLD-1',
        new_value: 'NEW-1',
      },
      {
        order_id: 'order-1',
        field: 'customer_phone',
        old_value: '123',
        new_value: '456',
      },
    ]);
  });

  it('expone la lista de campos restringidos para mutación directa', () => {
    expect(ORDER_RESTRICTED_MUTATION_FIELDS).toContain('payment_status');
    expect(ORDER_RESTRICTED_MUTATION_FIELDS).toContain('tracking_code');
  });

  it('normaliza URLs NFC a HTTPS canónico de nexcard.cl', () => {
    expect(normalizeNfcUrl(' https://www.nexcard.cl/carlos-test ')).toBe('https://nexcard.cl/carlos-test');
    expect(normalizeNfcUrl('https://nexcard.cl/a1-b2')).toBe('https://nexcard.cl/a1-b2');
  });

  it('rechaza URLs NFC externas o manipuladas', () => {
    expect(() => normalizeNfcUrl('https://evil.cl/carlos')).toThrow(/nexcard\.cl/);
    expect(() => normalizeNfcUrl('http://nexcard.cl/carlos')).toThrow(/HTTPS/);
    expect(() => normalizeNfcUrl('https://nexcard.cl/carlos?next=https://evil.cl')).toThrow(/query/);
    expect(() => normalizeNfcUrl('https://nexcard.cl//evil.cl')).toThrow(/slug/);
  });
});
