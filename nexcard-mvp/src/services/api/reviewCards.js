export function createReviewCardsApi({ supabase, hasSupabase }) {
  return {
    getReviewCards: async () => {
      if (!hasSupabase) return [];
      const { data, error } = await supabase
        .from('review_cards')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    },

    createReviewCard: async (payload) => {
      if (!hasSupabase) throw new Error('Supabase no configurado');
      const { data, error } = await supabase
        .from('review_cards')
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },

    updateReviewCard: async (id, payload) => {
      if (!hasSupabase) throw new Error('Supabase no configurado');
      const { data, error } = await supabase
        .from('review_cards')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },

    incrementReviewScan: async (slug) => {
      if (!hasSupabase) return;
      await supabase.rpc('increment_review_scan', { target_slug: slug }).catch(() => {
        supabase
          .from('review_cards')
          .select('scan_count')
          .eq('slug', slug)
          .single()
          .then(({ data }) => {
            if (data) {
              supabase.from('review_cards').update({ scan_count: (data.scan_count || 0) + 1 }).eq('slug', slug);
            }
          });
      });
    },
  };
}
