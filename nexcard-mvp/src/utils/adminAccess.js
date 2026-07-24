import { hasSupabase, supabase } from '../services/supabaseClient';
import { isAdminEmail } from '../config/admin';

const AUTH_TIMEOUT_MS = 4000;

function withTimeout(promise, label, timeoutMs = AUTH_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}_timeout`)), timeoutMs)),
  ]);
}

function readStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(window.localStorage.getItem('nexcard_auth') || 'null')?.user || null;
  } catch {
    return null;
  }
}

function resolveLocalAdminAccess() {
  const storedUser = readStoredUser();
  const storedEmail = storedUser?.email || null;
  const isAdmin = storedUser?.role === 'admin' || isAdminEmail(storedEmail);
  return {
    isAdmin,
    source: storedUser?.role === 'admin' ? 'local_role' : (isAdmin ? 'local_email_fallback' : 'local_anonymous'),
    session: null,
    email: storedEmail,
    user: storedUser,
  };
}

async function resolveAdminRoleFromSupabase() {
  if (!hasSupabase || !supabase) {
    const storedUser = readStoredUser();
    return {
      isAdmin: true,
      source: storedUser?.email ? 'local_mode_with_storage' : 'local_mode',
      session: null,
      email: storedUser?.email || null,
      user: storedUser,
    };
  }

  let session = null;
  let email = null;

  try {
    const { data: sessionData, error: sessionError } = await withTimeout(supabase.auth.getSession(), 'admin_session');
    if (sessionError) {
      throw sessionError;
    }
    session = sessionData?.session || null;
    email = session?.user?.email || null;
  } catch (error) {
    const storedUser = readStoredUser();
    const storedEmail = storedUser?.email || null;
    return {
      ...resolveLocalAdminAccess(),
      source: storedEmail ? 'stored_auth_fallback' : 'session_error',
      error,
    };
  }

  if (!session?.user?.id) {
    const storedUser = readStoredUser();
    if (storedUser?.email) {
      const isAdmin = storedUser.role === 'admin' || isAdminEmail(storedUser.email);
      return {
        isAdmin,
        source: storedUser.role === 'admin' ? 'stored_auth_local_role' : 'stored_auth_local_email',
        session: null,
        email: storedUser.email,
        user: storedUser,
      };
    }
    return { isAdmin: false, source: 'anonymous', session, email };
  }

  try {
    const { data, error } = await withTimeout(supabase.rpc('has_role', { required_role: 'admin' }), 'has_role');
    if (error) {
      return {
        isAdmin: isAdminEmail(email),
        source: 'email_fallback_rpc_error',
        session,
        email,
        error,
      };
    }

    if (data) {
      return { isAdmin: true, source: 'memberships', session, email };
    }
  } catch (error) {
    return {
      isAdmin: isAdminEmail(email),
      source: 'email_fallback_rpc_timeout',
      session,
      email,
      error,
    };
  }

  return {
    isAdmin: isAdminEmail(email),
    source: isAdminEmail(email) ? 'email_fallback' : 'memberships',
    session,
    email,
  };
}

export async function getCurrentAdminAccess() {
  return resolveAdminRoleFromSupabase();
}
