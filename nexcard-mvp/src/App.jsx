import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import NexCardProfile from './components/NexCardProfile';
import AdminDashboard from './components/AdminDashboard';
import InventoryDashboard from './components/InventoryDashboard';
import AdminCardsDashboard from './components/AdminCardsDashboard';
import AdminProfilesDashboard from './components/AdminProfilesDashboard';
import OrdersDashboard from './components/OrdersDashboard';
import UserEditor from './components/UserEditor';
import SetupWizard from './components/SetupWizard';
import AuthPage from './components/AuthPage';
import ProductCatalog from './components/ProductCatalog';
import Cart from './components/Cart';
import CheckoutForm from './components/CheckoutForm';
import OrderConfirmation from './components/OrderConfirmation';
import { api, getStoredAuth, setStoredAuth } from './services/api';
import { defaultLandingContent, initialMockData } from './utils/defaultData';
import { supabase, hasSupabase } from './services/supabaseClient';
import { useCart } from './store/cartStore';

function App() {
  const [data, setData] = useState(initialMockData);
  const [user, setUser] = useState(() => getStoredAuth()?.user || null);
  const [sessionReady, setSessionReady] = useState(false);
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
    if (!hasSupabase || !supabase) return;
    // Leer sesión activa primero
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        setStoredAuth({ user: session.user });
      }
      setSessionReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        setStoredAuth({ user: session.user });
      } else {
        setUser(null);
        setStoredAuth(null);
      }
    });
    return () => listener?.subscription?.unsubscribe();
  }, []);

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

        if (path === '/admin' || path === '/admin/inventory' || path === '/admin/cards' || path === '/admin/profiles' || path === '/admin/orders') {
          if (!hasSupabase || !supabase) {
            throw new Error('Admin deshabilitado: Supabase Auth es obligatorio');
          }

          // Admin whitelist — verificar sesión de Supabase directamente
          const ADMIN_EMAILS = [
            'bot.carlos.2026@gmail.com',
            'carlos.alvarez.contreras@gmail.com',
            // 'carlos@nexcard.com',  ← agregar cuando compres el dominio
          ];

          // Obtener sesión activa de Supabase (más confiable que localStorage)
          const { data: { session } } = await supabase.auth.getSession();
          const sessionEmail = session?.user?.email?.toLowerCase().trim();
          const isAdmin = sessionEmail && ADMIN_EMAILS.includes(sessionEmail);

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
            console.log('Loading cards...');
            const cards = await api.getAdminCards();
            console.log('Cards result:', cards);
            setCardsData({
              cards: cards.cards || [],
              profiles: cards.profiles || [],
            });
          } else if (path === '/admin/profiles') {
            const profiles = await api.getAdminProfiles();
            setProfilesAdminData(profiles.profiles || []);
          } else {
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
          setData(profile);
          setLoading(false);
          return;
        }

        if (path === '/login' || path === '/setup') {
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
  };

  const handleAuthSuccess = (authPayload) => {
    setUser(authPayload.user);
    setStoredAuth(authPayload);
    const ADMIN_EMAILS = [
      'bot.carlos.2026@gmail.com',
      'carlos.alvarez.contreras@gmail.com',
    ];
    const email = authPayload.user?.email?.toLowerCase().trim();
    if (email && ADMIN_EMAILS.includes(email)) {
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

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 text-white grid place-items-center font-bold">Cargando NexCard…</div>;
  }

  // ==================== CHECKOUT FLOW ====================
  if (checkoutStep === 'catalog') {
    return <ProductCatalog onProceedToCart={handleProceedToCart} />;
  }

  if (checkoutStep === 'cart') {
    return <Cart onProceedCheckout={handleProceedToCheckout} onBack={handleBackToShop} />;
  }

  if (checkoutStep === 'checkout') {
    return (
      <CheckoutForm
        onOrderSuccess={handleOrderSuccess}
        onBack={handleBackToCart}
      />
    );
  }

  if (checkoutStep === 'confirmation') {
    return (
      <OrderConfirmation
        order={currentOrder}
        onContinueShopping={handleBackToShop}
      />
    );
  }

  // ==================== REGULAR ROUTES ====================
  if (path === '/login') return <AuthPage onAuthSuccess={handleAuthSuccess} />;

  if (path === '/admin') return <AdminDashboard dashboard={adminData} />;
  if (path === '/admin/inventory') return <InventoryDashboard items={inventoryData.items} movements={inventoryData.movements} />;
  if (path === '/admin/cards') return <AdminCardsDashboard cards={cardsData.cards} profiles={cardsData.profiles} />;
  if (path === '/admin/profiles') return <AdminProfilesDashboard profiles={profilesAdminData} />;
  if (path === '/admin/orders') return <OrdersDashboard orders={ordersAdminData} />;

  if (path === '/edit') {
    if (!user) return null;
    return <UserEditor data={data} onSave={handleSave} onLogout={handleLogout} />;
  }

  if (path === '/setup') {
    return <SetupWizard onComplete={(wizardData) => {
      handleSave({ ...data, ...wizardData });
      navigate('/edit');
    }} />;
  }

  if (path === '/') return <LandingPage content={landingContent} onCheckoutStart={handleCheckoutStart} />;

  if (error) {
    return <div className="min-h-screen bg-zinc-950 text-white grid place-items-center p-8 text-center"><div><p className="font-black text-2xl mb-3">NexCard no pudo cargar el perfil</p><p className="text-zinc-400">{error}</p></div></div>;
  }

  return <NexCardProfile data={data} />;
}

export default App;
