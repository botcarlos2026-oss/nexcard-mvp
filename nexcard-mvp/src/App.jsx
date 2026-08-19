import React, { useState, useEffect, useRef, useCallback } from 'react';
import AppRouteRenderer from './components/AppRouteRenderer';
import { api, getPendingClaimEmail, getPendingClaimToken, setPendingClaimEmail, setPendingClaimToken, setStoredAuth } from './services/api';
import { defaultLandingContent, initialMockData } from './utils/defaultData';
import { useCart } from './store/cartStore';
import { useAuthSessionSync } from './hooks/useAuthSessionSync';
import { useCheckoutFlow } from './hooks/useCheckoutFlow';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import { getCurrentAdminAccess } from './utils/adminAccess';
import { parseAuthHashError, getAuthHashErrorMessage } from './utils/authFlow';
import { trackPageView, trackEvent } from './utils/ga4';

const getReservedSlugFromClaimResult = (result = {}) => (
  result?.reserved_slug || result?.order?.card_customization?.desired_slug || ''
);

const normalizePhoneSeed = (value = '') => String(value || '').replace(/[^\d+]/g, '').trim();

const getProfileSeedFromClaimResult = (result = {}) => {
  const order = result?.order || {};
  const customization = order?.card_customization || {};
  const phone = normalizePhoneSeed(order.customer_phone || customization.customer_phone || '');
  return {
    full_name: customization.full_name || order.customer_name || '',
    profession: customization.job_title || '',
    company: customization.company || '',
    whatsapp: phone,
    contact_phone: phone,
    contact_email: order.customer_email || result?.claim?.customer_email || '',
  };
};

function App() {
  const bootstrapSeqRef = useRef(0);
  const pendingClaimCompletionRef = useRef(null);
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
  const [pendingClaimEmail, setPendingClaimEmailState] = useState(() => getPendingClaimEmail());
  const [authHashNotice, setAuthHashNotice] = useState('');
  const { getTotalItems, startNewCheckout } = useCart();
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

  const navigate = useCallback((newPath) => {
    window.history.pushState({}, '', newPath);
    setPath(window.location.pathname);
  }, []);

  useEffect(() => {
    const handleLocationChange = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  useEffect(() => {
    trackPageView(path);
  }, [path]);

  useEffect(() => {
    const authHashError = parseAuthHashError(window.location.hash);
    if (!authHashError) return;
    setAuthHashNotice(getAuthHashErrorMessage(authHashError));
    navigate('/login');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const routes = {
      '/': {
        title: 'NexCard — Tarjeta Digital NFC',
        description: 'NexCard — Tarjeta de negocio NFC inteligente. Comparte tu contacto completo con un solo toque. Compatible con iPhone y Android.',
        canonical: 'https://nexcard.cl/',
      },
      '/preview': {
        title: 'NexCard Preview — Tarjeta Digital NFC',
        description: 'Previsualización pública de NexCard: comparte tu contacto con un toque y valida la experiencia antes del cierre comercial.',
        canonical: 'https://nexcard.cl/preview',
      },
      '/coming-soon': {
        title: 'NexCard — Próximamente',
        description: 'NexCard en modo anticipado: conoce la tarjeta NFC que comparte tu contacto completo con un solo toque.',
        canonical: 'https://nexcard.cl/coming-soon',
      },
    };

    const seo = routes[path] || {
      title: 'NexCard — Perfil público NFC',
      description: 'Perfil público de NexCard con tarjeta NFC inteligente y enlaces de contacto directos.',
      canonical: `https://nexcard.cl${path}`,
    };

    document.title = seo.title;

    const upsertMeta = (selector, attributes) => {
      let el = document.head.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        document.head.appendChild(el);
      }
      Object.entries(attributes).forEach(([key, value]) => el.setAttribute(key, value));
      return el;
    };

    upsertMeta('meta[name="description"]', { name: 'description', content: seo.description });
    upsertMeta('meta[name="robots"]', { name: 'robots', content: 'index,follow' });

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', seo.canonical);
  }, [path]);

  useAppBootstrap({
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
  });

  const handleSave = async (newData) => {
    const saved = await api.updateMyProfile(newData);
    setData(saved);

    const claimToken = getPendingClaimToken();
    if (claimToken) {
      try {
        await api.claimProfile(claimToken);
        setPendingClaimToken(null);
        setPendingClaimEmail(null);
        setPendingClaimTokenState(null);
        setPendingClaimEmailState('');
        try {
          sessionStorage.removeItem('nx_pending_profile_slug');
          sessionStorage.removeItem('nx_pending_profile_seed');
        } catch (_) {
          // sessionStorage puede estar bloqueado en modo privado.
        }
      } catch (_) {
        // no bloquear guardado del perfil
      }
    }
  };

  const handleClaimAuthRequired = (token, buyerEmail = '') => {
    setPendingClaimToken(token);
    setPendingClaimEmail(buyerEmail);
    setPendingClaimTokenState(token);
    setPendingClaimEmailState(buyerEmail || '');
    navigate('/login?mode=register&claim=1');
  };

  const handleContinueSetup = useCallback(({ token, reservedSlug, claimResult }) => {
    setPendingClaimToken(token);
    setPendingClaimTokenState(token);
    try {
      if (reservedSlug) sessionStorage.setItem('nx_pending_profile_slug', reservedSlug);
      else sessionStorage.removeItem('nx_pending_profile_slug');
      if (claimResult) sessionStorage.setItem('nx_pending_profile_seed', JSON.stringify(getProfileSeedFromClaimResult(claimResult)));
      else sessionStorage.removeItem('nx_pending_profile_seed');
    } catch (_) {
      // sessionStorage puede estar bloqueado en modo privado.
    }
    navigate('/setup');
  }, [navigate]);

  const completePendingClaim = useCallback(async (claimToken) => {
    try {
      const result = await api.claimProfile(claimToken);
      setPendingClaimEmail(null);
      setPendingClaimEmailState('');
      if (result?.requires_profile_setup) {
        handleContinueSetup({
          token: claimToken,
          reservedSlug: getReservedSlugFromClaimResult(result),
          claimResult: result,
        });
        return true;
      }
      setPendingClaimToken(null);
      setPendingClaimTokenState(null);
      navigate('/edit');
      return true;
    } catch (_) {
      navigate(`/activar/${claimToken}`);
      return false;
    }
  }, [handleContinueSetup, navigate]);

  useEffect(() => {
    if (!sessionReady || !user || !pendingClaimToken || path !== '/login') return;
    if (pendingClaimCompletionRef.current === pendingClaimToken) return;

    pendingClaimCompletionRef.current = pendingClaimToken;
    completePendingClaim(pendingClaimToken).finally(() => {
      pendingClaimCompletionRef.current = null;
    });
  }, [completePendingClaim, path, pendingClaimToken, sessionReady, user]);

  const handleAuthSuccess = async (authPayload) => {
    setUser(authPayload.user);
    setStoredAuth(authPayload);
    const claimToken = getPendingClaimToken();
    if (claimToken) {
      await completePendingClaim(claimToken);
      return;
    }

    const adminAccess = await getCurrentAdminAccess().catch(() => ({
      isAdmin: authPayload.user?.role === 'admin',
    }));

    if (adminAccess?.isAdmin) {
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
      pendingClaimEmail={pendingClaimEmail}
      authHashNotice={authHashNotice}
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
      handleCheckoutStart={() => {
        trackEvent('hero_cta_clicked');
        startNewCheckout();
        handleCheckoutStart();
      }}
      navigate={navigate}
    />
  );
}

export default App;
