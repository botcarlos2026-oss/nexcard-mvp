import { useEffect } from 'react';
import { api } from '../services/api';
import { hasSupabase } from '../services/supabaseClient';
import { ADMIN_ROUTES } from '../config/admin';
import { applyAdminRouteData, ensureAdminAccess, loadAdminRouteData, resetAdminRouteState } from '../utils/adminBootstrap';
import { isPublicBypassRoute } from '../utils/appRoutes';
import { defaultLandingContent } from '../utils/defaultData';

export function useAppBootstrap({
  path,
  user,
  sessionReady,
  navigate,
  setLoading,
  setError,
  setLandingContent,
  setData,
  setAdminData,
  setInventoryData,
  setCardsData,
  setProfilesAdminData,
  setOrdersAdminData,
  bootstrapSeqRef,
}) {
  useEffect(() => {
    const requestId = ++bootstrapSeqRef.current;
    let cancelled = false;
    const isStale = () => cancelled || bootstrapSeqRef.current !== requestId;

    const bootstrap = async () => {
      const isPublicRoute = path === '/' || isPublicBypassRoute(path);
      if (!sessionReady && hasSupabase && !isPublicRoute) return;
      if (!isStale()) {
        setLoading(true);
        setError('');
      }

      try {
        if (path === '/' || path === '/preview') {
          setLoading(false);
          Promise.race([
            api.getLandingContent(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('landing_content_timeout')), 4000)),
          ]).then((landing) => {
            if (isStale()) return;
            setLandingContent(landing);
          }).catch(() => {
            if (isStale()) return;
            setLandingContent(defaultLandingContent);
          });
          return;
        }

        try {
          const landing = await Promise.race([
            api.getLandingContent(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('landing_content_timeout')), 4000)),
          ]);
          if (isStale()) return;
          setLandingContent(landing);
        } catch {
          if (isStale()) return;
          setLandingContent(defaultLandingContent);
        }

        if (ADMIN_ROUTES.has(path)) {
          if (isStale()) return;
          const access = await ensureAdminAccess({ navigate });
          if (isStale()) return;
          if (!access.allowed) return;

          resetAdminRouteState({
            setAdminData,
            setInventoryData,
            setCardsData,
            setProfilesAdminData,
            setOrdersAdminData,
          });

          const adminRouteData = await loadAdminRouteData({ path, api });
          if (isStale()) return;
          applyAdminRouteData({
            kind: adminRouteData.kind,
            payload: adminRouteData.payload,
            setAdminData,
            setInventoryData,
            setCardsData,
            setProfilesAdminData,
            setOrdersAdminData,
          });
          return;
        }

        if (path === '/edit') {
          if (!user) {
            if (isStale()) return;
            navigate('/login');
            return;
          }
          const profile = await api.getMyProfile();
          if (isStale()) return;
          if (!profile) {
            if (isStale()) return;
            navigate('/setup');
            return;
          }
          setData(profile);
          return;
        }

        if (path === '/setup' && !user) {
          if (isStale()) return;
          navigate('/login');
          return;
        }

        if (isPublicRoute) return;

        const slug = path.replace(/^\/|\/$/g, '');
        if (slug) {
          const profile = await api.getPublicProfile(slug);
          if (isStale()) return;
          setData(profile);
        }
      } catch (err) {
        if (isStale()) return;
        setError(err.message || 'No fue posible cargar la aplicación');
      } finally {
        if (!isStale()) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [
    path,
    user,
    sessionReady,
    navigate,
    setLoading,
    setError,
    setLandingContent,
    setData,
    setAdminData,
    setInventoryData,
    setCardsData,
    setProfilesAdminData,
    setOrdersAdminData,
    bootstrapSeqRef,
  ]);
}
