import { supabase, hasSupabase, getClerkUserId, getCurrentUserEmail } from './supabaseClient';

const ERROR_MESSAGES = {
  'Failed to fetch': 'Sin conexión. Verifica tu internet e intenta nuevamente.',
  'JWT expired': 'Tu sesión expiró. Recarga la página.',
  '23502': 'Faltan datos requeridos. Completa todos los campos.',
  '23503': 'Error de referencia. Contacta a soporte en hola@nexcard.cl',
  '23505': 'Este registro ya existe.',
  'Stock insuficiente': 'Stock insuficiente para completar el despacho.',
  'PGRST': 'Error de base de datos. Intenta nuevamente.',
};

export const getErrorMessage = (error) => {
  const msg = error?.message || error?.toString() || '';
  for (const [key, friendly] of Object.entries(ERROR_MESSAGES)) {
    if (msg.includes(key)) return friendly;
  }
  return 'Ocurrió un error inesperado. Intenta nuevamente o contacta a hola@nexcard.cl';
};

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

export const getPendingClaimToken = () => {
  try {
    return localStorage.getItem('nexcard_pending_claim_token') || null;
  } catch {
    return null;
  }
};

export const setPendingClaimToken = (token) => {
  try {
    if (!token) localStorage.removeItem('nexcard_pending_claim_token');
    else localStorage.setItem('nexcard_pending_claim_token', token);
  } catch {
    // ignore
  }
};

const LAST_ORDER_SNAPSHOT_KEY = 'nexcard_last_order_snapshot';

export const getLastOrderSnapshot = () => {
  try {
    return JSON.parse(sessionStorage.getItem(LAST_ORDER_SNAPSHOT_KEY) || 'null');
  } catch {
    return null;
  }
};

