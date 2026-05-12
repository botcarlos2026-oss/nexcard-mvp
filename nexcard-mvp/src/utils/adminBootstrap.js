import { hasSupabase, supabase } from '../services/supabaseClient';
import { getCurrentAdminAccess } from './adminAccess';

const ADMIN_ROUTE_LOADERS = {
  '/admin': async (api) => ({ kind: 'dashboard', payload: await api.getAdminDashboard() }),
  '/admin/inventory': async (api) => ({ kind: 'inventory', payload: await api.getInventory() }),
  '/admin/cards': async (api) => ({ kind: 'cards', payload: await api.getAdminCards() }),
  '/admin/profiles': async (api) => ({ kind: 'profiles', payload: await api.getAdminProfiles() }),
  '/admin/nexreview': async (api) => ({ kind: 'profiles', payload: await api.getAdminProfiles() }),
  '/admin/orders': async (api) => ({ kind: 'orders', payload: await api.getOrders() }),
  '/admin/crm': async () => ({ kind: 'noop', payload: null }),
  '/admin/emails': async () => ({ kind: 'noop', payload: null }),
  '/admin/review-cards': async () => ({ kind: 'noop', payload: null }),
  '/admin/products': async () => ({ kind: 'noop', payload: null }),
  '/admin/team': async () => ({ kind: 'noop', payload: null }),
  '/admin/wheel': async () => ({ kind: 'noop', payload: null }),
  '/admin/print-test': async () => ({ kind: 'noop', payload: null }),
};

export async function ensureAdminAccess({ navigate }) {
  if (!hasSupabase || !supabase) {
    throw new Error('Admin deshabilitado: Supabase Auth es obligatorio');
  }

  const adminAccess = await getCurrentAdminAccess();
  const isAdmin = adminAccess?.isAdmin;

  if (!isAdmin) {
    navigate('/login');
    return { allowed: false, redirected: true };
  }

  return { allowed: true, redirected: false, session: adminAccess?.session, source: adminAccess?.source };
}

export async function loadAdminRouteData({ path, api }) {
  const loader = ADMIN_ROUTE_LOADERS[path];
  if (!loader) {
    throw new Error(`Ruta admin no soportada: ${path}`);
  }
  return loader(api);
}

export function resetAdminRouteState({ setAdminData, setInventoryData, setCardsData, setProfilesAdminData, setOrdersAdminData }) {
  setAdminData(null);
  setInventoryData({ items: [], movements: [] });
  setCardsData({ cards: [], profiles: [] });
  setProfilesAdminData([]);
  setOrdersAdminData([]);
}

export function applyAdminRouteData({ kind, payload, setAdminData, setInventoryData, setCardsData, setProfilesAdminData, setOrdersAdminData }) {
  if (kind === 'dashboard') {
    setAdminData(payload);
    return;
  }

  if (kind === 'inventory') {
    setInventoryData({
      items: payload?.items || [],
      movements: payload?.movements || [],
    });
    return;
  }

  if (kind === 'cards') {
    setCardsData({
      cards: payload?.cards || [],
      profiles: payload?.profiles || [],
    });
    return;
  }

  if (kind === 'profiles') {
    setProfilesAdminData(payload?.profiles || []);
    return;
  }

  if (kind === 'orders') {
    setOrdersAdminData(payload?.orders || []);
  }
}
