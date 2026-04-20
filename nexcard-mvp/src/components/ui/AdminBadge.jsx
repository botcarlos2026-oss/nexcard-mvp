import React from 'react';

const variants = {
  default: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  success: 'bg-emerald-950/50 text-emerald-400 border-emerald-900',
  warning: 'bg-amber-950/50 text-amber-400 border-amber-900',
  danger:  'bg-red-950/50 text-red-400 border-red-900',
  info:    'bg-blue-950/50 text-blue-400 border-blue-900',
  purple:  'bg-purple-950/50 text-purple-400 border-purple-900',
};

export default function AdminBadge({ children, variant = 'default' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${variants[variant]}`}>
      {children}
    </span>
  );
}
