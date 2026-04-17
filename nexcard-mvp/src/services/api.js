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
    card_customization: payload.card_customization || null,
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

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) {
    await supabase.from('orders').delete().eq('id', orderId);
    throw new Error('Error al guardar los items. La operación fue revertida.');
  }

  // Enviar email de confirmación vía Edge Function
  try {
    const emailPayload = {
      order: orderData,
      card_customization: payload.card_customization || null,
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
  } catch {
    // Email no crítico, continuar sin bloquear
  }

  return orderData;
}

// ---------------------------------------------------------------------------
// Helpers privados
// ---------------------------------------------------------------------------

async function fetchAdminProfiles() {
  const [profilesRes, versionsRes, eventsRes] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase
      .from('profile_versions')
      .select('profile_id, version')
      .order('version', { ascending: false }),
    supabase
      .from('audit_log')
      .select('entity_id, action, created_at')
      .eq('entity_type', 'profile')
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  const versions = versionsRes.data || [];
  const events = eventsRes.data || [];

  // Max version por profile
  const latestVersionMap = versions.reduce((acc, v) => {
    if (!acc[v.profile_id] || v.version > acc[v.profile_id]) {
      acc[v.profile_id] = v.version;
    }
    return acc;
  }, {});

  // Último evento por profile
  const lastEventMap = events.reduce((acc, e) => {
    if (!acc[e.entity_id]) acc[e.entity_id] = e;
    return acc;
  }, {});

  const profiles = (profilesRes.data || []).map((p) => ({
    ...p,
    latest_version: latestVersionMap[p.id] || null,
    last_event: lastEventMap[p.id] || null,
  }));

  return { profiles };
}

async function fetchAdminCards() {
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
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));

  const eventsByCard = events.reduce((acc, e) => {
    if (!acc[e.card_id]) acc[e.card_id] = [];
    acc[e.card_id].push(e);
    return acc;
  }, {});

  const cards = (cardsRes.data || []).map((card) => {
    const profile = profileMap[card.profile_id];
    return {
      ...card,
      profile_name: profile?.full_name || profile?.name || profile?.slug || null,
      profile_slug: profile?.slug || null,
      last_event: eventsByCard[card.id]?.[0] || null,
      events: eventsByCard[card.id] || [],
    };
  });

  return { cards, profiles };
}

