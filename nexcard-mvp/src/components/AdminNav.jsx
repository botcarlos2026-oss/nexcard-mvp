import React, { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { api, setStoredAuth } from '../services/api';

const items = [
  { id: 'dashboard', label: 'Dashboard', path: '/admin' },
  { id: 'orders',    label: 'Orders',     path: '/admin/orders' },
  { id: 'qa-orders', label: 'QA Orders',  path: '/admin/orders/qa' },
  { id: 'products',  label: 'Productos',  path: '/admin/products' },
  { id: 'cards',     label: 'Cards',      path: '/admin/cards' },
  { id: 'profiles',  label: 'Profiles',   path: '/admin/profiles' },
  { id: 'inventory', label: 'Inventario', path: '/admin/inventory' },
  { id: 'reviews',   label: 'Review Cards', path: '/admin/review-cards' },
  { id: 'nexreview', label: 'NexReview',  path: '/admin/nexreview' },
  { id: 'emails',    label: 'Emails',     path: '/admin/emails' },
  { id: 'crm',       label: 'CRM',        path: '/admin/crm' },
  { id: 'team',      label: 'Equipo',     path: '/admin/team' },
  { id: 'wheel',       label: 'Ruleta',      path: '/admin/wheel' },
  { id: 'print-test', label: 'Calibración', path: '/admin/print-test' },
  { id: 'kpis',      label: 'KPIs',       path: '/admin/kpis' },
];

export default function AdminNav({ active, navigate }) {
  // `navigate` is optional: when a caller passes it, links go through client-side
  // routing (no full reload). Dashboards that haven't been wired to it yet keep
  // working exactly as before via a plain <a href>.
  const linkProps = (path) =>
    navigate
      ? { href: path, onClick: (e) => { e.preventDefault(); navigate(path); } }
      : { href: path };

  const scrollRef = useRef(null);
  const [showFade, setShowFade] = useState(false);

  // Admin never had a working logout control — handleLogout in App.jsx was only ever
  // wired to UserEditor's onLogout prop, never passed down to the admin routes.
  // Self-contained here (calls api.logout()/setStoredAuth directly) instead of prop-
  // drilling through AppRouteRenderer/AdminShell for every admin dashboard.
  const handleAdminLogout = async () => {
    try {
      await api.logout();
    } finally {
      setStoredAuth(null);
      if (navigate) {
        navigate('/login');
      } else {
        window.location.href = '/login';
      }
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const updateFade = () => {
      setShowFade(el.scrollWidth - el.scrollLeft - el.clientWidth > 4);
    };
    updateFade();
    el.addEventListener('scroll', updateFade, { passive: true });
    window.addEventListener('resize', updateFade);
    return () => {
      el.removeEventListener('scroll', updateFade);
      window.removeEventListener('resize', updateFade);
    };
  }, []);

  return (
    <nav aria-label="Navegación admin" className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800 px-4 md:px-6 py-3">
      <div className="max-w-[1400px] mx-auto relative flex items-center gap-2">
        <div ref={scrollRef} className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-1 min-w-0">
          <a
            {...linkProps('/')}
            className="flex items-center gap-2 px-3 py-1.5 text-white font-bold text-sm flex-shrink-0 mr-4"
          >
            <span className="text-emerald-400">●</span> NexCard Admin
          </a>
          {items.map(item => (
            <a
              key={item.id}
              {...linkProps(item.path)}
              aria-current={active === item.id ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                active === item.id
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>
        {showFade && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-16 h-full w-10 bg-gradient-to-l from-zinc-950 to-transparent"
          />
        )}
        <button
          type="button"
          onClick={handleAdminLogout}
          data-cy="admin-logout"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
        >
          <LogOut size={16} />
          <span className="hidden md:inline">Cerrar sesión</span>
        </button>
      </div>
    </nav>
  );
}
