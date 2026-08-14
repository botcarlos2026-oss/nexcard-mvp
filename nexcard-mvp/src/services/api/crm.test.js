import { createCrmApi } from './crm';

describe('crmApi', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

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

  it('guarda carrito abandonado vía RPC pública acotada y recuerda update_token', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: { id: 'cart-1', update_token: 'token-1' }, error: null });
    const api = createCrmApi({ hasSupabase: true, supabase: { rpc } });

    const result = await api.saveAbandonedCart({
      email: 'CARLOS@test.com',
      customerName: 'Carlos',
      items: [{ sku: 'nfc' }],
      totalCents: 9990,
    });

    expect(result).toEqual({ id: 'cart-1' });
    expect(rpc).toHaveBeenCalledWith('save_abandoned_cart_public', {
      cart_email: 'CARLOS@test.com',
      cart_customer_name: 'Carlos',
      cart_items: [{ sku: 'nfc' }],
      cart_total_cents: 9990,
    });
    expect(sessionStorage.getItem('nexcard_abandoned_cart_token:cart-1')).toBe('token-1');
  });

  it('marca carrito convertido solo con token recordado', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: true, error: null });
    const api = createCrmApi({ hasSupabase: true, supabase: { rpc } });
    sessionStorage.setItem('nexcard_abandoned_cart_token:cart-1', 'token-1');

    await api.markCartConverted('cart-1');

    expect(rpc).toHaveBeenCalledWith('mark_abandoned_cart_converted_public', {
      cart_id: 'cart-1',
      cart_update_token: 'token-1',
    });
  });

  it('no marca carrito convertido si no existe token local', async () => {
    const rpc = jest.fn();
    const api = createCrmApi({ hasSupabase: true, supabase: { rpc } });

    await api.markCartConverted('cart-1');

    expect(rpc).not.toHaveBeenCalled();
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
