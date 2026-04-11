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
  const { data: items, error: itemsError } = await supabase
    .from('inventory_items')
    .select('*')
    .order('category', { ascending: true })
    .order('item', { ascending: true });
  if (itemsError) throw itemsError;

  const normalizedItems = (items || []).map((item) => ({
    ...item,
    sku: item.sku || item.item_code || null,
  }));

  const { data: movements, error: movementsError } = await supabase
    .from('inventory_movements')
    .select('*')
    .order('created_at', { ascending: false });
  if (movementsError) throw movementsError;

  return { items: normalizedItems, movements: movements || [] };
}

async function supabaseCreateInventoryMovement(payload) {
  const { inventory_item_id, movement_type, quantity, reason, order_id = null } = payload;
  const normalizedQuantity = Number(quantity);

  if (!inventory_item_id) throw new Error('Debes seleccionar un item de inventario');
  if (!movement_type) throw new Error('Debes indicar tipo de movimiento');
  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) throw new Error('La cantidad debe ser mayor a 0');
  if (!reason?.trim()) throw new Error('Debes indicar un motivo');

  const { data: item, error: itemError } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('id', inventory_item_id)
    .single();
  if (itemError) throw itemError;

  let nextStock = item.stock || 0;
  if (movement_type === 'in') nextStock += normalizedQuantity;
  else if (movement_type === 'out') nextStock -= normalizedQuantity;
  else if (movement_type === 'adjust') nextStock += normalizedQuantity;
  else throw new Error('Tipo de movimiento inválido');

  if (nextStock < 0) {
    throw new Error(`Stock insuficiente para ${item.item}. Disponible: ${item.stock || 0}`);
  }

  const { error: movementError } = await supabase
    .from('inventory_movements')
    .insert({
      inventory_item_id,
      movement_type,
      quantity: normalizedQuantity,
      reason: reason.trim(),
      order_id,
    });
  if (movementError) throw movementError;

  const { error: stockError } = await supabase
    .from('inventory_items')
    .update({ stock: nextStock })
    .eq('id', inventory_item_id);
  if (stockError) throw stockError;

  return supabaseInventory();
}

