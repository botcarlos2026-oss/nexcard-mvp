import { useEffect, useState } from 'react';
import { getStoredAuth, setStoredAuth } from '../services/api';
import { hasSupabase, supabase } from '../services/supabaseClient';

const AUTH_INIT_TIMEOUT_MS = 4000;

export function useAuthSessionSync() {
  const [user, setUser] = useState(() => getStoredAuth()?.user || null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const watchdog = setTimeout(() => {
      if (!cancelled) {
        console.warn('Supabase auth init timeout; continuing with degraded session state');
        setSessionReady(true);
      }
    }, AUTH_INIT_TIMEOUT_MS);

    if (!hasSupabase || !supabase) {
      clearTimeout(watchdog);
      setSessionReady(true);
      return undefined;
    }

    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session?.user) {
          setUser(session.user);
          setStoredAuth({ user: session.user });
        }
      } catch (error) {
        if (cancelled) return;
        console.warn('Supabase auth init failed:', error);
      } finally {
        clearTimeout(watchdog);
        if (!cancelled) {
          setSessionReady(true);
        }
      }
    };

    initSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      clearTimeout(watchdog);
      if (session?.user) {
        setUser(session.user);
        setStoredAuth({ user: session.user });
      } else {
        const storedAuth = getStoredAuth();
        if (storedAuth?.user) {
          setUser(storedAuth.user);
        } else {
          setUser(null);
          setStoredAuth(null);
        }
      }
      if (!cancelled) {
        setSessionReady(true);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      listener?.subscription?.unsubscribe();
    };
  }, []);

  return {
    user,
    setUser,
    sessionReady,
  };
}