export const setLastOrderSnapshot = (order) => {
  try {
    if (!order) sessionStorage.removeItem(LAST_ORDER_SNAPSHOT_KEY);
    else sessionStorage.setItem(LAST_ORDER_SNAPSHOT_KEY, JSON.stringify(order));
  } catch {
    // ignore
  }
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

  const userId = getClerkUserId() || null;

  const orderData = {
    user_id: userId,
    customer_name: payload.customer_name.trim(),
    customer_email: payload.customer_email.trim().toLowerCase(),
    customer_phone: payload.customer_phone?.trim() || null,
    customer_address: payload.customer_address?.trim() || null,
    payment_method: payload.payment_method,
    amount_cents: payload.amount_cents,
    coupon_code: payload.coupon_code || null,
    currency: payload.currency || 'CLP',
    card_customization: payload.card_customization || null,
    requires_invoice: payload.requires_invoice || false,
    invoice_rut: payload.invoice_rut || null,
    invoice_razon_social: payload.invoice_razon_social || null,
  };

  const orderItems = payload.items.map((item) => ({
    product_id: item.product_id,
    quantity: Number(item.quantity) || 1,
    currency: payload.currency || 'CLP',
  }));

  const { data: orderId, error: rpcError } = await supabase.rpc('create_order_with_items', {
    p_order: orderData,
    p_items: orderItems,
  });

  if (rpcError) throw new Error(rpcError.message || 'No se pudo crear la orden');
  if (!orderId) throw new Error('La orden fue creada pero no retornó un ID');

  const { data: createdOrder, error: fetchError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (fetchError || !createdOrder) throw new Error('Orden creada pero no se pudo recuperar');

  const { data: storedItems } = await supabase
    .from('order_items')
    .select('product_id, quantity, unit_price_cents')
    .eq('order_id', orderId);

  const productNameMap = Object.fromEntries(
    (payload.items || []).map((item) => [item.product_id, item.product_name || item.product_id])
  );

  // Enviar email de confirmación vía Edge Function
  try {
    const emailPayload = {
      order: createdOrder,
      card_customization: payload.card_customization || null,
      items: (storedItems?.length ? storedItems : payload.items).map(item => ({
        product_id: item.product_id,
        product_name: productNameMap[item.product_id] || item.product_id,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
      })),
    };
    await supabase.functions.invoke('send-order-confirmation', {
      body: JSON.stringify(emailPayload),
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // Email no crítico, continuar sin bloquear
  }

  return createdOrder;
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

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const uniqById = (rows = []) => Array.from(
  new Map((rows || []).filter(Boolean).map((row) => [row.id, row])).values()
);

const deriveOrderObservability = ({ order, claim, relatedCards }) => {
  const activeCardsCount = relatedCards.filter((card) => card.status === 'active' || card.activation_status === 'activated').length;
  const programmedCardsCount = relatedCards.filter((card) => card.nfc_url || card.programmed_at || card.status === 'programmed').length;
  const assignedCardsCount = relatedCards.filter((card) => card.profile_id || card.activation_status === 'assigned').length;
  const activationClaimed = claim?.status === 'claimed';
  const activationCompleted = Boolean(order.activated_at) || activeCardsCount > 0 || activationClaimed;
  const paymentPaid = order.payment_status === 'paid';
  const deliveryReady = paymentPaid && ['ready', 'shipped', 'delivered'].includes(order.fulfillment_status);
  const cardLifecycleReady = relatedCards.length > 0;
  const activationReady = paymentPaid && programmedCardsCount > 0;

  let funnelStage = 'pre_paid';
  if (paymentPaid) funnelStage = 'paid';
  if (paymentPaid && ['ready', 'shipped', 'delivered'].includes(order.fulfillment_status)) funnelStage = 'ready';
  if (paymentPaid && ['shipped', 'delivered'].includes(order.fulfillment_status)) funnelStage = 'shipped';
  if (paymentPaid && order.fulfillment_status === 'delivered') funnelStage = 'delivered';
  if (paymentPaid && activationCompleted) funnelStage = 'activated';

  const observabilityAlerts = [];
  if (paymentPaid && order.fulfillment_status === 'new') {
    observabilityAlerts.push('Pagada sin entrar a producción');
  }
  if (['ready', 'shipped', 'delivered'].includes(order.fulfillment_status) && relatedCards.length === 0) {
    observabilityAlerts.push('Orden avanzada sin card vinculada');
  }
  if (order.fulfillment_status === 'delivered' && !activationCompleted) {
    observabilityAlerts.push('Entregada sin activación cerrada');
  }
  if (activationCompleted && !['delivered', 'shipped'].includes(order.fulfillment_status)) {
    observabilityAlerts.push('Activación detectada antes de entrega confirmada');
  }
  if (claim?.status === 'pending' && order.fulfillment_status === 'delivered') {
    observabilityAlerts.push('Claim pendiente post-entrega');
  }

  let terminalState = null;
  if (['failed', 'cancelled', 'refunded'].includes(order.payment_status)) {
    terminalState = order.payment_status;
  } else if (activationCompleted) {
    terminalState = 'activated';
  } else if (order.fulfillment_status === 'delivered') {
    terminalState = 'delivered_pending_activation';
  } else if (order.fulfillment_status === 'cancelled') {
    terminalState = 'cancelled';
  }

  const activationLastAt = order.activated_at || (claim?.status === 'claimed'
    ? claim.updated_at
    : relatedCards
      .map((card) => card.activated_at)
      .filter(Boolean)
      .sort()
      .slice(-1)[0]) || null;

  return {
    related_cards: relatedCards,
    activation_claim: claim || null,
    active_cards_count: activeCardsCount,
    assigned_cards_count: assignedCardsCount,
    programmed_cards_count: programmedCardsCount,
    activation_ready_count: programmedCardsCount,
    activation_ready: activationReady,
    activation_completed: activationCompleted,
    card_lifecycle_ready: cardLifecycleReady,
    delivery_ready: deliveryReady,
    funnel_stage: funnelStage,
    terminal_state: terminalState,
    observability_alerts: observabilityAlerts,
    payment_paid: paymentPaid,
    activation_last_at: activationLastAt,
  };
};

async function fetchOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*), payments(*)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const orders = data || [];
  if (orders.length === 0) return { orders: [] };

  const [cardsRes, orderCardsRes, claimsRes, profilesRes] = await Promise.all([
    supabase
      .from('cards')
      .select('id, order_id, profile_id, card_code, status, activation_status, nfc_url, programmed_at, assigned_at, activated_at, created_at, updated_at, deleted_at')
      .is('deleted_at', null),
    supabase
      .from('order_cards')
      .select('order_id, card_id, linked_by, created_at'),
    supabase
      .from('profile_claims')
      .select('order_id, card_id, customer_email, status, claimed_by_user_id, claimed_profile_id, created_at, updated_at, expires_at'),
    supabase
      .from('profiles')
      .select('id, slug, full_name, contact_email, deleted_at')
      .is('deleted_at', null),
  ]);

  const cards = cardsRes.data || [];
  const orderCards = orderCardsRes.data || [];
  const claims = claimsRes.data || [];
  const profiles = profilesRes.data || [];
  const profileMap = Object.fromEntries(profiles.map((profile) => [profile.id, profile]));
  const cardMap = Object.fromEntries(cards.map((card) => [card.id, card]));
  const claimByOrderId = Object.fromEntries(claims.map((claim) => [claim.order_id, claim]));

  const directCardsByOrderId = cards.reduce((acc, card) => {
    if (!card.order_id) return acc;
    if (!acc[card.order_id]) acc[card.order_id] = [];
    acc[card.order_id].push(card);
    return acc;
  }, {});

  const formalCardsByOrderId = orderCards.reduce((acc, link) => {
    const linkedCard = cardMap[link.card_id];
    if (!linkedCard) return acc;
    if (!acc[link.order_id]) acc[link.order_id] = [];
    acc[link.order_id].push({ ...linkedCard, order_card_linked_at: link.created_at });
    return acc;
  }, {});

  const cardsByEmail = cards.reduce((acc, card) => {
    const email = normalizeEmail(profileMap[card.profile_id]?.contact_email);
    if (!email) return acc;
    if (!acc[email]) acc[email] = [];
    acc[email].push(card);
    return acc;
  }, {});

  const enrichedOrders = orders.map((order) => {
    const emailKey = normalizeEmail(order.customer_email);
    const claim = claimByOrderId[order.id] || null;
    const formalCards = formalCardsByOrderId[order.id] || [];
    const directCards = directCardsByOrderId[order.id] || [];
    const heuristicCards = formalCards.length || directCards.length ? [] : (cardsByEmail[emailKey] || []);
    const relatedCards = uniqById([...formalCards, ...directCards, ...heuristicCards]).map((card) => ({
      ...card,
      profile_name: profileMap[card.profile_id]?.full_name || profileMap[card.profile_id]?.slug || null,
      order_id: order.id,
    }));

    return {
      ...order,
      related_cards_source: formalCards.length || directCards.length ? 'order_cards' : 'heuristic',
      ...deriveOrderObservability({ order, claim, relatedCards }),
    };
  });

  return { orders: enrichedOrders };
}

const slugify = (value = '') => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

const normalizeAccountType = (value) => {
  if (value === 'business' || value === 'company') return 'company';
  return 'individual';
};

const PROFILE_ALLOWED_FIELDS = [
  'slug', 'full_name', 'profession', 'bio', 'avatar_url', 'theme_color', 'is_dark_mode',
  'whatsapp', 'instagram', 'linkedin', 'website', 'vcard_enabled', 'calendar_url',
  'bank_enabled', 'bank_name', 'bank_type', 'bank_number', 'bank_rut', 'bank_email',
  'view_count', 'status', 'account_type', 'company', 'contact_email', 'contact_phone',
  'location', 'cover_image_url', 'facebook', 'facebook_enabled', 'instagram_enabled',
  'linkedin_enabled', 'contact_email_enabled', 'contact_phone_enabled', 'website_enabled',
  'whatsapp_enabled', 'portfolio_enabled', 'portfolio_url', 'calendar_url_enabled',
  'tiktok', 'tiktok_enabled', 'review_url', 'card_type'
];

const buildProfilePayload = (payload = {}, { userId, email, existingProfile } = {}) => {
  const baseSlug = slugify(payload.slug || payload.full_name || email?.split('@')[0] || 'perfil');
  const normalizedPayload = {
    ...payload,
    website: payload.website || payload.website_url || existingProfile?.website || existingProfile?.website_url || null,
    user_id: userId,
    slug: baseSlug || `perfil-${Date.now()}`,
    full_name: payload.full_name?.trim() || existingProfile?.full_name || email?.split('@')[0] || 'Nuevo perfil NexCard',
    account_type: normalizeAccountType(payload.account_type || existingProfile?.account_type),
    contact_email: payload.contact_email || existingProfile?.contact_email || email || null,
    status: payload.status || existingProfile?.status || 'active',
    theme_color: payload.theme_color || existingProfile?.theme_color || '#10B981',
  };

  return Object.fromEntries(
    Object.entries(normalizedPayload).filter(([key, value]) => {
      if (key === 'user_id') return true;
      return PROFILE_ALLOWED_FIELDS.includes(key) && value !== undefined;
    })
  );
};

export const api = {
  health: () => request('/health'),

  register: async (payload) => {
    if (hasSupabase) {
      const { data, error } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
      });
      if (error) throw new Error(error.message);
      return { user: data.user, session: data.session };
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
      return { user: data.user, session: data.session };
    }
    return request('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
  },

  logout: async () => {
    if (hasSupabase && supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(error.message || 'No fue posible cerrar la sesión');
    }
    setStoredAuth(null);
    setPendingClaimToken(null);
  },

  previewProfileClaim: async (token) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { data, error } = await supabase.functions.invoke('claim-profile', {
      body: JSON.stringify({ action: 'preview', token }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (error) throw new Error(error.message || 'No fue posible validar tu activación');
    if (data?.error) throw new Error(data.error);
    return data;
  },

  claimProfile: async (token) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { data, error } = await supabase.functions.invoke('claim-profile', {
      body: JSON.stringify({ action: 'claim', token }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (error) throw new Error(error.message || 'No fue posible activar tu perfil');
    if (data?.error) throw new Error(data.error);
    return data;
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
    const userId = getClerkUserId();
    if (!userId) throw new Error('No hay sesión activa');
    const { data, error } = await supabase
      .from('profiles').select('*').eq('user_id', userId).is('deleted_at', null).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  updateMyProfile: async (payload) => {
    if (!hasSupabase) throw new Error('Edición deshabilitada');
    const userId = getClerkUserId();
    if (!userId) throw new Error('No hay sesión activa');

    const { data: existingProfile, error: existingError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    const profilePayload = buildProfilePayload(payload, {
      userId,
      email: getCurrentUserEmail(),
      existingProfile,
    });

    if (!existingProfile) {
      let uniquePayload = { ...profilePayload };
      const { data: slugTaken } = await supabase
        .from('profiles')
        .select('id')
        .eq('slug', uniquePayload.slug)
        .maybeSingle();

      if (slugTaken) {
        uniquePayload.slug = `${uniquePayload.slug}-${Date.now()}`;
      }

      const { data, error } = await supabase
        .from('profiles')
        .insert(uniquePayload)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(profilePayload)
      .eq('id', existingProfile.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  getAdminDashboard: async () => {
    if (!hasSupabase) throw new Error('Admin deshabilitado');
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { orders, error } = await (async () => {
      try {
        const result = await fetchOrders();
        return { orders: result.orders || [], error: null };
      } catch (err) {
        return { orders: null, error: err };
      }
    })();
    if (error) throw new Error(error.message || error);
    const paidOrders = (orders || []).filter(o => o.payment_status === 'paid');
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.amount_cents || 0), 0);
    const pendingOrders = (orders || []).filter(o => !['delivered','cancelled'].includes(o.fulfillment_status)).length;
    const paidOrdersCount = paidOrders.length;
    const funnel = {
      paid: paidOrdersCount,
      ready: paidOrders.filter(o => ['ready', 'shipped', 'delivered'].includes(o.fulfillment_status)).length,
      shipped: paidOrders.filter(o => ['shipped', 'delivered'].includes(o.fulfillment_status)).length,
      delivered: paidOrders.filter(o => o.fulfillment_status === 'delivered').length,
      activated: paidOrders.filter(o => o.activation_completed).length,
    };
    const nowMs = Date.now();
    const operationalAlerts = (orders || []).filter((order) => (order.observability_alerts || []).length > 0).map((order) => ({
      id: order.id,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      funnel_stage: order.funnel_stage,
      alerts: order.observability_alerts,
    }));
    const slaBreaches = paidOrders.filter((order) => {
      const paidAtMs = new Date(order.paid_at || order.updated_at || order.created_at).getTime();
      if (Number.isNaN(paidAtMs)) return false;
      const ageHours = (nowMs - paidAtMs) / (1000 * 60 * 60);
      return ageHours >= 24 && !order.activation_completed;
    }).map((order) => ({
      id: order.id,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      age_hours: Math.round((nowMs - new Date(order.paid_at || order.updated_at || order.created_at).getTime()) / (1000 * 60 * 60)),
      fulfillment_status: order.fulfillment_status,
      activation_completed: order.activation_completed,
    }));
    const stageSlaRaw = {
      paid_to_ready: [],
      ready_to_shipped: [],
      shipped_to_delivered: [],
      delivered_to_activated: [],
    };
    paidOrders.forEach((order) => {
      const paidAtMs = new Date(order.paid_at || order.updated_at || order.created_at).getTime();
      const readyAtMs = order.ready_at ? new Date(order.ready_at).getTime() : NaN;
      const shippedAtMs = order.shipped_at ? new Date(order.shipped_at).getTime() : NaN;
      const deliveredAtMs = order.delivered_at ? new Date(order.delivered_at).getTime() : NaN;
      const activatedAtMs = order.activated_at ? new Date(order.activated_at).getTime() : NaN;

      if (!Number.isNaN(paidAtMs) && !Number.isNaN(readyAtMs) && readyAtMs >= paidAtMs) {
        stageSlaRaw.paid_to_ready.push((readyAtMs - paidAtMs) / (1000 * 60 * 60));
      }
      if (!Number.isNaN(readyAtMs) && !Number.isNaN(shippedAtMs) && shippedAtMs >= readyAtMs) {
        stageSlaRaw.ready_to_shipped.push((shippedAtMs - readyAtMs) / (1000 * 60 * 60));
      }
      if (!Number.isNaN(shippedAtMs) && !Number.isNaN(deliveredAtMs) && deliveredAtMs >= shippedAtMs) {
        stageSlaRaw.shipped_to_delivered.push((deliveredAtMs - shippedAtMs) / (1000 * 60 * 60));
      }
      if (!Number.isNaN(deliveredAtMs) && !Number.isNaN(activatedAtMs) && activatedAtMs >= deliveredAtMs) {
        stageSlaRaw.delivered_to_activated.push((activatedAtMs - deliveredAtMs) / (1000 * 60 * 60));
      }
    });
    const stageSla = Object.fromEntries(
      Object.entries(stageSlaRaw).map(([key, values]) => {
        const avgHours = values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)) : null;
        return [key, { avg_hours: avgHours, sample_size: values.length }];
      })
    );
    const weeklyFunnelTrend = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayOrders = paidOrders.filter((order) => {
        const createdAt = new Date(order.created_at).getTime();
        return createdAt >= date.getTime() && createdAt < nextDate.getTime();
      });

      return {
        label: date.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' }),
        paid: dayOrders.length,
        ready: dayOrders.filter((order) => ['ready', 'shipped', 'delivered'].includes(order.fulfillment_status)).length,
        shipped: dayOrders.filter((order) => ['shipped', 'delivered'].includes(order.fulfillment_status)).length,
        delivered: dayOrders.filter((order) => order.fulfillment_status === 'delivered').length,
        activated: dayOrders.filter((order) => order.activation_completed).length,
      };
    });
    const alertBuckets = {
      paid_without_production: operationalAlerts.filter((order) => order.alerts?.includes('Pagada sin entrar a producción')),
      advanced_without_card: operationalAlerts.filter((order) => order.alerts?.includes('Orden avanzada sin card vinculada')),
      delivered_pending_activation: operationalAlerts.filter((order) => order.alerts?.includes('Entregada sin activación cerrada')),
      pending_claim_post_delivery: operationalAlerts.filter((order) => order.alerts?.includes('Claim pendiente post-entrega')),
    };
    const proactiveCandidates = [
      {
        key: 'sla_breaches',
        title: 'SLA roto: órdenes pagadas sin cierre',
        count: slaBreaches.length,
        severity: slaBreaches.length >= 5 ? 'critical' : 'high',
        action: 'Priorizar activación/cierre de órdenes con mayor aging.',
      },
      {
        key: 'delivered_pending_activation',
        title: 'Entregas sin activación final',
        count: alertBuckets.delivered_pending_activation.length,
        severity: alertBuckets.delivered_pending_activation.length >= 3 ? 'high' : 'medium',
        action: 'Revisar claims y activación final antes de que escale soporte.',
      },
      {
        key: 'advanced_without_card',
        title: 'Órdenes avanzadas sin card vinculada',
        count: alertBuckets.advanced_without_card.length,
        severity: alertBuckets.advanced_without_card.length >= 2 ? 'high' : 'medium',
        action: 'Corregir vínculo order-card para evitar quiebre del flujo físico.',
      },
      {
        key: 'paid_without_production',
        title: 'Pagos atrapados antes de producción',
        count: alertBuckets.paid_without_production.length,
        severity: alertBuckets.paid_without_production.length >= 3 ? 'high' : 'medium',
        action: 'Mover a producción o corregir excepción operativa de origen.',
      },
      {
        key: 'pending_claim_post_delivery',
        title: 'Claims pendientes después de entrega',
        count: alertBuckets.pending_claim_post_delivery.length,
        severity: alertBuckets.pending_claim_post_delivery.length >= 3 ? 'medium' : 'low',
        action: 'Empujar activación del cliente antes de enfriar la conversión.',
      },
    ].filter((item) => item.count > 0);
    const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
    const proactiveQueue = proactiveCandidates
      .sort((a, b) => (severityRank[b.severity] - severityRank[a.severity]) || (b.count - a.count))
      .slice(0, 5);
    const proactiveSummary = proactiveQueue[0]
      ? {
          headline: proactiveQueue[0].title,
          severity: proactiveQueue[0].severity,
          count: proactiveQueue[0].count,
          action: proactiveQueue[0].action,
          secondary_count: proactiveQueue.slice(1).reduce((sum, item) => sum + item.count, 0),
        }
      : {
          headline: 'Operación estable',
          severity: 'ok',
          count: 0,
          action: 'Sin excepciones prioritarias en este momento.',
          secondary_count: 0,
        };
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
        funnel,
        operationalAlertsCount: operationalAlerts.length,
        slaBreachesCount: slaBreaches.length,
        stageSla,
        proactiveSeverity: proactiveSummary.severity,
      },
      users,
      recentOrders: (orders || []).slice(0, 5),
      operationalAlerts: operationalAlerts.slice(0, 8),
      slaBreaches: slaBreaches.slice(0, 8),
      weeklyFunnelTrend,
      proactiveSummary,
      proactiveQueue,
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
    const { data: movements, error: movementsError } = await supabase
      .from('inventory_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (movementsError) throw new Error(movementsError.message);
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

    const forbiddenStatusKeys = ['payment_status', 'fulfillment_status', 'tracking_code', 'carrier', 'shipped_at', 'delivered_at', 'inventory_decremented', 'inventory_reserved'];
    const statusKeysPresent = forbiddenStatusKeys.filter((key) => Object.prototype.hasOwnProperty.call(payload, key));
    if (statusKeysPresent.length > 0) {
      throw new Error(`Usa el flujo server-side correspondiente para actualizar: ${statusKeysPresent.join(', ')}`);
    }

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

  transitionOrderState: async (orderId, { payment_status, fulfillment_status, reason }) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { data, error } = await supabase.rpc('admin_transition_order_state', {
      target_order_id: orderId,
      next_payment_status: payment_status ?? null,
      next_fulfillment_status: fulfillment_status ?? null,
      reason: reason || null,
    });
    if (error) throw new Error(error.message);
    const orders = await fetchOrders();
    return { ...orders, transition: data };
  },

  markOrderDelivered: async (orderId, reason) => {
    return api.transitionOrderState(orderId, {
      fulfillment_status: 'delivered',
      reason: reason || 'Entrega confirmada por admin',
    });
  },

  updateShipping: async (orderId, { carrier, tracking_code }) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    if (!carrier) throw new Error('Carrier requerido');
    if (!tracking_code?.trim()) throw new Error('Código de seguimiento requerido');

    const trackingCode = tracking_code.trim().toUpperCase();
    const { data: current } = await supabase
      .from('orders').select('carrier, tracking_code, fulfillment_status, shipped_at').eq('id', orderId).single();

    const payload = {
      carrier,
      tracking_code: trackingCode,
      fulfillment_status: 'shipped',
      shipped_at: current?.shipped_at || new Date().toISOString(),
    };

    const { error } = await supabase.from('orders').update(payload).eq('id', orderId);
    if (error) throw new Error(error.message);

    // Historial
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

    const { data: dispatchResult, error } = await supabase.rpc('admin_dispatch_order', {
      target_order_id: orderId,
      p_carrier: carrier,
      p_tracking_code: tracking_code,
    });
    if (error) throw new Error(error.message);

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
    return { ...orders, itemsDecremented: dispatchResult?.items_decremented || [] };
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
    const { data: card, error: fetchError } = await supabase
      .from('cards')
      .select('id, order_id, profile_id, status, deleted_at')
      .eq('id', cardId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);
    if (!card) throw new Error('Card no encontrada');
    if (card.deleted_at) throw new Error('No puedes vincular una card archivada');
    if (card.order_id && card.order_id !== orderId) throw new Error('Esta card ya está vinculada a otra orden');
    if (card.profile_id) throw new Error('Esta card ya está asignada a un perfil');
    if (['revoked', 'archived'].includes(card.status)) throw new Error(`No puedes vincular una card en estado ${card.status}`);

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

    const { data: linkedCard } = await supabase
      .from('cards')
      .select('profile_id')
      .eq('order_id', orderId)
      .not('profile_id', 'is', null)
      .limit(1)
      .maybeSingle();

    if (linkedCard?.profile_id) {
      const { data: byCard } = await supabase
        .from('profiles')
        .select('slug')
        .eq('id', linkedCard.profile_id)
        .is('deleted_at', null)
        .maybeSingle();
      if (byCard?.slug) return byCard.slug;
    }

    if (!customerEmail) return null;
    const { data: byEmail } = await supabase
      .from('profiles')
      .select('slug, id')
      .ilike('contact_email', customerEmail.trim())
      .is('deleted_at', null)
      .limit(1)
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
    const actorId = getClerkUserId();
    const { error } = await supabase.rpc('revoke_card', { target_card_id: cardId, actor_id: actorId });
    if (error) throw new Error(error.message);
    return fetchAdminCards();
  },

  archiveCard: async (cardId) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const actorId = getClerkUserId();
    const { error } = await supabase.rpc('soft_delete_card', { target_card_id: cardId, actor_id: actorId });
    if (error) throw new Error(error.message);
    return fetchAdminCards();
  },
  archiveProfile: async (profileId) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const actorId = getClerkUserId();
    const { error } = await supabase.rpc('soft_delete_profile', {
      target_profile_id: profileId,
      actor_id: actorId,
    });
    if (error) throw new Error(error.message);
    return fetchAdminProfiles();
  },

  restoreProfileVersion: async (profileId, version) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const actorId = getClerkUserId();
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

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('payment_status, fulfillment_status, amount_cents')
      .eq('id', orderId)
      .single();
    if (orderError) throw new Error(orderError.message);
    if (order?.payment_status !== 'paid') throw new Error('Solo puedes reembolsar órdenes pagadas');
    if (order?.fulfillment_status === 'delivered') throw new Error('No puedes reembolsar una orden ya entregada desde este flujo');
    if (Number(amount_cents) <= 0) throw new Error('Monto de reembolso inválido');
    if (Number(amount_cents) > Number(order?.amount_cents || 0)) throw new Error('El reembolso no puede superar el total de la orden');

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

  getCRMContacts: async () => {
    const { data } = await supabase.from('crm_contacts').select('*, crm_deals(count)').order('created_at', { ascending: false });
    return { contacts: data || [] };
  },

  getCRMDeals: async () => {
    const { data } = await supabase.from('crm_deals').select('*, crm_contacts(name, email, company, phone)').order('created_at', { ascending: false });
    return { deals: data || [] };
  },

  createCRMDeal: async (deal) => {
    const { data, error } = await supabase.from('crm_deals').insert(deal).select().single();
    if (error) throw error;
    return data;
  },

  updateCRMDeal: async (id, payload) => {
    const { error } = await supabase.from('crm_deals').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },

  getCRMActivities: async (dealId) => {
    const { data } = await supabase.from('crm_activities').select('*').eq('deal_id', dealId).order('created_at', { ascending: false });
    return { activities: data || [] };
  },

  addCRMActivity: async (activity) => {
    const { data, error } = await supabase.from('crm_activities').insert(activity).select().single();
    if (error) throw error;
    return data;
  },

  getCardScans: async (profileSlug) => {
    const { data } = await supabase.from('card_scans').select('*').eq('profile_slug', profileSlug).order('scanned_at', { ascending: false });
    return { scans: data || [] };
  },

  // ---------------------------------------------------------------------------
  // Team members
  // ---------------------------------------------------------------------------

  getTeamMembers: async () => {
    if (!hasSupabase) return { members: [] };
    const { data } = await supabase.from('team_members').select('*').eq('active', true).order('display_order', { ascending: true });
    return { members: data || [] };
  },

  getAllTeamMembers: async () => {
    if (!hasSupabase) return { members: [] };
    const { data } = await supabase.from('team_members').select('*').order('display_order', { ascending: true });
    return { members: data || [] };
  },

  createTeamMember: async (member) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { data, error } = await supabase.from('team_members').insert(member).select().single();
    if (error) throw error;
    return data;
  },

  updateTeamMember: async (id, payload) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase.from('team_members').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },

  deleteTeamMember: async (id) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase.from('team_members').delete().eq('id', id);
    if (error) throw error;
  },

  // ---------------------------------------------------------------------------
  // Wheel promotions
  // ---------------------------------------------------------------------------

  getActiveWheel: async () => {
    if (!hasSupabase) return { wheel: null };
    const now = new Date().toISOString();
    const { data: configs } = await supabase
      .from('wheel_config')
      .select('*, wheel_prizes(*)')
      .eq('active', true);
    if (!configs?.length) return { wheel: null };
    const wheel = configs.find(c => {
      const afterStart = !c.start_date || c.start_date <= now;
      const beforeEnd = !c.end_date || c.end_date >= now;
      return afterStart && beforeEnd;
    });
    return { wheel: wheel || null };
  },

  getAllWheels: async () => {
    if (!hasSupabase) return { wheels: [] };
    const { data } = await supabase.from('wheel_config').select('*, wheel_prizes(*)').order('created_at', { ascending: false });
    return { wheels: data || [] };
  },

  createWheel: async (config) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { data, error } = await supabase.from('wheel_config').insert(config).select().single();
    if (error) throw error;
    return data;
  },

  updateWheel: async (id, payload) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase.from('wheel_config').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },

  deleteWheel: async (id) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase.from('wheel_config').delete().eq('id', id);
    if (error) throw error;
  },

  createWheelPrize: async (prize) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { data, error } = await supabase.from('wheel_prizes').insert(prize).select().single();
    if (error) throw error;
    return data;
  },

  updateWheelPrize: async (id, payload) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase.from('wheel_prizes').update(payload).eq('id', id);
    if (error) throw error;
  },

  deleteWheelPrize: async (id) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase.from('wheel_prizes').delete().eq('id', id);
    if (error) throw error;
  },

  recordWheelSpin: async (spin) => {
    if (!hasSupabase) return null;
    const { data, error } = await supabase.from('wheel_spins').insert(spin).select().single();
    if (error) throw error;
    return data;
  },

  validateWheelCoupon: async (code) => {
    if (!hasSupabase || !code) return null;
    const { data: prize } = await supabase.from('wheel_prizes').select('*').eq('coupon_code', code.toUpperCase()).maybeSingle();
    if (!prize) return null;
    const { data: spin } = await supabase.from('wheel_spins').select('*').eq('prize_id', prize.id).eq('redeemed', false).limit(1).maybeSingle();
    if (!spin) return null;
    return { prize, spinId: spin.id };
  },

  redeemWheelCoupon: async (spinId, orderId) => {
    if (!hasSupabase || !spinId) return;
    await supabase.from('wheel_spins').update({ redeemed: true, redeemed_at: new Date().toISOString(), order_id: orderId }).eq('id', spinId);
  },

  getWheelStats: async (wheelId) => {
    if (!hasSupabase) return { spins: [] };
    const { data } = await supabase.from('wheel_spins').select('*, wheel_prizes(label, type, value)').eq('wheel_id', wheelId).order('spun_at', { ascending: false }).limit(200);
    return { spins: data || [] };
  },

  // ---------------------------------------------------------------------------
  // Products admin
  // ---------------------------------------------------------------------------

  getAllProducts: async () => {
    if (!hasSupabase) return { products: [] };
    const { data } = await supabase.from('products')
      .select('*')
      .order('display_order', { ascending: true });
    return { products: data || [] };
  },

  createProduct: async (product) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { data, error } = await supabase.from('products')
      .insert(product).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  updateProduct: async (id, payload) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase.from('products')
      .update(payload).eq('id', id);
    if (error) throw new Error(error.message);
  },

  deleteProduct: async (id) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase.from('products')
      .delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  toggleProductStatus: async (id, status) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase.from('products')
      .update({ status }).eq('id', id);
    if (error) throw new Error(error.message);
  },
};
