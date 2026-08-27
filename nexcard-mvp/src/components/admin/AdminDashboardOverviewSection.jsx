import React, { useMemo, useState } from 'react';
import { Activity, BarChart2, BellRing, CheckCircle2, ClipboardList, ShieldAlert, Truck, Zap } from 'lucide-react';
import AdminCard from '../ui/AdminCard';
import AdminStat from '../ui/AdminStat';
import AdminBadge from '../ui/AdminBadge';
import OperationalDecisionCard, { OperationalDecisionBusyBadge } from './OperationalDecisionCard';

const formatCLP = (value) => new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
}).format(value || 0);

const normalizeStatus = (value) => String(value || '').toLowerCase();

const laneDefinitions = [
  { key: 'problems', title: 'Problemas', subtitle: 'Excepciones primero', tone: 'danger' },
  { key: 'paid', title: 'Pagadas nuevas', subtitle: 'Preparar producción', tone: 'success' },
  { key: 'activation', title: 'Activación', subtitle: 'Claim/perfil/slug', tone: 'warning' },
  { key: 'production', title: 'Producción NFC', subtitle: 'Card física + URL', tone: 'info' },
  { key: 'shipping', title: 'Listas despacho', subtitle: 'Courier y tracking', tone: 'info' },
  { key: 'delivered', title: 'Entregadas', subtitle: 'Cierre y postventa', tone: 'success' },
];

const classifyOrderLane = (order) => {
  const payment = normalizeStatus(order.payment_status);
  const fulfillment = normalizeStatus(order.fulfillment_status || order.status);
  const risk = normalizeStatus(order.severity || order.risk || order.review_status);
  const activation = normalizeStatus(order.activation_status || order.claim_status);

  if (risk.includes('critical') || risk.includes('high') || fulfillment.includes('cancel') || order.blocked || order.requires_attention) return 'problems';
  if (payment === 'paid' && (!fulfillment || fulfillment === 'new' || fulfillment === 'pending')) return 'paid';
  if (activation.includes('pending') || activation.includes('claim')) return 'activation';
  if (fulfillment.includes('production') || fulfillment.includes('ready')) return 'production';
  if (fulfillment.includes('ship') || fulfillment.includes('dispatch')) return 'shipping';
  if (fulfillment.includes('deliver')) return 'delivered';
  return payment === 'paid' ? 'paid' : 'problems';
};

