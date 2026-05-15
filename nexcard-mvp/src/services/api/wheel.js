export function createWheelApi({ supabase, hasSupabase }) {
  return {
    getActiveWheel: async () => {
      if (!hasSupabase) return { wheel: null };
      const now = new Date().toISOString();
      const { data: configs } = await supabase
        .from('wheel_config')
        .select('*, wheel_prizes(*)')
        .eq('active', true);
      if (!configs?.length) return { wheel: null };
      const wheel = configs.find((config) => {
        const afterStart = !config.start_date || config.start_date <= now;
        const beforeEnd = !config.end_date || config.end_date >= now;
        return afterStart && beforeEnd;
      });
      return { wheel: wheel || null };
    },

    getAllWheels: async () => {
      if (!hasSupabase) return { wheels: [] };
      const { data } = await supabase
        .from('wheel_config')
        .select('*, wheel_prizes(*)')
        .order('created_at', { ascending: false });
      return { wheels: data || [] };
    },

    createWheel: async (config) => {
      if (!hasSupabase) throw new Error('Supabase no configurado');
      const { data, error } = await supabase.from('wheel_config').insert(config).select().single();
      if (error) throw error;
      return data;
    },

    updateWheel: async (id, payload) => {
      if (!hasSupabase) throw new Error('Supabase no configurado');
      const { error } = await supabase
        .from('wheel_config')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },

    deleteWheel: async (id) => {
      if (!hasSupabase) throw new Error('Supabase no configurado');
      const { error } = await supabase.from('wheel_config').delete().eq('id', id);
      if (error) throw error;
    },

    createWheelPrize: async (prize) => {
      if (!hasSupabase) throw new Error('Supabase no configurado');
      const { data, error } = await supabase.from('wheel_prizes').insert(prize).select().single();
      if (error) throw error;
      return data;
    },

    updateWheelPrize: async (id, payload) => {
      if (!hasSupabase) throw new Error('Supabase no configurado');
      const { error } = await supabase.from('wheel_prizes').update(payload).eq('id', id);
      if (error) throw error;
    },

    deleteWheelPrize: async (id) => {
      if (!hasSupabase) throw new Error('Supabase no configurado');
      const { error } = await supabase.from('wheel_prizes').delete().eq('id', id);
      if (error) throw error;
    },

    recordWheelSpin: async (spin) => {
      if (!hasSupabase) return null;
      const { data, error } = await supabase.from('wheel_spins').insert(spin).select().single();
      if (error) throw error;
      return data;
    },

    validateWheelCoupon: async (code) => {
      if (!hasSupabase || !code) return null;
      const { data: prize } = await supabase
        .from('wheel_prizes')
        .select('*')
        .eq('coupon_code', code.toUpperCase())
        .maybeSingle();
      if (!prize) return null;
      const { data: spin } = await supabase
        .from('wheel_spins')
        .select('*')
        .eq('prize_id', prize.id)
        .eq('redeemed', false)
        .limit(1)
        .maybeSingle();
      if (!spin) return null;
      return { prize, spinId: spin.id };
    },

    redeemWheelCoupon: async (spinId, orderId) => {
      if (!hasSupabase || !spinId) return;
      await supabase
        .from('wheel_spins')
        .update({ redeemed: true, redeemed_at: new Date().toISOString(), order_id: orderId })
        .eq('id', spinId);
    },

    getWheelStats: async (wheelId) => {
      if (!hasSupabase) return { spins: [] };
      const { data } = await supabase
        .from('wheel_spins')
        .select('*, wheel_prizes(label, type, value)')
        .eq('wheel_id', wheelId)
        .order('spun_at', { ascending: false })
        .limit(200);
      return { spins: data || [] };
    },
  };
}
