import { createReviewCardsApi } from './reviewCards';

describe('reviewCardsApi', () => {
  it('retorna vacío sin supabase en getReviewCards', async () => {
    const api = createReviewCardsApi({ supabase: null, hasSupabase: false });
    await expect(api.getReviewCards()).resolves.toEqual([]);
  });

  it('falla al crear si no hay supabase', async () => {
    const api = createReviewCardsApi({ supabase: null, hasSupabase: false });
    await expect(api.createReviewCard({ slug: 'x' })).rejects.toThrow('Supabase no configurado');
  });
});
