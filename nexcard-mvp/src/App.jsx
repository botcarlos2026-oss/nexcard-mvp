import React, { useState, useEffect, useRef } from 'react';
import AppRouteRenderer from './components/AppRouteRenderer';
import { api, getPendingClaimToken, setPendingClaimToken, setStoredAuth } from './services/api';
import { defaultLandingContent, initialMockData } from './utils/defaultData';
import { hasSupabase } from './services/supabaseClient';
import { useCart } from './store/cartStore';
import { ADMIN_ROUTES, isAdminEmail } from './config/admin';
import { useAuthSessionSync } from './hooks/useAuthSessionSync';
import { useCheckoutFlow } from './hooks/useCheckoutFlow';
import { applyAdminRouteData, ensureAdminAccess, loadAdminRouteData, resetAdminRouteState } from './utils/adminBootstrap';
import { isPublicBypassRoute } from './utils/appRoutes';

function App() {
  const bootstrapSeqRef = useRef(0);
  const [data, setData] = useState(initialMockData);
  const { user, setUser, sessionReady } = useAuthSessionSync();
  const [path, setPath] = useState(window.location.pathname);
  const [loading, setLoading] = useState(true);
  const [landingContent, setLandingContent] = useState(defaultLandingContent);
  const [adminData, setAdminData] = useState(null);
  const [inventoryData, setInventoryData] = useState({ items: [], movements: [] });
  const [cardsData, setCardsData] = useState({ cards: [], profiles: [] });
  const [profilesAdminData, setProfilesAdminData] = useState([]);
  const [ordersAdminData, setOrdersAdminData] = useState([]);
  const [error, setError] = useState('');
  const [pendingClaimToken, setPendingClaimTokenState] = useState(() => getPendingClaimToken());
  const { getTotalItems } = useCart();
  const {
    checkoutStep,
    currentOrder,
    handleCheckoutStart,
    handleProceedToCart,
    handleProceedToCheckout,
    handleOrderSuccess,
    handleBackToShop,
    handleBackToCart,
  } = useCheckoutFlow();

  const navigate = (newPath) => {
    window.history.pushState({}, '', newPath);
    setPath(newPath);
  };

  useEffect(() => {
    const handleLocationChange = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  useEffect(() => {
    const requestId = ++bootstrapSeqRef.current;
    let cancelled = false;
    const isStale = () => cancelled || bootstrapSeqRef.current !== requestId;

    const bootstrap = async () => {
      if (!sessionReady && hasSupabase) return; // esperar sesión
      if (!isStale()) {
        setLoading(true);
        setError('');
      }
      try {
        try {
          const landing = await api.getLandingContent();
          if (isStale()) return;
          setLandingContent(landing);
        } catch {
          if (isStale()) return;
          setLandingContent(defaultLandingContent);
        }

        if (path === '/') {
          return;
        }

        if (ADMIN_ROUTES.has(path)) {
          if (isStale()) return;
          const access = await ensureAdminAccess({ navigate });
          if (isStale()) return;
          if (!access.allowed) {
            return;
          }

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

        if (isPublicBypassRoute(path)) {
          return;
        }

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
  }, [path, user, sessionReady]);

  const handleSave = async (newData) => {
    const saved = await api.updateMyProfile(newData);
    setData(saved);

    const claimToken = getPendingClaimToken();
    if (claimToken) {
      try {
        await api.claimProfile(claimToken);
        setPendingClaimToken(null);
        setPendingClaimTokenState(null);
      } catch (_) {
        // no bloquear guardado del perfil
      }
    }
  };

  const handleClaimAuthRequired = (token) => {
    setPendingClaimToken(token);
    setPendingClaimTokenState(token);
    navigate('/login');
  };

  const handleContinueSetup = (token) => {
    setPendingClaimToken(token);
    setPendingClaimTokenState(token);
    navigate('/setup');
  };

  const handleAuthSuccess = (authPayload) => {
    setUser(authPayload.user);
    setStoredAuth(authPayload);
    const email = authPayload.user?.email;
    const claimToken = getPendingClaimToken();
    if (claimToken) {
      navigate(`/activar/${claimToken}`);
      return;
    }
    if (isAdminEmail(email)) {
      navigate('/admin');
    } else {
      navigate('/edit');
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setStoredAuth(null);
    navigate('/login');
  };

  return (
    <AppRouteRenderer
      loading={loading}
      checkoutStep={checkoutStep}
      currentOrder={currentOrder}
      path={path}
      pendingClaimToken={pendingClaimToken}
      user={user}
      data={data}
      adminData={adminData}
      inventoryData={inventoryData}
      cardsData={cardsData}
      profilesAdminData={profilesAdminData}
      ordersAdminData={ordersAdminData}
      landingContent={landingContent}
      error={error}
      handleProceedToCart={() => handleProceedToCart(getTotalItems)}
      handleProceedToCheckout={handleProceedToCheckout}
      handleOrderSuccess={handleOrderSuccess}
      handleBackToShop={handleBackToShop}
      handleBackToCart={handleBackToCart}
      handleAuthSuccess={handleAuthSuccess}
      handleSave={handleSave}
      handleLogout={handleLogout}
      handleClaimAuthRequired={handleClaimAuthRequired}
      handleContinueSetup={handleContinueSetup}
      handleCheckoutStart={handleCheckoutStart}
      navigate={navigate}
    />
  );
}

export default App;
