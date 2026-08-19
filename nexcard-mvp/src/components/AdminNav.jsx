import React, { useEffect, useRef, useState } from 'react';

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
      <div className="max-w-[1400px] mx-auto relative">
        <div ref={scrollRef} className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
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
            className="pointer-events-none absolute top-0 right-0 h-full w-10 bg-gradient-to-l from-zinc-950 to-transparent"
          />
        )}
      </div>
    </nav>
  );
}
