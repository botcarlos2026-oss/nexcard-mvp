import React, { useMemo, useState, useEffect } from 'react';
import {
  Search,
  AlertTriangle,
  X,
  BellRing,
} from 'lucide-react';
import { api } from '../services/api';
import AdminShell from './AdminShell';
import AdminBadge from './ui/AdminBadge';
import AdminDashboardOverviewSection from './admin/AdminDashboardOverviewSection';
import AdminDashboardAlertingSection from './admin/AdminDashboardAlertingSection';
import AdminDashboardProfilesSection from './admin/AdminDashboardProfilesSection';

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
    executive_alert_routing: { enabled: 1, auto_dispatch: 0, dry_run_default: 1, recipients_csv: 'carlos.alvarez.contreras@gmail.com,bot.carlos.2026@gmail.com' },
    executive_alert_band_policy: { kill_switch: 0, watch_cooldown_minutes: 180, critical_cooldown_minutes: 60, watch_recipients_csv: 'bot.carlos.2026@gmail.com', critical_recipients_csv: 'carlos.alvarez.contreras@gmail.com,bot.carlos.2026@gmail.com' },
  });
  const [kpiConfigBusy, setKpiConfigBusy] = useState('');
  const [kpiConfigMessage, setKpiConfigMessage] = useState({ type: '', text: '' });
  const [kpiAuditEntries, setKpiAuditEntries] = useState([]);
  const [alertStateBusy, setAlertStateBusy] = useState(false);
  const [alertDispatchBusy, setAlertDispatchBusy] = useState(false);
  const [kpiAlertHistory, setKpiAlertHistory] = useState([]);
  const [kpiAlertEvaluations, setKpiAlertEvaluations] = useState([]);
  const [evaluationBusy, setEvaluationBusy] = useState(false);

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
    api.getKpiAlertHistory().then(({ entries }) => setKpiAlertHistory(entries || [])).catch(() => {});
    api.getKpiAlertEvaluations().then(({ entries }) => setKpiAlertEvaluations(entries || [])).catch(() => {});
  }, []);

  const users = dashboardState?.users || [];
  const statsSource = useMemo(() => dashboardState?.stats || {}, [dashboardState]);
  const recentOrders = dashboardState?.recentOrders || [];
  const salesTrend7d = dashboardState?.salesTrend7d || [];
  const weeklyFunnelTrend = dashboardState?.weeklyFunnelTrend || [];
  const proactiveSummary = dashboardState?.proactiveSummary || null;
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
  const alertHistorySummary = useMemo(() => kpiAlertHistory.reduce((acc, entry) => {
    acc[entry.status] = (acc[entry.status] || 0) + 1;
    return acc;
  }, { sent: 0, dry_run: 0, omitted: 0, failed: 0 }), [kpiAlertHistory]);
  const evaluationHealth = useMemo(() => {
    const blockedSummary = kpiAlertEvaluations.reduce((acc, entry) => {
      const key = entry.blocked_reason || 'none';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const blockedTop = Object.entries(blockedSummary).sort((a, b) => b[1] - a[1])[0] || null;
    const lastEvaluation = kpiAlertEvaluations[0] || null;
    const shouldSendCount = kpiAlertEvaluations.filter((entry) => entry.should_send).length;
    const dispatchedCount = kpiAlertEvaluations.filter((entry) => entry.dispatched).length;
    const staleMinutes = lastEvaluation?.created_at ? Math.round((Date.now() - new Date(lastEvaluation.created_at).getTime()) / 60000) : null;
    return {
      lastEvaluation,
      staleMinutes,
      shouldSendCount,
      dispatchedCount,
      dispatchRate: shouldSendCount > 0 ? Math.round((dispatchedCount / shouldSendCount) * 100) : null,
      blockedTop,
    };
  }, [kpiAlertEvaluations]);
  const cronEvaluationHealth = useMemo(() => {
    const cronEvaluations = kpiAlertEvaluations.filter((entry) => entry.trigger_source === 'cron');
    const lastCronEvaluation = cronEvaluations[0] || null;
    const staleMinutes = lastCronEvaluation?.created_at ? Math.round((Date.now() - new Date(lastCronEvaluation.created_at).getTime()) / 60000) : null;
    const lastBlocked = lastCronEvaluation?.blocked_reason || '—';
    const failedCronDispatches = cronEvaluations.filter((entry) => entry.should_send && !entry.dispatched && entry.blocked_reason == null).length;
    return {
      cronEvaluations,
      lastCronEvaluation,
      staleMinutes,
      lastBlocked,
      failedCronDispatches,
    };
  }, [kpiAlertEvaluations]);

  const reloadDashboard = async () => {
    const refreshed = await api.getAdminDashboard();
    setDashboardState(refreshed);
    api.getKpiRuntimeConfigAudit().then(({ entries }) => setKpiAuditEntries(entries || [])).catch(() => {});
    api.getKpiAlertHistory().then(({ entries }) => setKpiAlertHistory(entries || [])).catch(() => {});
    api.getKpiAlertEvaluations().then(({ entries }) => setKpiAlertEvaluations(entries || [])).catch(() => {});
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
  const handleDispatchExecutiveAlert = async (dryRun = true) => {
    if (!transportReadiness?.executive_alert_payload) return;
    setAlertDispatchBusy(true);
    setKpiConfigMessage({ type: '', text: '' });
    try {
      const result = await api.dispatchExecutiveAlert({ payload: transportReadiness.executive_alert_payload, dryRun, recipients: executiveAlertState?.recipients || [] });
      await reloadDashboard();
      setKpiConfigMessage({ type: 'success', text: result?.skipped ? `Alerta omitida: ${result.reason}.` : `Alerta ejecutiva ${dryRun ? 'dry-run' : 'real'} procesada.` });
    } catch (error) {
      setKpiConfigMessage({ type: 'error', text: error.message || 'No pude disparar la alerta ejecutiva.' });
    } finally {
      setAlertDispatchBusy(false);
    }
  };
  const handleEvaluateExecutiveAlert = async () => {
    setEvaluationBusy(true);
    setKpiConfigMessage({ type: '', text: '' });
    try {
      const result = await api.evaluateExecutiveAlert('manual');
      await reloadDashboard();
      setKpiConfigMessage({ type: 'success', text: `Evaluación backend ejecutada. Score ${result.score} · banda ${result.band}.` });
    } catch (error) {
      setKpiConfigMessage({ type: 'error', text: error.message || 'No pude ejecutar el evaluador backend.' });
    } finally {
      setEvaluationBusy(false);
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

      <AdminDashboardOverviewSection
        stats={stats}
        manualOverrideQaOrdersCount={manualOverrideQaOrdersCount}
        manualOverrideQaSeverity={manualOverrideQaSeverity}
        manualOverrideQaAging={manualOverrideQaAging}
        manualOverrideQaSla={manualOverrideQaSla}
        manualOverrideQaBlockedCount={manualOverrideQaBlockedCount}
        topManualOverrideQueue={topManualOverrideQueue}
        quickActionMessage={quickActionMessage}
        quickActionBusyId={quickActionBusyId}
        onKeepQa={handleKeepQa}
        onMarkReviewed={handleMarkReviewed}
        onRestoreReal={handleRestoreReal}
        SalesChartComponent={SalesChart}
        salesTrend7d={salesTrend7d}
        funnelStats={funnelStats}
        stageSlaStats={stageSlaStats}
        paymentMethodStats={paymentMethodStats}
        carrierStats={carrierStats}
        productStats={productStats}
        wowAlerts={wowAlerts}
      />

      <AdminDashboardAlertingSection
        kpiAuditEntries={kpiAuditEntries}
        kpiAlertHistory={kpiAlertHistory}
        alertHistorySummary={alertHistorySummary}
        handleEvaluateExecutiveAlert={handleEvaluateExecutiveAlert}
        evaluationBusy={evaluationBusy}
        evaluationHealth={evaluationHealth}
        cronEvaluationHealth={cronEvaluationHealth}
        kpiAlertEvaluations={kpiAlertEvaluations}
        kpiComparisons={kpiComparisons}
        runtimeConfigLoaded={runtimeConfigLoaded}
        slaTargets={slaTargets}
        kpiConfigMessage={kpiConfigMessage}
        kpiConfigBusy={kpiConfigBusy}
        handleSaveKpiConfig={handleSaveKpiConfig}
        kpiConfigForm={kpiConfigForm}
        updateKpiConfigField={updateKpiConfigField}
        conversionCards={conversionCards}
        operationalOrders={statsSource.operationalOrders}
        qaOrders={statsSource.qaOrders}
        operationalPaidOrders={statsSource.operationalPaidOrders}
        totalOrders={statsSource.totalOrders}
        operationalRevenue={statsSource.operationalRevenue}
        qaRevenue={statsSource.qaRevenue}
        weeklyFunnelTrend={weeklyFunnelTrend}
        FunnelTrendChartComponent={FunnelTrendChart}
        handleCopyDigest={handleCopyDigest}
        digestCopied={digestCopied}
        operationalDigest={operationalDigest}
        deliveryFormats={deliveryFormats}
        handleCopyFormat={handleCopyFormat}
        copiedFormat={copiedFormat}
        transportReadiness={transportReadiness}
        executiveAlertState={executiveAlertState}
        alertStateBusy={alertStateBusy}
        handleMarkExecutiveAlertSent={handleMarkExecutiveAlertSent}
        alertDispatchBusy={alertDispatchBusy}
        handleDispatchExecutiveAlert={handleDispatchExecutiveAlert}
      />

      <AdminDashboardProfilesSection
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        filteredUsers={filteredUsers}
        recentOrders={recentOrders}
      />
    </AdminShell>
  );
};

export default AdminDashboard;