async function fetchOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*), payments(*)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return { orders: data || [] };
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
      } catch {
        // fallback al request REST
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
    return fetchOrders();
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

    return fetchOrders();
  },

  updateShipping: async (orderId, { carrier, tracking_code }) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    if (!carrier) throw new Error('Carrier requerido');
    if (!tracking_code?.trim()) throw new Error('Código de seguimiento requerido');

    const payload = {
      carrier,
      tracking_code: tracking_code.trim(),
      fulfillment_status: 'shipped',
      shipped_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('orders').update(payload).eq('id', orderId);
    if (error) throw new Error(error.message);

    // Historial
    const { data: current } = await supabase
      .from('orders').select('carrier, tracking_code, fulfillment_status').eq('id', orderId).single();

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

    // Trigger email de notificación de envío
    try {
      await supabase.functions.invoke('send-shipping-notification', {
        body: JSON.stringify({ order_id: orderId }),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // Email no crítico
    }

    return fetchOrders();
  },

  dispatchOrder: async (orderId, { carrier, tracking_code }) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    if (!carrier) throw new Error('Carrier requerido');
    if (!tracking_code?.trim()) throw new Error('Código de seguimiento requerido');

    const payload = {
      carrier,
      tracking_code: tracking_code.trim(),
      fulfillment_status: 'shipped',
      shipped_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('orders').update(payload).eq('id', orderId);
    if (error) throw new Error(error.message);

    // Historial
    const { data: current } = await supabase
      .from('orders').select('carrier, tracking_code, fulfillment_status').eq('id', orderId).single();
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

    // Descontar insumos de dispatch_config activos
    const decremented = [];
    const { data: configs } = await supabase
      .from('dispatch_config')
      .select('*, inventory_items(*)')
      .eq('active', true);

    if (configs && configs.length > 0) {
      for (const config of configs) {
        const item = config.inventory_items;
        if (!item) continue;
        const newStock = Math.max(0, (item.stock || 0) - config.quantity_per_dispatch);
        await supabase.from('inventory_items').update({ stock: newStock }).eq('id', item.id);
        await supabase.from('inventory_movements').insert([{
          inventory_item_id: item.id,
          movement_type: 'out',
          quantity: config.quantity_per_dispatch,
          reason: `Despacho orden ${orderId}`,
          order_id: orderId,
        }]);
        decremented.push({ name: item.item || item.sku, quantity: config.quantity_per_dispatch });
      }
    }

    // Verificar stock bajo mínimo tras descuento y enviar alerta si aplica
    try {
      const { data: allItems } = await supabase
        .from('inventory_items')
        .select('id, sku, item, stock, min_stock, stock_alert_sent_at')
        .gt('min_stock', 0);
      const lowItems = (allItems || []).filter(i => (i.stock || 0) <= (i.min_stock || 0));
      if (lowItems.length > 0) {
        await supabase.functions.invoke('send-low-stock-alert', {
          body: JSON.stringify({ items: lowItems.map(i => ({ name: i.item || i.sku, sku: i.sku, stock: i.stock, min_stock: i.min_stock })) }),
          headers: { 'Content-Type': 'application/json' },
        });
        await supabase.from('inventory_items')
          .update({ stock_alert_sent_at: new Date().toISOString() })
          .in('id', lowItems.map(i => i.id));
      }
    } catch {
      // Alerta no crítica, no bloquear despacho
    }

    // Trigger email de notificación de envío
    try {
      await supabase.functions.invoke('send-shipping-notification', {
        body: JSON.stringify({ order_id: orderId }),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // Email no crítico
    }

    const orders = await fetchOrders();
    return { ...orders, itemsDecremented: decremented };
  },

  getDispatchConfig: async () => {
    if (!hasSupabase) return [];
    const { data, error } = await supabase
      .from('dispatch_config')
      .select('*, inventory_items(*)')
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },

  addDispatchConfig: async ({ inventory_item_id, quantity_per_dispatch, description }) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase.from('dispatch_config').insert([{
      inventory_item_id,
      quantity_per_dispatch: Number(quantity_per_dispatch),
      description: description || null,
      active: true,
    }]);
    if (error) throw new Error(error.message);
    const { data } = await supabase
      .from('dispatch_config')
      .select('*, inventory_items(*)')
      .order('created_at', { ascending: true });
    return data || [];
  },

  deleteDispatchConfig: async (id) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase.from('dispatch_config').delete().eq('id', id);
    if (error) throw new Error(error.message);
    const { data } = await supabase
      .from('dispatch_config')
      .select('*, inventory_items(*)')
      .order('created_at', { ascending: true });
    return data || [];
  },

  linkOrderCard: async (orderId, cardId) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase
      .from('cards')
      .update({ order_id: orderId, updated_at: new Date().toISOString() })
      .eq('id', cardId);
    if (error) throw new Error(error.message);
    return fetchOrders();
  },

  updateCardNFC: async (cardId, { nfc_url }) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase
      .from('cards')
      .update({
        nfc_url,
        programmed_at: new Date().toISOString(),
        status: 'programmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', cardId);
    if (error) throw new Error(error.message);
    return fetchOrders();
  },

  getProfileSlugForOrder: async (orderId, customerEmail) => {
    if (!hasSupabase) return null;
    // Buscar por order_id primero, luego por email del cliente
    const { data: byOrder } = await supabase
      .from('profiles')
      .select('slug, id')
      .eq('order_id', orderId)
      .is('deleted_at', null)
      .maybeSingle();
    if (byOrder?.slug) return byOrder.slug;

    if (!customerEmail) return null;
    const { data: byEmail } = await supabase
      .from('profiles')
      .select('slug, id')
      .eq('email', customerEmail)
      .is('deleted_at', null)
      .maybeSingle();
    return byEmail?.slug || null;
  },

  getAdminCards: async () => {
    if (!hasSupabase) return { cards: [], profiles: [] };
    return fetchAdminCards();
  },

  getAdminProfiles: async () => {
    if (!hasSupabase) return { profiles: [] };
    return fetchAdminProfiles();
  },

  assignCard: async (cardId, profileId) => {
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
  },

  reassignCard: async (cardId, profileId) => {
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
  },

  activateCard: async (cardId) => {
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
  },

  revokeCard: async (cardId) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { data: { session } } = await supabase.auth.getSession();
    const actorId = session?.user?.id;
    const { error } = await supabase.rpc('revoke_card', { target_card_id: cardId, actor_id: actorId });
    if (error) throw new Error(error.message);
    return fetchAdminCards();
  },

  archiveCard: async (cardId) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { data: { session } } = await supabase.auth.getSession();
    const actorId = session?.user?.id;
    const { error } = await supabase.rpc('soft_delete_card', { target_card_id: cardId, actor_id: actorId });
    if (error) throw new Error(error.message);
    return fetchAdminCards();
  },
  archiveProfile: async (profileId) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { data: { session } } = await supabase.auth.getSession();
    const actorId = session?.user?.id;
    const { error } = await supabase.rpc('soft_delete_profile', {
      target_profile_id: profileId,
      actor_id: actorId,
    });
    if (error) throw new Error(error.message);
    return fetchAdminProfiles();
  },

  restoreProfileVersion: async (profileId, version) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { data: { session } } = await supabase.auth.getSession();
    const actorId = session?.user?.id;
    const { error } = await supabase.rpc('restore_profile_version', {
      target_profile_id: profileId,
      target_version: version,
      actor_id: actorId,
    });
    if (error) throw new Error(error.message);
    return fetchAdminProfiles();
  },
  getLandingAdminContent: async () => null,
  updateLandingAdminContent: async () => null,
  uploadAvatar: () => Promise.resolve({}),
  trackClick: async () => Promise.resolve({}),

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
      // fallback: direct update if RPC not available
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

  updateInventoryItem: async (itemId, payload) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase.from('inventory_items').update(payload).eq('id', itemId);
    if (error) throw new Error(error.message);
    const { data: items } = await supabase.from('inventory_items').select('*').order('created_at', { ascending: true });
    return { items: items || [] };
  },

  checkLowStock: async () => {
    if (!hasSupabase) return { lowStockItems: [] };
    const { data } = await supabase
      .from('inventory_items')
      .select('sku, name, item, stock, min_stock')
      .gt('min_stock', 0);
    const lowStockItems = (data || []).filter(i => (i.stock || 0) <= (i.min_stock || 0));
    return { lowStockItems };
  },

  getRefundForOrder: async (orderId) => {
    if (!hasSupabase) return null;
    const { data, error } = await supabase
      .from('refunds')
      .select('*')
      .eq('order_id', orderId)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  },

  createRefund: async ({ orderId, reason, amount_cents, notes }) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');

    // Insertar refund en estado pending
    const { data: refund, error: insertError } = await supabase
      .from('refunds')
      .insert([{ order_id: orderId, reason, amount_cents, notes: notes || null, status: 'pending' }])
      .select()
      .single();
    if (insertError) throw new Error(insertError.message);

    // Invocar Edge Function process-refund
    const { data: fnData, error: fnError } = await supabase.functions.invoke('process-refund', {
      body: JSON.stringify({ orderId, amount_cents, reason, refundId: refund.id }),
      headers: { 'Content-Type': 'application/json' },
    });

    if (fnError) throw new Error(fnError.message || 'Error al procesar reembolso en MP');
    if (!fnData?.success) throw new Error(fnData?.error || 'Mercado Pago rechazó el reembolso');

    return { refund: { ...refund, status: 'processed', mp_refund_id: fnData.mp_refund_id }, mp_refund_id: fnData.mp_refund_id };
  },

  getPendingRefundsCount: async () => {
    if (!hasSupabase) return 0;
    const { count } = await supabase
      .from('refunds')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    return count || 0;
  },

  // ---------------------------------------------------------------------------
  // Carritos abandonados
  // ---------------------------------------------------------------------------

  saveAbandonedCart: async ({ email, customerName, items, totalCents }) => {
    if (!hasSupabase) return null;
    try {
      // Buscar registro existente del mismo email en las últimas 2 horas
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
        // Actualizar registro existente
        await supabase
          .from('abandoned_carts')
          .update({ customer_name: customerName || null, items, total_cents: totalCents })
          .eq('id', existing.id);
        return { id: existing.id };
      }

      // Insertar nuevo registro
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
};