const OrderCard = ({ order, selected, onSelect, quickActionBusyId, onKeepQa, onMarkReviewed, onRestoreReal }) => {
  const id = order.folio || order.id || 'Orden';
  const customer = order.customer_name || order.name || 'Cliente sin nombre';
  const amount = order.amount_cents ? formatCLP(order.amount_cents) : null;
  const severity = order.severity || order.risk || order.payment_status || 'real';
  const reasons = order.reasons?.length ? order.reasons.join(' · ') : order.next_action || order.fulfillment_status || 'Revisar detalle operativo';
  const isOverride = Boolean(order.severity || order.age_hours != null);
  const nextAction = isOverride ? 'Decidir QA/Real' : order.payment_status === 'paid' ? 'Continuar operación' : 'Revisar pago';

  return (
    <OperationalDecisionCard
      id={id}
      title={customer}
      customerLabel={order.customer_email || order.email || order.contact || order.slug || 'sin contacto visible'}
      detail={`${reasons}${amount ? ` · ${amount}` : ''}`}
      status={order.fulfillment_status || order.status || order.payment_status || 'sin estado'}
      severity={severity}
      nextAction={nextAction}
      blockerReason={order.age_hours != null ? `${order.age_hours}h en cola` : ''}
      href={isOverride ? '/admin/orders/qa' : '/admin/orders'}
      onSelect={() => onSelect(order)}
      selected={selected}
      requiresHuman={isOverride}
    >
      {isOverride ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onKeepQa(order)} disabled={quickActionBusyId === order.id} className="inline-flex items-center gap-1 rounded-lg bg-fuchsia-700 px-2.5 py-2 text-[11px] font-bold text-white hover:bg-fuchsia-600 disabled:opacity-50">
            {quickActionBusyId === order.id ? <OperationalDecisionBusyBadge /> : <CheckCircle2 size={12} />}
            Mantener QA
          </button>
          <button type="button" onClick={() => onMarkReviewed(order)} disabled={quickActionBusyId === order.id} className="inline-flex items-center gap-1 rounded-lg bg-sky-700 px-2.5 py-2 text-[11px] font-bold text-white hover:bg-sky-600 disabled:opacity-50">
            {quickActionBusyId === order.id ? <OperationalDecisionBusyBadge /> : <CheckCircle2 size={12} />}
            Revisada
          </button>
          <button type="button" onClick={() => onRestoreReal(order)} disabled={quickActionBusyId === order.id} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-2 text-[11px] font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
            {quickActionBusyId === order.id ? <OperationalDecisionBusyBadge /> : <CheckCircle2 size={12} />}
            Real
          </button>
        </div>
      ) : null}
    </OperationalDecisionCard>
  );
};

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
  recentOrders = [],
  proactiveSummary = null,
  executiveScore = null,
  runtimeConfigLoaded = false,
  lowStockItems = [],
}) {
  const ordersForBoard = useMemo(() => {
    const byId = new Map();
    [...topManualOverrideQueue, ...recentOrders].forEach((order) => {
      if (!order) return;
      byId.set(order.id || order.folio || `${order.customer_name}-${byId.size}`, order);
    });
    return Array.from(byId.values());
  }, [topManualOverrideQueue, recentOrders]);

  const lanes = useMemo(() => {
    const grouped = Object.fromEntries(laneDefinitions.map((lane) => [lane.key, []]));
    ordersForBoard.forEach((order) => grouped[classifyOrderLane(order)].push(order));
    return grouped;
  }, [ordersForBoard]);

  const selectedDefault = topManualOverrideQueue[0] || ordersForBoard[0] || null;
  const [selectedOrder, setSelectedOrder] = useState(selectedDefault);
  const selected = selectedOrder || selectedDefault;

  const criticalActions = useMemo(() => {
    const manual = topManualOverrideQueue.slice(0, 4).map((order) => ({
      key: order.id,
      title: `${order.folio || order.id} · ${order.customer_name || 'orden sin nombre'}`,
      detail: order.reasons?.join(' · ') || `${order.payment_status || 'pago n/a'} · ${order.fulfillment_status || 'fulfillment n/a'}`,
      action: order.severity === 'critical' ? 'Resolver ahora' : 'Revisar cola',
      tone: order.severity === 'critical' ? 'danger' : 'warning',
    }));
    const alerts = wowAlerts.slice(0, Math.max(0, 4 - manual.length)).map((alert) => ({
      key: alert.key,
      title: alert.title,
      detail: alert.detail,
      action: 'Revisar KPI',
      tone: alert.severity === 'danger' ? 'danger' : 'warning',
    }));
    return [...manual, ...alerts];
  }, [topManualOverrideQueue, wowAlerts]);

  const operationalMetrics = useMemo(() => {
    const revenue = stats.find((item) => item.label.toLowerCase().includes('ingresos'));
    const lowStockLabel = lowStockItems.length === 1
      ? (lowStockItems[0].item || lowStockItems[0].name || lowStockItems[0].sku || '1 SKU')
      : `${lowStockItems.length} SKU`;
    return [
      { label: 'Pagadas reales', value: funnelStats.find((item) => item.label === 'Paid')?.value ?? 0, hint: funnelStats.find((item) => item.label === 'Paid')?.hint || 'QA excluido', accent: 'emerald' },
      { label: 'Activación pendiente', value: funnelStats.find((item) => item.label === 'Activated')?.value ?? 0, hint: 'claim/perfil/slug', accent: 'amber' },
      { label: 'Cards por operar', value: funnelStats.find((item) => item.label === 'Ready')?.value ?? 0, hint: 'producción + NFC', accent: 'blue' },
      { label: 'Stock crítico', value: lowStockItems.length ? lowStockLabel : 'OK', hint: lowStockItems.length ? 'Ver inventario' : 'Inventario sin alerta visible', accent: lowStockItems.length ? 'amber' : 'emerald' },
      { label: 'Problemas críticos', value: (manualOverrideQaSeverity.critical || 0) + (manualOverrideQaSeverity.high || 0), hint: manualOverrideQaBlockedCount ? `${manualOverrideQaBlockedCount} pagada(s) bloqueadas` : 'sin bloqueos pagados', accent: manualOverrideQaBlockedCount ? 'red' : 'emerald' },
      { label: 'Overrides QA', value: manualOverrideQaOrdersCount || 0, hint: manualOverrideQaAging.over72h ? `${manualOverrideQaAging.over72h} >72h` : 'operación real separada', accent: manualOverrideQaOrdersCount ? 'amber' : 'emerald' },
      { label: executiveScore ? 'Score operativo' : (revenue?.label || 'Ingresos operacionales'), value: executiveScore ? executiveScore.score : (revenue?.value || '$0'), hint: executiveScore ? `Banda ${executiveScore.band} · ${runtimeConfigLoaded ? 'config persistida' : 'fallback seguro'}` : (revenue?.hint || 'QA excluido'), accent: executiveScore?.band === 'critical' ? 'red' : executiveScore?.band === 'watch' ? 'amber' : 'emerald' },
      { label: 'Estado cierre', value: manualOverrideQaBlockedCount ? 'bloqueado' : 'operable', hint: manualOverrideQaBlockedCount ? 'requiere revisión humana' : 'sin bloqueo crítico visible', accent: manualOverrideQaBlockedCount ? 'red' : 'emerald' },
    ];
  }, [stats, funnelStats, manualOverrideQaSeverity, manualOverrideQaBlockedCount, manualOverrideQaOrdersCount, manualOverrideQaAging, lowStockItems, executiveScore, runtimeConfigLoaded]);

  const reconciliationRows = [
    ['Overrides manuales QA', manualOverrideQaOrdersCount || 0, manualOverrideQaOrdersCount ? 'warn' : 'ok'],
    ['Pagadas bloqueadas', manualOverrideQaBlockedCount || 0, manualOverrideQaBlockedCount ? 'bad' : 'ok'],
    ['Severidad crítica/high', `${manualOverrideQaSeverity.critical || 0}/${manualOverrideQaSeverity.high || 0}`, (manualOverrideQaSeverity.critical || manualOverrideQaSeverity.high) ? 'bad' : 'ok'],
    ['Aging >24h / >72h', `${manualOverrideQaAging.over24h || 0}/${manualOverrideQaAging.over72h || 0}`, manualOverrideQaAging.over72h ? 'bad' : manualOverrideQaAging.over24h ? 'warn' : 'ok'],
    ['Alertas WoW', wowAlerts.length, wowAlerts.length ? 'warn' : 'ok'],
  ];

  const selectedChecks = useMemo(() => {
    if (!selected) return [];
    const fulfillment = normalizeStatus(selected.fulfillment_status || selected.status);
    const payment = normalizeStatus(selected.payment_status);
    const activation = normalizeStatus(selected.claim_status || selected.activation_status);
    return [
      { label: 'Pago', value: payment === 'paid' ? 'OK' : payment ? 'Pendiente' : 'No aplica', accent: payment === 'paid' ? 'emerald' : 'amber', hint: selected.payment_status || 'sin estado de pago' },
      { label: 'Activación', value: activation.includes('active') || selected.activation_completed ? 'OK' : activation ? 'Pendiente' : 'No aplica', accent: activation.includes('active') || selected.activation_completed ? 'emerald' : 'amber', hint: selected.claim_status || selected.activation_status || 'sin claim visible' },
      { label: 'Card/NFC', value: selected.card_code || selected.cards_count || selected.active_cards_count ? 'OK' : 'Pendiente', accent: selected.card_code || selected.cards_count || selected.active_cards_count ? 'emerald' : 'amber', hint: selected.card_code || `${selected.cards_count || selected.active_cards_count || 0} card(s)` },
      { label: 'Despacho', value: fulfillment.includes('ship') || fulfillment.includes('deliver') ? 'OK' : fulfillment.includes('cancel') ? 'Bloqueado' : 'Pendiente', accent: fulfillment.includes('ship') || fulfillment.includes('deliver') ? 'emerald' : fulfillment.includes('cancel') ? 'red' : 'amber', hint: selected.fulfillment_status || selected.status || 'sin fulfillment' },
    ];
  }, [selected]);

  const selectedActivity = useMemo(() => {
    if (!selected) return [];
    const events = selected.history || selected.events || selected.activity_log || selected.timeline || [];
    return Array.isArray(events) ? events.slice(0, 4) : [];
  }, [selected]);

  return (
    <>
      <div className="mb-6 grid gap-4 lg:grid-cols-[1.08fr,0.92fr]">
        <AdminCard className="border-zinc-800 bg-zinc-950/80">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Dashboard v2 · operación real</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight text-white">Hoy requiere acción</h2>
              <p className="mt-1 text-sm text-zinc-400">Ordena la operación por prioridad real: pago, activación, producción, despacho y bloqueos.</p>
              {proactiveSummary ? (
                <div className="mt-3 rounded-2xl border border-emerald-900/70 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-100">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-300"><BellRing size={14} /> Prioridad operativa ahora</div>
                  <p className="mt-1 font-bold">{proactiveSummary.headline}</p>
                  <p className="text-xs text-emerald-200/80">{proactiveSummary.count > 0 ? `${proactiveSummary.count} caso(s) prioritarios.` : 'Sin casos prioritarios.'} {proactiveSummary.action}</p>
                </div>
              ) : null}
            </div>
            <AdminBadge variant={criticalActions.length ? 'danger' : 'success'}>{criticalActions.length ? `${criticalActions.length} acciones` : 'sin bloqueo'}</AdminBadge>
          </div>
          <div className="space-y-3">
            {criticalActions.length === 0 ? (
              <div className="rounded-2xl border border-emerald-900/70 bg-emerald-950/20 p-4 text-sm font-bold text-emerald-200">Sin cola crítica visible en este corte.</div>
            ) : criticalActions.map((item) => (
              <OperationalDecisionCard
                key={item.key}
                id={item.key}
                title={item.title}
                detail={item.detail}
                status={item.action}
                severity={item.tone}
                nextAction={item.action}
                href={item.tone === 'danger' || item.tone === 'warning' ? '/admin/orders/qa' : '/admin/orders'}
                onSelect={() => {}}
                requiresHuman={item.tone === 'danger' || item.tone === 'warning'}
              />
            ))}
          </div>
          {quickActionMessage.text ? (
            <div className={`mt-4 rounded-xl border px-3 py-2 text-xs font-semibold ${quickActionMessage.type === 'error' ? 'border-red-800 bg-red-950/40 text-red-300' : 'border-emerald-800 bg-emerald-950/40 text-emerald-300'}`}>
              {quickActionMessage.text}
            </div>
          ) : null}
        </AdminCard>

        <div className="grid grid-cols-2 gap-3">
          {operationalMetrics.map((stat) => <AdminStat key={stat.label} label={stat.label} value={stat.value} hint={stat.hint} accent={stat.accent} />)}
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500"><ShieldAlert size={15} /> Filtro operacional</div>
        <div className="flex flex-wrap gap-2">
          <a href="/admin/orders" className="rounded-full border border-emerald-700 bg-emerald-950/40 px-3 py-2 text-xs font-black text-emerald-200">Operación real</a>
          <a href="/admin/orders/qa" className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-black text-zinc-300">QA/Test</a>
          <a href="/admin/orders?view=all" className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-black text-zinc-300">Todos</a>
          <a href="/admin/orders?filter=problems" className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-black text-zinc-300">Solo problemas</a>
        </div>
      </div>

      <div className="mb-6 overflow-x-auto pb-2">
        <div className="grid min-w-[1640px] grid-cols-6 gap-3">
          {laneDefinitions.map((lane) => (
            <section key={lane.key} className="min-h-[430px] rounded-2xl border border-zinc-800 bg-zinc-950/75 p-3">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-white">{lane.title}</h3>
                  <p className="text-[11px] font-semibold text-zinc-500">{lane.subtitle}</p>
                </div>
                <AdminBadge variant={lane.tone}>{lanes[lane.key].length}</AdminBadge>
              </div>
              <div className="space-y-3">
                {lanes[lane.key].length === 0 ? (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-xs font-semibold text-zinc-500">Sin órdenes en este carril.</div>
                ) : lanes[lane.key].map((order) => (
                  <OrderCard
                    key={order.id || order.folio}
                    order={order}
                    selected={(selected?.id || selected?.folio) === (order.id || order.folio)}
                    onSelect={setSelectedOrder}
                    quickActionBusyId={quickActionBusyId}
                    onKeepQa={onKeepQa}
                    onMarkReviewed={onMarkReviewed}
                    onRestoreReal={onRestoreReal}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <AdminCard>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black tracking-tight text-white">Ficha de orden seleccionada</h2>
              <p className="text-sm text-zinc-400">Pago, activación, producción y despacho en un solo bloque.</p>
            </div>
            <AdminBadge variant={selected ? 'info' : 'warning'}>{selected ? (selected.folio || selected.id || 'orden') : 'sin selección'}</AdminBadge>
          </div>
          {selected ? (
            <>
              <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <p className="text-lg font-black text-white">{selected.customer_name || selected.name || 'Cliente sin nombre'}</p>
                <p className="mt-1 text-xs text-zinc-500 break-all">{selected.customer_email || selected.email || selected.id || 'sin contacto visible'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {selectedChecks.map((check) => (
                  <AdminStat key={check.label} label={check.label} value={check.value} hint={check.hint} accent={check.accent} />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href="/admin/orders" className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-emerald-950 hover:bg-emerald-500">Abrir orden</a>
                {selected.slug ? <a href={`/${selected.slug}`} target="_blank" rel="noreferrer" className="rounded-xl border border-zinc-700 px-4 py-2 text-xs font-black text-zinc-300 hover:bg-zinc-800">Ver perfil</a> : null}
                {(selected.isNonOperational || selected.severity || selected.age_hours != null) ? <a href="/admin/orders/qa" className="rounded-xl border border-zinc-700 px-4 py-2 text-xs font-black text-zinc-300 hover:bg-zinc-800">Abrir QA/Test</a> : null}
              </div>
              <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Activity size={16} className="text-emerald-400" />
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Activity log</p>
                </div>
                {selectedActivity.length ? (
                  <div className="space-y-2">
                    {selectedActivity.map((event, index) => (
                      <div key={event.id || index} className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300">
                        {event.label || event.message || event.action || String(event)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-zinc-500">Historial no disponible en este resumen. Abrir orden para auditoría completa.</p>
                )}
              </div>
            </>
          ) : <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">No hay órdenes reales recientes ni overrides para seleccionar.</div>}
        </AdminCard>

        <AdminCard>
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList size={18} className="text-emerald-400" />
            <h2 className="text-lg font-black text-white">Conciliación y seguridad</h2>
          </div>
          <div className="space-y-1">
            {reconciliationRows.map(([label, value, status]) => (
              <div key={label} className="flex items-center justify-between gap-3 border-b border-zinc-800 py-2 text-sm last:border-b-0">
                <span className="text-zinc-300">{label}</span>
                <span className={`font-black ${status === 'bad' ? 'text-red-300' : status === 'warn' ? 'text-amber-300' : 'text-emerald-300'}`}>{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <Truck size={18} className="mb-2 text-sky-400" />
              <p className="text-sm font-black text-white">SLA promedio</p>
              <p className="mt-1 text-xs text-zinc-500">Abierto {manualOverrideQaSla.open_avg_hours ?? '—'}h · revisión {manualOverrideQaSla.review_avg_hours ?? '—'}h</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <Zap size={18} className="mb-2 text-emerald-400" />
              <p className="text-sm font-black text-white">Regla QA</p>
              <p className="mt-1 text-xs text-zinc-500">Separado por defecto; nada de mezclar test con caja real. Revolucionario, sí.</p>
            </div>
          </div>
        </AdminCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <AdminCard>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg text-white">Ventas reales últimos 7 días</h2>
              <p className="text-sm text-zinc-400 font-medium">Ingresos diarios en CLP excluyendo QA/interno</p>
            </div>
            <BarChart2 size={20} className="text-emerald-500" />
          </div>
          <SalesChartComponent orders={salesTrend7d} />
        </AdminCard>

        <AdminCard>
          <h2 className="mb-4 font-bold text-lg text-white">Funnel operativo</h2>
          <div className="grid grid-cols-2 gap-3">
            {funnelStats.map((stat) => <AdminStat key={stat.label} label={stat.label} value={stat.value} hint={stat.hint} accent={stat.accent} />)}
          </div>
        </AdminCard>

        <AdminCard>
          <h2 className="mb-4 font-bold text-lg text-white">SLA por etapa</h2>
          <div className="grid grid-cols-2 gap-3">
            {stageSlaStats.map((stat) => <AdminStat key={stat.key} label={stat.label} value={stat.value} hint={stat.hint} accent={stat.accent} />)}
          </div>
        </AdminCard>
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
                  <p className="text-sm font-bold text-emerald-400">{formatCLP(item.net_revenue || 0)}</p>
                  <p className="text-[11px] text-zinc-500">fee {formatCLP(item.fee_cost || 0)}</p>
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
                  <p className="text-sm font-bold text-amber-400">{formatCLP(item.revenue || 0)}</p>
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
