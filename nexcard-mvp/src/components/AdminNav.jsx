import React from 'react';

const items = [
  { id: 'dashboard', label: 'Dashboard', path: '/admin' },
  { id: 'orders',    label: 'Orders',     path: '/admin/orders' },
  { id: 'products',  label: 'Productos',  path: '/admin/products' },
  { id: 'cards',     label: 'Cards',      path: '/admin/cards' },
  { id: 'profiles',  label: 'Profiles',   path: '/admin/profiles' },
  { id: 'inventory', label: 'Inventario', path: '/admin/inventory' },
  { id: 'reviews',   label: 'Review Cards', path: '/admin/review-cards' },
  { id: 'emails',    label: 'Emails',     path: '/admin/emails' },
  { id: 'crm',       label: 'CRM',        path: '/admin/crm' },
  { id: 'team',      label: 'Equipo',     path: '/admin/team' },
  { id: 'wheel',     label: 'Ruleta',     path: '/admin/wheel' },
];

export default function AdminNav({ active }) {
  return (
    <nav className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800 px-4 md:px-6 py-3">
      <div className="max-w-[1400px] mx-auto flex items-center gap-1 overflow-x-auto scrollbar-hide">
        <a
          href="/"
          className="flex items-center gap-2 px-3 py-1.5 text-white font-bold text-sm flex-shrink-0 mr-4"
        >
          <span className="text-emerald-400">●</span> NexCard Admin
        </a>
        {items.map(item => (
          <a
            key={item.id}
            href={item.path}
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
    </nav>
  );
}
