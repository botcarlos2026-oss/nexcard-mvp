import React from 'react';
import { Copy, Loader2, TrendingUp } from 'lucide-react';
import AdminCard from '../ui/AdminCard';
import AdminStat from '../ui/AdminStat';
import AdminBadge from '../ui/AdminBadge';

export default function AdminDashboardAlertingSection({
  kpiAuditEntries,
  kpiAlertHistory,
  alertHistorySummary,
  handleEvaluateExecutiveAlert,
  evaluationBusy,
  evaluationHealth,
  cronEvaluationHealth,
  kpiAlertEvaluations,
  kpiComparisons,
  runtimeConfigLoaded,
  slaTargets,
  kpiConfigMessage,
  kpiConfigBusy,
  handleSaveKpiConfig,
  kpiConfigForm,
  updateKpiConfigField,
  conversionCards,
  operationalOrders,
  qaOrders,
  operationalPaidOrders,
  totalOrders,
  operationalRevenue,
  qaRevenue,
  weeklyFunnelTrend,
  FunnelTrendChartComponent,
  handleCopyDigest,
  digestCopied,
  operationalDigest,
  deliveryFormats,
  handleCopyFormat,
  copiedFormat,
  transportReadiness,
  executiveAlertState,
  alertStateBusy,
  handleMarkExecutiveAlertSent,
  alertDispatchBusy,
  handleDispatchExecutiveAlert,
}) {
  const configSections = [
    {
      key: 'sla_targets',
      label: 'SLA targets',
      fields: [
        ['paid_to_ready', 'Paid → Ready', 'number', 1],
        ['ready_to_shipped', 'Ready → Shipped', 'number', 1],
        ['shipped_to_delivered', 'Shipped → Delivered', 'number', 1],
        ['delivered_to_activated', 'Delivered → Activated', 'number', 1],
      ],
    },
    {
      key: 'payment_method_fees',
      label: 'Fees por método',
      fields: [
        ['webpay', 'Webpay', 'number', 0.0001],
        ['transbank', 'Transbank', 'number', 0.0001],
        ['mercado_pago', 'Mercado Pago', 'number', 0.0001],
        ['mercado-pago', 'Mercado Pago slug', 'number', 0.0001],
        ['default', 'Default', 'number', 0.0001],
      ],
    },
    {
      key: 'wow_alert_thresholds',
      label: 'Thresholds WoW',
      fields: [
        ['revenue_drop_pct', 'Revenue drop %', 'number', 1],
        ['payment_rate_drop_pts', 'Payment rate pts', 'number', 1],
        ['carrier_delivery_rate_drop_pts', 'Carrier pts', 'number', 1],
        ['sku_claim_rate_pct', 'Claim rate %', 'number', 1],
      ],
    },
    {
      key: 'executive_alert_policy',
      label: 'Policy alertas ejecutivas',
      fields: [
        ['enabled', 'Enabled (1/0)', 'number', 1],
        ['cooldown_minutes', 'Cooldown min', 'number', 1],
        ['dedupe_by_band', 'Dedupe por banda (1/0)', 'number', 1],
        ['min_band_watch', 'Min watch', 'number', 1],
        ['min_band_critical', 'Min critical', 'number', 1],
      ],
    },
    {
      key: 'executive_alert_routing',
      label: 'Routing alertas ejecutivas',
      fields: [
        ['enabled', 'Routing enabled (1/0)', 'number', 1],
        ['auto_dispatch', 'Auto dispatch (1/0)', 'number', 1],
        ['dry_run_default', 'Dry-run default (1/0)', 'number', 1],
        ['recipients_csv', 'Recipients CSV', 'text', null],
      ],
    },
    {
      key: 'executive_alert_band_policy',
      label: 'Policy por banda',
      fields: [
        ['kill_switch', 'Kill switch (1/0)', 'number', 1],
        ['watch_cooldown_minutes', 'Watch cooldown min', 'number', 1],
        ['critical_cooldown_minutes', 'Critical cooldown min', 'number', 1],
        ['watch_recipients_csv', 'Watch recipients CSV', 'text', null],
        ['critical_recipients_csv', 'Critical recipients CSV', 'text', null],
      ],
    },
  ];

  return (
    <>
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-lg text-white">Historial de alertas ejecutivas</h2>
            <p className="text-sm text-zinc-400 font-medium">Trazabilidad real de dispatch, hash y deduplicación.</p>
          </div>
          <AdminBadge variant={kpiAlertHistory.length ? 'success' : 'warning'}>
            {kpiAlertHistory.length ? `${kpiAlertHistory.length} evento(s)` : 'sin historial'}
          </AdminBadge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <AdminStat label="Emitidas" value={alertHistorySummary.sent || 0} accent="emerald" />
          <AdminStat label="Dry-run" value={alertHistorySummary.dry_run || 0} accent="amber" />
          <AdminStat label="Omitidas" value={alertHistorySummary.omitted || 0} accent="blue" />
          <AdminStat label="Fallidas" value={alertHistorySummary.failed || 0} accent="red" />
        </div>
        <div className="space-y-3">
          {kpiAlertHistory.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">Todavía no hay alertas ejecutivas emitidas o simuladas.</div>
          ) : kpiAlertHistory.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <AdminBadge variant={entry.status === 'sent' ? 'success' : entry.status === 'dry_run' ? 'warning' : 'danger'}>{entry.status}</AdminBadge>
                  <span className="text-sm font-bold text-white">{entry.alert_key}</span>
                  <span className="text-xs text-zinc-500">band {entry.alert_band || '—'}</span>
                </div>
                <span className="text-xs text-zinc-500">{new Date(entry.created_at).toLocaleString('es-CL')}</span>
              </div>
              <p className="text-xs text-zinc-400 mb-2 break-all">hash: {entry.payload_hash}</p>
              <p className="text-xs text-zinc-400 mb-2">provider msg id: {entry.provider_message_id || '—'}</p>
              <pre className="whitespace-pre-wrap text-xs leading-6 text-zinc-300 font-mono">{JSON.stringify(entry.payload || {}, null, 2)}</pre>
            </div>
          ))}
        </div>
      </AdminCard>

      <AdminCard className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-lg text-white">Evaluador backend autónomo</h2>
            <p className="text-sm text-zinc-400 font-medium">Corre fuera del dashboard y deja registro de cada evaluación.</p>
          </div>
          <button
            type="button"
            onClick={handleEvaluateExecutiveAlert}
            disabled={evaluationBusy}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {evaluationBusy ? <Loader2 size={14} className="animate-spin" /> : null}
            Ejecutar evaluación
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <AdminStat label="Última corrida" value={evaluationHealth.staleMinutes != null ? `${evaluationHealth.staleMinutes} min` : '—'} accent={evaluationHealth.staleMinutes != null && evaluationHealth.staleMinutes <= 45 ? 'emerald' : 'amber'} hint={evaluationHealth.lastEvaluation ? `${evaluationHealth.lastEvaluation.band} · score ${evaluationHealth.lastEvaluation.score} · ${evaluationHealth.lastEvaluation.trigger_source}` : 'Sin corridas registradas'} />
          <AdminStat label="Dispatch efectivo" value={evaluationHealth.dispatchRate != null ? `${evaluationHealth.dispatchRate}%` : '—'} accent={(evaluationHealth.dispatchRate ?? 0) >= 60 ? 'emerald' : 'amber'} hint={`${evaluationHealth.dispatchedCount}/${evaluationHealth.shouldSendCount || 0} evaluaciones elegibles terminaron despachadas`} />
          <AdminStat label="Bloqueo dominante" value={evaluationHealth.blockedTop ? evaluationHealth.blockedTop[0] : '—'} accent={evaluationHealth.blockedTop?.[0] === 'none' ? 'emerald' : 'amber'} hint={evaluationHealth.blockedTop ? `${evaluationHealth.blockedTop[1]} ocurrencias recientes` : 'Sin bloqueos recientes'} />
          <AdminStat label="Fallos dispatch" value={alertHistorySummary.failed || 0} accent={alertHistorySummary.failed > 0 ? 'red' : 'emerald'} hint={`sent ${alertHistorySummary.sent || 0} · dry_run ${alertHistorySummary.dry_run || 0} · omitted ${alertHistorySummary.omitted || 0}`} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <AdminStat label="Último cron" value={cronEvaluationHealth.staleMinutes != null ? `${cronEvaluationHealth.staleMinutes} min` : '—'} accent={cronEvaluationHealth.staleMinutes != null && cronEvaluationHealth.staleMinutes <= 45 ? 'emerald' : 'red'} hint={cronEvaluationHealth.lastCronEvaluation ? `${cronEvaluationHealth.lastCronEvaluation.band} · score ${cronEvaluationHealth.lastCronEvaluation.score}` : 'Sin corridas cron registradas'} />
          <AdminStat label="Bloqueo último cron" value={cronEvaluationHealth.lastBlocked} accent={cronEvaluationHealth.lastBlocked === '—' || cronEvaluationHealth.lastBlocked === 'below_band' ? 'blue' : 'amber'} hint={cronEvaluationHealth.lastCronEvaluation ? `trigger ${cronEvaluationHealth.lastCronEvaluation.trigger_source}` : 'Sin evaluación cron'} />
          <AdminStat label="Corridas cron" value={cronEvaluationHealth.cronEvaluations.length} accent={cronEvaluationHealth.cronEvaluations.length > 0 ? 'emerald' : 'amber'} hint="Ventana reciente de evaluaciones registradas con trigger cron" />
          <AdminStat label="Dispatch cron perdidos" value={cronEvaluationHealth.failedCronDispatches} accent={cronEvaluationHealth.failedCronDispatches > 0 ? 'red' : 'emerald'} hint="Evaluaciones cron elegibles que no terminaron despachadas" />
        </div>
        <div className="space-y-3">
          {kpiAlertEvaluations.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">Sin evaluaciones backend registradas todavía.</div>
          ) : kpiAlertEvaluations.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <AdminBadge variant={entry.dispatched ? 'success' : 'warning'}>{entry.band}</AdminBadge>
                  <span className="text-sm font-bold text-white">score {entry.score}</span>
                  <span className="text-xs text-zinc-500">trigger {entry.trigger_source}</span>
                </div>
                <span className="text-xs text-zinc-500">{new Date(entry.created_at).toLocaleString('es-CL')}</span>
              </div>
              <p className="text-xs text-zinc-400">should_send: {entry.should_send ? 'sí' : 'no'} · dispatched: {entry.dispatched ? 'sí' : 'no'} · blocked: {entry.blocked_reason || '—'}</p>
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
        <FunnelTrendChartComponent data={weeklyFunnelTrend.length ? weeklyFunnelTrend : [{ label: 'Sin data', paid: 0, ready: 0, shipped: 0, delivered: 0, activated: 0 }]} />
      </AdminCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <AdminStat label="Revenue 7d vs previo" value={kpiComparisons.revenue_7d?.delta_pct != null ? `${kpiComparisons.revenue_7d.delta_pct > 0 ? '+' : ''}${kpiComparisons.revenue_7d.delta_pct}%` : '—'} accent={kpiComparisons.revenue_7d?.delta_pct >= 0 ? 'emerald' : 'red'} hint={kpiComparisons.revenue_7d ? `Actual ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(kpiComparisons.revenue_7d.current || 0)} vs prev ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(kpiComparisons.revenue_7d.previous || 0)}` : null} />
        <AdminStat label="Paid orders 7d vs previo" value={kpiComparisons.paid_orders_7d?.delta_pct != null ? `${kpiComparisons.paid_orders_7d.delta_pct > 0 ? '+' : ''}${kpiComparisons.paid_orders_7d.delta_pct}%` : '—'} accent={kpiComparisons.paid_orders_7d?.delta_pct >= 0 ? 'emerald' : 'red'} hint={kpiComparisons.paid_orders_7d ? `Actual ${kpiComparisons.paid_orders_7d.current || 0} vs prev ${kpiComparisons.paid_orders_7d.previous || 0}` : null} />
        <AdminStat label="Tasa pago 7d vs previo" value={kpiComparisons.payment_rate_7d?.current != null ? `${kpiComparisons.payment_rate_7d.current}%` : '—'} accent={kpiComparisons.payment_rate_7d?.delta_pts >= 0 ? 'emerald' : 'red'} hint={kpiComparisons.payment_rate_7d ? `${kpiComparisons.payment_rate_7d.delta_pts > 0 ? '+' : ''}${kpiComparisons.payment_rate_7d.delta_pts || 0} pts vs ${kpiComparisons.payment_rate_7d.previous || 0}%` : null} />
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
          <AdminBadge variant={runtimeConfigLoaded ? 'success' : 'warning'}>{runtimeConfigLoaded ? 'runtime activo' : 'solo fallback'}</AdminBadge>
        </div>
        {kpiConfigMessage.text ? <div className={`mb-4 rounded-xl border px-3 py-2 text-xs font-semibold ${kpiConfigMessage.type === 'error' ? 'border-red-800 bg-red-950/40 text-red-300' : 'border-emerald-800 bg-emerald-950/40 text-emerald-300'}`}>{kpiConfigMessage.text}</div> : null}
        <div className="grid lg:grid-cols-3 gap-4">
          {configSections.map((item) => (
            <div key={item.key} className="rounded-xl bg-zinc-950 border border-zinc-800 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-sm font-bold text-white">{item.label}</p>
                <button type="button" onClick={() => handleSaveKpiConfig(item.key)} disabled={kpiConfigBusy === item.key} className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50">
                  {kpiConfigBusy === item.key ? <Loader2 size={14} className="animate-spin" /> : null}
                  Guardar
                </button>
              </div>
              <div className="space-y-3">
                {item.fields.map(([fieldKey, fieldLabel, fieldType = 'number', step]) => (
                  <label key={fieldKey} className="block">
                    <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-zinc-500">{fieldLabel}</span>
                    {fieldType === 'text' ? (
                      <input type="text" value={kpiConfigForm[item.key]?.[fieldKey] ?? ''} onChange={(e) => updateKpiConfigField(item.key, fieldKey, e.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-600" />
                    ) : (
                      <input type="number" step={step} value={kpiConfigForm[item.key]?.[fieldKey] ?? 0} onChange={(e) => updateKpiConfigField(item.key, fieldKey, Number(e.target.value))} className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-600" />
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </AdminCard>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {conversionCards.map((stat) => <AdminStat key={stat.key} label={stat.label} value={stat.value} accent={stat.accent} />)}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <AdminStat label="Total órdenes reales" value={operationalOrders || 0} hint={qaOrders > 0 ? `QA/internas: ${qaOrders}` : null} />
        <AdminStat label="Tasa de pago real" value={`${operationalOrders > 0 ? Math.round(((operationalPaidOrders || 0) / operationalOrders) * 100) : 0}%`} accent="emerald" hint={totalOrders > operationalOrders ? `Base total: ${totalOrders}` : null} />
        <AdminStat label="Ticket promedio real" value={operationalPaidOrders > 0 ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format((operationalRevenue || 0) / operationalPaidOrders) : '$0'} accent="amber" hint={qaRevenue > 0 ? `Revenue QA excluido: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(qaRevenue || 0)}` : null} />
      </div>

      <AdminCard className="mb-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h2 className="font-bold text-lg text-white">Resumen ejecutivo listo para enviar</h2>
            <p className="text-sm text-zinc-400 font-medium">Digest reutilizable para cron, WhatsApp, mail o alerta externa</p>
          </div>
          <button type="button" onClick={handleCopyDigest} className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition-colors">
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
                <button type="button" onClick={() => handleCopyFormat(item.key, deliveryFormats[item.key])} className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition-colors">
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
          <AdminBadge variant={transportReadiness?.mode === 'dry_run_only' ? 'warning' : 'success'}>{transportReadiness?.mode || 'n/a'}</AdminBadge>
        </div>
        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4">
            <p className="text-sm font-bold text-white mb-2">Recomendación de disparo</p>
            <p className="text-xs text-zinc-300">Trigger: {transportReadiness?.recommended_trigger || 'n/a'}</p>
            <p className="text-xs text-zinc-300 mt-1">Frecuencia: {transportReadiness?.recommended_frequency || 'n/a'}</p>
          </div>
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4">
            <p className="text-sm font-bold text-white mb-2">Checklist</p>
            <ul className="space-y-1 text-xs text-zinc-300 list-disc pl-4">{(transportReadiness?.checklist || []).map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm font-bold text-white">Cron payload</p>
              <button type="button" onClick={() => handleCopyFormat('cron_payload', JSON.stringify(transportReadiness?.cron_payload || {}, null, 2))} className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition-colors">
                <Copy size={14} />
                {copiedFormat === 'cron_payload' ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-xs leading-6 text-zinc-300 font-mono">{JSON.stringify(transportReadiness?.cron_payload || {}, null, 2)}</pre>
          </div>
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm font-bold text-white">Webhook payload</p>
              <button type="button" onClick={() => handleCopyFormat('webhook_payload', JSON.stringify(transportReadiness?.webhook_payload || {}, null, 2))} className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition-colors">
                <Copy size={14} />
                {copiedFormat === 'webhook_payload' ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-xs leading-6 text-zinc-300 font-mono">{JSON.stringify(transportReadiness?.webhook_payload || {}, null, 2)}</pre>
          </div>
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm font-bold text-white">Executive alert payload</p>
              <button type="button" onClick={() => handleCopyFormat('executive_alert_payload', JSON.stringify(transportReadiness?.executive_alert_payload || {}, null, 2))} className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition-colors">
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
                <p>Kill switch: {executiveAlertState?.kill_switch ? 'activo' : 'off'}</p>
                <p>Routing enabled: {executiveAlertState?.routing_enabled ? 'sí' : 'no'}</p>
                <p>Auto dispatch: {executiveAlertState?.auto_dispatch ? 'sí' : 'no'}</p>
                <p>Dry-run default: {executiveAlertState?.dry_run_default ? 'sí' : 'no'}</p>
                <p>Last band: {executiveAlertState?.last_band || '—'}</p>
                <p>Last sent: {executiveAlertState?.last_sent_at ? new Date(executiveAlertState.last_sent_at).toLocaleString('es-CL') : '—'}</p>
                <p>Blocked: {executiveAlertState?.blocked_reason || '—'}</p>
                <p>Recipients: {(executiveAlertState?.recipients || []).join(', ') || '—'}</p>
                {executiveAlertState?.auto_dispatch_result ? <p>Último auto-dispatch: {executiveAlertState.auto_dispatch_result.ok ? 'ok' : executiveAlertState.auto_dispatch_result.message || 'falló'}</p> : null}
              </div>
              <button type="button" onClick={handleMarkExecutiveAlertSent} disabled={alertStateBusy} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50">
                {alertStateBusy ? <Loader2 size={14} className="animate-spin" /> : null}
                Marcar enviado (dry-run)
              </button>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => handleDispatchExecutiveAlert(true)} disabled={alertDispatchBusy} className="inline-flex items-center gap-2 rounded-lg border border-amber-700 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-950/30 transition-colors disabled:opacity-50">
                  {alertDispatchBusy ? <Loader2 size={14} className="animate-spin" /> : null}
                  Disparar dry-run
                </button>
                <button type="button" onClick={() => handleDispatchExecutiveAlert(false)} disabled={alertDispatchBusy || !executiveAlertState?.should_send} className="inline-flex items-center gap-2 rounded-lg border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-950/30 transition-colors disabled:opacity-50">
                  {alertDispatchBusy ? <Loader2 size={14} className="animate-spin" /> : null}
                  Enviar real
                </button>
              </div>
            </div>
          </div>
        </div>
      </AdminCard>
    </>
  );
}
