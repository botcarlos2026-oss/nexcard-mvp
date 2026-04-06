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
    .single();
  if (error) throw error;
  // Incrementar view_count de forma atómica (RPC en DB). No hacemos await para no bloquear la carga.
  supabase.rpc('increment_view_count', { profile_slug: slug }).catch(() => {});
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
    .single();
  if (error) throw error;
  return data;
}

async function supabaseUpdateMyProfile(payload) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw new Error('No hay sesión');

  const { data, error } = await supabase
    .from('profiles')
    .update({ ...payload })
    .eq('user_id', userId)
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
      try {
        const profile = await supabasePublicProfile(slug);
        if (profile) return profile;
      } catch (e) {
        console.warn('Supabase public profile error, fallback local', e.message);
      }
    }
    return request(`/public/profiles/${slug}`);
  },

  // Owner profile (Supabase first)
  getMyProfile: async () => {
    if (hasSupabase) {
      try {
        return await supabaseMyProfile();
      } catch (e) {
        console.warn('Supabase my profile error, fallback local', e.message);
      }
    }
    return request('/me/profile');
  },
  updateMyProfile: async (payload) => {
    if (hasSupabase) {
      try {
        return await supabaseUpdateMyProfile(payload);
      } catch (e) {
        console.warn('Supabase update profile error, fallback local', e.message);
      }
    }
    return request('/me/profile', { method: 'PUT', body: JSON.stringify(payload) });
  },

  // Admin dashboard
  getAdminDashboard: async () => {
    if (hasSupabase) {
      try {
        return await supabaseDashboard();
      } catch (e) {
        console.warn('Supabase dashboard error, fallback local', e.message);
      }
    }
    return request('/admin/dashboard');
  },

  // Inventory
  getInventory: async () => {
    if (hasSupabase) {
      try {
        const items = await supabaseInventory();
        return { items };
      } catch (e) {
        console.warn('Supabase inventory error, fallback local', e.message);
      }
    }
    return request('/admin/inventory');
  },

  // Orders
  getOrders: async () => {
    if (hasSupabase) {
      try {
        const orders = await supabaseOrders();
        return { orders, products: [] };
      } catch (e) {
        console.warn('Supabase orders error, fallback local', e.message);
      }
    }
    return request('/admin/orders');
  },

  // CMS admin
  getLandingAdminContent: async () => {
    if (hasSupabase) {
      try {
        const content = await supabaseLandingContent();
        if (content) return content;
      } catch (e) {
        console.warn('Supabase CMS read error, fallback local', e.message);
      }
    }
    return request('/admin/content/landing');
  },
  updateLandingAdminContent: async (payload) => {
    if (hasSupabase) {
      try {
        return await supabaseUpdateLandingAdmin(payload);
      } catch (e) {
        console.warn('Supabase CMS write error, fallback local', e.message);
      }
    }
    return request('/admin/content/landing', { method: 'PUT', body: JSON.stringify(payload) });
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
