import React, { useState, useEffect, useRef } from 'react';
import AppRouteRenderer from './components/AppRouteRenderer';
import { api, getPendingClaimToken, setPendingClaimToken, setStoredAuth } from './services/api';
import { defaultLandingContent, initialMockData } from './utils/defaultData';
import { useCart } from './store/cartStore';
import { isAdminEmail } from './config/admin';
import { useAuthSessionSync } from './hooks/useAuthSessionSync';
import { useCheckoutFlow } from './hooks/useCheckoutFlow';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import { getCurrentAdminAccess } from './utils/adminAccess';

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

  const handleAuthSuccess = async (authPayload) => {
    setUser(authPayload.user);
    setStoredAuth(authPayload);
    const claimToken = getPendingClaimToken();
    if (claimToken) {
      navigate(`/activar/${claimToken}`);
      return;
    }

    const adminAccess = await getCurrentAdminAccess().catch(() => ({
      isAdmin: isAdminEmail(authPayload.user?.email),
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
