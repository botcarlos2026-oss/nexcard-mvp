import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { TH, TR, TD } from '../ui/AdminTable';
import AdminBadge from '../ui/AdminBadge';
import { currency, formatDate, formatLabel, fulfillmentBadgeVariant, paymentBadgeVariant } from './utils';

export default function OrdersTable({
  orders,
  selectedOrderId,
  busyOrderId,
  fulfillmentNext,
  onMarkPaid,
  onAdvanceFulfillment,
  onSelectOrder,
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="bg-zinc-800/50 border-b border-zinc-800">
          <tr className="text-xs uppercase tracking-wide text-zinc-500">
            <TH>Folio</TH>
            <TH>Orden</TH>
            <TH>Cliente</TH>
            <TH>Monto</TH>
            <TH>Pago</TH>
            <TH>Fulfillment</TH>
            <TH>Activación</TH>
            <TH>Ítems</TH>
            <TH>Fecha</TH>
            <TH className="text-right">Acción</TH>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {orders.map((order) => (
            <TR key={order.id} active={selectedOrderId === order.id}>
              <TD>
                <AdminBadge variant="default">{order.folio || '—'}</AdminBadge>
              </TD>
              <TD>
                <div>
                  <p className="font-bold text-white text-sm">{order.id}</p>
                  <p className="text-xs text-zinc-500 font-medium">{order.payment_method || 'Sin método'} · {order.delivery_type || 'Sin entrega'}</p>
                  <div className="mt-1.5">
                    <AdminBadge variant={order.inventory_reserved ? 'success' : 'default'}>
                      {order.inventory_reserved ? 'Stock reservado' : 'Sin reserva'}
                    </AdminBadge>
                  </div>
                </div>
              </TD>
              <TD>
                <div>
                  <p className="font-bold text-white text-sm">{order.customerLabel}</p>
                  <p className="text-xs text-zinc-500 font-medium">{order.customer_email || order.customer_phone || 'Sin contacto'}</p>
                  {order.isNonOperational && (
                    <div className="mt-1.5">
                      <AdminBadge variant="warning">QA/test · {formatLabel(order.testReasonResolved)}</AdminBadge>
                    </div>
                  )}
                </div>
              </TD>
              <TD className="font-bold text-white">{currency(order.totalCents)}</TD>
              <TD>
                <div className="flex flex-col gap-1.5">
                  <AdminBadge variant={paymentBadgeVariant(order.payment_status)}>
                    {formatLabel(order.payment_status)}
                  </AdminBadge>
                  {order.payment_status !== 'paid' && (
                    <button
                      type="button"
                      onClick={() => onMarkPaid(order)}
                      disabled={busyOrderId === order.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-400 text-[10px] font-bold hover:bg-emerald-950/70 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 size={10} />
                      Marcar pagado
                    </button>
                  )}
                </div>
              </TD>
              <TD>
                <div className="flex flex-col gap-1.5">
                  <AdminBadge variant={fulfillmentBadgeVariant(order.fulfillment_status)}>
                    {formatLabel(order.fulfillment_status)}
                  </AdminBadge>
                  {fulfillmentNext[order.fulfillment_status] && (
                    <button
                      type="button"
                      onClick={() => onAdvanceFulfillment(order)}
                      disabled={busyOrderId === order.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-950/40 border border-blue-800 text-blue-400 text-[10px] font-bold hover:bg-blue-950/70 transition-colors disabled:opacity-50"
                    >
                      → {formatLabel(fulfillmentNext[order.fulfillment_status])}
                    </button>
                  )}
                </div>
              </TD>
              <TD>
                <AdminBadge variant={order.activation_ready ? 'success' : order.active_cards_count > 0 ? 'info' : 'warning'}>
                  {order.activation_ready ? `Lista (${order.activation_ready_count})` : order.active_cards_count > 0 ? `Activas (${order.active_cards_count})` : 'Pendiente'}
                </AdminBadge>
              </TD>
              <TD className="font-bold text-zinc-300">{order.itemCount}</TD>
              <TD className="text-zinc-400">{formatDate(order.created_at)}</TD>
              <TD className="text-right">
                <button
                  type="button"
                  onClick={() => onSelectOrder(order.id)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Ver detalle
                </button>
              </TD>
            </TR>
          ))}

          {orders.length === 0 && (
            <tr>
              <td colSpan={10} className="px-8 py-12 text-center text-sm font-semibold text-zinc-500">
                No hay órdenes que coincidan con los filtros activos.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
