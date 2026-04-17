import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Package,
  Clock3,
  Lock,
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
  CreditCard,
  Printer,
} from 'lucide-react';

const currency = (amount) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);

const statusTone = {
  paid: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  failed: 'bg-rose-100 text-rose-700',
  refunded: 'bg-zinc-200 text-zinc-700',
  new: 'bg-amber-100 text-amber-700',
  in_production: 'bg-indigo-100 text-indigo-700',
  ready: 'bg-sky-100 text-sky-700',
  shipped: 'bg-violet-100 text-violet-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
};

const COLUMNS = [
  { key: 'new', label: 'Nueva' },
  { key: 'in_production', label: 'En producción' },
  { key: 'ready', label: 'Lista' },
  { key: 'shipped', label: 'Enviada' },
  { key: 'delivered', label: 'Entregada' },
];

const FULFILLMENT_NEXT = {
  new: 'in_production',
  in_production: 'ready',
  ready: 'shipped',
  shipped: 'delivered',
};

const NEXT_LABEL = {
  new: 'En producción',
  in_production: 'Lista',
  ready: 'Enviada',
  shipped: 'Entregada',
};

const formatLabel = (value) => (value ? String(value).replace(/_/g, ' ') : '—');

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

const Badge = ({ value }) => {
  const tone = statusTone[value] || 'bg-zinc-100 text-zinc-600';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${tone}`}>
      {formatLabel(value)}
    </span>
  );
};

const ProductionSheet = ({ order }) => {
  const items = order.order_items || order.items || [];
  return (
    <div className="mt-3 border-t border-zinc-100 pt-3 flex flex-col gap-2.5">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
        <Printer size={11} /> Ficha de producción
      </p>
      <div className="space-y-1.5 text-xs">
        {order.customer_name && (
          <div className="flex items-center gap-2 text-zinc-700">
            <User size={11} className="text-zinc-400 shrink-0" />
            <span className="font-bold">{order.customer_name}</span>
          </div>
        )}
        {order.customer_email && (
          <div className="flex items-center gap-2 text-zinc-500">
            <Mail size={11} className="text-zinc-400 shrink-0" />
            <span className="truncate">{order.customer_email}</span>
          </div>
        )}
        {order.customer_phone && (
          <div className="flex items-center gap-2 text-zinc-500">
            <Phone size={11} className="text-zinc-400 shrink-0" />
            <span>{order.customer_phone}</span>
          </div>
        )}
        {order.delivery_address && (
          <div className="flex items-start gap-2 text-zinc-500">
            <MapPin size={11} className="text-zinc-400 shrink-0 mt-0.5" />
            <span className="leading-tight">{order.delivery_address}</span>
          </div>
        )}
      </div>
      {items.length > 0 && (
        <div className="bg-zinc-50 rounded-xl p-2.5 space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-800 truncate max-w-[130px]">
                {item.product_name || item.product_id || 'Producto'}
              </span>
              <span className="text-zinc-500 font-bold shrink-0 ml-2">x{item.quantity}</span>
            </div>
          ))}
        </div>
      )}
      {order.notes && (
        <div className="flex items-start gap-2 text-xs text-zinc-500 bg-amber-50 rounded-xl p-2.5">
          <FileText size={11} className="text-amber-500 shrink-0 mt-0.5" />
          <span className="leading-tight">{order.notes}</span>
        </div>
      )}
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest">
        <CreditCard size={11} className="text-zinc-400" />
        <span className="text-zinc-400">ID orden:</span>
        <span className="text-zinc-600 font-mono">{String(order.id).slice(0, 8).toUpperCase()}</span>
      </div>
    </div>
  );
};

const OrderCard = ({ order, onAdvance, busy }) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const nextStatus = FULFILLMENT_NEXT[order.fulfillment_status];
  const customerName = order.customer_name || order.customer_full_name || 'Cliente sin nombre';
  const amount = order.amount_cents || 0;

  // Gate: can't move to production without confirmed payment
  const blockedByPayment = nextStatus === 'in_production' && order.payment_status !== 'paid';
  const isInProduction = order.fulfillment_status === 'in_production';

  return (
    <div className={`bg-white rounded-[24px] border shadow-sm p-4 flex flex-col gap-3 ${isInProduction ? 'border-indigo-200' : 'border-zinc-100'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-black text-zinc-900 text-sm leading-tight truncate">{customerName}</p>
          {order.customer_email && (
            <p className="text-zinc-400 text-xs mt-0.5 truncate">{order.customer_email}</p>
          )}
        </div>
        <p className="font-black text-zinc-950 text-sm whitespace-nowrap">{currency(amount)}</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge value={order.payment_status} />
        <span className="text-zinc-300 text-xs">•</span>
        <span className="text-zinc-400 text-xs">{formatDate(order.created_at)}</span>
      </div>

      {/* Production sheet toggle */}
      {isInProduction && (
        <button
          onClick={() => setSheetOpen(v => !v)}
          className="flex items-center justify-between w-full text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Printer size={12} />
            {sheetOpen ? 'Ocultar ficha' : 'Ver ficha de producción'}
          </span>
          <ChevronDown size={12} className={`transition-transform ${sheetOpen ? 'rotate-180' : ''}`} />
        </button>
      )}

      {isInProduction && sheetOpen && <ProductionSheet order={order} />}

      {/* Advance button */}
      {nextStatus && (
        blockedByPayment ? (
          <div className="flex items-center gap-2 w-full py-2 px-3 rounded-xl border border-amber-200 bg-amber-50 text-xs font-bold text-amber-700">
            <Lock size={12} />
            Pago pendiente — no se puede producir
          </div>
        ) : (
          <button
            onClick={() => onAdvance(order.id, nextStatus)}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-xs font-bold text-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
            {NEXT_LABEL[order.fulfillment_status]}
          </button>
        )
      )}
    </div>
  );
};

