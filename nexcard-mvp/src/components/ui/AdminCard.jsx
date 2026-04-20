import React from 'react';

export default function AdminCard({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
