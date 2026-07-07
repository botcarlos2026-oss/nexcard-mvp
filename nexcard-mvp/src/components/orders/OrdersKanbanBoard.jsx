import React, { useMemo } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Search } from 'lucide-react';
import AdminBadge from '../ui/AdminBadge';
import {
  buildOrdersKanbanGroups,
  buildOrdersKanbanSummary,
  currency,
  deriveActivationStatus,
  deriveOrderNextAction,
  deriveOrderSlaAlert,
  formatDate,
  formatLabel,
  fulfillmentBadgeVariant,
  KANBAN_LANES,
  KANBAN_PRIORITY_ORDER,
  isOrderReadyForDispatch,
  paymentBadgeVariant,
} from './utils';

const laneAccent = {
  paid_new: 'border-emerald-900/60 bg-emerald-950/10',
  in_production: 'border-blue-900/60 bg-blue-950/10',
  ready_to_ship: 'border-purple-900/60 bg-purple-950/10',
  shipped_pending_delivery: 'border-amber-900/60 bg-amber-950/10',
  delivered: 'border-zinc-700 bg-zinc-900/40',
  alerts: 'border-red-900/70 bg-red-950/10',
};

const summaryCards = [
  { key: 'today', label: 'Total visible' },
  { key: 'paidNew', label: 'Pagadas' },
  { key: 'inProduction', label: 'Producción' },
  { key: 'readyToShip', label: 'Despacho' },
  { key: 'alerts', label: 'Alertas' },
];

function OrderKanbanCard({ order, laneKey, selected, busy, fulfillmentNext, onMarkPaid, onAdvanceFulfillment, onSelectOrder }) {
  const activation = deriveActivationStatus(order);
  const slaAlert = deriveOrderSlaAlert(order);
  const nextAction = deriveOrderNextAction(order);
  const nextFulfillment = fulfillmentNext[order.fulfillment_status];
  const canQuickAdvance = laneKey === 'paid_new'
    || (laneKey === 'in_production' && isOrderReadyForDispatch(order))
    || (laneKey === 'shipped_pending_delivery' && order.payment_status === 'paid' && !!order.tracking_code);
  const actionLabel = (() => {
    if (laneKey === 'alerts') return 'Revisar alerta';
    if (laneKey === 'ready_to_ship') return 'Registrar despacho';
    if (laneKey === 'delivered') return 'Ver detalle';
    if (laneKey === 'in_production' && !isOrderReadyForDispatch(order)) return 'Vincular / programar NFC';
    if (canQuickAdvance && nextFulfillment) return `Mover a ${formatLabel(nextFulfillment)}`;
    if (order.payment_status !== 'paid') return 'Revisar pago';
    return 'Abrir detalle';
  })();
  const action = canQuickAdvance && nextFulfillment
    ? () => onAdvanceFulfillment(order)
    : order.payment_status !== 'paid' && laneKey !== 'alerts'
      ? () => onMarkPaid(order)
      : () => onSelectOrder(order.id);

  return (
    <article
      className={`rounded-2xl border p-3 transition-colors ${selected ? 'border-emerald-500 bg-emerald-950/20' : 'border-zinc-800 bg-zinc-950/70 hover:border-emerald-900'}`}
      data-cy="order-kanban-card"
      data-order-id={order.id}
      data-lane={laneKey}
    >
      <button type="button" onClick={() => onSelectOrder(order.id)} className="block w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-black text-white text-sm">{order.folio || order.id}</p>
            <p className="mt-1 text-xs font-semibold text-zinc-500">{formatDate(order.created_at)}</p>
          </div>
          <AdminBadge variant={paymentBadgeVariant(order.payment_status)}>{formatLabel(order.payment_status)}</AdminBadge>
        </div>
        <p className="mt-3 text-sm font-extrabold text-zinc-100">{order.customerLabel}</p>
        <p className="mt-0.5 truncate text-xs font-medium text-zinc-500">{order.customer_email || order.customer_phone || 'Sin contacto'}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <AdminBadge variant={fulfillmentBadgeVariant(order.fulfillment_status)}>{formatLabel(order.fulfillment_status)}</AdminBadge>
          <AdminBadge variant={activation.variant}>{activation.label}</AdminBadge>
          {slaAlert && <AdminBadge variant={slaAlert.level === 'critical' ? 'danger' : 'warning'}>{slaAlert.label}</AdminBadge>}
          {order.isNonOperational && <AdminBadge variant="warning">QA/test</AdminBadge>}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 p-2 text-xs font-bold">
          <div>
            <p className="text-zinc-500">Venta</p>
            <p className="text-white">{currency(order.totalCents)}</p>
          </div>
          <div>
            <p className="text-zinc-500">Ítems</p>
            <p className="text-white">{order.itemCount}</p>
          </div>
        </div>
        <p className="mt-3 rounded-xl bg-zinc-950 px-3 py-2 text-xs font-extrabold text-emerald-300">
          {nextAction}
        </p>
      </button>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          data-cy="order-kanban-primary-action"
          onClick={action}
          disabled={busy}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-emerald-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? <Clock3 size={13} /> : <ArrowRight size={13} />}
          {actionLabel}
        </button>
        <button
          type="button"
          data-cy="order-kanban-view-action"
          onClick={() => onSelectOrder(order.id)}
          className="rounded-xl border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
        >
          Ver
        </button>
      </div>
    </article>
  );
}

