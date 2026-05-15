import React from 'react';
import { Loader2 } from 'lucide-react';
import AdminBadge from '../ui/AdminBadge';
import { currency } from './utils';

export default function OrderRefundCard({ order, refundByOrder, refundForm, onRefundFormChange, refundBusy, onProcessRefund }) {
  const existingRefund = refundByOrder[order.id];
  const canRefund = order.payment_status === 'paid' && order.fulfillment_status !== 'delivered' && !existingRefund;
  const isRefunded = order.payment_status === 'refunded';

  if (existingRefund || isRefunded) {
    const refund = existingRefund;
    const refundVariant = {
      pending: 'warning',
      processed: 'success',
      rejected: 'danger',
      approved: 'info',
    };
    return (
      <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Devolución registrada</p>
        {refund ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400 font-medium">Estado</span>
              <AdminBadge variant={refundVariant[refund.status] || 'default'}>
                {refund.status === 'processed' ? 'Procesado' : refund.status === 'pending' ? 'Pendiente' : refund.status === 'rejected' ? 'Rechazado' : refund.status}
              </AdminBadge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400 font-medium">Monto</span>
              <span className="text-sm text-white font-bold">{currency(refund.amount_cents)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400 font-medium">Motivo</span>
              <span className="text-sm text-zinc-200 font-medium">{refund.reason}</span>
            </div>
            {refund.mp_refund_id && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400 font-medium">ID MP</span>
                <span className="text-xs text-zinc-400 font-mono">{refund.mp_refund_id}</span>
              </div>
            )}
            {refund.notes && <p className="text-xs text-zinc-500 italic mt-1">{refund.notes}</p>}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Orden marcada como reembolsada.</p>
        )}
      </div>
    );
  }

  if (!canRefund) return null;

  return (
    <div className="rounded-xl border border-red-900 bg-zinc-800 p-4 space-y-4">
      <p className="text-xs font-bold uppercase tracking-widest text-red-400">Gestión de devolución</p>
      <div className="space-y-3">
        <div>
          <label className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Motivo</label>
          <select
            value={refundForm.reason}
            onChange={(e) => onRefundFormChange({ ...refundForm, reason: e.target.value })}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
          >
            <option>Producto defectuoso</option>
            <option>No llegó</option>
            <option>No cumple expectativas</option>
            <option>Error en pedido</option>
            <option>Otro</option>
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Monto a reembolsar (CLP)</label>
          <input
            type="number"
            min="1"
            max={order.amount_cents}
            value={refundForm.amount_cents}
            onChange={(e) => onRefundFormChange({ ...refundForm, amount_cents: e.target.value })}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
            placeholder={`Máx. ${order.amount_cents}`}
          />
          <p className="text-xs text-zinc-600 mt-1">Reembolso parcial posible — edita el monto si aplica</p>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Notas internas (opcional)</label>
          <textarea
            rows={2}
            value={refundForm.notes}
            onChange={(e) => onRefundFormChange({ ...refundForm, notes: e.target.value })}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors resize-none"
            placeholder="Observaciones para el equipo..."
          />
        </div>
        <button
          type="button"
          onClick={onProcessRefund}
          disabled={refundBusy || !refundForm.amount_cents}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {refundBusy ? <Loader2 size={16} className="animate-spin" /> : null}
          {refundBusy ? 'Procesando reembolso...' : 'Procesar devolución'}
        </button>
      </div>
    </div>
  );
}
