import React from 'react';
import { BarChart2, CheckCircle2, Loader2 } from 'lucide-react';
import AdminCard from '../ui/AdminCard';
import AdminStat from '../ui/AdminStat';
import AdminBadge from '../ui/AdminBadge';

export default function AdminDashboardOverviewSection({
  stats,
  manualOverrideQaOrdersCount,
  manualOverrideQaSeverity,
  manualOverrideQaAging,
  manualOverrideQaSla,
  manualOverrideQaBlockedCount,
  topManualOverrideQueue,
  quickActionMessage,
  quickActionBusyId,
  onKeepQa,
  onMarkReviewed,
  onRestoreReal,
  SalesChartComponent,
  salesTrend7d,
  funnelStats,
  stageSlaStats,
  paymentMethodStats,
  carrierStats,
  productStats,
  wowAlerts,
}) {
  return (
    <>
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => {
          const inner = (
            <AdminStat
              key={i}
              label={stat.label}
              value={stat.value}
              hint={stat.hint}
              accent={stat.accent}
            />
          );
          return stat.href
            ? <a key={i} href={stat.href}>{inner}</a>
            : <React.Fragment key={i}>{inner}</React.Fragment>;
        })}
      </div>

      {manualOverrideQaOrdersCount > 0 && (
        <div className="grid lg:grid-cols-[1.1fr,0.9fr] gap-6 mb-6">
          <AdminCard>
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div>
                <h2 className="font-bold text-lg text-white">Severidad cola overrides manuales QA</h2>
                <p className="text-sm text-zinc-400 font-medium">Prioriza lo más riesgoso: aging + pagada + no despachada + no activada.</p>
              </div>
              <a href="/admin/orders/qa?audit=excluded&test_reason=manual_override_only&review_status=pending" className="text-xs font-bold underline underline-offset-2">Abrir cola QA</a>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <AdminStat label="Críticas" value={manualOverrideQaSeverity.critical || 0} accent="red" hint={manualOverrideQaSeverity.critical > 0 ? 'Pagadas, sin envío/activación y con aging alto' : null} />
              <AdminStat label="High" value={manualOverrideQaSeverity.high || 0} accent="amber" hint={manualOverrideQaSeverity.high > 0 ? 'Pagadas sin activación o atascadas' : null} />
              <AdminStat label=">24h" value={manualOverrideQaAging.over24h || 0} accent="amber" hint="Overrides manuales envejeciendo" />
              <AdminStat label=">72h" value={manualOverrideQaAging.over72h || 0} accent="red" hint="Deuda operativa real" />
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <AdminStat label="SLA aging abierto" value={manualOverrideQaSla.open_avg_hours != null ? `${manualOverrideQaSla.open_avg_hours}h` : '—'} accent="amber" hint={manualOverrideQaSla.open_sample_size > 0 ? `${manualOverrideQaSla.open_sample_size} override(s) pendientes` : 'Sin muestra pendiente'} />
              <AdminStat label="SLA a revisión" value={manualOverrideQaSla.review_avg_hours != null ? `${manualOverrideQaSla.review_avg_hours}h` : '—'} accent="blue" hint={manualOverrideQaSla.review_sample_size > 0 ? `${manualOverrideQaSla.review_sample_size} override(s) revisados` : 'Sin muestra revisada'} />
              <AdminStat label="SLA a restore real" value={manualOverrideQaSla.resolution_avg_hours != null ? `${manualOverrideQaSla.resolution_avg_hours}h` : '—'} accent="emerald" hint={manualOverrideQaSla.resolution_sample_size > 0 ? `${manualOverrideQaSla.resolution_sample_size} restore(s) manual(es)` : 'Sin restores manuales'} />
            </div>
            {manualOverrideQaBlockedCount > 0 && (
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <AdminBadge variant="danger">{manualOverrideQaBlockedCount} pagada(s) y bloqueada(s)</AdminBadge>
                <a href="/admin/orders/qa?audit=excluded&test_reason=manual_override_only&review_status=pending&risk=paid_blocked" className="text-xs font-bold underline underline-offset-2">Abrir solo pagadas bloqueadas</a>
              </div>
            )}
          </AdminCard>

          <AdminCard>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="font-bold text-lg text-white">Top 5 overrides críticos</h2>
                <p className="text-sm text-zinc-400 font-medium">Acción inmediata sobre la cola manual más riesgosa.</p>
              </div>
              <a href="/admin/orders/qa?audit=excluded&test_reason=manual_override_only&review_status=pending" className="text-xs font-bold underline underline-offset-2">Ver todo</a>
            </div>
            {quickActionMessage.text && (
              <div className={`mb-3 rounded-xl border px-3 py-2 text-xs font-semibold ${quickActionMessage.type === 'error' ? 'border-red-800 bg-red-950/40 text-red-300' : 'border-emerald-800 bg-emerald-950/40 text-emerald-300'}`}>
                {quickActionMessage.text}
              </div>
            )}
            <div className="space-y-3">
              {topManualOverrideQueue.length === 0 ? (
                <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 text-sm font-medium text-zinc-400">Sin overrides manuales priorizados en este momento.</div>
              ) : topManualOverrideQueue.map((order) => (
                <div key={order.id} className="rounded-xl bg-zinc-800 border border-zinc-700 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm text-white">{order.customer_name}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{order.folio || order.id}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <AdminBadge variant={order.severity === 'critical' ? 'danger' : order.severity === 'high' ? 'warning' : 'default'}>{order.severity}</AdminBadge>
                      <AdminBadge variant={order.age_hours >= 72 ? 'danger' : order.age_hours >= 24 ? 'warning' : 'default'}>{order.age_hours}h</AdminBadge>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 mt-3">{order.reasons?.join(' · ') || 'Sin señales adicionales'}</p>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <AdminBadge variant={order.payment_status === 'paid' ? 'success' : 'default'}>{order.payment_status || 'sin pago'}</AdminBadge>
                    <AdminBadge variant="info">{order.fulfillment_status || 'sin fulfillment'}</AdminBadge>
                    <AdminBadge variant={order.activation_completed ? 'success' : 'warning'}>{order.activation_completed ? 'activada' : 'sin activar'}</AdminBadge>
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <button type="button" onClick={() => onKeepQa(order)} disabled={quickActionBusyId === order.id} className="inline-flex items-center gap-1 rounded-lg bg-fuchsia-700 px-3 py-2 text-[11px] font-bold text-white hover:bg-fuchsia-600 disabled:opacity-50">
                      {quickActionBusyId === order.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                      Mantener QA
                    </button>
                    <button type="button" onClick={() => onMarkReviewed(order)} disabled={quickActionBusyId === order.id} className="inline-flex items-center gap-1 rounded-lg bg-sky-700 px-3 py-2 text-[11px] font-bold text-white hover:bg-sky-600 disabled:opacity-50">
                      {quickActionBusyId === order.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                      Marcar revisada
                    </button>
                    <button type="button" onClick={() => onRestoreReal(order)} disabled={quickActionBusyId === order.id} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
                      {quickActionBusyId === order.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                      Restaurar real
                    </button>
                    <a href={`/admin/orders/qa?audit=excluded&test_reason=manual_override_only&review_status=pending${order.age_hours >= 72 ? '&override_age=72h' : order.age_hours >= 24 ? '&override_age=24h' : ''}&order_id=${encodeURIComponent(order.id)}`} className="text-[11px] font-bold text-zinc-300 underline underline-offset-2 hover:text-white">
                      Abrir detalle
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </AdminCard>
        </div>
      )}

      <AdminCard className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold text-lg text-white">Ventas reales últimos 7 días</h2>
            <p className="text-sm text-zinc-400 font-medium">Ingresos diarios en CLP excluyendo QA/interno</p>
          </div>
          <BarChart2 size={20} className="text-emerald-500" />
        </div>
        <SalesChartComponent orders={salesTrend7d} />
      </AdminCard>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {funnelStats.map((stat) => (
          <AdminStat key={stat.label} label={stat.label} value={stat.value} hint={stat.hint} accent={stat.accent} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {stageSlaStats.map((stat) => (
          <AdminStat key={stat.key} label={stat.label} value={stat.value} hint={stat.hint} accent={stat.accent} />
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {[
          {
            title: 'Métodos de pago (30d)',
            subtitle: 'Top por revenue neto estimado post-fee',
            items: paymentMethodStats,
            empty: 'Sin data suficiente.',
            render: (item) => (
              <div key={item.key} className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-sm text-white">{item.label}</p>
                  <p className="text-xs text-zinc-400">{item.orders} órdenes · fee {(item.fee_rate * 100).toFixed(2)}%</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-400">{new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(item.net_revenue || 0)}</p>
                  <p className="text-[11px] text-zinc-500">fee {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(item.fee_cost || 0)}</p>
                </div>
              </div>
            ),
          },
          {
            title: 'Carriers (30d)',
            subtitle: 'Volumen despachado y tasa entrega',
            items: carrierStats,
            empty: 'Sin data suficiente.',
            render: (item) => (
              <div key={item.key} className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-sm text-white">{item.label}</p>
                  <p className="text-xs text-zinc-400">{item.orders} despachos · {item.delivered} entregadas</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-sky-400">{item.delivery_rate != null ? `${item.delivery_rate}%` : '—'}</p>
                  <p className="text-[11px] text-zinc-500">p90 act. {item.p90_delivery_to_activation_hours != null ? `${item.p90_delivery_to_activation_hours}h` : '—'}</p>
                </div>
              </div>
            ),
          },
          {
            title: 'Productos/SKU (30d)',
            subtitle: 'Top por revenue operativo',
            items: productStats,
            empty: 'Sin data suficiente.',
            render: (item) => (
              <div key={item.key} className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-sm text-white">{item.label}</p>
                  <p className="text-xs text-zinc-400">{item.quantity} unidades · {item.order_count} órdenes</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-amber-400">{new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(item.revenue || 0)}</p>
                  <p className="text-[11px] text-zinc-500">claim {item.claim_rate != null ? `${item.claim_rate}%` : '—'}</p>
                </div>
              </div>
            ),
          },
        ].map((section) => (
          <AdminCard key={section.title}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-lg text-white">{section.title}</h2>
                <p className="text-sm text-zinc-400 font-medium">{section.subtitle}</p>
              </div>
            </div>
            <div className="space-y-3">
              {section.items.length === 0
                ? <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 text-sm text-zinc-400">{section.empty}</div>
                : section.items.map(section.render)}
            </div>
          </AdminCard>
        ))}
      </div>

      <AdminCard className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-lg text-white">Alertas automáticas WoW</h2>
            <p className="text-sm text-zinc-400 font-medium">Caídas de revenue, pago, carriers o claim rate anómalo</p>
          </div>
        </div>
        <div className="space-y-3">
          {wowAlerts.length === 0 ? (
            <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 text-sm text-zinc-400">Sin deterioros relevantes detectados en esta ventana.</div>
          ) : wowAlerts.map((alert) => (
            <div key={alert.key} className={`rounded-xl border p-4 ${alert.severity === 'danger' ? 'border-red-800 bg-red-950/30' : 'border-amber-800 bg-amber-950/30'}`}>
              <p className={`font-bold text-sm ${alert.severity === 'danger' ? 'text-red-300' : 'text-amber-300'}`}>{alert.title}</p>
              <p className="text-xs text-zinc-300 mt-1">{alert.detail}</p>
            </div>
          ))}
        </div>
      </AdminCard>
    </>
  );
}
