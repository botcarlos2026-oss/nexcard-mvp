import { hasSupabase, supabase } from '../services/supabaseClient';
import { isAdminEmail } from '../config/admin';

export async function ensureAdminAccess({ navigate }) {
  if (!hasSupabase || !supabase) {
    throw new Error('Admin deshabilitado: Supabase Auth es obligatorio');
  }

  const { data: { session } } = await supabase.auth.getSession();
  const sessionEmail = session?.user?.email;
  const isAdmin = isAdminEmail(sessionEmail);

  if (!isAdmin) {
    navigate('/login');
    return { allowed: false, redirected: true };
  }

  return { allowed: true, redirected: false, session };
}

export async function loadAdminRouteData({ path, api }) {
  if (path === '/admin') {
    return { kind: 'dashboard', payload: await api.getAdminDashboard() };
  }

  if (path === '/admin/inventory') {
    return { kind: 'inventory', payload: await api.getInventory() };
  }

  if (path === '/admin/cards') {
    return { kind: 'cards', payload: await api.getAdminCards() };
  }

  if (path === '/admin/profiles' || path === '/admin/nexreview') {
    return { kind: 'profiles', payload: await api.getAdminProfiles() };
  }

  if (path === '/admin/emails' || path === '/admin/review-cards' || path === '/admin/products' || path === '/admin/team' || path === '/admin/wheel' || path === '/admin/print-test') {
    return { kind: 'noop', payload: null };
  }

  return { kind: 'orders', payload: await api.getOrders() };
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
