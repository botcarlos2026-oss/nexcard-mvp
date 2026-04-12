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
    .order('price_cents', { ascending: true });

  if (error) throw new Error(error.message || 'Error al cargar productos');
  return data || [];
}

async function supabaseCreateOrder(payload) {
  if (!hasSupabase) throw new Error('Supabase no configurado');

  // Validaciones básicas en cliente (segunda capa — la primera es el formulario)
  if (!payload.customer_name?.trim()) throw new Error('Nombre del cliente requerido');
  if (!payload.customer_email?.trim()) throw new Error('Email del cliente requerido');
  if (!payload.items?.length) throw new Error('La orden debe tener al menos un producto');
  if (!payload.amount_cents || payload.amount_cents <= 0) throw new Error('Monto inválido');

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id || null;

  const orderPayload = {
    user_id: userId,
    customer_name: payload.customer_name.trim(),
    customer_email: payload.customer_email.trim().toLowerCase(),
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

  if (orderError) {
    throw new Error(orderError.message || 'No se pudo crear la orden');
  }

  if (!orderData?.id) {
    throw new Error('La orden fue creada pero no retornó un ID');
  }

  const orderId = orderData.id;

  // Insertar items
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
    // Rollback manual: eliminar la orden si los items fallaron
    await supabase.from('orders').delete().eq('id', orderId);
    throw new Error('Error al guardar los items de la orden. La operación fue revertida.');
  }

  // Nota: email de confirmación se implementará vía Supabase Edge Function
  // cuando se configure SendGrid/Resend. No hay import de email.js local.

  return orderData;
}

// --- API Surface ---
export const api = {
  health: () => request('/health'),

  // Auth
  register: async (payload) => {
    if (hasSupabase) {
      const { data, error } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
      });
      if (error) throw new Error(error.message);
      const user = data.user;
      setStoredAuth({ user });
      return { user };
    }
    return request('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
  },

  login: async (payload) => {
    if (hasSupabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: payload.email,
        password: payload.password,
      });
      if (error) throw new Error(error.message);
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
        console.warn('Supabase landing content error:', e.message);
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
    if (!userId) throw new Error('No hay sesión activa');
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  updateMyProfile: async (payload) => {
    if (!hasSupabase) throw new Error('Edición deshabilitada');
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) throw new Error('No hay sesión activa');
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  // Admin
  getAdminDashboard: async () => {
    if (!hasSupabase) throw new Error('Admin deshabilitado');
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: orders } = await supabase.from('orders').select('*');
    return {
      stats: {
        totalProfiles: profiles?.length || 0,
        totalOrders: orders?.length || 0,
      },
      users: [],
      recentOrders: [],
    };
  },

  // Checkout
  getProducts: async () => supabaseGetProducts(),
  createOrder: async (payload) => supabaseCreateOrder(payload),

  // Inventory
  getInventory: async () => ({ items: [], movements: [] }),
  createInventoryMovement: async () => ({ items: [], movements: [] }),

  // Orders
  getOrders: async () => {
    if (!hasSupabase) return { orders: [] };
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return { orders: data || [] };
  },

  updateOrder: async (orderId, payload) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase.from('orders').update(payload).eq('id', orderId);
    if (error) throw new Error(error.message);
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    return { orders: data || [] };
  },

  linkOrderCard: async () => ({ orders: [] }),

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

  assignCard: async () => ({ cards: [], profiles: [] }),
  reassignCard: async () => ({ cards: [], profiles: [] }),
  activateCard: async () => ({ cards: [] }),
  revokeCard: async () => ({ cards: [] }),
  archiveCard: async () => ({ cards: [] }),
  archiveProfile: async () => ({ profiles: [] }),
  restoreProfileVersion: async () => ({ profiles: [] }),

  // CMS
  getLandingAdminContent: async () => null,
  updateLandingAdminContent: async () => null,

  // Misc
  uploadAvatar: () => Promise.resolve({}),
  trackClick: async () => Promise.resolve({}),
};
