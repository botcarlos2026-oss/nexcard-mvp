import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import NexCardProfile from './components/NexCardProfile';
import AdminDashboard from './components/AdminDashboard';
import InventoryDashboard from './components/InventoryDashboard';
import UserEditor from './components/UserEditor';
import SetupWizard from './components/SetupWizard';
import AuthPage from './components/AuthPage';
import { api, getStoredAuth, setStoredAuth } from './services/api';
import { defaultLandingContent, initialMockData } from './utils/defaultData';
import { supabase, hasSupabase } from './services/supabaseClient';

function App() {
  const [data, setData] = useState(initialMockData);
  const [user, setUser] = useState(() => getStoredAuth()?.user || null);
  const [path, setPath] = useState(window.location.pathname);
  const [loading, setLoading] = useState(true);
  const [landingContent, setLandingContent] = useState(defaultLandingContent);
  const [adminData, setAdminData] = useState(null);
  const [inventoryData, setInventoryData] = useState([]);
  const [error, setError] = useState('');

  const navigate = (newPath) => {
    window.history.pushState({}, '', newPath);
    setPath(newPath);
  };

  // Escucha cambios de sesión supabase
  useEffect(() => {
    if (!hasSupabase || !supabase) return;
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
      setLoading(true);
      setError('');
      try {
        const landing = await api.getLandingContent().catch(() => defaultLandingContent);
        setLandingContent(landing);

        if (path === '/') {
          setLoading(false);
          return;
        }

        if (path === '/admin' || path === '/admin/inventory') {
          if (!hasSupabase || !supabase) {
            throw new Error('Admin deshabilitado: Supabase Auth es obligatorio');
          }
          if (!user) {
            navigate('/login');
            setLoading(false);
            return;
          }

          const { data: membership, error: memErr } = await supabase
            .from('memberships')
            .select('role')
            .eq('user_id', user.id)
            .in('role', ['admin'])
            .maybeSingle();

          if (memErr) {
            throw new Error('No fue posible validar permisos de administrador');
          }

          if (!membership) {
            navigate('/');
            setLoading(false);
            return;
          }

          if (path === '/admin') {
            const dashboard = await api.getAdminDashboard();
            setAdminData(dashboard);
          } else {
            const inventory = await api.getInventory();
            setInventoryData(inventory.items || []);
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
  }, [path, user]);

  const handleSave = async (newData) => {
    const saved = await api.updateMyProfile(newData);
    setData(saved);
  };

  const handleAuthSuccess = (authPayload) => {
    setUser(authPayload.user);
    setStoredAuth(authPayload);
    navigate('/edit');
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

  if (path === '/login') return <AuthPage onAuthSuccess={handleAuthSuccess} />;

  if (path === '/admin') return <AdminDashboard dashboard={adminData} />;
  if (path === '/admin/inventory') return <InventoryDashboard items={inventoryData} />;

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

  if (path === '/') return <LandingPage content={landingContent} />;

  if (error) {
    return <div className="min-h-screen bg-zinc-950 text-white grid place-items-center p-8 text-center"><div><p className="font-black text-2xl mb-3">NexCard no pudo cargar el perfil</p><p className="text-zinc-400">{error}</p></div></div>;
  }

  return <NexCardProfile data={data} />;
}

export default App;
