import React, { useEffect, useState } from 'react';
import { RefreshCw, TrendingUp, Users, Package, Repeat } from 'lucide-react';
import AdminShell from './AdminShell';
import AdminCard from './ui/AdminCard';
import AdminStat from './ui/AdminStat';
import { api } from '../services/api';

const fmtCLP = (cents) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
    .format(cents || 0);

const fmtMonth = (iso) => {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-CL', { month: 'short', year: 'numeric' }).format(new Date(iso));
};

const pct = (num, den) => {
  if (!den) return '0%';
  return `${Math.round((num / den) * 100)}%`;
};

export default function KpiDashboard() {
  const [funnel, setFunnel] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const [f, r, p, c] = await Promise.all([
        api.getKpiFunnel(),
        api.getKpiMonthlyRevenue({ months: 12 }),
        api.getKpiTopProducts({ limit: 10 }),
        api.getKpiCohorts({ months: 12 }),
      ]);
      setFunnel(f);
      setRevenue(r);
      setTopProducts(p);
      setCohorts(c);
    } catch (e) {
      setError(e.message || 'Error al cargar KPIs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const conversionRate = funnel
    ? pct(funnel.paid_orders_30d, funnel.waitlist_signups + funnel.abandoned_carts_30d + funnel.paid_orders_30d)
    : '—';

  const fulfillmentRate = funnel
    ? pct(funnel.delivered_orders_30d, funnel.paid_orders_30d)
    : '—';

  const cartRecovery = funnel
    ? pct(funnel.paid_orders_30d, funnel.abandoned_carts_30d + funnel.paid_orders_30d)
    : '—';

  return (
    <AdminShell
      active="kpis"
      title="KPIs"
      subtitle="Métricas clave de negocio — actualizadas en tiempo real"
      actions={
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Actualizar
        </button>
      }
    >
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-zinc-500 text-sm">Cargando KPIs…</div>
      ) : (
        <div className="space-y-8">
          {/* Funnel */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Users size={16} className="text-emerald-400" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">Funnel últimos 30 días</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <AdminStat
                label="Waitlist"
                value={(funnel?.waitlist_signups || 0).toLocaleString('es-CL')}
                hint="Total acumulado"
              />
              <AdminStat
                label="Carritos abandonados"
                value={(funnel?.abandoned_carts_30d || 0).toLocaleString('es-CL')}
                accent="amber"
                hint={`Recuperación: ${cartRecovery}`}
              />
              <AdminStat
                label="Órdenes pagadas"
                value={(funnel?.paid_orders_30d || 0).toLocaleString('es-CL')}
                accent="emerald"
                hint={`Conversión: ${conversionRate}`}
              />
              <AdminStat
                label="Entregadas"
                value={(funnel?.delivered_orders_30d || 0).toLocaleString('es-CL')}
                accent="emerald"
                hint={`Fulfillment: ${fulfillmentRate}`}
              />
            </div>
          </section>

          {/* Revenue mensual */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-emerald-400" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">Revenue mensual</h2>
            </div>
            <AdminCard className="!p-0 overflow-hidden">
              {revenue.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-sm">Sin órdenes pagadas todavía.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-800/50 border-b border-zinc-800">
                      <tr className="text-[10px] uppercase tracking-wider text-zinc-500">
                        <th className="px-4 py-3 text-left font-semibold">Mes</th>
                        <th className="px-4 py-3 text-right font-semibold">Órdenes</th>
                        <th className="px-4 py-3 text-right font-semibold">Revenue</th>
                        <th className="px-4 py-3 text-right font-semibold">Ticket promedio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {revenue.map((row) => (
                        <tr key={row.month} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-3 text-zinc-300 capitalize">{fmtMonth(row.month)}</td>
                          <td className="px-4 py-3 text-right text-zinc-400">{row.orders_count}</td>
                          <td className="px-4 py-3 text-right text-emerald-400 font-semibold">{fmtCLP(row.revenue_cents)}</td>
                          <td className="px-4 py-3 text-right text-zinc-400">{fmtCLP(row.avg_ticket_cents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AdminCard>
          </section>

          {/* Top productos */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Package size={16} className="text-emerald-400" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">Top productos</h2>
            </div>
            <AdminCard className="!p-0 overflow-hidden">
              {topProducts.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-sm">Sin ventas registradas.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-800/50 border-b border-zinc-800">
                      <tr className="text-[10px] uppercase tracking-wider text-zinc-500">
                        <th className="px-4 py-3 text-left font-semibold">SKU</th>
                        <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                        <th className="px-4 py-3 text-right font-semibold">Pedidos</th>
                        <th className="px-4 py-3 text-right font-semibold">Unidades</th>
                        <th className="px-4 py-3 text-right font-semibold">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {topProducts.map((row) => (
                        <tr key={row.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{row.sku || '—'}</td>
                          <td className="px-4 py-3 text-zinc-300">{row.name}</td>
                          <td className="px-4 py-3 text-right text-zinc-400">{row.times_ordered}</td>
                          <td className="px-4 py-3 text-right text-zinc-400">{row.units_sold}</td>
                          <td className="px-4 py-3 text-right text-emerald-400 font-semibold">{fmtCLP(row.revenue_cents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AdminCard>
          </section>

          {/* Cohorts */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Repeat size={16} className="text-emerald-400" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">Retención por cohorte</h2>
            </div>
            <AdminCard className="!p-0 overflow-hidden">
              {cohorts.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-sm">Aún no hay datos de retención.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-800/50 border-b border-zinc-800">
                      <tr className="text-[10px] uppercase tracking-wider text-zinc-500">
                        <th className="px-4 py-3 text-left font-semibold">Cohorte</th>
                        <th className="px-4 py-3 text-right font-semibold">Nuevos clientes</th>
                        <th className="px-4 py-3 text-right font-semibold">Recompraron</th>
                        <th className="px-4 py-3 text-right font-semibold">Tasa retención</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {cohorts.map((row) => (
                        <tr key={row.cohort_month} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-3 text-zinc-300 capitalize">{fmtMonth(row.cohort_month)}</td>
                          <td className="px-4 py-3 text-right text-zinc-400">{row.new_customers}</td>
                          <td className="px-4 py-3 text-right text-zinc-400">{row.repeat_customers}</td>
                          <td className="px-4 py-3 text-right text-emerald-400 font-semibold">
                            {pct(row.repeat_customers, row.new_customers)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AdminCard>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
