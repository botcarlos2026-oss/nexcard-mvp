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
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Error de red');
  }
  return response.json();
}

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

  if (orderError) throw new Error(orderError.message || 'No se pudo crear la orden');
  if (!orderData?.id) throw new Error('La orden fue creada pero no retornó un ID');

  const orderId = orderData.id;
  const orderItems = payload.items.map((item) => ({
    order_id: orderId,
    product_id: item.product_id,
    quantity: Number(item.quantity) || 1,
    unit_price_cents: Number(item.unit_price_cents),
    currency: payload.currency || 'CLP',
  }));

  console.log('Inserting order_items:', JSON.stringify(orderItems));
  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) console.error('order_items error:', JSON.stringify(itemsError));
  if (itemsError) {
    await supabase.from('orders').delete().eq('id', orderId);
    throw new Error('Error al guardar los items. La operación fue revertida.');
  }

  // Enviar email de confirmación vía Edge Function
  try {
    const emailPayload = {
      order: orderData,
      items: payload.items.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name || item.product_id,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
      })),
    };
    const { error: fnError } = await supabase.functions.invoke('send-order-confirmation', {
      body: JSON.stringify(emailPayload),
      headers: { 'Content-Type': 'application/json' },
    });
    if (fnError) console.warn('Email function error:', fnError);
  } catch (emailErr) {
    console.warn('Email no enviado:', emailErr);
  }

  return orderData;
}

export const api = {
  health: () => request('/health'),

  register: async (payload) => {
    if (hasSupabase) {
      const { data, error } = await supabase.auth.signUp({ email: payload.email, password: payload.password });
      if (error) throw new Error(error.message);
      setStoredAuth({ user: data.user });
      return { user: data.user };
    }
    return request('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
  },

  login: async (payload) => {
    if (hasSupabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: payload.email, password: payload.password });
      if (error) throw new Error(error.message);
      const user = data.user || data.session?.user;
      if (!user) throw new Error('No se pudo obtener el usuario');
      setStoredAuth({ user });
      return { user };
    }
    return request('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
  },

  logout: async () => {
    if (hasSupabase) await supabase.auth.signOut();
    setStoredAuth(null);
  },

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

  getPublicProfile: async (slug) => {
    if (hasSupabase) {
      const { data, error } = await supabase
        .from('profiles').select('*')
        .eq('slug', slug).eq('status', 'active').is('deleted_at', null).single();
      if (!error && data) return data;
    }
    return request(`/public/profiles/${slug}`);
  },

  getMyProfile: async () => {
    if (!hasSupabase) throw new Error('Perfil privado deshabilitado');
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) throw new Error('No hay sesión activa');
    const { data, error } = await supabase
      .from('profiles').select('*').eq('user_id', userId).is('deleted_at', null).single();
    if (error) throw new Error(error.message);
    return data;
  },

  updateMyProfile: async (payload) => {
    if (!hasSupabase) throw new Error('Edición deshabilitada');
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) throw new Error('No hay sesión activa');
    const { data, error } = await supabase
      .from('profiles').update(payload).eq('user_id', userId).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  getAdminDashboard: async () => {
    if (!hasSupabase) throw new Error('Admin deshabilitado');
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const paidOrders = (orders || []).filter(o => o.payment_status === 'paid');
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.amount_cents || 0), 0);
    const pendingOrders = (orders || []).filter(o => !['delivered','cancelled'].includes(o.fulfillment_status)).length;
    const paidOrdersCount = paidOrders.length;
    const users = (profiles || []).map(p => ({
      id: p.id,
      name: p.name || p.slug || 'Sin nombre',
      slug: p.slug || '',
      status: p.status || 'active',
      color: p.color || '#10B981',
      taps: p.taps || 0,
      wa_clicks: p.wa_clicks || 0,
      vcard_clicks: p.vcard_clicks || 0,
      account_type: p.account_type || 'individual',
    }));
    return {
      stats: {
        totalProfiles: profiles?.length || 0,
        totalOrders: orders?.length || 0,
        totalRevenue,
        pendingOrders,
        paidOrders: paidOrdersCount,
      },
      users,
      recentOrders: (orders || []).slice(0, 5),
    };
  },

  getProducts: async () => supabaseGetProducts(),
  createOrder: async (payload) => supabaseCreateOrder(payload),

  getInventory: async () => {
    if (!hasSupabase) return { items: [], movements: [] };
    const { data: items, error: itemsError } = await supabase
      .from('inventory_items')
      .select('*')
      .order('created_at', { ascending: true });
    if (itemsError) throw new Error(itemsError.message);
    const { data: movements, error: movErr } = await supabase
      .from('inventory_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    return { items: items || [], movements: movements || [] };
  },

  createInventoryMovement: async (payload) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error: movError } = await supabase
      .from('inventory_movements')
      .insert([payload]);
    if (movError) throw new Error(movError.message);
    // Actualizar stock del item
    const { data: item } = await supabase
      .from('inventory_items')
      .select('stock')
      .eq('id', payload.inventory_item_id)
      .single();
    if (item) {
      let newStock = item.stock;
      if (payload.movement_type === 'in') newStock += Number(payload.quantity);
      else if (payload.movement_type === 'out') newStock -= Number(payload.quantity);
      else if (payload.movement_type === 'adjust') newStock = Number(payload.quantity);
      await supabase
        .from('inventory_items')
        .update({ stock: Math.max(0, newStock) })
        .eq('id', payload.inventory_item_id);
    }
    // Retornar estado actualizado
    const { data: items } = await supabase
      .from('inventory_items')
      .select('*')
      .order('created_at', { ascending: true });
    const { data: movements } = await supabase
      .from('inventory_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    return { items: items || [], movements: movements || [] };
  },

  getOrders: async () => {
    if (!hasSupabase) return { orders: [] };
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return { orders: data || [] };
  },

  updateOrder: async (orderId, payload) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');

    // Obtener valores anteriores para historial
    const { data: current } = await supabase
      .from('orders').select('*').eq('id', orderId).single();

    const { error } = await supabase.from('orders').update(payload).eq('id', orderId);
    if (error) throw new Error(error.message);

    // Guardar historial de cambios
    const historyEntries = Object.keys(payload)
      .filter(key => current && String(current[key]) !== String(payload[key]))
      .map(key => ({
        order_id: orderId,
        field: key,
        old_value: String(current?.[key] || ''),
        new_value: String(payload[key]),
      }));

    if (historyEntries.length > 0) {
      await supabase.from('order_status_history').insert(historyEntries);
    }

    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });
    return { orders: data || [] };
  },

  linkOrderCard: async () => ({ orders: [] }),

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
  getLandingAdminContent: async () => null,
  updateLandingAdminContent: async () => null,
  uploadAvatar: () => Promise.resolve({}),
  trackClick: async () => Promise.resolve({}),
};
