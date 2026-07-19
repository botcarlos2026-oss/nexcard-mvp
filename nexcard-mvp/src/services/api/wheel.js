export function createWheelApi({ supabase, hasSupabase }) {
  return {
    getActiveWheel: async () => {
      if (!hasSupabase) return { wheel: null };
      const now = new Date().toISOString();
      const { data: configs } = await supabase
        .from('wheel_config')
        .select('*')
        .eq('active', true);
      if (!configs?.length) return { wheel: null };
      const wheel = configs.find((config) => {
        const afterStart = !config.start_date || config.start_date <= now;
        const beforeEnd = !config.end_date || config.end_date >= now;
        return afterStart && beforeEnd;
      });
      if (!wheel) return { wheel: null };
      const { data: prizes, error } = await supabase
        .from('wheel_prizes_public')
        .select('*')
        .eq('wheel_id', wheel.id)
        .eq('active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return { wheel: { ...wheel, wheel_prizes: prizes || [] } };
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
      const { data, error } = await supabase.functions.invoke('spin-wheel', {
        body: { wheel_id: spin.wheel_id, visitor_id: spin.visitor_id },
      });
      if (error) throw error;
      return data;
    },

    spinWheel: async (wheelId, visitorId) => {
      if (!hasSupabase) return null;
      const { data, error } = await supabase.functions.invoke('spin-wheel', {
        body: { wheel_id: wheelId, visitor_id: visitorId },
      });
      if (error) throw error;
      return data;
    },

    validateWheelCoupon: async (code) => {
      if (!hasSupabase || !code) return null;
      const { data, error } = await supabase.rpc('validate_wheel_coupon', { p_code: code.toUpperCase() });
      if (error) throw error;
      const coupon = Array.isArray(data) ? data[0] : data;
      if (!coupon) return null;
      return {
        prize: {
          id: coupon.prize_id,
          type: coupon.type,
          value: coupon.value,
          label: coupon.label,
        },
        spinId: coupon.spin_id,
      };
    },

    redeemWheelCoupon: async () => {
      // Redemption is atomic inside create_order_with_items; kept for backward-compatible callers.
    },

    updateWheelSpinEmail: async (spinId, visitorId, email) => {
      if (!hasSupabase || !spinId || !visitorId || !email) return null;
      const { data, error } = await supabase.rpc('record_wheel_spin_email', {
        p_spin_id: spinId,
        p_visitor_id: visitorId,
        p_email: email,
      });
      if (error) throw error;
      return data;
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
