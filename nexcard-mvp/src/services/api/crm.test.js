import { createCrmApi } from './crm';

describe('crmApi', () => {
  it('retorna null al guardar carrito si no hay supabase', async () => {
    const api = createCrmApi({ supabase: null, hasSupabase: false });
    await expect(api.saveAbandonedCart({ email: 'a@test.com', items: [], totalCents: 0 })).resolves.toBeNull();
  });

  it('retorna vacío en getAbandonedCarts sin supabase', async () => {
    const api = createCrmApi({ supabase: null, hasSupabase: false });
    await expect(api.getAbandonedCarts()).resolves.toEqual([]);
  });

  it('markCartConverted no falla sin cartId', async () => {
    const api = createCrmApi({ supabase: null, hasSupabase: false });
    await expect(api.markCartConverted(null)).resolves.toBeUndefined();
  });

  it('reusa carrito abandonado existente para el mismo email', async () => {
    const eqUpdate = jest.fn().mockResolvedValue({});
    const update = jest.fn(() => ({ eq: eqUpdate }));
    const maybeSingle = jest.fn().mockResolvedValue({ data: { id: 'cart-1' } });
    const limit = jest.fn(() => ({ maybeSingle }));
    const gte = jest.fn(() => ({ limit }));
    const inFn = jest.fn(() => ({ gte }));
    const eqSelect = jest.fn(() => ({ in: inFn }));
    const select = jest.fn(() => ({ eq: eqSelect }));
    const from = jest.fn(() => ({ select, update }));
    const api = createCrmApi({ hasSupabase: true, supabase: { from } });

    const result = await api.saveAbandonedCart({
      email: 'CARLOS@test.com',
      customerName: 'Carlos',
      items: [{ sku: 'nfc' }],
      totalCents: 9990,
    });

    expect(result).toEqual({ id: 'cart-1' });
    expect(eqSelect).toHaveBeenCalledWith('email', 'carlos@test.com');
    expect(update).toHaveBeenCalledWith({
      customer_name: 'Carlos',
      items: [{ sku: 'nfc' }],
      total_cents: 9990,
    });
    expect(eqUpdate).toHaveBeenCalledWith('id', 'cart-1');
  });

  it('crea carrito nuevo si no existe uno reciente', async () => {
    const singleInsert = jest.fn().mockResolvedValue({ data: { id: 'cart-2' }, error: null });
    const selectInsert = jest.fn(() => ({ single: singleInsert }));
    const insert = jest.fn(() => ({ select: selectInsert }));
    const maybeSingle = jest.fn().mockResolvedValue({ data: null });
    const limit = jest.fn(() => ({ maybeSingle }));
    const gte = jest.fn(() => ({ limit }));
    const inFn = jest.fn(() => ({ gte }));
    const eqSelect = jest.fn(() => ({ in: inFn }));
    const select = jest.fn(() => ({ eq: eqSelect }));
    const from = jest.fn(() => ({ select, insert }));
    const api = createCrmApi({ hasSupabase: true, supabase: { from } });

    const result = await api.saveAbandonedCart({
      email: 'new@test.com',
      customerName: null,
      items: [{ sku: 'pack-1' }],
      totalCents: 12000,
    });

    expect(result).toEqual({ id: 'cart-2' });
    expect(insert).toHaveBeenCalledWith([{
      email: 'new@test.com',
      customer_name: null,
      items: [{ sku: 'pack-1' }],
      total_cents: 12000,
    }]);
  });

  it('agrega updated_at al actualizar negocio CRM', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ update }));
    const api = createCrmApi({ hasSupabase: true, supabase: { from } });

    await api.updateCRMDeal('deal-1', { stage: 'won' });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ stage: 'won', updated_at: expect.any(String) }));
    expect(eq).toHaveBeenCalledWith('id', 'deal-1');
  });
});
