import React, { useState } from 'react';
import { AlertCircle, Bell, Calendar, CheckCircle2, ChevronDown, Clock3, Download, Filter, QrCode, RefreshCw, Search, ShieldAlert } from 'lucide-react';

export default function OrdersFiltersBar({
  dateFilter,
  onDateFilterChange,
  operationalFilter,
  onOperationalFilterChange,
  operationalFilters,
  newOrdersCount,
  refreshing,
  onRefresh,
  onExportCsv,
  searchTerm,
  onSearchTermChange,
  paymentFilter,
  onPaymentFilterChange,
  paymentStatuses,
  fulfillmentFilter,
  onFulfillmentFilterChange,
  fulfillmentStatuses,
  auditFilter,
  onAuditFilterChange,
  forceAuditFilter,
  testReasonOptions,
  testReasonFilter,
  onTestReasonFilterChange,
  testReasonCounts,
  manualOverrideCount,
  overrideAgeFilter,
  onOverrideAgeFilterChange,
  reviewStatusFilter,
  onReviewStatusFilterChange,
  riskFilter,
  onRiskFilterChange,
  formatLabel,
}) {
  // Off by default: the daily-use filters (payment/fulfillment/date/search) stay
  // in the primary row; the QA-audit cluster (up to 4 extra selects) only
  // appears once someone deliberately opts into it, instead of auto-expanding
  // the moment the audit select's value changes.
  const [qaModeOpen, setQaModeOpen] = useState(auditFilter === 'excluded' || !!forceAuditFilter);

  return (
    <div className="p-5 border-b border-zinc-800 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar size={16} className="text-zinc-500" />
          {['all', 'today', 'week', 'month'].map((filterValue) => (
            <button
              key={filterValue}
              onClick={() => onDateFilterChange(filterValue)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${dateFilter === filterValue ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
            >
              {filterValue === 'all' ? 'Todos' : filterValue === 'today' ? 'Hoy' : filterValue === 'week' ? '7 días' : '30 días'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {newOrdersCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/40 border border-emerald-800 rounded-lg">
              <Bell size={14} className="text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400">{newOrdersCount} nueva{newOrdersCount > 1 ? 's' : ''}</span>
            </div>
          )}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold text-zinc-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button
            onClick={onExportCsv}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-bold text-white transition-colors"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {operationalFilters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => onOperationalFilterChange(filter.key)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${operationalFilter === filter.key ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300' : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white'}`}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className="flex gap-3 flex-1 flex-col sm:flex-row sm:flex-wrap">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input
            type="search"
            aria-label="Buscar órdenes"
            placeholder="Buscar por ID, cliente, email o teléfono"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors pl-9"
          />
        </label>
        <label className="relative block">
          <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <select
            aria-label="Filtrar por estado de pago"
            value={paymentFilter}
            onChange={(event) => onPaymentFilterChange(event.target.value)}
            className="w-full appearance-none px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors pl-9 sm:w-52"
          >
            {paymentStatuses.map((status) => (
              <option key={status} value={status}>{status === 'all' ? 'Todos los pagos' : formatLabel(status)}</option>
            ))}
          </select>
        </label>
        <label className="relative block">
          <Clock3 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <select
            aria-label="Filtrar por estado de fulfillment"
            value={fulfillmentFilter}
            onChange={(event) => onFulfillmentFilterChange(event.target.value)}
            className="w-full appearance-none px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors pl-9 sm:w-56"
          >
            {fulfillmentStatuses.map((status) => (
              <option key={status} value={status}>{status === 'all' ? 'Todos los estados' : formatLabel(status)}</option>
            ))}
          </select>
        </label>
        {!forceAuditFilter && (
          <button
            type="button"
            onClick={() => {
              const next = !qaModeOpen;
              setQaModeOpen(next);
              if (!next) onAuditFilterChange('all');
            }}
            aria-expanded={qaModeOpen}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${qaModeOpen ? 'border-amber-700 bg-amber-950/30 text-amber-300' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'}`}
          >
            <QrCode size={16} />
            Modo auditoría QA
            <ChevronDown size={14} className={`transition-transform ${qaModeOpen ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {(qaModeOpen || forceAuditFilter) && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-amber-900/40 bg-amber-950/10 p-3">
          <label className="relative block">
            <QrCode className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <select
              aria-label="Filtrar por auditoría QA"
              value={auditFilter}
              onChange={(event) => onAuditFilterChange(event.target.value)}
              className="w-full appearance-none px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors pl-9 sm:w-56"
            >
              {!forceAuditFilter && <option value="all">Auditoría: todas</option>}
              <option value="excluded">Solo QA/internas</option>
            </select>
          </label>
          {(auditFilter === 'excluded' || forceAuditFilter) && testReasonOptions.length > 1 && (
            <>
              <label className="relative block">
                <AlertCircle className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <select
                  aria-label="Filtrar por motivo QA"
                  value={testReasonFilter}
                  onChange={(event) => onTestReasonFilterChange(event.target.value)}
                  className="w-full appearance-none px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors pl-9 sm:w-64"
                >
                  <option value="all">Motivo QA: todos</option>
                  {testReasonOptions.filter((reason) => reason !== 'all').map((reason) => (
                    <option key={reason} value={reason}>
                      {reason === 'manual_override_only'
                        ? `Solo overrides manuales (${manualOverrideCount})`
                        : `${formatLabel(reason)} (${testReasonCounts[reason] || 0})`}
                    </option>
                  ))}
                </select>
              </label>
              {testReasonFilter === 'manual_override_only' && (
                <>
                  <label className="relative block">
                    <Clock3 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                    <select
                      aria-label="Filtrar por antigüedad del override"
                      value={overrideAgeFilter}
                      onChange={(event) => onOverrideAgeFilterChange(event.target.value)}
                      className="w-full appearance-none px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors pl-9 sm:w-56"
                    >
                      <option value="all">Override age: todos</option>
                      <option value="24h">Override age: ≥24h</option>
                      <option value="72h">Override age: ≥72h</option>
                    </select>
                  </label>
                  <label className="relative block">
                    <CheckCircle2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                    <select
                      aria-label="Filtrar por estado de revisión"
                      value={reviewStatusFilter}
                      onChange={(event) => onReviewStatusFilterChange(event.target.value)}
                      className="w-full appearance-none px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors pl-9 sm:w-56"
                    >
                      <option value="all">Revisión: todas</option>
                      <option value="pending">Revisión: pendientes</option>
                      <option value="reviewed">Revisión: revisadas</option>
                    </select>
                  </label>
                  <label className="relative block">
                    <ShieldAlert className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                    <select
                      aria-label="Filtrar por riesgo"
                      value={riskFilter}
                      onChange={(event) => onRiskFilterChange(event.target.value)}
                      className="w-full appearance-none px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors pl-9 sm:w-64"
                    >
                      <option value="all">Riesgo: todos</option>
                      <option value="paid_blocked">Riesgo: pagadas y bloqueadas</option>
                    </select>
                  </label>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
