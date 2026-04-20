import React from 'react';

export function Table({ children }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

export function THead({ children }) {
  return (
    <thead className="bg-zinc-900 border-b border-zinc-800">
      <tr className="text-xs uppercase tracking-wide text-zinc-500">{children}</tr>
    </thead>
  );
}

export function TH({ children, className = '' }) {
  return (
    <th className={`text-left px-4 py-3 font-medium ${className}`}>{children}</th>
  );
}

export function TR({ children, onClick, active }) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-zinc-800/60 transition-colors ${
        onClick ? 'cursor-pointer hover:bg-zinc-800/50' : ''
      } ${active ? 'bg-zinc-800/80' : ''}`}
    >
      {children}
    </tr>
  );
}

export function TD({ children, className = '' }) {
  return (
    <td className={`px-4 py-3 text-zinc-300 ${className}`}>{children}</td>
  );
}
