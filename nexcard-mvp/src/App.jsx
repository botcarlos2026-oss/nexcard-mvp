import React, { useState, useEffect } from 'react';
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
    const bootstrap = async () => {
      if (!sessionReady && hasSupabase) return; // esperar sesión
      setLoading(true);
      setError('');
      try {
        try {
          const landing = await api.getLandingContent();
          setLandingContent(landing);
        } catch {
          setLandingContent(defaultLandingContent);
        }

        if (path === '/') {
          setLoading(false);
          return;
        }

        if (ADMIN_ROUTES.has(path)) {
          const access = await ensureAdminAccess({ navigate });
          if (!access.allowed) {
            setLoading(false);
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
          applyAdminRouteData({
            kind: adminRouteData.kind,
            payload: adminRouteData.payload,
            setAdminData,
            setInventoryData,
            setCardsData,
            setProfilesAdminData,
            setOrdersAdminData,
          });
          setLoading(false);
          return;
        }

        if (path === '/edit') {
          if (!user) {
            navigate('/login');
            setLoading(false);
            return;
          }
          const profile = await api.getMyProfile();
          if (!profile) {
            navigate('/setup');
            setLoading(false);
            return;
          }
          setData(profile);
          setLoading(false);
          return;
        }

        if (path === '/setup' && !user) {
          navigate('/login');
          setLoading(false);
          return;
        }

        if (isPublicBypassRoute(path)) {
          setLoading(false);
          return;
        }

        const slug = path.replace(/^\/|\/$/g, '');
        if (slug) {
          const profile = await api.getPublicProfile(slug);
          setData(profile);
        }
      } catch (err) {
        setError(err.message || 'No fue posible cargar la aplicación');
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
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
