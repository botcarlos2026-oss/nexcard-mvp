import React from 'react';
import AdminCard from '../ui/AdminCard';
import AdminStat from '../ui/AdminStat';
import AdminBadge from '../ui/AdminBadge';
import { formatLabel } from './utils';

export default function OrdersDashboardHeader({
  stats,
  excludedOrdersCount,
  auditFilter,
  manualOverrideCount,
  manualOverridePendingCount,
  manualOverrideReviewedCount,
  manualOverrideBlockedCount,
  testReasonCounts,
  testReasonFilter,
  reviewStatusFilter,
  riskFilter,
  funnelSnapshot,
  forceAuditFilter,
  onSelectManualOverrides,
  onSelectReason,
  onClearQaFilter,
}) {
  return (
    <>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <AdminStat key={stat.label} label={stat.label} value={stat.value} accent={stat.accent} />
        ))}
      </div>

      {excludedOrdersCount > 0 && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <AdminBadge variant={auditFilter === 'excluded' ? 'info' : 'default'}>
              {excludedOrdersCount} orden(es) QA/interna(s)
            </AdminBadge>
            {manualOverrideCount > 0 && (
              <button
                type="button"
                onClick={onSelectManualOverrides}
                className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${testReasonFilter === 'manual_override_only' ? 'border-fuchsia-700 bg-fuchsia-950/40 text-fuchsia-300' : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white'}`}
              >
                Solo overrides manuales · {manualOverrideCount}
              </button>
            )}
            {Object.entries(testReasonCounts).map(([reason, count]) => (
              <button
                key={reason}
                type="button"
                onClick={() => onSelectReason(reason)}
                className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${testReasonFilter === reason ? 'border-sky-700 bg-sky-950/40 text-sky-300' : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white'}`}
              >
                {formatLabel(reason)} · {count}
              </button>
            ))}
            {(auditFilter === 'excluded' || testReasonFilter !== 'all') && !forceAuditFilter ? (
              <button
                type="button"
                onClick={onClearQaFilter}
                className="text-xs font-bold text-zinc-400 underline underline-offset-2 hover:text-white"
              >
                Limpiar filtro QA
              </button>
            ) : null}
          </div>
          <p className="text-xs text-zinc-500">
            Breakdown QA/test: {manualOverrideCount > 0 ? `Solo overrides manuales (${manualOverrideCount}) · Pendientes (${manualOverridePendingCount}) · Revisadas (${manualOverrideReviewedCount}) · Pagadas bloqueadas (${manualOverrideBlockedCount}) · ` : ''}
            {Object.entries(testReasonCounts).map(([reason, count]) => `${formatLabel(reason)} (${count})`).join(' · ')}
          </p>
          {testReasonFilter === 'manual_override_only' && (
            <p className="text-xs text-zinc-500">
              Priorización activa: severidad desc por aging + pagada + no enviada + no activada. Estado revisión: {reviewStatusFilter === 'pending' ? 'solo pendientes' : reviewStatusFilter === 'reviewed' ? 'solo revisadas' : 'todas'}. Riesgo: {riskFilter === 'paid_blocked' ? 'solo pagadas bloqueadas' : 'todos'}.
            </p>
          )}
        </div>
      )}

      <AdminCard className="mb-8">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div>
            <h2 className="font-bold text-white">Embudo operativo real</h2>
            <p className="text-sm text-zinc-400">Base pagada: {funnelSnapshot.paidBase} órdenes</p>
          </div>
          <AdminBadge variant={funnelSnapshot.exceptions.length > 0 ? 'warning' : 'success'}>
            {funnelSnapshot.exceptions.length} excepción{funnelSnapshot.exceptions.length === 1 ? '' : 'es'}
          </AdminBadge>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          {funnelSnapshot.counts.map((step) => (
            <div key={step.key} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500 font-bold">{step.label}</p>
              <p className="mt-2 text-2xl font-bold text-white">{step.count}</p>
              <p className="text-xs text-zinc-400 mt-1">{step.ratio}% de paid</p>
            </div>
          ))}
        </div>
        {funnelSnapshot.exceptions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {funnelSnapshot.exceptions.slice(0, 6).map((order) => (
              <span key={order.id} className="rounded-full border border-amber-800 bg-amber-950/40 px-3 py-1 text-[11px] font-bold text-amber-300">
                {order.customerLabel}: {(order.observability_alerts || [])[0]}
              </span>
            ))}
          </div>
        )}
      </AdminCard>
    </>
  );
}
