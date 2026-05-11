import React, { useMemo, useState, useEffect } from 'react';
import {
  TrendingUp,
  Eye,
  MousePointer2,
  QrCode,
  BarChart2,
  Search,
  AlertTriangle,
  X,
  Siren,
  ShieldAlert,
  BellRing,
  Copy,
} from 'lucide-react';
import { generateQRCode } from '../utils/qrEngine';
import { api } from '../services/api';
import AdminShell from './AdminShell';
import AdminCard from './ui/AdminCard';
import AdminStat from './ui/AdminStat';
import { TH, TD } from './ui/AdminTable';
import AdminBadge from './ui/AdminBadge';

const SalesChart = ({ orders }) => {
  const days = useMemo(() => {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      const dayOrders = orders.filter(o => new Date(o.created_at).toDateString() === dateStr);
      const revenue = dayOrders.reduce((sum, o) => sum + (o.amount_cents || 0), 0);
      result.push({
        label: date.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' }),
        revenue,
        count: dayOrders.length,
      });
    }
    return result;
  }, [orders]);

  const maxRevenue = Math.max(...days.map(d => d.revenue), 1);
  const formatCLP = (n) => n >= 1000 ? `$${Math.round(n/1000)}K` : `$${n}`;

  return (
    <div className="flex items-end gap-3 h-32">
      {days.map((day, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs font-bold text-zinc-500">{day.revenue > 0 ? formatCLP(day.revenue) : ''}</span>
          <div className="w-full relative" style={{ height: '80px' }}>
            <div
              className="w-full rounded-t-lg bg-emerald-500 absolute bottom-0 transition-all"
              style={{ height: `${Math.max((day.revenue / maxRevenue) * 80, day.revenue > 0 ? 4 : 0)}px` }}
            />
            {day.revenue === 0 && <div className="w-full h-1 bg-zinc-700 absolute bottom-0 rounded" />}
          </div>
          <span className="text-[10px] font-bold text-zinc-400 text-center leading-tight">{day.label}</span>
        </div>
      ))}
    </div>
  );
};

