import { supabase, hasSupabase } from './supabaseClient';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

export const getStoredAuth = () => {
  try {
    return JSON.parse(localStorage.getItem('nexcard_auth') || 'null');
  } catch {
    return null;
  }
};

export const setStoredAuth = (auth) => {
  if (!auth) {
    localStorage.removeItem('nexcard_auth');
    return;
  }
  localStorage.setItem('nexcard_auth', JSON.stringify(auth));
};

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Error de red');
  }

  return response.json();
}

// --- Supabase helpers ---

export async function supaLogin({ email, password }) {
  if (!hasSupabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function supaRegister({ email, password }) {
  if (!hasSupabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function supaLogout() {
  if (!hasSupabase) return;
  await supabase.auth.signOut();
}

async function supabaseLandingContent() {
  const { data, error } = await supabase
    .from('content_blocks')
    .select('content')
    .eq('block_key', 'landing')
    .eq('locale', 'es-CL')
    .single();
  if (error) throw error;
  return data?.content || null;
}

async function supabasePublicProfile(slug) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .is('deleted_at', null)
    .single();
  if (error) throw error;
  // Incrementar view_count de forma atómica (RPC en DB). No hacemos await para no bloquear la carga.
  supabase.rpc('increment_view_count', { profile_slug: slug }).then(() => {}).catch(() => {});
  return data;
}

async function supabaseMyProfile() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw new Error('No hay sesión');

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single();
  if (error) throw error;
  return data;
}

async function supabaseUpdateMyProfile(payload) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw new Error('No hay sesión');

  const { data: existing, error: existingError } = await supabase
    .from('profiles')
    .select('id, user_id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...payload })
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const insertPayload = {
    ...payload,
    user_id: userId,
    status: payload.status || 'active',
  };

  const { data, error } = await supabase
    .from('profiles')
    .insert(insertPayload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function supabaseDashboard() {
  const { data: profiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('*');
  if (profilesErr) throw profilesErr;

  const { data: events, error: eventsErr } = await supabase
    .from('events')
    .select('profile_slug, event_type');
  if (eventsErr) throw eventsErr;

  const eventCounts = {};
  events.forEach((e) => {
    const key = `${e.profile_slug}|${e.event_type}`;
    eventCounts[key] = (eventCounts[key] || 0) + 1;
  });

  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select('*');
  if (ordersErr) throw ordersErr;

  const totalRevenue = orders
    .filter(o => o.payment_status === 'paid')
    .reduce((sum, o) => sum + (o.amount_cents || 0), 0) / 100;

  const users = profiles.map((profile) => ({
    id: profile.id,
    name: profile.full_name,
    slug: profile.slug,
    status: profile.status,
    taps: profile.view_count || 0,
    wa_clicks: eventCounts[`${profile.slug}|whatsapp`] || 0,
    vcard_clicks: eventCounts[`${profile.slug}|vcard`] || 0,
    color: profile.theme_color || '#10B981',
    account_type: profile.account_type,
  }));

  const recentOrders = orders
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  return {
    stats: {
      totalRevenue: Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totalRevenue),
      totalProfiles: profiles.length,
      totalOrders: orders.length,
      pendingOrders: orders.filter(o => o.fulfillment_status !== 'delivered').length,
    },
    users,
    recentOrders,
  };
}

async function supabaseInventory() {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*');
  if (error) throw error;
  return data;
}

async function supabaseAdminCards() {
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, card_code, public_token, status, activation_status, profile_id, deleted_at, revoked_at, archived_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const { data: events, error: eventsError } = await supabase
    .from('card_events')
    .select('card_id, event_type, created_at')
    .order('created_at', { ascending: false });

  if (eventsError) {
    console.warn('No fue posible cargar card_events para admin cards', eventsError.message);
    return cards;
  }

  const latestEventByCardId = events.reduce((acc, event) => {
    if (!acc[event.card_id]) {
      acc[event.card_id] = event;
    }
    return acc;
  }, {});

  return cards.map((card) => ({
    ...card,
    last_event: latestEventByCardId[card.id] || null,
  }));
}

async function supabaseAdminProfiles() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, slug, full_name, status, deleted_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  const { data: versions, error: versionsError } = await supabase
    .from('profile_versions')
    .select('profile_id, version');

  if (versionsError) throw versionsError;

  const { data: auditEvents, error: auditError } = await supabase
    .from('audit_log')
    .select('entity_id, action, created_at')
    .eq('entity_type', 'profile')
    .order('created_at', { ascending: false });

  if (auditError) throw auditError;

  const versionCountByProfile = versions.reduce((acc, item) => {
    acc[item.profile_id] = (acc[item.profile_id] || 0) + 1;
    return acc;
  }, {});

  const latestEventByProfile = auditEvents.reduce((acc, item) => {
    if (!acc[item.entity_id]) acc[item.entity_id] = item;
    return acc;
  }, {});

  return profiles.map((profile) => ({
    ...profile,
    version_count: versionCountByProfile[profile.id] || 0,
    last_event: latestEventByProfile[profile.id] || null,
  }));
}

async function supabaseGetActorId() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const actorId = sessionData?.session?.user?.id;
  if (!actorId) throw new Error('No hay sesión');
  return actorId;
}

async function supabaseRevokeCard(cardId, reason = null) {
  const actorId = await supabaseGetActorId();
  const { error } = await supabase.rpc('revoke_card', {
    target_card_id: cardId,
    actor_id: actorId,
    reason,
  });
  if (error) throw error;
  return supabaseAdminCards();
}

async function supabaseArchiveCard(cardId) {
  const actorId = await supabaseGetActorId();
  const { error } = await supabase.rpc('soft_delete_card', {
    target_card_id: cardId,
    actor_id: actorId,
  });
  if (error) throw error;
  return supabaseAdminCards();
}

async function supabaseOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*), payments(*)');
  if (error) throw error;
  return data;
}

