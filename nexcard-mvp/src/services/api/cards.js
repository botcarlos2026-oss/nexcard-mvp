export const enrichAdminCards = ({ cards = [], profiles = [], events = [] }) => {
  const profileMap = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));

  const eventsByCard = (events || []).reduce((acc, event) => {
    if (!event?.card_id) return acc;
    if (!acc[event.card_id]) acc[event.card_id] = [];
    acc[event.card_id].push(event);
    return acc;
  }, {});

  return (cards || []).map((card) => {
    const profile = profileMap[card.profile_id];
    return {
      ...card,
      profile_name: profile?.full_name || profile?.name || profile?.slug || null,
      profile_slug: profile?.slug || null,
      last_event: eventsByCard[card.id]?.[0] || null,
      events: eventsByCard[card.id] || [],
    };
  });
};

export function createCardsApi({ supabase, hasSupabase, getClerkUserId, request }) {
  const fetchAdminCards = async () => {
    const [cardsRes, profilesRes, eventsRes] = await Promise.all([
      supabase.from('cards').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').is('deleted_at', null),
      supabase
        .from('card_events')
        .select('card_id, event_type, created_at')
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    const profiles = profilesRes.data || [];
    const events = eventsRes.data || [];
    const cards = enrichAdminCards({
      cards: cardsRes.data || [],
      profiles,
      events,
    });

    return { cards, profiles };
  };

  const getAdminCards = async () => {
    if (!hasSupabase) return request('/admin/cards');
    return fetchAdminCards();
  };

  const assignCard = async (cardId, profileId) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase
      .from('cards')
      .update({
        profile_id: profileId,
        status: 'assigned',
        activation_status: 'assigned',
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', cardId);
    if (error) throw new Error(error.message);
    await supabase.from('card_events').insert({ card_id: cardId, event_type: 'assigned', context: { profile_id: profileId } }).catch(() => {});
    return fetchAdminCards();
  };

  const reassignCard = async (cardId, profileId) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase
      .from('cards')
      .update({
        profile_id: profileId,
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', cardId);
    if (error) throw new Error(error.message);
    await supabase.from('card_events').insert({ card_id: cardId, event_type: 'reassigned', context: { profile_id: profileId } }).catch(() => {});
    return fetchAdminCards();
  };

  const activateCard = async (cardId) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase
      .from('cards')
      .update({
        status: 'active',
        activation_status: 'activated',
        activated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', cardId);
    if (error) throw new Error(error.message);
    await supabase.from('card_events').insert({ card_id: cardId, event_type: 'activated' }).catch(() => {});
    return fetchAdminCards();
  };

  const revokeCard = async (cardId) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const actorId = getClerkUserId();
    const { error } = await supabase.rpc('revoke_card', { target_card_id: cardId, actor_id: actorId });
    if (error) throw new Error(error.message);
    return fetchAdminCards();
  };

  const archiveCard = async (cardId) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const actorId = getClerkUserId();
    const { error } = await supabase.rpc('soft_delete_card', { target_card_id: cardId, actor_id: actorId });
    if (error) throw new Error(error.message);
    return fetchAdminCards();
  };

  return {
    getAdminCards,
    assignCard,
    reassignCard,
    activateCard,
    revokeCard,
    archiveCard,
  };
}