export default function OrdersKanbanBoard({
  orders,
  selectedOrderId,
  busyOrderId,
  fulfillmentNext,
  onMarkPaid,
  onAdvanceFulfillment,
  onSelectOrder,
  onOperationalFilterChange,
}) {
  const groups = useMemo(() => buildOrdersKanbanGroups(orders), [orders]);
  const summary = useMemo(() => buildOrdersKanbanSummary(orders), [orders]);
  const firstAction = KANBAN_PRIORITY_ORDER
    .map((key) => KANBAN_LANES.find((lane) => lane.key === key))
    .find((lane) => lane && groups[lane.key]?.length > 0 && lane.key !== 'delivered');

  return (
    <section className="space-y-4" data-cy="orders-kanban-board">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-emerald-900/70 bg-emerald-950/20 p-4 sm:col-span-2 xl:col-span-1">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Próxima acción</p>
          <p className="mt-2 text-2xl font-black text-white">
            {firstAction ? `${groups[firstAction.key].length} en ${firstAction.label}` : 'Sin pendientes'}
          </p>
          <p className="mt-1 text-xs font-semibold text-zinc-500">Ordena la tarde por prioridad operativa.</p>
        </div>
        {summaryCards.map((card) => (
          <button
            key={card.key}
            data-cy={`orders-kanban-summary-${card.key}`}
            type="button"
            onClick={() => {
              if (card.key === 'paidNew') onOperationalFilterChange('paid_new');
              else if (card.key === 'inProduction') onOperationalFilterChange('in_production');
              else if (card.key === 'readyToShip') onOperationalFilterChange('ready_to_ship');
              else if (card.key === 'alerts') onOperationalFilterChange('alerts');
              else onOperationalFilterChange('all');
            }}
            className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-left transition-colors hover:border-emerald-900"
          >
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">{card.label}</p>
            <p className="mt-2 text-3xl font-black text-white">{summary[card.key]}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold text-zinc-300">
          <Search size={16} className="text-zinc-500" />
          Kanban compacto: cada card muestra estado, activación y próxima acción.
        </div>
        <button
          type="button"
          onClick={() => onOperationalFilterChange('alerts')}
          className="inline-flex items-center gap-2 rounded-full border border-red-900 bg-red-950/30 px-3 py-1.5 text-xs font-black text-red-300 hover:bg-red-950/50"
        >
          <AlertTriangle size={14} />
          Ver problemas
        </button>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1380px] grid-cols-6 gap-3">
          {KANBAN_LANES.map((lane) => (
            <section key={lane.key} data-cy={`orders-kanban-lane-${lane.key}`} className={`min-h-[460px] rounded-2xl border p-3 ${laneAccent[lane.key]}`}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-white">{lane.label}</h3>
                  <p className="mt-1 text-[11px] font-semibold leading-snug text-zinc-500">{lane.description}</p>
                </div>
                <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-xs font-black text-emerald-300">
                  {groups[lane.key]?.length || 0}
                </span>
              </div>
              <div className="space-y-2">
                {(groups[lane.key] || []).map((order) => (
                  <OrderKanbanCard
                    key={order.id}
                    order={order}
                    laneKey={lane.key}
                    selected={selectedOrderId === order.id}
                    busy={busyOrderId === order.id}
                    fulfillmentNext={fulfillmentNext}
                    onMarkPaid={onMarkPaid}
                    onAdvanceFulfillment={onAdvanceFulfillment}
                    onSelectOrder={onSelectOrder}
                  />
                ))}
                {(groups[lane.key] || []).length === 0 && (
                  <div className="rounded-2xl border border-dashed border-zinc-800 p-4 text-center text-xs font-bold text-zinc-600">
                    Sin órdenes en esta columna.
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-500">
        <CheckCircle2 size={14} className="text-emerald-400" />
        Botones protegidos: los cambios de estado siguen usando las RPC/API existentes; no hay drag & drop accidental.
      </div>
    </section>
  );
}
