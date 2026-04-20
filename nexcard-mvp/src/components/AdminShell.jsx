import React from 'react';
import AdminNav from './AdminNav';

export default function AdminShell({ active, children, title, subtitle, actions }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AdminNav active={active} />
      <main className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 md:py-8">
        {(title || actions) && (
          <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6 md:mb-8">
            <div>
              {title && (
                <h1 className="text-2xl md:text-3xl font-bold text-white">{title}</h1>
              )}
              {subtitle && (
                <p className="text-zinc-400 text-sm mt-1">{subtitle}</p>
              )}
            </div>
            {actions && (
              <div className="flex items-center gap-2">{actions}</div>
            )}
          </header>
        )}
        {children}
      </main>
    </div>
  );
}
