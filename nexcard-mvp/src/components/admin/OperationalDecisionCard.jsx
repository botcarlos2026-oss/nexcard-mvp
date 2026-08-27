import React from 'react';
import { ArrowRight, Eye, Loader2 } from 'lucide-react';
import AdminBadge from '../ui/AdminBadge';

const severityVariant = (severity) => {
  const value = String(severity || '').toLowerCase();
  if (value.includes('critical') || value.includes('crítico') || value.includes('high') || value.includes('bloque')) return 'danger';
  if (value.includes('paid') || value.includes('ok') || value.includes('real')) return 'success';
  if (value.includes('medium') || value.includes('pendiente') || value.includes('warn')) return 'warning';
  return 'default';
};

export default function OperationalDecisionCard({
  id,
  title,
  customerLabel,
  detail,
  status,
  severity,
  nextAction,
  blockerReason,
  href = '/admin/orders',
  onSelect,
  selected = false,
  requiresHuman = false,
  children,
}) {
  return (
    <article
      className={`rounded-2xl border p-4 transition-colors ${selected ? 'border-emerald-500 bg-emerald-950/20' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'}`}
      data-cy="operational-decision-card"
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500 break-all">{id || 'sin folio'}</p>
            <h3 className="mt-1 text-sm font-black text-white">{title || customerLabel || 'Decisión de pedido'}</h3>
            {customerLabel && title !== customerLabel ? <p className="mt-0.5 truncate text-xs font-semibold text-zinc-500">{customerLabel}</p> : null}
          </div>
          <AdminBadge variant={severityVariant(severity || status)}>{status || severity || 'pendiente'}</AdminBadge>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr,auto] md:items-center">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Detalle</p>
            <p className="mt-1 text-xs font-semibold text-zinc-300">{detail || blockerReason || 'Revisar estado del pedido.'}</p>
          </div>
          <div className="rounded-xl border border-emerald-900/70 bg-emerald-950/20 px-3 py-2 text-xs font-black text-emerald-200">
            <span className="inline-flex items-center gap-1.5"><ArrowRight size={13} /> {nextAction || 'Abrir detalle'}</span>
          </div>
        </div>
        {blockerReason ? (
          <p className="mt-2 text-xs font-semibold text-amber-300">Bloqueo: {blockerReason}</p>
        ) : null}
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {requiresHuman ? <AdminBadge variant="warning">requiere revisión</AdminBadge> : null}
        <a href={href} className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-300 hover:border-zinc-500 hover:text-white">
          <Eye size={13} /> Ver detalle
        </a>
        {children || null}
      </div>
    </article>
  );
}

export function OperationalDecisionBusyBadge() {
  return <Loader2 size={12} className="animate-spin" />;
}