async function supabaseAdminCards() {
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, card_code, public_token, status, activation_status, profile_id, deleted_at, revoked_at, archived_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const profileIds = Array.from(new Set((cards || []).map((card) => card.profile_id).filter(Boolean)));
  let profilesById = {};

  if (profileIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, slug, full_name')
      .in('id', profileIds);
    if (profilesError) throw profilesError;

    profilesById = (profiles || []).reduce((acc, profile) => {
      acc[profile.id] = profile;
      return acc;
    }, {});
  }

  const { data: events, error: eventsError } = await supabase
    .from('card_events')
    .select('card_id, event_type, created_at')
    .order('created_at', { ascending: false });

  if (eventsError) {
    console.warn('No fue posible cargar card_events para admin cards', eventsError.message);
    return cards.map((card) => ({
      ...card,
      profile_slug: profilesById[card.profile_id]?.slug || null,
      profile_name: profilesById[card.profile_id]?.full_name || null,
    }));
  }

  const latestEventByCardId = events.reduce((acc, event) => {
    if (!acc[event.card_id]) {
      acc[event.card_id] = event;
    }
    return acc;
  }, {});

  const eventsByCardId = events.reduce((acc, event) => {
    if (!acc[event.card_id]) acc[event.card_id] = [];
    acc[event.card_id].push(event);
    return acc;
  }, {});

  return cards.map((card) => ({
    ...card,
    profile_slug: profilesById[card.profile_id]?.slug || null,
    profile_name: profilesById[card.profile_id]?.full_name || null,
    last_event: latestEventByCardId[card.id] || null,
    events: (eventsByCardId[card.id] || []).slice(0, 8),
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
    .select('profile_id, version, created_at')
    .order('created_at', { ascending: false });

  if (versionsError) throw versionsError;

  const { data: auditEvents, error: auditError } = await supabase
    .from('audit_log')
    .select('entity_id, action, created_at, context')
    .eq('entity_type', 'profile')
    .order('created_at', { ascending: false });

  if (auditError) throw auditError;

  const versionsByProfile = versions.reduce((acc, item) => {
    if (!acc[item.profile_id]) acc[item.profile_id] = [];
    acc[item.profile_id].push(item);
    return acc;
  }, {});

  const eventsByProfile = auditEvents.reduce((acc, item) => {
    if (!acc[item.entity_id]) acc[item.entity_id] = [];
    acc[item.entity_id].push(item);
    return acc;
  }, {});

  return profiles.map((profile) => {
    const profileVersions = versionsByProfile[profile.id] || [];
    const profileEvents = eventsByProfile[profile.id] || [];
    const latestVersion = profileVersions[0] || null;
    const latestEvent = profileEvents[0] || null;
    const restoreEvent = profileEvents.find((event) => event.action === 'profile_restore');
    const restoredVersion = restoreEvent?.context?.restored_version ?? null;

    return {
      ...profile,
      version_count: profileVersions.length,
      latest_version: latestVersion?.version || null,
      latest_snapshot_at: latestVersion?.created_at || null,
      versions: profileVersions.slice(0, 5),
      last_event: latestEvent,
      last_restore_version: restoredVersion,
      can_restore: profileVersions.length > 0,
    };
  });
}

async function supabaseGetActorId() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const actorId = sessionData?.session?.user?.id;
  if (!actorId) throw new Error('No hay sesión');
  return actorId;
}

async function supabaseAssignCard(cardId, profileId) {
  const actorId = await supabaseGetActorId();
  if (!profileId) throw new Error('Debes seleccionar un perfil');

  const { error } = await supabase.rpc('assign_card', {
    target_card_id: cardId,
    target_profile_id: profileId,
    actor_id: actorId,
  });
  if (error) throw error;

  return supabaseAdminCards();
}

async function supabaseReassignCard(cardId, profileId) {
  const actorId = await supabaseGetActorId();
  if (!profileId) throw new Error('Debes seleccionar un perfil');

  const { error } = await supabase.rpc('reassign_card', {
    target_card_id: cardId,
    target_profile_id: profileId,
    actor_id: actorId,
  });
  if (error) throw error;

  return supabaseAdminCards();
}

async function supabaseActivateCard(cardId) {
  const actorId = await supabaseGetActorId();

  const { error } = await supabase.rpc('activate_card', {
    target_card_id: cardId,
    actor_id: actorId,
  });
  if (error) throw error;

  return supabaseAdminCards();
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

async function supabaseArchiveProfile(profileId) {
  const actorId = await supabaseGetActorId();
  const { error } = await supabase.rpc('soft_delete_profile', {
    target_profile_id: profileId,
    actor_id: actorId,
  });
  if (error) throw error;
  return supabaseAdminProfiles();
}

async function supabaseRestoreProfile(profileId, version) {
  const actorId = await supabaseGetActorId();
  const { error } = await supabase.rpc('restore_profile_version', {
    target_profile_id: profileId,
    target_version: version,
    actor_id: actorId,
  });
  if (error) throw error;
  return supabaseAdminProfiles();
}

async function supabaseOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*), payments(*)');
  if (error) throw error;

  const { data: inventoryMovements, error: inventoryMovementsError } = await supabase
    .from('inventory_movements')
    .select('order_id, id, movement_type, created_at')
    .not('order_id', 'is', null);
  if (inventoryMovementsError) throw inventoryMovementsError;

  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('id, card_code, profile_id, status, activation_status');
  if (cardsError) throw cardsError;

  const { data: orderCards, error: orderCardsError } = await supabase
    .from('order_cards')
    .select('order_id, card_id')
    .throwOnError()
    .catch(() => ({ data: [], error: null }));
  if (orderCardsError) throw orderCardsError;

  const movementsByOrder = (inventoryMovements || []).reduce((acc, movement) => {
    if (!acc[movement.order_id]) acc[movement.order_id] = [];
    acc[movement.order_id].push(movement);
    return acc;
  }, {});

  const cardById = (cards || []).reduce((acc, card) => {
    acc[card.id] = card;
    return acc;
  }, {});

  const linkedCardsByOrder = (orderCards || []).reduce((acc, row) => {
    if (!acc[row.order_id]) acc[row.order_id] = [];
    if (cardById[row.card_id]) acc[row.order_id].push(cardById[row.card_id]);
    return acc;
  }, {});

  return (data || []).map((order) => {
    const heuristicCards = (cards || []).filter((card) => {
      const orderProfileIds = (order.order_items || []).map((item) => item.profile_id).filter(Boolean);
      return orderProfileIds.length > 0 && orderProfileIds.includes(card.profile_id);
    });

    const linkedCards = linkedCardsByOrder[order.id] || [];
    const relatedCards = linkedCards.length > 0 ? linkedCards : heuristicCards;

    const deliveryReady = ['ready', 'shipped', 'delivered'].includes(order.fulfillment_status);
    const activationReadyCards = relatedCards.filter((card) => card.profile_id && card.status === 'assigned' && card.activation_status === 'assigned');
    const activeCards = relatedCards.filter((card) => card.status === 'active' || card.activation_status === 'activated');

    return {
      ...order,
      inventory_reserved: Boolean((movementsByOrder[order.id] || []).some((movement) => movement.movement_type === 'out')),
      inventory_movements: movementsByOrder[order.id] || [],
      related_cards: relatedCards,
      related_cards_source: linkedCards.length > 0 ? 'order_cards' : 'heuristic',
      card_lifecycle_ready: relatedCards.some((card) => card.status === 'assigned' || card.status === 'active'),
      delivery_ready: deliveryReady,
      activation_ready: deliveryReady && activationReadyCards.length > 0,
      activation_ready_count: activationReadyCards.length,
      active_cards_count: activeCards.length,
    };
  });
}

async function reserveInventoryForOrder(orderId) {
  const { data: existingMovements, error: existingMovementsError } = await supabase
    .from('inventory_movements')
    .select('id')
    .eq('order_id', orderId)
    .eq('movement_type', 'out')
    .limit(1);
  if (existingMovementsError) throw existingMovementsError;

  if ((existingMovements || []).length > 0) {
    return { skipped: true, reason: 'already_reserved' };
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_items(*)')
    .eq('id', orderId)
    .single();
  if (orderError) throw orderError;

  const reservationPlan = [];
  const createdMovementIds = [];

  const items = order.order_items || [];
  for (const orderItem of items) {
    const productName = orderItem.product_name || orderItem.product_id;
    const productSku = orderItem.sku || null;
    if (!productName && !productSku) continue;

    let inventoryItem = null;

    if (productSku) {
      const { data: skuMatch } = await supabase
        .from('inventory_items')
        .select('*')
        .ilike('item', `%${productSku}%`)
        .limit(1)
        .maybeSingle();
      inventoryItem = skuMatch || null;
    }

    if (!inventoryItem && productName) {
      const { data: nameMatch } = await supabase
        .from('inventory_items')
        .select('*')
        .ilike('item', `%${productName}%`)
        .limit(1)
        .maybeSingle();
      inventoryItem = nameMatch || null;
    }

    if (!inventoryItem) continue;

    const quantity = orderItem.quantity || 0;
    const nextStock = (inventoryItem.stock || 0) - quantity;
    if (nextStock < 0) {
      throw new Error(`Stock insuficiente para reservar ${productName}. Disponible: ${inventoryItem.stock || 0}`);
    }

    reservationPlan.push({
      inventoryItem,
      quantity,
      previousStock: inventoryItem.stock || 0,
      nextStock,
      productName,
    });
  }

  try {
    for (const step of reservationPlan) {
      const { data: movement, error: movementError } = await supabase
        .from('inventory_movements')
        .insert({
          inventory_item_id: step.inventoryItem.id,
          movement_type: 'out',
          quantity: step.quantity,
          reason: `Reserva automática por orden ${orderId}`,
          order_id: orderId,
        })
        .select('id')
        .single();
      if (movementError) throw movementError;

      createdMovementIds.push(movement.id);

      const { error: stockError } = await supabase
        .from('inventory_items')
        .update({ stock: step.nextStock })
        .eq('id', step.inventoryItem.id);
      if (stockError) throw stockError;
    }
  } catch (error) {
    for (const step of reservationPlan) {
      await supabase
        .from('inventory_items')
        .update({ stock: step.previousStock })
        .eq('id', step.inventoryItem.id);
    }

    if (createdMovementIds.length > 0) {
      await supabase
        .from('inventory_movements')
        .delete()
        .in('id', createdMovementIds);
    }

    throw error;
  }

  return { skipped: false, reservedItems: reservationPlan.length };
}

async function supabaseLinkOrderCard(orderId, cardId) {
  const actorId = await supabaseGetActorId();
  const { error } = await supabase.rpc('link_order_card', {
    target_order_id: orderId,
    target_card_id: cardId,
    actor_id: actorId,
  });
  if (error) throw error;
  return supabaseOrders();
}

async function supabaseUpdateOrder(orderId, payload) {
  const { data: currentOrder, error: currentOrderError } = await supabase
    .from('orders')
    .select('id, fulfillment_status')
    .eq('id', orderId)
    .single();
  if (currentOrderError) throw currentOrderError;

  const nextFulfillmentStatus = payload.fulfillment_status;
  const shouldReserveStock = nextFulfillmentStatus === 'in_production' && currentOrder.fulfillment_status !== 'in_production';

  const { error } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', orderId);
  if (error) throw error;

  if (shouldReserveStock) {
    try {
      await supabase.rpc('reserve_inventory_for_order', {
        target_order_id: orderId,
        actor_id: null,
      });
    } catch (_rpcError) {
      await reserveInventoryForOrder(orderId);
    }
  }

  return supabaseOrders();
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
    const inventory = await supabaseInventory();
    return inventory;
  },
  createInventoryMovement: async (payload) => {
    if (!hasSupabase) {
      throw new Error('Inventario deshabilitado: Supabase Auth es obligatorio');
    }
    const inventory = await supabaseCreateInventoryMovement(payload);
    return inventory;
  },

  // Orders: no insecure fallback to local API
  getOrders: async () => {
    if (!hasSupabase) {
      throw new Error('Órdenes deshabilitadas: Supabase Auth es obligatorio');
    }
    const orders = await supabaseOrders();
    return { orders, products: [] };
  },
  updateOrder: async (orderId, payload) => {
    if (!hasSupabase) {
      throw new Error('Órdenes deshabilitadas: Supabase Auth es obligatorio');
    }
    const orders = await supabaseUpdateOrder(orderId, payload);
    return { orders };
  },
  linkOrderCard: async (orderId, cardId) => {
    if (!hasSupabase) {
      throw new Error('Órdenes deshabilitadas: Supabase Auth es obligatorio');
    }
    const orders = await supabaseLinkOrderCard(orderId, cardId);
    return { orders };
  },

  // Cards admin view
  getAdminCards: async () => {
    if (!hasSupabase) {
      throw new Error('Cards admin deshabilitado: Supabase Auth es obligatorio');
    }
    const cards = await supabaseAdminCards();
    const profiles = await supabaseAdminProfiles().catch(() => []);
    return { cards, profiles: Array.isArray(profiles) ? profiles : profiles.profiles || [] };
  },

  getAdminProfiles: async () => {
    if (!hasSupabase) {
      throw new Error('Profiles admin deshabilitado: Supabase Auth es obligatorio');
    }
    const profiles = await supabaseAdminProfiles();
    return { profiles };
  },
  assignCard: async (cardId, profileId) => {
    if (!hasSupabase) {
      throw new Error('Cards admin deshabilitado: Supabase Auth es obligatorio');
    }
    const cards = await supabaseAssignCard(cardId, profileId);
    const profiles = await supabaseAdminProfiles().catch(() => []);
    return { cards, profiles: Array.isArray(profiles) ? profiles : profiles.profiles || [] };
  },
  reassignCard: async (cardId, profileId) => {
    if (!hasSupabase) {
      throw new Error('Cards admin deshabilitado: Supabase Auth es obligatorio');
    }
    const cards = await supabaseReassignCard(cardId, profileId);
    const profiles = await supabaseAdminProfiles().catch(() => []);
    return { cards, profiles: Array.isArray(profiles) ? profiles : profiles.profiles || [] };
  },
  activateCard: async (cardId) => {
    if (!hasSupabase) {
      throw new Error('Cards admin deshabilitado: Supabase Auth es obligatorio');
    }
    const cards = await supabaseActivateCard(cardId);
    const profiles = await supabaseAdminProfiles().catch(() => []);
    return { cards, profiles: Array.isArray(profiles) ? profiles : profiles.profiles || [] };
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
  archiveProfile: async (profileId) => {
    if (!hasSupabase) {
      throw new Error('Profiles admin deshabilitado: Supabase Auth es obligatorio');
    }
    const profiles = await supabaseArchiveProfile(profileId);
    return { profiles };
  },
  restoreProfileVersion: async (profileId, version) => {
    if (!hasSupabase) {
      throw new Error('Profiles admin deshabilitado: Supabase Auth es obligatorio');
    }
    const profiles = await supabaseRestoreProfile(profileId, version);
    return { profiles };
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
