import React from 'react';
import AdminBadge from '../ui/AdminBadge';
import { formatActorLabel, formatDate, formatLabel } from './utils';
import { isManualTestReason } from '../../utils/orderOperationalSegmentation';

export default function OrderQaAuditCard({
  order,
  overrideAudit,
  qaTimeline,
  busyOrderId,
  reviewNote,
  onReviewNoteChange,
  testOverrideReason,
  onTestOverrideReasonChange,
  onApplyTestOverride,
  onReviewTestClassification,
}) {
  return (
    <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Cliente</p>
        <p className="font-bold text-white">{order.customerLabel}</p>
        <p className="text-sm text-zinc-400 font-medium">{order.customer_email || 'Sin email'}</p>
        <p className="text-sm text-zinc-400 font-medium">{order.customer_phone || 'Sin teléfono'}</p>
      </div>

      <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Segregación QA/test</p>
            <p className="text-sm font-semibold text-white mt-1">
              {order.is_test ? 'Excluida de operación real' : 'Incluida en operación real'}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Motivo actual: {order.test_reason ? formatLabel(order.test_reason) : 'sin motivo'}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Último override: {overrideAudit ? `${formatActorLabel(overrideAudit)} · ${formatDate(overrideAudit.changed_at)}` : 'sin trazabilidad manual registrada'}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Última revisión: {order.qa_reviewed_at ? `${order.qa_reviewed_by_label || 'admin'} · ${formatDate(order.qa_reviewed_at)}` : 'pendiente de revisión'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {order.manualOverrideSeverity?.level && (
              <AdminBadge variant={order.manualOverrideSeverity.level === 'critical' ? 'danger' : order.manualOverrideSeverity.level === 'high' ? 'warning' : 'default'}>
                {order.manualOverrideSeverity.level} · {order.manualOverrideSeverity.ageHours}h
              </AdminBadge>
            )}
            <AdminBadge variant={order.is_test ? 'warning' : 'success'}>
              {order.is_test ? 'QA/test' : 'Operativa real'}
            </AdminBadge>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-4">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Timeline decisión QA</p>
            <p className="text-[11px] text-zinc-500">Clasificación → override → revisión → restore</p>
          </div>
          {qaTimeline.length === 0 ? (
            <p className="text-sm text-zinc-500">Sin eventos QA relevantes todavía.</p>
          ) : (
            <div className="space-y-3">
              {qaTimeline.map((event) => {
                const toneClasses = event.tone === 'success'
                  ? 'border-emerald-800 bg-emerald-950/20 text-emerald-300'
                  : event.tone === 'warning'
                    ? 'border-amber-800 bg-amber-950/20 text-amber-300'
                    : event.tone === 'info'
                      ? 'border-sky-800 bg-sky-950/20 text-sky-300'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-300';
                return (
                  <div key={event.key} className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <div className={`h-3 w-3 rounded-full border ${event.tone === 'success' ? 'border-emerald-500 bg-emerald-500' : event.tone === 'warning' ? 'border-amber-500 bg-amber-500' : event.tone === 'info' ? 'border-sky-500 bg-sky-500' : 'border-zinc-500 bg-zinc-500'}`} />
                      {!event.isLast && <div className="mt-1 w-px flex-1 bg-zinc-700 min-h-[28px]" />}
                    </div>
                    <div className={`flex-1 rounded-xl border p-3 ${toneClasses}`}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="text-sm font-bold">{event.title}</p>
                          <p className="mt-1 text-xs opacity-80">{event.detail}</p>
                        </div>
                        <div className="text-right text-[11px] opacity-80">
                          <p className="font-bold">{event.actor}</p>
                          <p>{formatDate(event.at)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {order.is_test && isManualTestReason(order.test_reason) && (
          <div className="rounded-xl border border-fuchsia-800 bg-fuchsia-950/20 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-300">Decisión rápida</p>
                <p className="text-sm text-zinc-300 mt-1">
                  Esta orden llegó aquí por override manual. Ahora puedes distinguir quién la clasificó y quién la auditó después.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onApplyTestOverride(order, true)}
                  disabled={busyOrderId === order.id}
                  className="px-3 py-2 bg-fuchsia-700 hover:bg-fuchsia-600 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                >
                  Mantener QA
                </button>
                <button
                  type="button"
                  onClick={() => onApplyTestOverride(order, false)}
                  disabled={busyOrderId === order.id}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                >
                  Restaurar real
                </button>
              </div>
            </div>
            <textarea
              value={reviewNote}
              onChange={(event) => onReviewNoteChange(event.target.value)}
              disabled={busyOrderId === order.id}
              rows="2"
              placeholder="Nota de auditoría: ej. revisada y se mantiene QA por smoke controlado"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors resize-none"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onReviewTestClassification(order)}
                disabled={busyOrderId === order.id}
                className="px-3 py-2 bg-sky-700 hover:bg-sky-600 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                Marcar revisión QA
              </button>
              <p className="text-[11px] text-zinc-500">
                La revisión queda separada del override y se reinicia si alguien reclasifica la orden.
              </p>
            </div>
          </div>
        )}
        <textarea
          value={testOverrideReason}
          onChange={(event) => onTestOverrideReasonChange(event.target.value)}
          disabled={busyOrderId === order.id}
          rows="2"
          placeholder={order.is_test ? 'Ej: pedido real corregido manualmente' : 'Ej: smoke interno / demo'}
          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors resize-none"
        />
        <div className="flex flex-wrap gap-2">
          {order.is_test ? (
            <button
              type="button"
              onClick={() => onApplyTestOverride(order, false)}
              disabled={busyOrderId === order.id}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
            >
              Restaurar como orden real
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onApplyTestOverride(order, true)}
              disabled={busyOrderId === order.id}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
            >
              Marcar como QA/test
            </button>
          )}
          <p className="text-[11px] text-zinc-500 self-center">
            Override manual persistente para corregir clasificaciones erróneas sin tocar datos del cliente.
          </p>
        </div>
      </div>
    </div>
  );
}
