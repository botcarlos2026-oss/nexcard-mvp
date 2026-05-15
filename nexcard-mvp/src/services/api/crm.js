export function createCrmApi({ supabase, hasSupabase }) {
  return {
    saveAbandonedCart: async ({ email, customerName, items, totalCents }) => {
      if (!hasSupabase) return null;
      try {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { data: existing } = await supabase
          .from('abandoned_carts')
          .select('id')
          .eq('email', email.toLowerCase())
          .in('status', ['abandoned', 'email_sent'])
          .gte('created_at', twoHoursAgo)
          .limit(1)
          .maybeSingle();

        if (existing?.id) {
          await supabase
            .from('abandoned_carts')
            .update({ customer_name: customerName || null, items, total_cents: totalCents })
            .eq('id', existing.id);
          return { id: existing.id };
        }

        const { data, error } = await supabase
          .from('abandoned_carts')
          .insert([{ email: email.toLowerCase(), customer_name: customerName || null, items, total_cents: totalCents }])
          .select('id')
          .single();
        if (error) return null;
        return { id: data.id };
      } catch {
        return null;
      }
    },

    markCartConverted: async (cartId) => {
      if (!hasSupabase || !cartId) return;
      try {
        await supabase
          .from('abandoned_carts')
          .update({ status: 'converted', converted_at: new Date().toISOString() })
          .eq('id', cartId);
      } catch {
        // silencioso
      }
    },

    getAbandonedCarts: async () => {
      if (!hasSupabase) return [];
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('abandoned_carts')
        .select('*')
        .in('status', ['abandoned', 'email_sent', 'converted'])
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    },

    getCRMContacts: async () => {
      const { data } = await supabase
        .from('crm_contacts')
        .select('*, crm_deals(count)')
        .order('created_at', { ascending: false });
      return { contacts: data || [] };
    },

    getCRMDeals: async () => {
      const { data } = await supabase
        .from('crm_deals')
        .select('*, crm_contacts(name, email, company, phone)')
        .order('created_at', { ascending: false });
      return { deals: data || [] };
    },

    createCRMDeal: async (deal) => {
      const { data, error } = await supabase.from('crm_deals').insert(deal).select().single();
      if (error) throw error;
      return data;
    },

    updateCRMDeal: async (id, payload) => {
      const { error } = await supabase
        .from('crm_deals')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },

    getCRMActivities: async (dealId) => {
      const { data } = await supabase
        .from('crm_activities')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });
      return { activities: data || [] };
    },

    addCRMActivity: async (activity) => {
      const { data, error } = await supabase.from('crm_activities').insert(activity).select().single();
      if (error) throw error;
      return data;
    },
  };
}
