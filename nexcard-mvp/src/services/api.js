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

// --- Supabase Checkout Functions ---

async function supabaseGetProducts() {
  if (!hasSupabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

async function supabaseCreateOrder(payload) {
  if (!hasSupabase) throw new Error('Supabase no configurado');
  
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id || null;

  const orderPayload = {
    user_id: userId,
    customer_name: payload.customer_name,
    customer_email: payload.customer_email,
    payment_method: payload.payment_method,
    payment_status: 'pending',
    fulfillment_status: 'new',
    amount_cents: payload.amount_cents,
    currency: payload.currency || 'CLP',
  };

  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert([orderPayload])
    .select()
    .single();

  if (orderError) throw orderError;

  if (!orderData?.id) {
    throw new Error('No se pudo crear la orden');
  }

  const orderId = orderData.id;

  if (payload.items && payload.items.length > 0) {
    const orderItems = payload.items.map((item) => ({
      order_id: orderId,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
      currency: payload.currency || 'CLP',
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      await supabase.from('orders').delete().eq('id', orderId);
      throw itemsError;
    }
  }

  // Enviar email de confirmación (async, no bloquea)
  try {
    const emailModule = await import('./email.js');
    if (emailModule.sendOrderConfirmationEmail) {
      emailModule.sendOrderConfirmationEmail(payload.customer_email, orderData).catch(err => {
        console.error('Email error:', err);
      });
    }
  } catch (emailError) {
    console.warn('Email service not available:', emailError);
  }

  return orderData;
}

// --- API Surface ---
export const api = {
  health: () => request('/health'),

  // Auth
  register: async (payload) => {
    if (hasSupabase) {
      const { data, error } = await supabase.auth.signUp({ email: payload.email, password: payload.password });
      if (error) throw error;
      const user = data.user;
      setStoredAuth({ user });
      return { user };
    }
    return request('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
  },
  login: async (payload) => {
    if (hasSupabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: payload.email, password: payload.password });
      if (error) throw error;
      const user = data.session?.user;
      setStoredAuth({ user });
      return { user };
    }
    return request('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
  },
  logout: async () => {
    if (hasSupabase) await supabase.auth.signOut();
    setStoredAuth(null);
  },

  // Landing content
  getLandingContent: async () => {
    if (hasSupabase) {
      try {
        const { data, error } = await supabase
          .from('content_blocks')
          .select('content')
          .eq('block_key', 'landing')
          .eq('locale', 'es-CL')
          .single();
        if (!error && data?.content) return data.content;
      } catch (e) {
        console.warn('Supabase landing content error', e.message);
      }
    }
    return request('/content/landing');
  },

  // Public profile by slug
  getPublicProfile: async (slug) => {
    if (hasSupabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'active')
        .is('deleted_at', null)
        .single();
      if (!error && data) return data;
    }
    return request(`/public/profiles/${slug}`);
  },

  // Owner profile
  getMyProfile: async () => {
    if (!hasSupabase) throw new Error('Perfil privado deshabilitado');
    const { data: sessionData } = await supabase.auth.getSession();
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
  },
  updateMyProfile: async (payload) => {
    if (!hasSupabase) throw new Error('Edición deshabilitada');
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) throw new Error('No hay sesión');
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Admin
  getAdminDashboard: async () => {
    if (!hasSupabase) throw new Error('Admin deshabilitado');
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: orders } = await supabase.from('orders').select('*');
    return { stats: { totalProfiles: profiles?.length || 0, totalOrders: orders?.length || 0 }, users: [], recentOrders: [] };
  },

  // Checkout
  getProducts: async () => {
    return supabaseGetProducts();
  },

  createOrder: async (payload) => {
    return supabaseCreateOrder(payload);
  },

  // Inventory (minimal)
  getInventory: async () => {
    return { items: [], movements: [] };
  },
  createInventoryMovement: async () => {
    return { items: [], movements: [] };
  },

  // Orders
  getOrders: async () => {
    const { data } = await supabase.from('orders').select('*');
    return { orders: data || [], products: [] };
  },
  updateOrder: async (orderId, payload) => {
    await supabase.from('orders').update(payload).eq('id', orderId);
    const { data } = await supabase.from('orders').select('*');
    return { orders: data || [] };
  },
  linkOrderCard: async () => {
    return { orders: [] };
  },

  // Cards admin
  getAdminCards: async () => {
    const { data: cards } = await supabase.from('cards').select('*');
    const { data: profiles } = await supabase.from('profiles').select('*');
    return { cards: cards || [], profiles: profiles || [] };
  },

  getAdminProfiles: async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    return { profiles: profiles || [] };
  },
  assignCard: async () => {
    return { cards: [], profiles: [] };
  },
  reassignCard: async () => {
    return { cards: [], profiles: [] };
  },
  activateCard: async () => {
    return { cards: [] };
  },
  revokeCard: async () => {
    return { cards: [] };
  },
  archiveCard: async () => {
    return { cards: [] };
  },
  archiveProfile: async () => {
    return { profiles: [] };
  },
  restoreProfileVersion: async () => {
    return { profiles: [] };
  },

  // CMS
  getLandingAdminContent: async () => {
    return null;
  },
  updateLandingAdminContent: async () => {
    return null;
  },

  // Upload
  uploadAvatar: () => Promise.resolve({}),
  trackClick: async () => Promise.resolve({}),
};
