import { hasSupabase, supabase } from '../services/supabaseClient';

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

function resolveLocalOnlyAdminAccess() {
  const storedUser = readStoredUser();
  const storedEmail = storedUser?.email || null;
  const isAdmin = storedUser?.role === 'admin';
  return {
    isAdmin,
    source: isAdmin ? 'local_only_role' : 'local_only_anonymous',
    session: null,
    email: storedEmail,
    user: storedUser,
  };
}

async function resolveAdminRoleFromSupabase() {
  if (!hasSupabase || !supabase) {
    return resolveLocalOnlyAdminAccess();
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
    return {
      isAdmin: false,
      source: 'session_error',
      session: null,
      email: null,
      error,
    };
  }

  if (!session?.user?.id) {
    return { isAdmin: false, source: 'anonymous', session, email };
  }

  try {
    const { data, error } = await withTimeout(supabase.rpc('has_role', { required_role: 'admin' }), 'has_role');
    if (error) {
      return {
        isAdmin: false,
        source: 'has_role_error',
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
      isAdmin: false,
      source: 'has_role_timeout',
      session,
      email,
      error,
    };
  }

  return {
    isAdmin: false,
    source: 'memberships',
    session,
    email,
  };
}

export async function getCurrentAdminAccess() {
  return resolveAdminRoleFromSupabase();
}