const FunnelTrendChart = ({ data }) => {
  const maxValue = Math.max(...data.flatMap((day) => [day.paid, day.ready, day.shipped, day.delivered, day.activated]), 1);
  const stages = [
    { key: 'paid', color: 'bg-emerald-500', label: 'Paid' },
    { key: 'ready', color: 'bg-amber-500', label: 'Ready' },
    { key: 'shipped', color: 'bg-sky-500', label: 'Shipped' },
    { key: 'delivered', color: 'bg-violet-500', label: 'Delivered' },
    { key: 'activated', color: 'bg-fuchsia-500', label: 'Activated' },
  ];

  return (
    <div>
      <div className="grid grid-cols-5 gap-2 mb-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        {stages.map((stage) => (
          <div key={stage.key} className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${stage.color}`} />
            <span>{stage.label}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-3 items-end h-40">
        {data.map((day) => (
          <div key={day.label} className="flex flex-col items-center gap-2 h-full">
            <div className="flex items-end gap-1 h-full w-full justify-center">
              {stages.map((stage) => (
                <div key={stage.key} className="w-3 h-full flex items-end">
                  <div
                    className={`w-full rounded-t ${stage.color}`}
                    style={{ height: `${Math.max(((day[stage.key] || 0) / maxValue) * 100, day[stage.key] ? 8 : 0)}%` }}
                    title={`${stage.label}: ${day[stage.key] || 0}`}
                  />
                </div>
              ))}
            </div>
            <span className="text-[10px] font-bold text-zinc-400 text-center leading-tight">{day.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const AdminDashboard = ({ dashboard }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalResults, setGlobalResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [lowStockDismissed, setLowStockDismissed] = useState(false);
  const [pendingRefundsCount, setPendingRefundsCount] = useState(0);
  const [digestCopied, setDigestCopied] = useState(false);

  useEffect(() => {
    api.checkLowStock().then(({ lowStockItems: items }) => setLowStockItems(items)).catch(() => {});
    api.getPendingRefundsCount().then(setPendingRefundsCount).catch(() => {});
  }, []);

  const users = dashboard?.users || [];
  const statsSource = useMemo(() => dashboard?.stats || {}, [dashboard]);
  const recentOrders = dashboard?.recentOrders || [];
  const operationalAlerts = dashboard?.operationalAlerts || [];
  const slaBreaches = dashboard?.slaBreaches || [];
  const weeklyFunnelTrend = dashboard?.weeklyFunnelTrend || [];
  const proactiveSummary = dashboard?.proactiveSummary || null;
  const proactiveQueue = dashboard?.proactiveQueue || [];
  const operationalDigest = dashboard?.operationalDigest || null;

  const handleGlobalSearch = async (term) => {
    if (!term.trim()) { setGlobalResults(null); return; }
    setSearching(true);
    try {
      const [ordersRes] = await Promise.all([api.getOrders()]);
      const orders = ordersRes.orders || [];
      const t = term.toLowerCase();
      const matchedOrders = orders.filter(o =>
        o.customer_name?.toLowerCase().includes(t) ||
        o.customer_email?.toLowerCase().includes(t) ||
        o.id?.toLowerCase().includes(t)
      ).slice(0, 5);
      const matchedProfiles = users.filter(u =>
        u.name?.toLowerCase().includes(t) ||
        u.slug?.toLowerCase().includes(t)
      ).slice(0, 5);
      setGlobalResults({ orders: matchedOrders, profiles: matchedProfiles });
    } catch (err) {
      console.warn('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const stats = useMemo(() => ([
    { label: 'Ingresos cobrados', value: new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(statsSource.totalRevenue || 0), accent: 'emerald' },
    { label: 'Perfiles activos', value: `${statsSource.totalProfiles || 0}`, accent: null },
    { label: 'Pedidos abiertos', value: `${statsSource.pendingOrders || 0}`, accent: 'amber' },
    { label: 'Devoluciones pendientes', value: `${pendingRefundsCount}`, accent: pendingRefundsCount > 0 ? 'red' : null, hint: pendingRefundsCount > 0 ? 'Requiere revisión' : null, href: '/admin/orders' },
  ]), [statsSource, pendingRefundsCount]);

  const funnelStats = useMemo(() => {
    const funnel = statsSource.funnel || { paid: 0, ready: 0, shipped: 0, delivered: 0, activated: 0 };
    return [
      { label: 'Paid', value: funnel.paid || 0, accent: 'emerald' },
      { label: 'Ready', value: funnel.ready || 0, accent: 'amber' },
      { label: 'Shipped', value: funnel.shipped || 0, accent: 'blue' },
      { label: 'Delivered', value: funnel.delivered || 0, accent: 'emerald' },
      { label: 'Activated', value: funnel.activated || 0, accent: 'emerald' },
    ];
  }, [statsSource]);

  const stageSlaStats = useMemo(() => {
    const stageSla = statsSource.stageSla || {};
    return [
      { key: 'paid_to_ready', label: 'Paid → Ready', accent: 'amber' },
      { key: 'ready_to_shipped', label: 'Ready → Shipped', accent: 'blue' },
      { key: 'shipped_to_delivered', label: 'Shipped → Delivered', accent: 'emerald' },
      { key: 'delivered_to_activated', label: 'Delivered → Activated', accent: 'red' },
    ].map((item) => {
      const value = stageSla[item.key];
      return {
        ...item,
        value: value?.avg_hours != null ? `${value.avg_hours}h` : '—',
        hint: value?.sample_size ? `${value.sample_size} casos` : 'Sin muestra cerrada',
      };
    });
  }, [statsSource]);

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const handleCopyDigest = async () => {
    if (!operationalDigest?.text || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(operationalDigest.text);
      setDigestCopied(true);
      window.setTimeout(() => setDigestCopied(false), 1800);
    } catch {
      setDigestCopied(false);
    }
  };
  const proactiveTone = proactiveSummary?.severity === 'critical'
    ? 'border-red-800 bg-red-950/30 text-red-200'
    : proactiveSummary?.severity === 'high'
      ? 'border-amber-800 bg-amber-950/30 text-amber-200'
      : proactiveSummary?.severity === 'medium'
        ? 'border-yellow-800 bg-yellow-950/30 text-yellow-200'
        : 'border-emerald-800 bg-emerald-950/20 text-emerald-200';

  return (
    <AdminShell active="dashboard" title="NexCard Control Center" subtitle="Conversión, perfiles, pedidos y salud operativa desde un solo panel">
      {proactiveSummary && (
        <div className="mb-6">
          <div className={`rounded-xl border px-5 py-4 ${proactiveTone}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <BellRing size={16} className="shrink-0" />
                  <p className="text-xs uppercase tracking-widest font-bold opacity-80">Prioridad operativa ahora</p>
                </div>
                <p className="font-bold text-base">{proactiveSummary.headline}</p>
                <p className="text-sm mt-1 opacity-90">
                  {proactiveSummary.count > 0 ? `${proactiveSummary.count} caso(s) prioritarios.` : 'Sin casos prioritarios.'} {proactiveSummary.action}
                </p>
                {proactiveSummary.secondary_count > 0 && (
                  <p className="text-xs mt-2 opacity-80">Además hay {proactiveSummary.secondary_count} caso(s) más en cola secundaria.</p>
                )}
              </div>
              <a href="/admin/orders" className="text-xs font-bold underline underline-offset-2 shrink-0">Ir a órdenes</a>
            </div>
          </div>
        </div>
      )}

      {!lowStockDismissed && lowStockItems.length > 0 && (
        <div className="mb-6">
          <div className="flex items-start gap-3 rounded-xl border border-amber-800 bg-amber-950/40 px-5 py-4">
            <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-amber-300 text-sm">
                Stock bajo en {lowStockItems.length} {lowStockItems.length === 1 ? 'producto' : 'productos'}:{' '}
                <span className="font-medium">{lowStockItems.map(i => i.item || i.name || i.sku).join(', ')}</span>
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <a href="/admin/inventory" className="text-xs font-bold text-amber-400 underline underline-offset-2 hover:text-amber-200">Ver inventario</a>
              <button type="button" onClick={() => setLowStockDismissed(true)} className="text-amber-500 hover:text-amber-300 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Búsqueda global */}
      <div className="relative mb-8">
        <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
          <Search size={18} className="text-zinc-500 shrink-0" />
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => {
              setGlobalSearch(e.target.value);
              handleGlobalSearch(e.target.value);
            }}
            placeholder="Buscar órdenes, clientes, perfiles..."
            className="flex-1 outline-none text-sm font-medium text-zinc-300 placeholder-zinc-500 bg-transparent"
          />
          {searching && <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0" />}
          {globalSearch && !searching && (
            <button onClick={() => { setGlobalSearch(''); setGlobalResults(null); }} className="text-zinc-500 hover:text-zinc-300">✕</button>
          )}
        </div>

        {globalResults && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden">
            {globalResults.orders.length === 0 && globalResults.profiles.length === 0 ? (
              <div className="px-5 py-4 text-sm text-zinc-400 font-medium">Sin resultados para "{globalSearch}"</div>
            ) : (
              <>
                {globalResults.orders.length > 0 && (
                  <div>
                    <p className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 bg-zinc-800/50">Órdenes</p>
                    {globalResults.orders.map(o => (
                      <a key={o.id} href="/admin/orders" className="flex items-center justify-between px-5 py-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0">
                        <div>
                          <p className="font-bold text-sm text-white">{o.customer_name || 'Sin nombre'}</p>
                          <p className="text-xs text-zinc-400">{o.customer_email}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm text-white">{new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(o.amount_cents || 0)}</p>
                          <AdminBadge variant={o.payment_status === 'paid' ? 'success' : 'warning'}>{o.payment_status}</AdminBadge>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
                {globalResults.profiles.length > 0 && (
                  <div>
                    <p className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 bg-zinc-800/50">Perfiles</p>
                    {globalResults.profiles.map(p => (
                      <a key={p.id} href={`/${p.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: p.color || '#10B981' }}>
                          {p.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-white">{p.name}</p>
                          <p className="text-xs text-zinc-400">/{p.slug}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
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

      {/* Gráfico ventas por día */}
      <AdminCard className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold text-lg text-white">Ventas últimos 7 días</h2>
            <p className="text-sm text-zinc-400 font-medium">Ingresos diarios en CLP</p>
          </div>
          <BarChart2 size={20} className="text-emerald-500" />
        </div>
        <SalesChart orders={recentOrders} />
      </AdminCard>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {funnelStats.map((stat) => (
          <AdminStat key={stat.label} label={stat.label} value={stat.value} accent={stat.accent} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {stageSlaStats.map((stat) => (
          <AdminStat key={stat.key} label={stat.label} value={stat.value} hint={stat.hint} accent={stat.accent} />
        ))}
      </div>

      <AdminCard className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold text-lg text-white">Tendencia semanal del embudo</h2>
            <p className="text-sm text-zinc-400 font-medium">Volumen diario por etapa para detectar cuellos persistentes</p>
          </div>
          <TrendingUp size={20} className="text-fuchsia-400" />
        </div>
        <FunnelTrendChart data={weeklyFunnelTrend.length ? weeklyFunnelTrend : [{ label: 'Sin data', paid: 0, ready: 0, shipped: 0, delivered: 0, activated: 0 }]} />
      </AdminCard>

      {/* Métricas conversión */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <AdminStat
          label="Total órdenes"
          value={statsSource.totalOrders || 0}
        />
        <AdminStat
          label="Tasa de pago"
          value={`${statsSource.totalOrders > 0
            ? Math.round(((statsSource.paidOrders || 0) / statsSource.totalOrders) * 100)
            : 0}%`}
          accent="emerald"
        />
        <AdminStat
          label="Ticket promedio"
          value={statsSource.totalOrders > 0
            ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format((statsSource.totalRevenue || 0) / statsSource.totalOrders)
            : '$0'}
          accent="amber"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <AdminCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-lg text-white">Alertas operativas</h2>
              <p className="text-sm text-zinc-400 font-medium">Órdenes grises detectadas por la nueva observabilidad</p>
            </div>
            <AdminBadge variant={operationalAlerts.length > 0 ? 'warning' : 'success'}>
              {statsSource.operationalAlertsCount || 0}
            </AdminBadge>
          </div>
          <div className="space-y-3">
            {operationalAlerts.length === 0 ? (
              <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 text-sm font-medium text-zinc-400">Sin excepciones visibles en este momento.</div>
            ) : operationalAlerts.map((order) => (
              <a key={order.id} href="/admin/orders" className="block rounded-xl bg-zinc-800 border border-zinc-700 p-4 hover:bg-zinc-700/60 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm text-white">{order.customer_name || 'Sin nombre'}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{order.id}</p>
                  </div>
                  <Siren size={16} className="text-amber-400 shrink-0" />
                </div>
                <p className="text-xs text-amber-300 font-semibold mt-3">{order.alerts?.[0]}</p>
              </a>
            ))}
          </div>
        </AdminCard>

        <AdminCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-lg text-white">SLA en riesgo</h2>
              <p className="text-sm text-zinc-400 font-medium">Pagadas hace 24h+ sin activación cerrada</p>
            </div>
            <AdminBadge variant={slaBreaches.length > 0 ? 'danger' : 'success'}>
              {statsSource.slaBreachesCount || 0}
            </AdminBadge>
          </div>
          <div className="space-y-3">
            {slaBreaches.length === 0 ? (
              <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 text-sm font-medium text-zinc-400">Sin brechas SLA detectadas.</div>
            ) : slaBreaches.map((order) => (
              <a key={order.id} href="/admin/orders" className="block rounded-xl bg-zinc-800 border border-zinc-700 p-4 hover:bg-zinc-700/60 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm text-white">{order.customer_name || 'Sin nombre'}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{order.id}</p>
                  </div>
                  <ShieldAlert size={16} className="text-red-400 shrink-0" />
                </div>
                <p className="text-xs text-red-300 font-semibold mt-3">{order.age_hours}h desde pago · estado {order.fulfillment_status}</p>
              </a>
            ))}
          </div>
        </AdminCard>
      </div>

      <AdminCard className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-lg text-white">Cola proactiva sugerida</h2>
            <p className="text-sm text-zinc-400 font-medium">Orden de ataque sugerido según severidad e impacto operativo</p>
          </div>
          <BellRing size={20} className="text-amber-400" />
        </div>
        <div className="space-y-3">
          {proactiveQueue.length === 0 ? (
            <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 text-sm font-medium text-zinc-400">Sin cola prioritaria. La operación está limpia.</div>
          ) : proactiveQueue.map((item, index) => (
            <div key={item.key} className="rounded-xl bg-zinc-800 border border-zinc-700 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Prioridad #{index + 1}</p>
                  <p className="font-bold text-sm text-white mt-1">{item.title}</p>
                  <p className="text-xs text-zinc-400 mt-2">{item.action}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-lg text-white">{item.count}</p>
                  <AdminBadge variant={item.severity === 'critical' ? 'danger' : item.severity === 'high' ? 'warning' : item.severity === 'medium' ? 'info' : 'default'}>
                    {item.severity}
                  </AdminBadge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </AdminCard>

      <AdminCard className="mb-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h2 className="font-bold text-lg text-white">Resumen ejecutivo listo para enviar</h2>
            <p className="text-sm text-zinc-400 font-medium">Digest reutilizable para cron, WhatsApp, mail o alerta externa</p>
          </div>
          <button
            type="button"
            onClick={handleCopyDigest}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <Copy size={14} />
            {digestCopied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 overflow-x-auto">
          <pre className="whitespace-pre-wrap text-xs leading-6 text-zinc-300 font-mono">{operationalDigest?.text || 'Sin digest disponible.'}</pre>
        </div>
      </AdminCard>

      <div className="grid lg:grid-cols-[1.6fr,1fr] gap-6">
        {/* Tabla perfiles */}
        <AdminCard className="!p-0 overflow-hidden" data-cy="admin-inventory">
          <div className="p-5 border-b border-zinc-800 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-bold text-lg text-white">Perfiles y rendimiento</h2>
              <p className="text-sm text-zinc-400 font-medium">Base preparada para personas, pymes y cuentas empresa</p>
            </div>
            <input
              type="text"
              placeholder="Filtrar por nombre..."
              className="w-full md:w-72 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto" data-cy="admin-users-table">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800/50 border-b border-zinc-800">
                <tr className="text-xs uppercase tracking-wide text-zinc-500">
                  <TH>Usuario</TH>
                  <TH className="text-center">Taps</TH>
                  <TH className="text-center">WhatsApp</TH>
                  <TH className="text-center">vCard</TH>
                  <TH className="text-center">Tipo</TH>
                  <TH className="text-right">Acciones</TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-800/30 transition-colors group">
                    <TD>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full shadow-inner shrink-0" style={{ backgroundColor: user.color }}></div>
                        <div>
                          <span className="font-bold text-sm text-white block">{user.name}</span>
                          <AdminBadge variant={user.status === 'active' ? 'success' : 'default'}>{user.status}</AdminBadge>
                        </div>
                      </div>
                    </TD>
                    <TD className="text-center font-bold text-white">{user.taps}</TD>
                    <TD className="text-center text-zinc-300">{user.wa_clicks}</TD>
                    <TD className="text-center text-zinc-300">{user.vcard_clicks}</TD>
                    <TD className="text-center">
                      <AdminBadge>{user.account_type}</AdminBadge>
                    </TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a
                          href={`/${user.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 hover:bg-zinc-700 rounded-lg transition-all text-zinc-400 hover:text-emerald-400"
                          title="Ver Perfil"
                        >
                          <Eye size={18} />
                        </a>
                        <button
                          onClick={() => generateQRCode(user.slug, { color: user.color })}
                          className="p-2 hover:bg-zinc-700 rounded-lg transition-all text-zinc-400 hover:text-blue-400"
                          title="Descargar QR"
                        >
                          <QrCode size={18} />
                        </button>
                      </div>
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>

        <div className="space-y-6">
          {/* Últimos pedidos */}
          <AdminCard>
            <h3 className="font-bold text-lg text-white mb-4">Últimos pedidos</h3>
            <div className="space-y-3">
              {recentOrders.map(order => (
                <div key={order.id} className="p-4 rounded-xl bg-zinc-800 border border-zinc-700">
                  <div className="flex justify-between gap-4 items-start">
                    <div>
                      <p className="font-bold text-sm text-white">{order.customer_name}</p>
                      <p className="text-xs text-zinc-400 font-medium mt-0.5">{order.payment_method} · {order.payment_status}</p>
                    </div>
                    <span className="text-sm font-bold text-white shrink-0">{order.amount_cents ? Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(order.amount_cents || 0) : '-'}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{order.id}</span>
                    <AdminBadge variant={
                      order.fulfillment_status === 'delivered' ? 'success' :
                      order.fulfillment_status === 'shipped' ? 'info' :
                      order.fulfillment_status === 'in_production' ? 'info' :
                      order.fulfillment_status === 'cancelled' ? 'danger' : 'warning'
                    }>{order.fulfillment_status}</AdminBadge>
                  </div>
                </div>
              ))}
            </div>
          </AdminCard>

          <AdminCard className="bg-zinc-900">
            <p className="text-xs uppercase tracking-widest font-bold text-zinc-500 mb-3">Diagnóstico</p>
            <p className="text-sm font-medium leading-relaxed text-zinc-300">
              Base lista para migrar admin e integraciones de pago. Siguiente cuello de botella: auth/roles efectivos, CMS admin y órdenes conectadas a producción.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4 text-sm font-bold">
              <div className="bg-white/5 rounded-xl p-4">
                <MousePointer2 className="mb-2 text-emerald-400" size={18} />
                <span className="text-zinc-300">Más control del funnel</span>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <TrendingUp className="mb-2 text-blue-400" size={18} />
                <span className="text-zinc-300">Escala sin rehacer panel</span>
              </div>
            </div>
          </AdminCard>
        </div>
      </div>
    </AdminShell>
  );
};

export default AdminDashboard;
