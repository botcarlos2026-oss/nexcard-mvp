import { createWheelApi } from './wheel';

describe('wheelApi', () => {
  it('retorna wheel null sin supabase', async () => {
    const api = createWheelApi({ supabase: null, hasSupabase: false });
    await expect(api.getActiveWheel()).resolves.toEqual({ wheel: null });
  });

  it('elige la configuración activa y carga premios públicos sin códigos', async () => {
    const eqActive = jest.fn().mockResolvedValue({
      data: [
        { id: 'w1', active: true, start_date: '2099-01-01T00:00:00Z', end_date: null },
        { id: 'w2', active: true, start_date: '2020-01-01T00:00:00Z', end_date: '2099-01-01T00:00:00Z' },
      ],
    });
    const selectConfig = jest.fn(() => ({ eq: eqActive }));

    const order = jest.fn().mockResolvedValue({ data: [{ id: 'p1', label: '10%' }] });
    const eqPrizeActive = jest.fn(() => ({ order }));
    const eqPrizeWheel = jest.fn(() => ({ eq: eqPrizeActive }));
    const selectPrize = jest.fn(() => ({ eq: eqPrizeWheel }));

    const from = jest.fn((table) => {
      if (table === 'wheel_config') return { select: selectConfig };
      if (table === 'wheel_prizes_public') return { select: selectPrize };
      throw new Error(`unexpected table ${table}`);
    });
    const api = createWheelApi({ hasSupabase: true, supabase: { from } });

    const result = await api.getActiveWheel();

    expect(from).toHaveBeenCalledWith('wheel_prizes_public');
    expect(eqPrizeWheel).toHaveBeenCalledWith('wheel_id', 'w2');
    expect(result).toEqual({ wheel: expect.objectContaining({ id: 'w2', wheel_prizes: [{ id: 'p1', label: '10%' }] }) });
  });

  it('gira la ruleta vía Edge Function para aplicar rate limit no controlado por cliente', async () => {
    const invoke = jest.fn().mockResolvedValue({ data: { prize_id: 'p1', coupon_code: 'NX-123', spin_id: 's1' } });
    const api = createWheelApi({ hasSupabase: true, supabase: { functions: { invoke } } });

    const result = await api.spinWheel('wheel-1', 'visitor-1');

    expect(invoke).toHaveBeenCalledWith('spin-wheel', { body: { wheel_id: 'wheel-1', visitor_id: 'visitor-1' } });
    expect(result).toEqual({ prize_id: 'p1', coupon_code: 'NX-123', spin_id: 's1' });
  });

  it('valida coupon code por RPC sin leer wheel_prizes directamente', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ prize_id: 'prize-1', spin_id: 'spin-1', type: 'discount_percent', value: 10, label: '10%' }],
    });
    const from = jest.fn();
    const api = createWheelApi({ hasSupabase: true, supabase: { rpc, from } });
    const result = await api.validateWheelCoupon('promo10');

    expect(rpc).toHaveBeenCalledWith('validate_wheel_coupon', { p_code: 'PROMO10' });
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({
      prize: { id: 'prize-1', type: 'discount_percent', value: 10, label: '10%' },
      spinId: 'spin-1',
    });
  });
});