async function supabaseUpdateLandingAdmin(content) {
  const { data, error } = await supabase
    .from('content_blocks')
    .upsert({ block_key: 'landing', locale: 'es-CL', content }, { onConflict: 'block_key,locale' })
    .select()
    .single();
  if (error) throw error;
  return data?.content || content;
}

// --- API surface ---
export const api = {
  health: () => request('/health'),

  // Auth: Supabase first, fallback mock
  register: async (payload) => {
    if (hasSupabase) {
      const data = await supaRegister(payload);
      const user = data.user;
      setStoredAuth({ user });
      return { user };
    }
    return request('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
  },
  login: async (payload) => {
    if (hasSupabase) {
      const data = await supaLogin(payload);
      const user = data.session?.user;
      setStoredAuth({ user });
      return { user };
    }
    return request('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
  },
  logout: async () => {
    if (hasSupabase) await supaLogout();
    setStoredAuth(null);
  },

  // Landing content
  getLandingContent: async () => {
    if (hasSupabase) {
      try {
        const content = await supabaseLandingContent();
        if (content) return content;
      } catch (e) {
        console.warn('Supabase landing content error, fallback local', e.message);
      }
    }
    return request('/content/landing');
  },

  // Public profile by slug
  getPublicProfile: async (slug) => {
    if (hasSupabase) {
      const profile = await supabasePublicProfile(slug);
      if (profile) return profile;
      throw new Error('Perfil no encontrado en Supabase');
    }
    return request(`/public/profiles/${slug}`);
  },

  // Owner profile: no insecure fallback to local API
  getMyProfile: async () => {
    if (!hasSupabase) {
      throw new Error('Perfil privado deshabilitado: Supabase Auth es obligatorio');
    }
    return supabaseMyProfile();
  },
  updateMyProfile: async (payload) => {
    if (!hasSupabase) {
      throw new Error('Edición de perfil deshabilitada: Supabase Auth es obligatorio');
    }
    return supabaseUpdateMyProfile(payload);
  },

  // Admin dashboard: no insecure fallback to local API
  getAdminDashboard: async () => {
    if (!hasSupabase) {
      throw new Error('Admin deshabilitado: Supabase Auth es obligatorio');
    }
    return supabaseDashboard();
  },

  // Inventory: no insecure fallback to local API
  getInventory: async () => {
    if (!hasSupabase) {
      throw new Error('Inventario deshabilitado: Supabase Auth es obligatorio');
    }
    const items = await supabaseInventory();
    return { items };
  },

  // Orders: no insecure fallback to local API
  getOrders: async () => {
    if (!hasSupabase) {
      throw new Error('Órdenes deshabilitadas: Supabase Auth es obligatorio');
    }
    const orders = await supabaseOrders();
    return { orders, products: [] };
  },

  // Cards admin view
  getAdminCards: async () => {
    if (!hasSupabase) {
      throw new Error('Cards admin deshabilitado: Supabase Auth es obligatorio');
    }
    const cards = await supabaseAdminCards();
    return { cards };
  },

  getAdminProfiles: async () => {
    if (!hasSupabase) {
      throw new Error('Profiles admin deshabilitado: Supabase Auth es obligatorio');
    }
    const profiles = await supabaseAdminProfiles();
    return { profiles };
  },
  revokeCard: async (cardId, reason = null) => {
    if (!hasSupabase) {
      throw new Error('Cards admin deshabilitado: Supabase Auth es obligatorio');
    }
    const cards = await supabaseRevokeCard(cardId, reason);
    return { cards };
  },
  archiveCard: async (cardId) => {
    if (!hasSupabase) {
      throw new Error('Cards admin deshabilitado: Supabase Auth es obligatorio');
    }
    const cards = await supabaseArchiveCard(cardId);
    return { cards };
  },

  // CMS admin: no insecure fallback to local API
  getLandingAdminContent: async () => {
    if (!hasSupabase) {
      throw new Error('CMS admin deshabilitado: Supabase Auth es obligatorio');
    }
    const content = await supabaseLandingContent();
    return content || null;
  },
  updateLandingAdminContent: async (payload) => {
    if (!hasSupabase) {
      throw new Error('CMS admin deshabilitado: Supabase Auth es obligatorio');
    }
    return supabaseUpdateLandingAdmin(payload);
  },

  // Upload / track (mock)
  uploadAvatar: (imageUrl) => request('/upload/avatar', { method: 'POST', body: JSON.stringify({ imageUrl }) }),
  trackClick: async ({ slug, buttonType }) => {
    if (hasSupabase) {
      const { error } = await supabase.from('events').insert({
        profile_slug: slug,
        event_type: buttonType,
        metadata: { source: 'web', device: navigator.userAgent },
      });
      if (!error) return;
      console.warn('Supabase track error, fallback local', error.message);
    }
    return request('/track', { method: 'POST', body: JSON.stringify({ slug, buttonType }) });
  },
};
