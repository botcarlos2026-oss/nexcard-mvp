import { createWheelApi } from './wheel';

describe('wheelApi', () => {
  it('retorna wheel null sin supabase', async () => {
    const api = createWheelApi({ supabase: null, hasSupabase: false });
    await expect(api.getActiveWheel()).resolves.toEqual({ wheel: null });
  });

  it('elige la configuración activa dentro de rango', async () => {
    const eq = jest.fn().mockResolvedValue({
      data: [
        { id: 'w1', active: true, start_date: '2099-01-01T00:00:00Z', end_date: null },
        { id: 'w2', active: true, start_date: '2020-01-01T00:00:00Z', end_date: '2099-01-01T00:00:00Z' },
      ],
    });
    const select = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ select }));
    const api = createWheelApi({ hasSupabase: true, supabase: { from } });

    const result = await api.getActiveWheel();

    expect(result).toEqual({ wheel: expect.objectContaining({ id: 'w2' }) });
  });

  it('normaliza coupon code a uppercase al validar', async () => {
    const maybeSingleSpin = jest.fn().mockResolvedValue({ data: { id: 'spin-1' } });
    const limit = jest.fn(() => ({ maybeSingle: maybeSingleSpin }));
    const eqSpinRedeemed = jest.fn(() => ({ limit }));
    const eqSpinPrize = jest.fn(() => ({ eq: eqSpinRedeemed }));
    const selectSpin = jest.fn(() => ({ eq: eqSpinPrize }));

    const maybeSinglePrize = jest.fn().mockResolvedValue({ data: { id: 'prize-1' } });
    const eqPrize = jest.fn(() => ({ maybeSingle: maybeSinglePrize }));
    const selectPrize = jest.fn(() => ({ eq: eqPrize }));

    const from = jest.fn((table) => {
      if (table === 'wheel_prizes') return { select: selectPrize };
      if (table === 'wheel_spins') return { select: selectSpin };
      throw new Error(`unexpected table ${table}`);
    });

    const api = createWheelApi({ hasSupabase: true, supabase: { from } });
    const result = await api.validateWheelCoupon('promo10');

    expect(eqPrize).toHaveBeenCalledWith('coupon_code', 'PROMO10');
    expect(result).toEqual({ prize: { id: 'prize-1' }, spinId: 'spin-1' });
  });
});
