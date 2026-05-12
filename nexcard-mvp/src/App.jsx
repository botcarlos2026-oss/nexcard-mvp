import React, { useState, useEffect } from 'react';
import AppRouteRenderer from './components/AppRouteRenderer';
import { api, getLastOrderSnapshot, getPendingClaimToken, setPendingClaimToken, setStoredAuth } from './services/api';
import { defaultLandingContent, initialMockData } from './utils/defaultData';
import { supabase, hasSupabase } from './services/supabaseClient';
import { useCart } from './store/cartStore';
import { ADMIN_ROUTES, isAdminEmail } from './config/admin';
import { useAuthSessionSync } from './hooks/useAuthSessionSync';

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
  
  // Checkout state
  const [checkoutStep, setCheckoutStep] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [pendingClaimToken, setPendingClaimTokenState] = useState(() => getPendingClaimToken());
  const { getTotalItems } = useCart();

  const navigate = (newPath) => {
    window.history.pushState({}, '', newPath);
    setPath(newPath);
  };

  // Checkout handlers
  const handleCheckoutStart = () => {
    setCheckoutStep('catalog');
  };

  const handleProceedToCart = () => {
    if (getTotalItems() > 0) {
      setCheckoutStep('cart');
    }
  };

  const handleProceedToCheckout = () => {
    setCheckoutStep('checkout');
  };

  const handleOrderSuccess = (order) => {
    setCurrentOrder(order);
    setCheckoutStep('confirmation');
  };

  const handleBackToShop = () => {
    setCheckoutStep('catalog');
  };

  const handleBackToCart = () => {
    setCheckoutStep('cart');
  };

  useEffect(() => {
    const handleLocationChange = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Leer parámetros de retorno de Mercado Pago
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const orderId = params.get('order');
    if (payment && orderId) {
      const snapshot = getLastOrderSnapshot();
      window.history.replaceState({}, '', '/');
      setCurrentOrder({
        ...(snapshot?.id === orderId ? snapshot : {}),
        id: orderId,
        payment_status: payment === 'success' ? 'paid' : payment,
      });
      setCheckoutStep('confirmation');
    }
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
          if (!hasSupabase || !supabase) {
            throw new Error('Admin deshabilitado: Supabase Auth es obligatorio');
          }

          // Obtener sesión activa de Supabase (más confiable que localStorage)
          const { data: { session } } = await supabase.auth.getSession();
          const sessionEmail = session?.user?.email;
          const isAdmin = isAdminEmail(sessionEmail);

          if (!isAdmin) {
            navigate('/login');
            setLoading(false);
            return;
          }

          if (path === '/admin') {
            const dashboard = await api.getAdminDashboard();
            setAdminData(dashboard);
          } else if (path === '/admin/inventory') {
            const inventory = await api.getInventory();
            setInventoryData({
              items: inventory.items || [],
              movements: inventory.movements || [],
            });
          } else if (path === '/admin/cards') {
            const cards = await api.getAdminCards();
            setCardsData({
              cards: cards.cards || [],
              profiles: cards.profiles || [],
            });
          } else if (path === '/admin/profiles' || path === '/admin/nexreview') {
            const profiles = await api.getAdminProfiles();
            setProfilesAdminData(profiles.profiles || []);
          } else if (path === '/admin/emails') {
            // EmailDashboard carga sus propios datos via supabase directo
          } else if (path === '/admin/review-cards') {
            // ReviewCardsDashboard carga sus propios datos
          } else {
            // /admin/orders y /admin/crm comparten la misma fuente de datos
            const orders = await api.getOrders();
            setOrdersAdminData(orders.orders || []);
          }
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

        if (path === '/login' || path === '/setup' || path === '/privacidad' || path === '/preview' || path === '/terminos'
            || path === '/baja'
            || path.startsWith('/r/')
            || path.startsWith('/seguimiento/') || path.startsWith('/confirmar/') || path.startsWith('/activar/')) {
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
      handleProceedToCart={handleProceedToCart}
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
