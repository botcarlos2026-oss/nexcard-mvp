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

  it('usa fallback directo si falla el RPC de scan', async () => {
    const eqUpdate = jest.fn().mockResolvedValue({});
    const update = jest.fn(() => ({ eq: eqUpdate }));
    const single = jest.fn().mockResolvedValue({ data: { scan_count: 4 } });
    const eqSelect = jest.fn(() => ({ single }));
    const select = jest.fn(() => ({ eq: eqSelect }));
    const from = jest.fn(() => ({ select, update }));
    const rpc = jest.fn().mockRejectedValue(new Error('rpc down'));
    const api = createReviewCardsApi({
      hasSupabase: true,
      supabase: { rpc, from },
    });

    await api.incrementReviewScan('carlos');
    await Promise.resolve();

    expect(rpc).toHaveBeenCalledWith('increment_review_scan', { target_slug: 'carlos' });
    expect(from).toHaveBeenCalledWith('review_cards');
    expect(update).toHaveBeenCalledWith({ scan_count: 5 });
    expect(eqUpdate).toHaveBeenCalledWith('slug', 'carlos');
  });

  it('actualiza review card con timestamp', async () => {
    const single = jest.fn().mockResolvedValue({ data: { id: 'r1' }, error: null });
    const select = jest.fn(() => ({ single }));
    const eq = jest.fn(() => ({ select }));
    const update = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ update }));
    const api = createReviewCardsApi({
      hasSupabase: true,
      supabase: { from },
    });

    await api.updateReviewCard('r1', { title: 'Nuevo' });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ title: 'Nuevo', updated_at: expect.any(String) }));
    expect(eq).toHaveBeenCalledWith('id', 'r1');
  });
});
