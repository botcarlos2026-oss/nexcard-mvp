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
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { generateQRCode } from '../utils/qrEngine';
import { api } from '../services/api';
import AdminShell from './AdminShell';
import AdminCard from './ui/AdminCard';
import AdminStat from './ui/AdminStat';
import { TH, TD } from './ui/AdminTable';
import AdminBadge from './ui/AdminBadge';

const SalesChart = ({ orders }) => {
  const days = useMemo(() => orders || [], [orders]);

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
  const [dashboardState, setDashboardState] = useState(dashboard);
  const [searchTerm, setSearchTerm] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalResults, setGlobalResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [lowStockDismissed, setLowStockDismissed] = useState(false);
  const [digestCopied, setDigestCopied] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState('');
  const [quickActionBusyId, setQuickActionBusyId] = useState('');
  const [quickActionMessage, setQuickActionMessage] = useState({ type: '', text: '' });
  const [kpiConfigForm, setKpiConfigForm] = useState({
    sla_targets: { paid_to_ready: 24, ready_to_shipped: 24, shipped_to_delivered: 72, delivered_to_activated: 24 },
    payment_method_fees: { webpay: 0.0295, transbank: 0.0295, mercado_pago: 0.0349, 'mercado-pago': 0.0349, default: 0 },
    wow_alert_thresholds: { revenue_drop_pct: -20, payment_rate_drop_pts: -8, carrier_delivery_rate_drop_pts: -10, sku_claim_rate_pct: 8 },
    executive_alert_policy: { enabled: 1, cooldown_minutes: 180, dedupe_by_band: 1, min_band_watch: 1, min_band_critical: 1 },
  });
  const [kpiConfigBusy, setKpiConfigBusy] = useState('');
  const [kpiConfigMessage, setKpiConfigMessage] = useState({ type: '', text: '' });
  const [kpiAuditEntries, setKpiAuditEntries] = useState([]);
  const [alertStateBusy, setAlertStateBusy] = useState(false);

  useEffect(() => {
    setDashboardState(dashboard);
  }, [dashboard]);

  useEffect(() => {
    api.checkLowStock().then(({ lowStockItems: items }) => setLowStockItems(items)).catch(() => {});
  }, []);

  useEffect(() => {
    api.getKpiRuntimeConfig().then(({ configs }) => {
      if (!configs?.length) return;
      setKpiConfigForm((prev) => {
        const next = { ...prev };
        configs.forEach((row) => {
          if (row?.key) next[row.key] = row.config || {};
        });
        return next;
      });
    }).catch(() => {});
    api.getKpiRuntimeConfigAudit().then(({ entries }) => setKpiAuditEntries(entries || [])).catch(() => {});
  }, []);

  const users = dashboardState?.users || [];
  const statsSource = useMemo(() => dashboardState?.stats || {}, [dashboardState]);
  const recentOrders = dashboardState?.recentOrders || [];
  const salesTrend7d = dashboardState?.salesTrend7d || [];
  const operationalAlerts = dashboardState?.operationalAlerts || [];
  const slaBreaches = dashboardState?.slaBreaches || [];
  const weeklyFunnelTrend = dashboardState?.weeklyFunnelTrend || [];
  const proactiveSummary = dashboardState?.proactiveSummary || null;
  const proactiveQueue = dashboardState?.proactiveQueue || [];
  const topManualOverrideQueue = dashboardState?.topManualOverrideQueue || [];
  const operationalDigest = dashboardState?.operationalDigest || null;
  const excludedOperationalOrdersCount = dashboardState?.stats?.excludedOperationalOrdersCount || 0;
  const manualOverrideQaOrdersCount = dashboardState?.stats?.manualOverrideQaOrdersCount || 0;
  const manualOverrideQaReviewedCount = dashboardState?.stats?.manualOverrideQaReviewedCount || 0;
  const manualOverrideQaBlockedCount = dashboardState?.stats?.manualOverrideQaBlockedCount || 0;
  const manualOverrideRealOrdersCount = dashboardState?.stats?.manualOverrideRealOrdersCount || 0;
  const manualOverrideQaAging = useMemo(() => dashboardState?.stats?.manualOverrideQaAging || { fresh: 0, over24h: 0, over72h: 0 }, [dashboardState]);
  const manualOverrideQaSeverity = useMemo(() => dashboardState?.stats?.manualOverrideQaSeverity || { low: 0, medium: 0, high: 0, critical: 0, total: 0, maxScore: 0 }, [dashboardState]);
  const manualOverrideQaSla = useMemo(() => dashboardState?.stats?.manualOverrideQaSla || { open_avg_hours: null, open_sample_size: 0, review_avg_hours: null, review_sample_size: 0, resolution_avg_hours: null, resolution_sample_size: 0 }, [dashboardState]);
  const deliveryFormats = dashboardState?.deliveryFormats || {};
  const transportReadiness = dashboardState?.transportReadiness || null;
  const executiveAlertState = transportReadiness?.executive_alert_state || null;

  const reloadDashboard = async () => {
    const refreshed = await api.getAdminDashboard();
    setDashboardState(refreshed);
    api.getKpiRuntimeConfigAudit().then(({ entries }) => setKpiAuditEntries(entries || [])).catch(() => {});
  };

  const runQuickAction = async (orderId, action) => {
    setQuickActionBusyId(orderId);
    setQuickActionMessage({ type: '', text: '' });
    try {
      await action();
      await reloadDashboard();
    } catch (error) {
      setQuickActionMessage({ type: 'error', text: error.message || 'No fue posible ejecutar la acción rápida.' });
    } finally {
      setQuickActionBusyId('');
    }
  };

  const handleKeepQa = async (order) => runQuickAction(order.id, async () => {
    await api.reviewOrderTestClassification(order.id, { review_note: 'Se mantiene QA tras revisión rápida desde dashboard.' });
    setQuickActionMessage({ type: 'success', text: `Orden ${order.id} mantenida en QA y marcada como revisada.` });
  });

  const handleMarkReviewed = async (order) => runQuickAction(order.id, async () => {
    await api.reviewOrderTestClassification(order.id, { review_note: 'Revisión rápida registrada desde dashboard.' });
    setQuickActionMessage({ type: 'success', text: `Orden ${order.id} marcada como revisada.` });
  });

  const handleRestoreReal = async (order) => runQuickAction(order.id, async () => {
    await api.overrideOrderTestClassification(order.id, { is_test: false, test_reason: '' });
    setQuickActionMessage({ type: 'success', text: `Orden ${order.id} restaurada como operativa real.` });
  });

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
    {
      label: 'Ingresos cobrados reales',
      value: new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(statsSource.operationalRevenue || 0),
      accent: 'emerald',
      hint: statsSource.qaRevenue > 0 ? `QA/interno excluido: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(statsSource.qaRevenue || 0)}` : 'Sin revenue QA excluido',
    },
    {
      label: 'Perfiles activos',
      value: `${statsSource.totalProfiles || 0}`,
      accent: null,
      hint: statsSource.qaOrders > 0 ? `${statsSource.qaOrders} orden(es) QA/interna(s) fuera del KPI` : null,
    },
    {
      label: 'Pedidos abiertos reales',
      value: `${statsSource.operationalPendingOrders || 0}`,
      accent: 'amber',
      hint: statsSource.pendingOrders > statsSource.operationalPendingOrders ? `${statsSource.pendingOrders - statsSource.operationalPendingOrders} abiertos QA/internos excluidos` : null,
    },
    {
      label: 'Overrides manuales QA',
      value: `${manualOverrideQaOrdersCount}`,
      accent: manualOverrideQaOrdersCount > 0 ? 'red' : null,
      hint: manualOverrideQaAging.over72h > 0
        ? `${manualOverrideQaAging.over72h} con aging >72h`
        : manualOverrideQaAging.over24h > 0
          ? `${manualOverrideQaAging.over24h} con aging >24h`
          : manualOverrideQaBlockedCount > 0
            ? `${manualOverrideQaBlockedCount} pagada(s) y bloqueada(s)`
          : manualOverrideQaReviewedCount > 0
            ? `${manualOverrideQaReviewedCount} ya revisada(s)`
            : manualOverrideRealOrdersCount > 0
              ? `${manualOverrideRealOrdersCount} restore(s) manual(es) a orden real`
              : (manualOverrideQaOrdersCount > 0 ? 'Revisar cola manual en QA' : 'Sin correcciones manuales abiertas'),
      href: '/admin/orders/qa?audit=excluded&test_reason=manual_override_only&review_status=pending',
    },
  ]), [statsSource, manualOverrideQaOrdersCount, manualOverrideQaReviewedCount, manualOverrideQaBlockedCount, manualOverrideRealOrdersCount, manualOverrideQaAging]);

  const funnelStats = useMemo(() => {
    const funnel = statsSource.operationalFunnel || { paid: 0, ready: 0, shipped: 0, delivered: 0, activated: 0 };
    const qaFunnel = statsSource.qaFunnel || { paid: 0, ready: 0, shipped: 0, delivered: 0, activated: 0 };
    return [
      { label: 'Paid', value: funnel.paid || 0, accent: 'emerald', hint: qaFunnel.paid > 0 ? `+${qaFunnel.paid} QA` : null },
      { label: 'Ready', value: funnel.ready || 0, accent: 'amber', hint: qaFunnel.ready > 0 ? `+${qaFunnel.ready} QA` : null },
      { label: 'Shipped', value: funnel.shipped || 0, accent: 'blue', hint: qaFunnel.shipped > 0 ? `+${qaFunnel.shipped} QA` : null },
      { label: 'Delivered', value: funnel.delivered || 0, accent: 'emerald', hint: qaFunnel.delivered > 0 ? `+${qaFunnel.delivered} QA` : null },
      { label: 'Activated', value: funnel.activated || 0, accent: 'emerald', hint: qaFunnel.activated > 0 ? `+${qaFunnel.activated} QA` : null },
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
        hint: value?.sample_size ? `p50 ${value.p50_hours ?? '—'}h · p90 ${value.p90_hours ?? '—'}h · breach ${value.breach_rate ?? 0}%` : 'Sin muestra cerrada',
      };
    });
  }, [statsSource]);

  const conversionCards = useMemo(() => {
    const conversions = statsSource.conversionStats || {};
    return [
      { key: 'paid_to_ready', label: 'Paid → Ready', accent: 'amber' },
      { key: 'ready_to_shipped', label: 'Ready → Shipped', accent: 'blue' },
      { key: 'shipped_to_delivered', label: 'Shipped → Delivered', accent: 'emerald' },
      { key: 'delivered_to_activated', label: 'Delivered → Activated', accent: 'fuchsia' },
    ].map((item) => ({
      ...item,
      value: conversions[item.key] != null ? `${conversions[item.key]}%` : '—',
    }));
  }, [statsSource]);

  const kpiComparisons = useMemo(() => statsSource.kpiComparisons || {}, [statsSource]);
  const paymentMethodStats = useMemo(() => statsSource.paymentMethodStats || [], [statsSource]);
  const carrierStats = useMemo(() => statsSource.carrierStats || [], [statsSource]);
  const productStats = useMemo(() => statsSource.productStats || [], [statsSource]);
  const slaTargets = useMemo(() => statsSource.slaTargets || {}, [statsSource]);
  const wowAlerts = useMemo(() => statsSource.wowAlerts || [], [statsSource]);
  const executiveScore = useMemo(() => statsSource.executiveScore || null, [statsSource]);
  const runtimeConfigLoaded = useMemo(() => !!statsSource.runtimeConfigLoaded, [statsSource]);

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
  const handleCopyFormat = async (key, value) => {
    if (!value || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedFormat(key);
      window.setTimeout(() => setCopiedFormat(''), 1800);
    } catch {
      setCopiedFormat('');
    }
  };
  const handleSaveKpiConfig = async (key) => {
    setKpiConfigBusy(key);
    setKpiConfigMessage({ type: '', text: '' });
    try {
      await api.upsertKpiRuntimeConfig({ key, config: kpiConfigForm[key] || {}, active: true });
      await reloadDashboard();
      setKpiConfigMessage({ type: 'success', text: `Config KPI ${key} guardada.` });
    } catch (error) {
      setKpiConfigMessage({ type: 'error', text: error.message || `No pude guardar ${key}.` });
    } finally {
      setKpiConfigBusy('');
    }
  };
  const updateKpiConfigField = (groupKey, fieldKey, value) => {
    setKpiConfigForm((prev) => ({
      ...prev,
      [groupKey]: {
        ...(prev[groupKey] || {}),
        [fieldKey]: value,
      },
    }));
  };
  const handleMarkExecutiveAlertSent = async () => {
    if (!transportReadiness?.executive_alert_payload) return;
    setAlertStateBusy(true);
    setKpiConfigMessage({ type: '', text: '' });
    try {
      await api.upsertKpiAlertState({
        alert_key: 'executive_score',
        last_band: transportReadiness.executive_alert_payload.band,
        last_score: transportReadiness.executive_alert_payload.score,
        last_payload: transportReadiness.executive_alert_payload,
        cooldown_minutes: executiveAlertState?.cooldown_minutes || 0,
      });
      await reloadDashboard();
      setKpiConfigMessage({ type: 'success', text: 'Estado de alerta ejecutiva actualizado (dry-run).' });
    } catch (error) {
      setKpiConfigMessage({ type: 'error', text: error.message || 'No pude persistir el estado de alerta.' });
    } finally {
      setAlertStateBusy(false);
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
                {excludedOperationalOrdersCount > 0 && (
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    <AdminBadge variant="info">{excludedOperationalOrdersCount} orden(es) QA/interna(s) excluidas del resumen operativo</AdminBadge>
                    {manualOverrideQaOrdersCount > 0 && (
                      <AdminBadge variant="danger">{manualOverrideQaOrdersCount} override(s) manual(es) QA pendientes de revisión</AdminBadge>
                    )}
                    {manualOverrideQaReviewedCount > 0 && (
                      <AdminBadge variant="success">{manualOverrideQaReviewedCount} override(s) QA ya revisada(s)</AdminBadge>
                    )}
                    {manualOverrideQaSeverity.critical > 0 && (
                      <AdminBadge variant="danger">{manualOverrideQaSeverity.critical} crítica(s)</AdminBadge>
                    )}
                    {manualOverrideQaSeverity.high > 0 && (
                      <AdminBadge variant="warning">{manualOverrideQaSeverity.high} high</AdminBadge>
                    )}
                    {manualOverrideQaAging.over72h > 0 && (
                      <AdminBadge variant="danger">{manualOverrideQaAging.over72h} override(s) manual(es) con aging &gt;72h</AdminBadge>
                    )}
                    {manualOverrideQaAging.over24h > 0 && manualOverrideQaAging.over72h === 0 && (
                      <AdminBadge variant="warning">{manualOverrideQaAging.over24h} override(s) manual(es) con aging &gt;24h</AdminBadge>
                    )}
                    <a href="/admin/orders/qa" className="text-xs font-bold underline underline-offset-2 opacity-90 hover:opacity-100">Abrir vista QA</a>
                    {manualOverrideQaOrdersCount > 0 && (
                      <a href="/admin/orders/qa?audit=excluded&test_reason=manual_override_only&review_status=pending" className="text-xs font-bold underline underline-offset-2 opacity-90 hover:opacity-100">Ver overrides pendientes</a>
                    )}
                    {manualOverrideQaAging.over24h > 0 && (
                      <a href="/admin/orders/qa?audit=excluded&test_reason=manual_override_only&override_age=24h&review_status=pending" className="text-xs font-bold underline underline-offset-2 opacity-90 hover:opacity-100">Ver aging &gt;24h</a>
                    )}
                    {manualOverrideQaAging.over72h > 0 && (
                      <a href="/admin/orders/qa?audit=excluded&test_reason=manual_override_only&override_age=72h&review_status=pending" className="text-xs font-bold underline underline-offset-2 opacity-90 hover:opacity-100">Ver aging &gt;72h</a>
                    )}
                  </div>
                )}
              </div>
              <a href="/admin/orders" className="text-xs font-bold underline underline-offset-2 shrink-0">Ir a órdenes</a>
            </div>
          </div>
        </div>
      )}

      {executiveScore && (
        <div className="mb-6">
          <div className={`rounded-xl border px-5 py-4 ${executiveScore.band === 'critical' ? 'border-red-800 bg-red-950/25' : executiveScore.band === 'watch' ? 'border-amber-800 bg-amber-950/25' : 'border-emerald-800 bg-emerald-950/20'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest font-bold text-zinc-400">Executive score</p>
                <p className="mt-1 text-3xl font-bold text-white">{executiveScore.score}</p>
                <p className="text-sm text-zinc-300 mt-1">Banda: {executiveScore.band}. {runtimeConfigLoaded ? 'Usando parámetros persistidos + fallback seguro.' : 'Usando fallback seguro en código hasta activar config persistente.'}</p>
                {executiveScore.reasons?.length ? <p className="text-xs text-zinc-400 mt-2">Drivers: {executiveScore.reasons.join(' · ')}</p> : null}
              </div>
              <AdminBadge variant={executiveScore.band === 'critical' ? 'danger' : executiveScore.band === 'watch' ? 'warning' : 'success'}>
                {executiveScore.band}
              </AdminBadge>
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
                <div
                  key={order.id}
                  className="rounded-xl bg-zinc-800 border border-zinc-700 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm text-white">{order.customer_name}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{order.folio || order.id}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <AdminBadge variant={order.severity === 'critical' ? 'danger' : order.severity === 'high' ? 'warning' : 'default'}>
                        {order.severity}
                      </AdminBadge>
                      <AdminBadge variant={order.age_hours >= 72 ? 'danger' : order.age_hours >= 24 ? 'warning' : 'default'}>
                        {order.age_hours}h
                      </AdminBadge>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 mt-3">
                    {order.reasons?.join(' · ') || 'Sin señales adicionales'}
                  </p>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <AdminBadge variant={order.payment_status === 'paid' ? 'success' : 'default'}>{order.payment_status || 'sin pago'}</AdminBadge>
                    <AdminBadge variant="info">{order.fulfillment_status || 'sin fulfillment'}</AdminBadge>
                    <AdminBadge variant={order.activation_completed ? 'success' : 'warning'}>
                      {order.activation_completed ? 'activada' : 'sin activar'}
                    </AdminBadge>
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleKeepQa(order)}
                      disabled={quickActionBusyId === order.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-fuchsia-700 px-3 py-2 text-[11px] font-bold text-white hover:bg-fuchsia-600 disabled:opacity-50"
                    >
                      {quickActionBusyId === order.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                      Mantener QA
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarkReviewed(order)}
                      disabled={quickActionBusyId === order.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-sky-700 px-3 py-2 text-[11px] font-bold text-white hover:bg-sky-600 disabled:opacity-50"
                    >
                      {quickActionBusyId === order.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                      Marcar revisada
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestoreReal(order)}
                      disabled={quickActionBusyId === order.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
                    >
                      {quickActionBusyId === order.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                      Restaurar real
                    </button>
                    <a
                      href={`/admin/orders/qa?audit=excluded&test_reason=manual_override_only&review_status=pending${order.age_hours >= 72 ? '&override_age=72h' : order.age_hours >= 24 ? '&override_age=24h' : ''}&order_id=${encodeURIComponent(order.id)}`}
                      className="text-[11px] font-bold text-zinc-300 underline underline-offset-2 hover:text-white"
                    >
                      Abrir detalle
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </AdminCard>
        </div>
      )}

      {/* Gráfico ventas por día */}
      <AdminCard className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold text-lg text-white">Ventas reales últimos 7 días</h2>
            <p className="text-sm text-zinc-400 font-medium">Ingresos diarios en CLP excluyendo QA/interno</p>
          </div>
          <BarChart2 size={20} className="text-emerald-500" />
        </div>
        <SalesChart orders={salesTrend7d} />
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
        <AdminCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-lg text-white">Métodos de pago (30d)</h2>
              <p className="text-sm text-zinc-400 font-medium">Top por revenue neto estimado post-fee</p>
            </div>
          </div>
          <div className="space-y-3">
            {paymentMethodStats.length === 0 ? <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 text-sm text-zinc-400">Sin data suficiente.</div> : paymentMethodStats.map((item) => (
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
            ))}
          </div>
        </AdminCard>

        <AdminCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-lg text-white">Carriers (30d)</h2>
              <p className="text-sm text-zinc-400 font-medium">Volumen despachado y tasa entrega</p>
            </div>
          </div>
          <div className="space-y-3">
            {carrierStats.length === 0 ? <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 text-sm text-zinc-400">Sin data suficiente.</div> : carrierStats.map((item) => (
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
            ))}
          </div>
        </AdminCard>

        <AdminCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-lg text-white">Productos/SKU (30d)</h2>
              <p className="text-sm text-zinc-400 font-medium">Top por revenue operativo</p>
            </div>
          </div>
          <div className="space-y-3">
            {productStats.length === 0 ? <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 text-sm text-zinc-400">Sin data suficiente.</div> : productStats.map((item) => (
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
            ))}
          </div>
        </AdminCard>
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

      <AdminCard className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-lg text-white">Auditoría KPI config</h2>
            <p className="text-sm text-zinc-400 font-medium">Quién cambió qué y cuándo. Sin memoria tribal.</p>
          </div>
          <AdminBadge variant={kpiAuditEntries.length ? 'success' : 'warning'}>
            {kpiAuditEntries.length ? `${kpiAuditEntries.length} evento(s)` : 'sin eventos'}
          </AdminBadge>
        </div>
        <div className="space-y-3">
          {kpiAuditEntries.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">Todavía no hay cambios persistidos en runtime config.</div>
          ) : kpiAuditEntries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <AdminBadge variant={entry.action === 'create' ? 'success' : 'warning'}>{entry.action}</AdminBadge>
                  <span className="text-sm font-bold text-white">{entry.context?.key || 'kpi_runtime_config'}</span>
                </div>
                <span className="text-xs text-zinc-500">{new Date(entry.created_at).toLocaleString('es-CL')}</span>
              </div>
              <p className="text-xs text-zinc-400 mb-2">Actor: {entry.context?.actor_email || 'desconocido'}</p>
              <div className="grid lg:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">Before</p>
                  <pre className="whitespace-pre-wrap text-xs leading-6 text-zinc-300 font-mono">{JSON.stringify(entry.before || {}, null, 2)}</pre>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">After</p>
                  <pre className="whitespace-pre-wrap text-xs leading-6 text-zinc-300 font-mono">{JSON.stringify(entry.after || {}, null, 2)}</pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      </AdminCard>

      <AdminCard className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold text-lg text-white">Tendencia semanal del throughput real</h2>
            <p className="text-sm text-zinc-400 font-medium">Hitos diarios por timestamp de etapa (paid, ready, shipped, delivered, activated) excluyendo QA/interno</p>
          </div>
          <TrendingUp size={20} className="text-fuchsia-400" />
        </div>
        <FunnelTrendChart data={weeklyFunnelTrend.length ? weeklyFunnelTrend : [{ label: 'Sin data', paid: 0, ready: 0, shipped: 0, delivered: 0, activated: 0 }]} />
      </AdminCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <AdminStat
          label="Revenue 7d vs previo"
          value={kpiComparisons.revenue_7d?.delta_pct != null ? `${kpiComparisons.revenue_7d.delta_pct > 0 ? '+' : ''}${kpiComparisons.revenue_7d.delta_pct}%` : '—'}
          accent={kpiComparisons.revenue_7d?.delta_pct >= 0 ? 'emerald' : 'red'}
          hint={kpiComparisons.revenue_7d ? `Actual ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(kpiComparisons.revenue_7d.current || 0)} vs prev ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(kpiComparisons.revenue_7d.previous || 0)}` : null}
        />
        <AdminStat
          label="Paid orders 7d vs previo"
          value={kpiComparisons.paid_orders_7d?.delta_pct != null ? `${kpiComparisons.paid_orders_7d.delta_pct > 0 ? '+' : ''}${kpiComparisons.paid_orders_7d.delta_pct}%` : '—'}
          accent={kpiComparisons.paid_orders_7d?.delta_pct >= 0 ? 'emerald' : 'red'}
          hint={kpiComparisons.paid_orders_7d ? `Actual ${kpiComparisons.paid_orders_7d.current || 0} vs prev ${kpiComparisons.paid_orders_7d.previous || 0}` : null}
        />
        <AdminStat
          label="Tasa pago 7d vs previo"
          value={kpiComparisons.payment_rate_7d?.current != null ? `${kpiComparisons.payment_rate_7d.current}%` : '—'}
          accent={kpiComparisons.payment_rate_7d?.delta_pts >= 0 ? 'emerald' : 'red'}
          hint={kpiComparisons.payment_rate_7d ? `${kpiComparisons.payment_rate_7d.delta_pts > 0 ? '+' : ''}${kpiComparisons.payment_rate_7d.delta_pts || 0} pts vs ${kpiComparisons.payment_rate_7d.previous || 0}%` : null}
        />
      </div>

      <AdminCard className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-lg text-white">Targets SLA activos</h2>
            <p className="text-sm text-zinc-400 font-medium">{runtimeConfigLoaded ? 'Tomados desde config persistente activa (con fallback seguro).' : 'Fallback desde `src/config/admin.js` hasta activar config persistente.'}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AdminStat label="Paid → Ready" value={slaTargets.paid_to_ready != null ? `${slaTargets.paid_to_ready}h` : '—'} accent="amber" />
          <AdminStat label="Ready → Shipped" value={slaTargets.ready_to_shipped != null ? `${slaTargets.ready_to_shipped}h` : '—'} accent="blue" />
          <AdminStat label="Shipped → Delivered" value={slaTargets.shipped_to_delivered != null ? `${slaTargets.shipped_to_delivered}h` : '—'} accent="emerald" />
          <AdminStat label="Delivered → Activated" value={slaTargets.delivered_to_activated != null ? `${slaTargets.delivered_to_activated}h` : '—'} accent="fuchsia" />
        </div>
      </AdminCard>

      <AdminCard className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-lg text-white">KPI runtime config</h2>
            <p className="text-sm text-zinc-400 font-medium">Edita parámetros persistentes con inputs tipados. Menos error humano, más control.</p>
          </div>
          <AdminBadge variant={runtimeConfigLoaded ? 'success' : 'warning'}>
            {runtimeConfigLoaded ? 'runtime activo' : 'solo fallback'}
          </AdminBadge>
        </div>
        {kpiConfigMessage.text ? (
          <div className={`mb-4 rounded-xl border px-3 py-2 text-xs font-semibold ${kpiConfigMessage.type === 'error' ? 'border-red-800 bg-red-950/40 text-red-300' : 'border-emerald-800 bg-emerald-950/40 text-emerald-300'}`}>
            {kpiConfigMessage.text}
          </div>
        ) : null}
        <div className="grid lg:grid-cols-3 gap-4">
          {[
            {
              key: 'sla_targets',
              label: 'SLA targets',
              fields: [
                ['paid_to_ready', 'Paid → Ready', 1],
                ['ready_to_shipped', 'Ready → Shipped', 1],
                ['shipped_to_delivered', 'Shipped → Delivered', 1],
                ['delivered_to_activated', 'Delivered → Activated', 1],
              ],
            },
            {
              key: 'payment_method_fees',
              label: 'Fees por método',
              fields: [
                ['webpay', 'Webpay', 0.0001],
                ['transbank', 'Transbank', 0.0001],
                ['mercado_pago', 'Mercado Pago', 0.0001],
                ['mercado-pago', 'Mercado Pago slug', 0.0001],
                ['default', 'Default', 0.0001],
              ],
            },
            {
              key: 'wow_alert_thresholds',
              label: 'Thresholds WoW',
              fields: [
                ['revenue_drop_pct', 'Revenue drop %', 1],
                ['payment_rate_drop_pts', 'Payment rate pts', 1],
                ['carrier_delivery_rate_drop_pts', 'Carrier pts', 1],
                ['sku_claim_rate_pct', 'Claim rate %', 1],
              ],
            },
            {
              key: 'executive_alert_policy',
              label: 'Policy alertas ejecutivas',
              fields: [
                ['enabled', 'Enabled (1/0)', 1],
                ['cooldown_minutes', 'Cooldown min', 1],
                ['dedupe_by_band', 'Dedupe por banda (1/0)', 1],
                ['min_band_watch', 'Min watch', 1],
                ['min_band_critical', 'Min critical', 1],
              ],
            },
          ].map((item) => (
            <div key={item.key} className="rounded-xl bg-zinc-950 border border-zinc-800 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-sm font-bold text-white">{item.label}</p>
                <button
                  type="button"
                  onClick={() => handleSaveKpiConfig(item.key)}
                  disabled={kpiConfigBusy === item.key}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  {kpiConfigBusy === item.key ? <Loader2 size={14} className="animate-spin" /> : null}
                  Guardar
                </button>
              </div>
              <div className="space-y-3">
                {item.fields.map(([fieldKey, fieldLabel, step]) => (
                  <label key={fieldKey} className="block">
                    <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-zinc-500">{fieldLabel}</span>
                    <input
                      type="number"
                      step={step}
                      value={kpiConfigForm[item.key]?.[fieldKey] ?? 0}
                      onChange={(e) => updateKpiConfigField(item.key, fieldKey, Number(e.target.value))}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-600"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </AdminCard>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {conversionCards.map((stat) => (
          <AdminStat key={stat.key} label={stat.label} value={stat.value} accent={stat.accent} />
        ))}
      </div>

      {/* Métricas conversión */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <AdminStat
          label="Total órdenes reales"
          value={statsSource.operationalOrders || 0}
          hint={statsSource.qaOrders > 0 ? `QA/internas: ${statsSource.qaOrders}` : null}
        />
        <AdminStat
          label="Tasa de pago real"
          value={`${statsSource.operationalOrders > 0
            ? Math.round(((statsSource.operationalPaidOrders || 0) / statsSource.operationalOrders) * 100)
            : 0}%`}
          accent="emerald"
          hint={statsSource.totalOrders > statsSource.operationalOrders ? `Base total: ${statsSource.totalOrders}` : null}
        />
        <AdminStat
          label="Ticket promedio real"
          value={statsSource.operationalPaidOrders > 0
            ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format((statsSource.operationalRevenue || 0) / statsSource.operationalPaidOrders)
            : '$0'}
          accent="amber"
          hint={statsSource.qaRevenue > 0 ? `Revenue QA excluido: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(statsSource.qaRevenue || 0)}` : null}
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

      <AdminCard className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-lg text-white">Formatos listos por canal</h2>
            <p className="text-sm text-zinc-400 font-medium">Payloads reutilizables para conectar delivery sin rehacer contenido</p>
          </div>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          {[
            { key: 'short_text', label: 'Resumen corto' },
            { key: 'whatsapp_text', label: 'WhatsApp' },
            { key: 'email_subject', label: 'Email subject' },
            { key: 'email_body', label: 'Email body' },
          ].map((item) => (
            <div key={item.key} className="rounded-xl bg-zinc-950 border border-zinc-800 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-sm font-bold text-white">{item.label}</p>
                <button
                  type="button"
                  onClick={() => handleCopyFormat(item.key, deliveryFormats[item.key])}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  <Copy size={14} />
                  {copiedFormat === item.key ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-xs leading-6 text-zinc-300 font-mono">{deliveryFormats[item.key] || 'No disponible.'}</pre>
            </div>
          ))}
        </div>
      </AdminCard>

      <AdminCard className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-lg text-white">Transporte automático preparado</h2>
            <p className="text-sm text-zinc-400 font-medium">Dry-run listo para cron o webhook, sin salida real por defecto</p>
          </div>
          <AdminBadge variant={transportReadiness?.mode === 'dry_run_only' ? 'warning' : 'success'}>
            {transportReadiness?.mode || 'n/a'}
          </AdminBadge>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4">
            <p className="text-sm font-bold text-white mb-2">Recomendación de disparo</p>
            <p className="text-xs text-zinc-300">Trigger: {transportReadiness?.recommended_trigger || 'n/a'}</p>
            <p className="text-xs text-zinc-300 mt-1">Frecuencia: {transportReadiness?.recommended_frequency || 'n/a'}</p>
          </div>
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4">
            <p className="text-sm font-bold text-white mb-2">Checklist</p>
            <ul className="space-y-1 text-xs text-zinc-300 list-disc pl-4">
              {(transportReadiness?.checklist || []).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm font-bold text-white">Cron payload</p>
              <button
                type="button"
                onClick={() => handleCopyFormat('cron_payload', JSON.stringify(transportReadiness?.cron_payload || {}, null, 2))}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <Copy size={14} />
                {copiedFormat === 'cron_payload' ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-xs leading-6 text-zinc-300 font-mono">{JSON.stringify(transportReadiness?.cron_payload || {}, null, 2)}</pre>
          </div>
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm font-bold text-white">Webhook payload</p>
              <button
                type="button"
                onClick={() => handleCopyFormat('webhook_payload', JSON.stringify(transportReadiness?.webhook_payload || {}, null, 2))}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <Copy size={14} />
                {copiedFormat === 'webhook_payload' ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-xs leading-6 text-zinc-300 font-mono">{JSON.stringify(transportReadiness?.webhook_payload || {}, null, 2)}</pre>
          </div>
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm font-bold text-white">Executive alert payload</p>
              <button
                type="button"
                onClick={() => handleCopyFormat('executive_alert_payload', JSON.stringify(transportReadiness?.executive_alert_payload || {}, null, 2))}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <Copy size={14} />
                {copiedFormat === 'executive_alert_payload' ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-xs leading-6 text-zinc-300 font-mono">{JSON.stringify(transportReadiness?.executive_alert_payload || {}, null, 2)}</pre>
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Estado dedupe/cooldown</p>
              <div className="space-y-1 text-xs text-zinc-300">
                <p>Should send: {executiveAlertState?.should_send ? 'sí' : 'no'}</p>
                <p>Cooldown: {executiveAlertState?.cooldown_minutes ?? 'n/a'} min</p>
                <p>Last band: {executiveAlertState?.last_band || '—'}</p>
                <p>Last sent: {executiveAlertState?.last_sent_at ? new Date(executiveAlertState.last_sent_at).toLocaleString('es-CL') : '—'}</p>
                <p>Blocked: {executiveAlertState?.blocked_reason || '—'}</p>
              </div>
              <button
                type="button"
                onClick={handleMarkExecutiveAlertSent}
                disabled={alertStateBusy}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                {alertStateBusy ? <Loader2 size={14} className="animate-spin" /> : null}
                Marcar enviado (dry-run)
              </button>
            </div>
          </div>
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
            <h3 className="font-bold text-lg text-white mb-4">Últimos pedidos reales</h3>
            <div className="space-y-3">
              {recentOrders.length === 0 ? (
                <div className="p-4 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-400 font-medium">
                  Sin pedidos reales todavía. El panel está mostrando solo operación no-QA.
                </div>
              ) : recentOrders.map(order => (
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