const CRMDashboard = ({ orders = [], onUpdateOrder }) => {
  const [busyOrderId, setBusyOrderId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [cancelledOpen, setCancelledOpen] = useState(false);

  const handleAdvance = async (orderId, nextStatus) => {
    setBusyOrderId(orderId);
    setFeedback({ type: '', message: '' });
    try {
      await onUpdateOrder(orderId, { fulfillment_status: nextStatus });
      setFeedback({
        type: 'success',
        message: `Orden actualizada → ${formatLabel(nextStatus)}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err?.message || 'No fue posible actualizar la orden.',
      });
    } finally {
      setBusyOrderId(null);
    }
  };

  const activeOrders = useMemo(
    () => orders.filter((o) => o.fulfillment_status !== 'cancelled'),
    [orders],
  );

  const cancelledOrders = useMemo(
    () => orders.filter((o) => o.fulfillment_status === 'cancelled'),
    [orders],
  );

  const columnMap = useMemo(() => {
    const map = {};
    for (const col of COLUMNS) {
      map[col.key] = activeOrders.filter((o) => o.fulfillment_status === col.key);
    }
    return map;
  }, [activeOrders]);

  const inProductionCount = columnMap['in_production']?.length ?? 0;
  const unpaidCount = useMemo(
    () => orders.filter((o) => o.payment_status === 'pending').length,
    [orders],
  );

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 p-8">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-8">

        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-950">
              CRM — Pipeline de órdenes
            </h1>
            <p className="text-zinc-500 font-medium mt-1">
              Vista Kanban por estado de fulfillment.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <a
              href="/admin"
              className="px-4 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold text-sm hover:bg-zinc-50 transition-colors"
            >
              Dashboard
            </a>
            <a
              href="/admin/orders"
              className="px-4 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold text-sm hover:bg-zinc-50 transition-colors"
            >
              Órdenes
            </a>
            <a
              href="/admin/cards"
              className="px-4 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold text-sm hover:bg-zinc-50 transition-colors"
            >
              Cards
            </a>
          </div>
        </div>

        {/* Quick metrics */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:w-fit">
          <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm px-6 py-4 flex items-center gap-4">
            <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-500">
              <Package size={20} />
            </div>
            <div>
              <p className="text-zinc-400 text-xs font-black uppercase tracking-widest">En producción</p>
              <p className="text-2xl font-black text-zinc-950">{inProductionCount}</p>
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm px-6 py-4 flex items-center gap-4">
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-500">
              <Clock3 size={20} />
            </div>
            <div>
              <p className="text-zinc-400 text-xs font-black uppercase tracking-widest">Sin pagar</p>
              <p className="text-2xl font-black text-zinc-950">{unpaidCount}</p>
            </div>
          </div>
        </div>

        {/* Feedback */}
        {feedback.message && (
          <div
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Kanban columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 items-start">
          {COLUMNS.map((col) => {
            const colOrders = columnMap[col.key] || [];
            const headerTone = statusTone[col.key] || 'bg-zinc-100 text-zinc-600';
            return (
              <div
                key={col.key}
                className="bg-white rounded-[32px] border border-zinc-100 shadow-sm flex flex-col overflow-hidden"
              >
                {/* Column header */}
                <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between gap-2">
                  <span className="font-black text-zinc-900 text-sm">{col.label}</span>
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${headerTone}`}
                  >
                    {colOrders.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="p-3 flex flex-col gap-3 min-h-[120px]">
                  {colOrders.length === 0 ? (
                    <p className="text-zinc-300 text-xs font-bold text-center py-6">Sin órdenes</p>
                  ) : (
                    colOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onAdvance={handleAdvance}
                        busy={busyOrderId === order.id}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Cancelled collapsible section */}
        {cancelledOrders.length > 0 && (
          <div className="bg-white rounded-[32px] border border-zinc-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setCancelledOpen((v) => !v)}
              className="w-full px-6 py-4 flex items-center justify-between gap-3 hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-black text-zinc-700 text-sm">Canceladas</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                  {cancelledOrders.length}
                </span>
              </div>
              {cancelledOpen ? (
                <ChevronDown size={16} className="text-zinc-400" />
              ) : (
                <ChevronRight size={16} className="text-zinc-400" />
              )}
            </button>

            {cancelledOpen && (
              <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 border-t border-zinc-100 pt-4">
                {cancelledOrders.map((order) => {
                  const customerName =
                    order.customer_name || order.customer_full_name || 'Cliente sin nombre';
                  const amount = order.amount_cents || 0;
                  return (
                    <div
                      key={order.id}
                      className="bg-zinc-50 rounded-[20px] border border-zinc-100 p-4 flex flex-col gap-2 opacity-60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-black text-zinc-900 text-sm leading-tight">{customerName}</p>
                          {order.customer_email && (
                            <p className="text-zinc-400 text-xs mt-0.5 truncate max-w-[180px]">
                              {order.customer_email}
                            </p>
                          )}
                        </div>
                        <p className="font-black text-zinc-700 text-sm whitespace-nowrap">{currency(amount)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge value={order.payment_status} />
                        <span className="text-zinc-300 text-xs">•</span>
                        <span className="text-zinc-400 text-xs">{formatDate(order.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CRMDashboard;
