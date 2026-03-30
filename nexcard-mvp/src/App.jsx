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

function App() {
  const [data, setData] = useState(initialMockData);
  const [user, setUser] = useState(() => getStoredAuth()?.user || null);
  const [path, setPath] = useState(window.location.pathname);
  const [loading, setLoading] = useState(true);
  const [landingContent, setLandingContent] = useState(defaultLandingContent);
  const [adminData, setAdminData] = useState(null);
  const [inventoryData, setInventoryData] = useState([]);
  const [error, setError] = useState('');

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

        if (path === '/admin') {
          const dashboard = await api.getAdminDashboard();
          setAdminData(dashboard);
          setLoading(false);
          return;
        }

        if (path === '/admin/inventory') {
          const inventory = await api.getInventory();
          setInventoryData(inventory.items || []);
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

        const slug = path.replace(/^\//, '');
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

  const navigate = (newPath) => {
    window.history.pushState({}, '', newPath);
    setPath(newPath);
  };

  const handleSave = async (newData) => {
    const saved = await api.updateMyProfile(newData).catch(() => newData);
    setData(saved);
  };

  const handleAuthSuccess = (authPayload) => {
    setUser(authPayload.user);
    setStoredAuth(authPayload);
    navigate('/edit');
  };

  const handleLogout = () => {
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
