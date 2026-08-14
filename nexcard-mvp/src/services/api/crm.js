const CART_TOKEN_STORAGE_PREFIX = 'nexcard_abandoned_cart_token:';

const cartTokenStorageKey = (cartId) => `${CART_TOKEN_STORAGE_PREFIX}${cartId}`;

const rememberCartToken = (cartId, updateToken) => {
  if (!cartId || !updateToken || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(cartTokenStorageKey(cartId), updateToken);
  } catch {
    // sessionStorage can be unavailable in private mode.
  }
};

const readCartToken = (cartId) => {
  if (!cartId || typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(cartTokenStorageKey(cartId));
  } catch {
    return null;
  }
};

export function createCrmApi({ supabase, hasSupabase }) {
  return {
    saveAbandonedCart: async ({ email, customerName, items, totalCents }) => {
      if (!hasSupabase) return null;
      try {
        const { data, error } = await supabase.rpc('save_abandoned_cart_public', {
          cart_email: email,
          cart_customer_name: customerName || null,
          cart_items: items || [],
          cart_total_cents: Number(totalCents) || 0,
        });
        if (error || !data?.id) return null;
        rememberCartToken(data.id, data.update_token);
        return { id: data.id };
      } catch {
        return null;
      }
    },

    markCartConverted: async (cartId) => {
      if (!hasSupabase || !cartId) return;
      try {
        const updateToken = readCartToken(cartId);
        if (!updateToken) return;
        await supabase.rpc('mark_abandoned_cart_converted_public', {
          cart_id: cartId,
          cart_update_token: updateToken,
        });
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
