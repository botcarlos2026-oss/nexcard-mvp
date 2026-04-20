import React from 'react';

export default function AdminStat({ label, value, hint, accent }) {
  const valueClass =
    accent === 'emerald' ? 'text-emerald-400' :
    accent === 'amber'   ? 'text-amber-400'   :
    accent === 'red'     ? 'text-red-400'      :
    'text-white';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500 font-medium">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</div>
      {hint && <div className="text-xs text-zinc-400 mt-1">{hint}</div>}
    </div>
  );
}
