import { supabase, hasSupabase, getClerkUserId, getCurrentUserEmail } from './supabaseClient';
import { createProductsApi } from './api/products';
import { createOrdersApi } from './api/orders';
import { createPaymentsApi } from './api/payments';
import { createProfilesApi } from './api/profiles';
import { createInventoryApi } from './api/inventory';
import { createKpisApi } from './api/kpis';
import { createCardsApi } from './api/cards';
import { createOrderOperationsApi } from './api/orderOperations';
import { createKpiAdminApi } from './api/kpiAdmin';
import { createAdminDashboardApi } from './api/adminDashboard';
import { createReviewCardsApi } from './api/reviewCards';
import { createCrmApi } from './api/crm';
import { createWheelApi } from './api/wheel';
import { KPI_EXECUTIVE_ALERT_BAND_POLICY, KPI_EXECUTIVE_ALERT_POLICY, KPI_EXECUTIVE_ALERT_ROUTING, KPI_PAYMENT_METHOD_FEES, KPI_SLA_TARGET_HOURS, KPI_WOW_ALERT_THRESHOLDS } from '../config/admin';
import { isManualTestReason, isNonOperationalOrder } from '../utils/orderOperationalSegmentation';
import { buildWowAlerts, computeExecutiveAlertDecision, computeExecutiveScore, deltaPercent, percentage, percentile, round1 } from '../utils/executiveKpi';

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
const cardsApi = createCardsApi({ supabase, hasSupabase, getClerkUserId, request });
const orderOperationsApi = createOrderOperationsApi({ supabase, hasSupabase, fetchOrders });
const kpiAdminApi = createKpiAdminApi({ supabase, hasSupabase, getClerkUserId, getCurrentUserEmail });
const adminDashboardApi = createAdminDashboardApi({
  supabase,
  hasSupabase,
  request,
  fetchOrders,
  KPI_SLA_TARGET_HOURS,
  KPI_PAYMENT_METHOD_FEES,
  KPI_WOW_ALERT_THRESHOLDS,
  KPI_EXECUTIVE_ALERT_POLICY,
  KPI_EXECUTIVE_ALERT_ROUTING,
  KPI_EXECUTIVE_ALERT_BAND_POLICY,
  isManualTestReason,
  isNonOperationalOrder,
  buildWowAlerts,
  computeExecutiveAlertDecision,
  computeExecutiveScore,
  deltaPercent,
  percentage,
  percentile,
  round1,
});
const reviewCardsApi = createReviewCardsApi({ supabase, hasSupabase });
const crmApi = createCrmApi({ supabase, hasSupabase });
const wheelApi = createWheelApi({ supabase, hasSupabase });

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

  checkProfileSlugAvailability: async (slug, orderId = null) => profilesApi.checkProfileSlugAvailability(slug, orderId),

  getAdminDashboard: async () => adminDashboardApi.getAdminDashboard(),

  getProducts: async (options = {}) => productsApi.getProducts(options),
  createOrder: async (payload) => ordersApi.createOrder(payload),

  getInventory: async () => inventoryApi.getInventory(),

  createInventoryMovement: async (payload) => inventoryApi.createInventoryMovement(payload),

  getOrders: async () => ordersApi.getOrders(),

  updateOrder: async (orderId, payload) => orderOperationsApi.updateOrder(orderId, payload),

  overrideOrderTestClassification: async (orderId, payload) => orderOperationsApi.overrideOrderTestClassification(orderId, payload),

  reviewOrderTestClassification: async (orderId, payload) => orderOperationsApi.reviewOrderTestClassification(orderId, payload),

  getKpiRuntimeConfig: async () => kpiAdminApi.getKpiRuntimeConfig(),

  getKpiRuntimeConfigAudit: async () => kpiAdminApi.getKpiRuntimeConfigAudit(),

  getKpiAlertState: async () => kpiAdminApi.getKpiAlertState(),

  getKpiAlertHistory: async () => kpiAdminApi.getKpiAlertHistory(),

  getKpiAlertEvaluations: async () => kpiAdminApi.getKpiAlertEvaluations(),

  evaluateExecutiveAlert: async (trigger = 'manual') => kpiAdminApi.evaluateExecutiveAlert(trigger),

  dispatchExecutiveAlert: async (payload) => kpiAdminApi.dispatchExecutiveAlert(payload),

  upsertKpiAlertState: async (payload) => kpiAdminApi.upsertKpiAlertState(payload),

  upsertKpiRuntimeConfig: async (payload) => kpiAdminApi.upsertKpiRuntimeConfig(payload),

  transitionOrderState: async (orderId, payload) => paymentsApi.transitionOrderState(orderId, payload),

  markOrderDelivered: async (orderId, reason) => {
    return api.transitionOrderState(orderId, {
      fulfillment_status: 'delivered',
      reason: reason || 'Entrega confirmada por admin',
    });
  },

  updateShipping: async (orderId, payload) => orderOperationsApi.updateShipping(orderId, payload),

  dispatchOrder: async (orderId, payload) => orderOperationsApi.dispatchOrder(orderId, payload),

  getDispatchConfig: async () => inventoryApi.getDispatchConfig(),

  addDispatchConfig: async (payload) => inventoryApi.addDispatchConfig(payload),

  deleteDispatchConfig: async (id) => inventoryApi.deleteDispatchConfig(id),

  linkOrderCard: async (orderId, cardId) => orderOperationsApi.linkOrderCard(orderId, cardId),

  updateCardNFC: async (cardId, payload) => orderOperationsApi.updateCardNFC(cardId, payload),

  getProfileSlugForOrder: async (orderId, customerEmail) => profilesApi.getProfileSlugForOrder(orderId, customerEmail),

  getAdminCards: async () => cardsApi.getAdminCards(),

  getAdminProfiles: async () => profilesApi.getAdminProfiles(),

  assignCard: async (cardId, profileId) => cardsApi.assignCard(cardId, profileId),

  reassignCard: async (cardId, profileId) => cardsApi.reassignCard(cardId, profileId),

  activateCard: async (cardId) => cardsApi.activateCard(cardId),

  revokeCard: async (cardId) => cardsApi.revokeCard(cardId),

  archiveCard: async (cardId) => cardsApi.archiveCard(cardId),
  archiveProfile: async (profileId) => profilesApi.archiveProfile(profileId),

  restoreProfileVersion: async (profileId, version) => profilesApi.restoreProfileVersion(profileId, version),
  getLandingAdminContent: async () => null,
  updateLandingAdminContent: async () => null,
  uploadAvatar: () => Promise.resolve({}),
  trackClick: async () => Promise.resolve({}),

  getReviewCards: async () => reviewCardsApi.getReviewCards(),

  createReviewCard: async (payload) => reviewCardsApi.createReviewCard(payload),

  updateReviewCard: async (id, payload) => reviewCardsApi.updateReviewCard(id, payload),

  incrementReviewScan: async (slug) => reviewCardsApi.incrementReviewScan(slug),

  updateInventoryItem: async (itemId, payload) => inventoryApi.updateInventoryItem(itemId, payload),

  checkLowStock: async () => inventoryApi.checkLowStock(),

  getRefundForOrder: async (orderId) => paymentsApi.getRefundForOrder(orderId),

  createRefund: async (payload) => paymentsApi.createRefund(payload),

  getPendingRefundsCount: async () => paymentsApi.getPendingRefundsCount(),

  // ---------------------------------------------------------------------------
  // Carritos abandonados
  // ---------------------------------------------------------------------------

  saveAbandonedCart: async (payload) => crmApi.saveAbandonedCart(payload),

  markCartConverted: async (cartId) => crmApi.markCartConverted(cartId),

  getAbandonedCarts: async () => crmApi.getAbandonedCarts(),

  getCRMContacts: async () => crmApi.getCRMContacts(),

  getCRMDeals: async () => crmApi.getCRMDeals(),

  createCRMDeal: async (deal) => crmApi.createCRMDeal(deal),

  updateCRMDeal: async (id, payload) => crmApi.updateCRMDeal(id, payload),

  getCRMActivities: async (dealId) => crmApi.getCRMActivities(dealId),

  addCRMActivity: async (activity) => crmApi.addCRMActivity(activity),

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

  getActiveWheel: async () => wheelApi.getActiveWheel(),

  getAllWheels: async () => wheelApi.getAllWheels(),

  createWheel: async (config) => wheelApi.createWheel(config),

  updateWheel: async (id, payload) => wheelApi.updateWheel(id, payload),

  deleteWheel: async (id) => wheelApi.deleteWheel(id),

  createWheelPrize: async (prize) => wheelApi.createWheelPrize(prize),

  updateWheelPrize: async (id, payload) => wheelApi.updateWheelPrize(id, payload),

  deleteWheelPrize: async (id) => wheelApi.deleteWheelPrize(id),

  recordWheelSpin: async (spin) => wheelApi.recordWheelSpin(spin),

  validateWheelCoupon: async (code) => wheelApi.validateWheelCoupon(code),

  redeemWheelCoupon: async (spinId, orderId) => wheelApi.redeemWheelCoupon(spinId, orderId),

  getWheelStats: async (wheelId) => wheelApi.getWheelStats(wheelId),

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
