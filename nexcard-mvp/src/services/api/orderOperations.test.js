import { buildOrderHistoryEntries, createOrderOperationsApi, normalizeTrackingCode, ORDER_RESTRICTED_MUTATION_FIELDS } from './orderOperations';

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

  it('programa NFC sin mutar status de card', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn(() => ({ eq }));
    const fetchOrders = jest.fn().mockResolvedValue({ orders: [] });
    const supabase = { from: jest.fn(() => ({ update })) };
    const api = createOrderOperationsApi({ supabase, hasSupabase: true, fetchOrders });

    await api.updateCardNFC('card-1', { nfc_url: 'https://nexcard.cl/carlos' });

    expect(update).toHaveBeenCalledWith(expect.not.objectContaining({ status: 'programmed' }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ nfc_url: 'https://nexcard.cl/carlos' }));
    expect(eq).toHaveBeenCalledWith('id', 'card-1');
  });
});
