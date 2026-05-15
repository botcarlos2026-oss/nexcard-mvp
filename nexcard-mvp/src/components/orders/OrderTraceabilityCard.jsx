import React from 'react';
import AdminBadge from '../ui/AdminBadge';
import { deriveTraceabilityMoments, formatDate, formatLabel } from './utils';

export default function OrderTraceabilityCard({ order }) {
  return (
    <>
      <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">Folio de producción</p>
        <p className="font-bold text-[18px] text-white">{order.folio || '—'}</p>
        <p className="text-[11px] text-zinc-400 font-mono mt-1">{order.id}</p>
      </div>

      <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Trazabilidad post-pago</p>
          <AdminBadge variant={order.terminal_state === 'activated' ? 'success' : order.observability_alerts?.length ? 'warning' : 'default'}>
            {formatLabel(order.terminal_state || order.funnel_stage)}
          </AdminBadge>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          {deriveTraceabilityMoments(order).map((moment) => (
            <div key={moment.key} className="rounded-xl bg-zinc-900 border border-zinc-700 p-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500 font-bold">{moment.label}</p>
              <p className={`mt-2 text-sm font-bold ${moment.done ? 'text-white' : 'text-zinc-500'}`}>
                {moment.done ? 'OK' : 'Pendiente'}
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">{formatDate(moment.at)}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <AdminBadge variant={order.related_cards?.length > 0 ? 'success' : 'warning'}>
            {order.related_cards?.length > 0 ? `${order.related_cards.length} card(s) trazadas` : 'Sin card trazada'}
          </AdminBadge>
          <AdminBadge variant={order.activation_claim?.status === 'claimed' ? 'success' : order.activation_claim ? 'info' : 'default'}>
            Claim: {formatLabel(order.activation_claim?.status || 'sin claim')}
          </AdminBadge>
          <AdminBadge variant={order.observability_alerts?.length ? 'warning' : 'success'}>
            {order.observability_alerts?.length ? `${order.observability_alerts.length} alerta(s)` : 'Sin alertas'}
          </AdminBadge>
        </div>
        {order.observability_alerts?.length > 0 && (
          <div className="mt-3 space-y-2">
            {order.observability_alerts.map((alert) => (
              <div key={alert} className="rounded-lg border border-amber-800 bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-300">
                {alert}
              </div>
            ))}
          </div>
        )}
      </div>

    </>
  );
}
