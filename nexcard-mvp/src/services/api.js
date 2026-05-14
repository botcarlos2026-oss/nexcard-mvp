import { supabase, hasSupabase, getClerkUserId, getCurrentUserEmail } from './supabaseClient';
import { createProductsApi } from './api/products';
import { createOrdersApi } from './api/orders';
import { createPaymentsApi } from './api/payments';
import { createProfilesApi } from './api/profiles';
import { createInventoryApi } from './api/inventory';
import { createKpisApi } from './api/kpis';
import { isManualTestReason, isNonOperationalOrder } from '../utils/orderOperationalSegmentation';

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

const productsApi = createProductsApi({ supabase, hasSupabase });
const ordersApi = createOrdersApi({ supabase, hasSupabase, getClerkUserId });
const fetchOrders = ordersApi.getOrders;
const paymentsApi = createPaymentsApi({ supabase, hasSupabase, fetchOrders });
const profilesApi = createProfilesApi({ supabase, hasSupabase, getClerkUserId, getCurrentUserEmail, request });
const inventoryApi = createInventoryApi({ supabase, hasSupabase });
const kpisApi = createKpisApi({ supabase, hasSupabase });

// ---------------------------------------------------------------------------
// Helpers privados
// ---------------------------------------------------------------------------

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

  previewProfileClaim: async (token) => profilesApi.previewProfileClaim(token),

  claimProfile: async (token) => profilesApi.claimProfile(token),

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

  getPublicProfile: async (slug) => profilesApi.getPublicProfile(slug),

  getMyProfile: async () => profilesApi.getMyProfile(),

  updateMyProfile: async (payload) => profilesApi.updateMyProfile(payload),

  getAdminDashboard: async () => {
    if (!hasSupabase) return request('/admin/dashboard');
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
    const nowMs = Date.now();
    const { data: qaHistoryRows } = await supabase
      .from('order_status_history')
      .select('order_id, field, old_value, new_value, changed_at')
      .in('field', ['is_test', 'qa_reviewed_at']);

    const latestQaOverrideAtByOrder = new Map();
    (qaHistoryRows || []).forEach((row) => {
      if (row.field === 'is_test' && row.new_value === 'true') {
        const current = latestQaOverrideAtByOrder.get(row.order_id);
        const changedAtMs = new Date(row.changed_at).getTime();
        const currentMs = current ? new Date(current).getTime() : NaN;
        if (!current || (!Number.isNaN(changedAtMs) && (Number.isNaN(currentMs) || changedAtMs > currentMs))) {
          latestQaOverrideAtByOrder.set(row.order_id, row.changed_at);
        }
      }
    });
    const paidOrders = (orders || []).filter(o => o.payment_status === 'paid');
    const operationalOrders = (orders || []).filter((order) => !isNonOperationalOrder(order));
    const excludedOperationalOrders = (orders || []).filter((order) => isNonOperationalOrder(order));
    const operationalPaidOrders = paidOrders.filter((order) => !isNonOperationalOrder(order));
    const excludedOperationalOrdersCount = excludedOperationalOrders.length;
    const manualOverrideQaOrdersAll = excludedOperationalOrders.filter((order) => isManualTestReason(order.test_reason));
    const manualOverrideQaOrders = manualOverrideQaOrdersAll.filter((order) => !order.qa_reviewed_at);
    const manualOverrideQaReviewedCount = manualOverrideQaOrdersAll.length - manualOverrideQaOrders.length;
    const manualOverrideQaOrdersCount = manualOverrideQaOrders.length;
    const manualOverrideRealOrdersCount = (orders || []).filter((order) => !order.is_test && isManualTestReason(order.test_reason)).length;
    const manualOverrideQaBlockedCount = manualOverrideQaOrders.filter((order) => {
      const isPaid = order.payment_status === 'paid';
      const notShipped = !['shipped', 'delivered'].includes(order.fulfillment_status);
      const notActivated = !order.activation_completed;
      return isPaid && notShipped && notActivated;
    }).length;
    const manualOverrideQaAging = manualOverrideQaOrders.reduce((acc, order) => {
      const overrideAtMs = new Date(order.qa_override_at || latestQaOverrideAtByOrder.get(order.id) || order.updated_at || order.created_at).getTime();
      if (Number.isNaN(overrideAtMs)) return acc;
      const ageHours = (nowMs - overrideAtMs) / (1000 * 60 * 60);
      if (ageHours >= 72) acc.over72h += 1;
      else if (ageHours >= 24) acc.over24h += 1;
      else acc.fresh += 1;
      return acc;
    }, { fresh: 0, over24h: 0, over72h: 0 });
    const manualOverrideQaScored = manualOverrideQaOrders.map((order) => {
      const overrideAtMs = new Date(order.qa_override_at || latestQaOverrideAtByOrder.get(order.id) || order.updated_at || order.created_at).getTime();
      const ageHours = Number.isNaN(overrideAtMs) ? 0 : Math.round((nowMs - overrideAtMs) / (1000 * 60 * 60));
      const isPaid = order.payment_status === 'paid';
      const notShipped = !['shipped', 'delivered'].includes(order.fulfillment_status);
      const notActivated = !order.activation_completed;
      const notReady = !['ready', 'shipped', 'delivered'].includes(order.fulfillment_status);
      let severity = 'low';
      let score = 1;
      const reasons = [];
      if (ageHours >= 72) { severity = 'medium'; score += 2; reasons.push('aging >72h'); }
      else if (ageHours >= 24) { score += 1; reasons.push('aging >24h'); }
      if (isPaid && notActivated) { severity = 'high'; score += 3; reasons.push('paid sin activación'); }
      if (isPaid && notShipped && notActivated && ageHours >= 72) {
        severity = 'critical';
        score += 4;
        reasons.push('sin despacho');
      } else if (isPaid && notReady && ageHours >= 24) {
        severity = severity === 'critical' ? 'critical' : 'high';
        score += 2;
        reasons.push('sin producción lista');
      }
      return {
        id: order.id,
        folio: order.folio || null,
        customer_name: order.customer_name || order.customer_full_name || 'Cliente sin nombre',
        customer_email: order.customer_email || null,
        payment_status: order.payment_status,
        fulfillment_status: order.fulfillment_status,
        activation_completed: !!order.activation_completed,
        qa_override_at: order.qa_override_at || latestQaOverrideAtByOrder.get(order.id) || null,
        qa_reviewed_at: order.qa_reviewed_at || null,
        age_hours: ageHours,
        severity,
        score,
        reasons,
      };
    });

    const manualOverrideQaOpenHours = manualOverrideQaOrders
      .map((order) => {
        const overrideAtMs = new Date(order.qa_override_at || latestQaOverrideAtByOrder.get(order.id) || order.updated_at || order.created_at).getTime();
        return Number.isNaN(overrideAtMs) ? null : (nowMs - overrideAtMs) / (1000 * 60 * 60);
      })
      .filter((value) => value != null);
    const manualOverrideQaReviewHours = manualOverrideQaOrdersAll
      .map((order) => {
        const overrideAtMs = new Date(order.qa_override_at || latestQaOverrideAtByOrder.get(order.id) || order.updated_at || order.created_at).getTime();
        const reviewedAtMs = new Date(order.qa_reviewed_at || '').getTime();
        if (Number.isNaN(overrideAtMs) || Number.isNaN(reviewedAtMs) || reviewedAtMs < overrideAtMs) return null;
        return (reviewedAtMs - overrideAtMs) / (1000 * 60 * 60);
      })
      .filter((value) => value != null);
    const manualOverrideQaResolutionHours = (orders || [])
      .filter((order) => !order.is_test && isManualTestReason(order.test_reason))
      .map((order) => {
        const overrideAtMs = new Date(order.qa_override_at || latestQaOverrideAtByOrder.get(order.id) || order.created_at).getTime();
        const resolvedAtMs = new Date(order.qa_override_resolved_at || order.updated_at || '').getTime();
        if (Number.isNaN(overrideAtMs) || Number.isNaN(resolvedAtMs) || resolvedAtMs < overrideAtMs) return null;
        return (resolvedAtMs - overrideAtMs) / (1000 * 60 * 60);
      })
      .filter((value) => value != null);
    const averageHours = (values) => values.length > 0 ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
    const manualOverrideQaSla = {
      open_avg_hours: averageHours(manualOverrideQaOpenHours),
      open_sample_size: manualOverrideQaOpenHours.length,
      review_avg_hours: averageHours(manualOverrideQaReviewHours),
      review_sample_size: manualOverrideQaReviewHours.length,
      resolution_avg_hours: averageHours(manualOverrideQaResolutionHours),
      resolution_sample_size: manualOverrideQaResolutionHours.length,
    };

    const manualOverrideQaSeverity = manualOverrideQaScored.reduce((acc, order) => {
      acc.total += 1;
      acc[order.severity] += 1;
      if (order.score > acc.maxScore) acc.maxScore = order.score;
      return acc;
    }, { low: 0, medium: 0, high: 0, critical: 0, total: 0, maxScore: 0 });

    const topManualOverrideQueue = [...manualOverrideQaScored]
      .sort((a, b) => (b.score - a.score) || (b.age_hours - a.age_hours))
      .slice(0, 5);
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.amount_cents || 0), 0);
    const operationalRevenue = operationalPaidOrders.reduce((sum, o) => sum + (o.amount_cents || 0), 0);
    const qaRevenue = totalRevenue - operationalRevenue;
    const pendingOrders = (orders || []).filter(o => !['delivered','cancelled'].includes(o.fulfillment_status)).length;
    const operationalPendingOrders = operationalOrders.filter(o => !['delivered','cancelled'].includes(o.fulfillment_status)).length;
    const paidOrdersCount = paidOrders.length;
    const operationalPaidOrdersCount = operationalPaidOrders.length;
    const funnel = {
      paid: paidOrdersCount,
      ready: paidOrders.filter(o => ['ready', 'shipped', 'delivered'].includes(o.fulfillment_status)).length,
      shipped: paidOrders.filter(o => ['shipped', 'delivered'].includes(o.fulfillment_status)).length,
      delivered: paidOrders.filter(o => o.fulfillment_status === 'delivered').length,
      activated: paidOrders.filter(o => o.activation_completed).length,
    };
    const operationalFunnel = {
      paid: operationalPaidOrdersCount,
      ready: operationalPaidOrders.filter(o => ['ready', 'shipped', 'delivered'].includes(o.fulfillment_status)).length,
      shipped: operationalPaidOrders.filter(o => ['shipped', 'delivered'].includes(o.fulfillment_status)).length,
      delivered: operationalPaidOrders.filter(o => o.fulfillment_status === 'delivered').length,
      activated: operationalPaidOrders.filter(o => o.activation_completed).length,
    };
    const qaFunnel = {
      paid: funnel.paid - operationalFunnel.paid,
      ready: funnel.ready - operationalFunnel.ready,
      shipped: funnel.shipped - operationalFunnel.shipped,
      delivered: funnel.delivered - operationalFunnel.delivered,
      activated: funnel.activated - operationalFunnel.activated,
    };
    const operationalAlerts = operationalOrders.filter((order) => (order.observability_alerts || []).length > 0).map((order) => ({
      id: order.id,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      funnel_stage: order.funnel_stage,
      alerts: order.observability_alerts,
    }));
    const slaBreaches = operationalPaidOrders.filter((order) => {
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
    operationalPaidOrders.forEach((order) => {
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

      const dayOrders = operationalPaidOrders.filter((order) => {
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
    const stageSlaDigest = Object.entries(stageSla)
      .filter(([, value]) => value?.avg_hours != null)
      .map(([key, value]) => {
        const labels = {
          paid_to_ready: 'Paid→Ready',
          ready_to_shipped: 'Ready→Shipped',
          shipped_to_delivered: 'Shipped→Delivered',
          delivered_to_activated: 'Delivered→Activated',
        };
        return `${labels[key] || key}: ${value.avg_hours}h (${value.sample_size})`;
      });
    const digestLines = [
      `Resumen operativo NexCard`,
      `- Prioridad: ${proactiveSummary.headline}`,
      `- Severidad: ${proactiveSummary.severity}`,
      `- Casos prioritarios: ${proactiveSummary.count}`,
      `- Alertas operativas: ${operationalAlerts.length}`,
      `- SLA rotos: ${slaBreaches.length}`,
      `- Funnel real: paid ${operationalFunnel.paid} | ready ${operationalFunnel.ready} | shipped ${operationalFunnel.shipped} | delivered ${operationalFunnel.delivered} | activated ${operationalFunnel.activated}`,
      stageSlaDigest.length > 0 ? `- SLA promedio: ${stageSlaDigest.join(' | ')}` : '- SLA promedio: sin muestra cerrada suficiente',
      proactiveQueue.length > 0 ? `- Acciones sugeridas: ${proactiveQueue.map((item) => `${item.title} (${item.count})`).join(' · ')}` : '- Acciones sugeridas: sin excepciones prioritarias',
      `- Recomendación: ${proactiveSummary.action}`,
    ];
    const operationalDigest = {
      generated_at: new Date().toISOString(),
      text: digestLines.join('\n'),
      lines: digestLines,
    };
    const deliveryFormats = {
      short_text: [
        `NexCard | ${proactiveSummary.headline}`,
        `${proactiveSummary.count} caso(s) prioritarios · ${slaBreaches.length} SLA rotos · ${operationalAlerts.length} alertas`,
        `${proactiveSummary.action}`,
      ].join(' — '),
      whatsapp_text: [
        `*Resumen operativo NexCard*`,
        `Prioridad: *${proactiveSummary.headline}*`,
        `Severidad: ${proactiveSummary.severity}`,
        `Casos prioritarios: ${proactiveSummary.count}`,
        `Alertas operativas: ${operationalAlerts.length}`,
        `SLA rotos: ${slaBreaches.length}`,
        `Funnel real: paid ${operationalFunnel.paid} | ready ${operationalFunnel.ready} | shipped ${operationalFunnel.shipped} | delivered ${operationalFunnel.delivered} | activated ${operationalFunnel.activated}`,
        stageSlaDigest.length > 0 ? `SLA promedio: ${stageSlaDigest.join(' | ')}` : `SLA promedio: sin muestra cerrada suficiente`,
        `Acción: ${proactiveSummary.action}`,
      ].join('\n'),
      email_subject: `[NexCard] ${proactiveSummary.severity.toUpperCase()} - ${proactiveSummary.headline}`,
      email_body: [
        `Resumen operativo NexCard`,
        ``,
        `Prioridad actual: ${proactiveSummary.headline}`,
        `Severidad: ${proactiveSummary.severity}`,
        `Casos prioritarios: ${proactiveSummary.count}`,
        `Alertas operativas: ${operationalAlerts.length}`,
        `SLA rotos: ${slaBreaches.length}`,
        ``,
        `Funnel actual`,
        `- Paid: ${operationalFunnel.paid}`,
        `- Ready: ${operationalFunnel.ready}`,
        `- Shipped: ${operationalFunnel.shipped}`,
        `- Delivered: ${operationalFunnel.delivered}`,
        `- Activated: ${operationalFunnel.activated}`,
        ``,
        `SLA promedio`,
        ...(stageSlaDigest.length > 0 ? stageSlaDigest.map((line) => `- ${line}`) : ['- Sin muestra cerrada suficiente']),
        ``,
        `Cola sugerida`,
        ...(proactiveQueue.length > 0 ? proactiveQueue.map((item, index) => `${index + 1}. ${item.title} (${item.count}) -> ${item.action}`) : ['1. Sin excepciones prioritarias']),
        ``,
        `Recomendación principal: ${proactiveSummary.action}`,
      ].join('\n'),
    };
    const transportReadiness = {
      mode: 'dry_run_only',
      recommended_trigger: proactiveSummary.severity === 'critical' ? 'immediate' : 'scheduled',
      recommended_frequency: proactiveSummary.severity === 'critical' ? 'event-driven or every 15m' : 'daily at 09:00',
      checklist: [
        'Definir canal destino (webhook, email o mensajería).',
        'Aprobar destinatarios humanos válidos para alertas operativas.',
        'Conectar transporte usando deliveryFormats sin reescribir contenido.',
        'Mantener dry-run como default hasta validar ruido/falsos positivos.',
      ],
      cron_payload: {
        job: 'nexcard-operational-digest',
        mode: 'dry_run',
        recommended_frequency: proactiveSummary.severity === 'critical' ? '*/15 * * * *' : '0 9 * * *',
        summary: deliveryFormats.short_text,
      },
      webhook_payload: {
        event: 'nexcard.operational_digest',
        dry_run: true,
        severity: proactiveSummary.severity,
        generated_at: operationalDigest.generated_at,
        summary: deliveryFormats.short_text,
        digest: operationalDigest.text,
      },
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
        operationalRevenue,
        qaRevenue,
        pendingOrders,
        operationalPendingOrders,
        paidOrders: paidOrdersCount,
        operationalPaidOrders: operationalPaidOrdersCount,
        operationalOrders: operationalOrders.length,
        qaOrders: excludedOperationalOrdersCount,
        funnel,
        operationalFunnel,
        qaFunnel,
        operationalAlertsCount: operationalAlerts.length,
        slaBreachesCount: slaBreaches.length,
        excludedOperationalOrdersCount,
        manualOverrideQaOrdersCount,
        manualOverrideQaReviewedCount,
        manualOverrideQaBlockedCount,
        manualOverrideRealOrdersCount,
        manualOverrideQaAging,
        manualOverrideQaSeverity,
        manualOverrideQaSla,
        stageSla,
        proactiveSeverity: proactiveSummary.severity,
      },
      users,
      recentOrders: operationalOrders.slice(0, 5),
      operationalAlerts: operationalAlerts.slice(0, 8),
      slaBreaches: slaBreaches.slice(0, 8),
      weeklyFunnelTrend,
      proactiveSummary,
      proactiveQueue,
      topManualOverrideQueue,
      operationalDigest,
      deliveryFormats,
      transportReadiness,
    };
  },

  getProducts: async () => productsApi.getProducts(),
  createOrder: async (payload) => ordersApi.createOrder(payload),

  getInventory: async () => inventoryApi.getInventory(),

  createInventoryMovement: async (payload) => inventoryApi.createInventoryMovement(payload),

  getOrders: async () => ordersApi.getOrders(),

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

  overrideOrderTestClassification: async (orderId, { is_test, test_reason }) => {
    if (!hasSupabase) {
      throw new Error('Override QA/test requiere Supabase configurado');
    }

    if (typeof is_test !== 'boolean') {
      throw new Error('Debes indicar si la orden debe quedar marcada o no como QA/test');
    }

    const { error } = await supabase.rpc('admin_override_order_test_classification', {
      target_order_id: orderId,
      target_is_test: is_test,
      target_reason: test_reason || null,
    });

    if (error) throw new Error(error.message);

    return fetchOrders();
  },

  reviewOrderTestClassification: async (orderId, { review_note }) => {
    if (!hasSupabase) {
      throw new Error('Revisión QA/test requiere Supabase configurado');
    }

    const { error } = await supabase.rpc('admin_review_order_test_classification', {
      target_order_id: orderId,
      review_note: review_note || null,
    });

    if (error) throw new Error(error.message);

    return fetchOrders();
  },

  transitionOrderState: async (orderId, payload) => paymentsApi.transitionOrderState(orderId, payload),

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

  getDispatchConfig: async () => inventoryApi.getDispatchConfig(),

  addDispatchConfig: async (payload) => inventoryApi.addDispatchConfig(payload),

  deleteDispatchConfig: async (id) => inventoryApi.deleteDispatchConfig(id),

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

  getProfileSlugForOrder: async (orderId, customerEmail) => profilesApi.getProfileSlugForOrder(orderId, customerEmail),

  getAdminCards: async () => {
    if (!hasSupabase) return request('/admin/cards');
    return fetchAdminCards();
  },

  getAdminProfiles: async () => profilesApi.getAdminProfiles(),

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
  archiveProfile: async (profileId) => profilesApi.archiveProfile(profileId),

  restoreProfileVersion: async (profileId, version) => profilesApi.restoreProfileVersion(profileId, version),
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

  updateInventoryItem: async (itemId, payload) => inventoryApi.updateInventoryItem(itemId, payload),

  checkLowStock: async () => inventoryApi.checkLowStock(),

  getRefundForOrder: async (orderId) => paymentsApi.getRefundForOrder(orderId),

  createRefund: async (payload) => paymentsApi.createRefund(payload),

  getPendingRefundsCount: async () => paymentsApi.getPendingRefundsCount(),

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

  getCardScans: async (profileSlug) => profilesApi.getCardScans(profileSlug),

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

  getKpiMonthlyRevenue: async (opts) => kpisApi.getKpiMonthlyRevenue(opts),
  getKpiFunnel: async () => kpisApi.getKpiFunnel(),
  getKpiTopProducts: async (opts) => kpisApi.getKpiTopProducts(opts),
  getKpiCohorts: async (opts) => kpisApi.getKpiCohorts(opts),
};
