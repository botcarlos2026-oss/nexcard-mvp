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
});
