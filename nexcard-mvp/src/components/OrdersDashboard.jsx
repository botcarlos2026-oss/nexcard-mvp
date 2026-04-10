import React, { useEffect, useMemo, useState } from 'react';
import {
  Package,
  DollarSign,
  Clock3,
  Search,
  Filter,
  Receipt,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { api } from '../services/api';

const currency = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

const statusTone = {
  paid: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  failed: 'bg-rose-100 text-rose-700',
  refunded: 'bg-zinc-200 text-zinc-700',
  new: 'bg-sky-100 text-sky-700',
  in_production: 'bg-indigo-100 text-indigo-700',
  ready: 'bg-emerald-100 text-emerald-700',
  shipped: 'bg-violet-100 text-violet-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
};

const formatLabel = (value) => (value ? String(value).replace(/_/g, ' ') : '—');

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

const OrdersDashboard = ({ orders = [] }) => {
  const [rows, setRows] = useState(orders);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('all');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [busyOrderId, setBusyOrderId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    setRows(orders);
  }, [orders]);

  const normalizedOrders = useMemo(() => rows.map((order) => {
    const items = order.order_items || [];
    const payments = order.payments || [];
    const totalCents = order.amount_cents || 0;
    const totalCostCents = items.reduce((sum, item) => sum + ((item.unit_cost_cents || 0) * (item.quantity || 0)), 0);
    const customerName = order.customer_name || order.customer_full_name || 'Cliente sin nombre';
    const paymentRecord = payments[0] || null;

    return {
      ...order,
      items,
      payments,
      totalCents,
      totalCostCents,
      grossMarginCents: totalCents - totalCostCents,
      itemCount: items.reduce((sum, item) => sum + (item.quantity || 0), 0),
      customerLabel: customerName,
      paymentProvider: paymentRecord?.provider || order.payment_method || '—',
      paymentReference: paymentRecord?.transaction_reference || '—',
      paidAt: paymentRecord?.paid_at || null,
    };
  }), [rows]);

  const paymentStatuses = useMemo(() => ['all', ...Array.from(new Set(normalizedOrders.map((order) => order.payment_status).filter(Boolean)))], [normalizedOrders]);
  const fulfillmentStatuses = useMemo(() => ['all', ...Array.from(new Set(normalizedOrders.map((order) => order.fulfillment_status).filter(Boolean)))], [normalizedOrders]);

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return normalizedOrders.filter((order) => {
      const matchesPayment = paymentFilter === 'all' || order.payment_status === paymentFilter;
      const matchesFulfillment = fulfillmentFilter === 'all' || order.fulfillment_status === fulfillmentFilter;

      if (!matchesPayment || !matchesFulfillment) return false;
      if (!term) return true;

      const haystack = [
        order.id,
        order.customerLabel,
        order.customer_email,
        order.customer_phone,
        order.payment_method,
        order.fulfillment_status,
        order.payment_status,
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(term);
    });
  }, [normalizedOrders, searchTerm, paymentFilter, fulfillmentFilter]);

  const selectedOrder = filteredOrders.find((order) => order.id === selectedOrderId) || filteredOrders[0] || null;

  const updateOrderField = async (orderId, payload, successMessage) => {
    setBusyOrderId(orderId);
    setFeedback({ type: '', message: '' });
    try {
      const response = await api.updateOrder(orderId, payload);
      setRows(response.orders || []);
      setFeedback({ type: 'success', message: successMessage });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'No fue posible actualizar la orden.' });
    } finally {
      setBusyOrderId(null);
    }
  };

  const stats = useMemo(() => {
    const paidOrders = normalizedOrders.filter((order) => order.payment_status === 'paid');
    const paidRevenue = paidOrders.reduce((sum, order) => sum + order.totalCents, 0);
    const pendingOrders = normalizedOrders.filter((order) => !['delivered', 'cancelled'].includes(order.fulfillment_status)).length;
    const overdueOrders = normalizedOrders.filter((order) => ['pending', 'new'].includes(order.payment_status) || ['new'].includes(order.fulfillment_status)).length;
    const avgTicket = normalizedOrders.length ? normalizedOrders.reduce((sum, order) => sum + order.totalCents, 0) / normalizedOrders.length : 0;

    return [
      { label: 'Ventas cobradas', value: currency.format(paidRevenue / 100), icon: DollarSign, color: 'text-emerald-500' },
      { label: 'Pedidos pendientes', value: `${pendingOrders}`, icon: Package, color: 'text-amber-500' },
      { label: 'Pedidos atrasados', value: `${overdueOrders}`, icon: AlertCircle, color: 'text-rose-500' },
      { label: 'Ticket promedio', value: currency.format(avgTicket / 100), icon: Receipt, color: 'text-blue-500' },
    ];
  }, [normalizedOrders]);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 mb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-950">Orders Control Center</h1>
            <p className="text-zinc-500 font-medium">Caja, producción y cumplimiento en una sola mesa de control operativa.</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <a href="/admin" className="px-4 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold text-sm">Dashboard</a>
            <a href="/admin/cards" className="px-4 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold text-sm">Cards</a>
            <a href="/admin/profiles" className="px-4 py-3 bg-zinc-950 text-white rounded-2xl font-bold text-sm">Profiles</a>
            <a href="/admin/inventory" className="px-4 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold text-sm">Inventario</a>
          </div>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
              <div className={`p-3 rounded-2xl bg-zinc-50 inline-flex mb-4 ${stat.color}`}>
                <stat.icon size={24} />
              </div>
              <p className="text-zinc-400 text-xs font-black uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-3xl font-black mt-1">{stat.value}</h3>
            </div>
          ))}
        </div>

        {feedback.message && (
          <div className={`mb-6 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="grid lg:grid-cols-[1.5fr,1fr] gap-6">
          <div className="bg-white rounded-[32px] border border-zinc-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-zinc-100 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex gap-3 flex-1 flex-col sm:flex-row">
                <label className="relative block flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input
                    type="search"
                    placeholder="Buscar por ID, cliente, email o teléfono"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 py-3 pl-10 pr-4 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </label>
                <label className="relative block">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <select
                    value={paymentFilter}
                    onChange={(event) => setPaymentFilter(event.target.value)}
                    className="w-full appearance-none rounded-2xl border border-zinc-200 bg-zinc-50 py-3 pl-10 pr-8 text-sm font-bold outline-none sm:w-52"
                  >
                    {paymentStatuses.map((status) => (
                      <option key={status} value={status}>{status === 'all' ? 'Todos los pagos' : formatLabel(status)}</option>
                    ))}
                  </select>
                </label>
                <label className="relative block">
                  <Clock3 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <select
                    value={fulfillmentFilter}
                    onChange={(event) => setFulfillmentFilter(event.target.value)}
                    className="w-full appearance-none rounded-2xl border border-zinc-200 bg-zinc-50 py-3 pl-10 pr-8 text-sm font-bold outline-none sm:w-56"
                  >
                    {fulfillmentStatuses.map((status) => (
                      <option key={status} value={status}>{status === 'all' ? 'Todos los estados' : formatLabel(status)}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead>
                  <tr className="bg-zinc-50/50 text-zinc-400 text-[10px] uppercase tracking-widest font-black">
                    <th className="px-8 py-4">Orden</th>
                    <th className="px-8 py-4">Cliente</th>
                    <th className="px-8 py-4">Monto</th>
                    <th className="px-8 py-4">Pago</th>
                    <th className="px-8 py-4">Fulfillment</th>
                    <th className="px-8 py-4">Ítems</th>
                    <th className="px-8 py-4">Fecha</th>
                    <th className="px-8 py-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-zinc-50/30 transition-colors">
                      <td className="px-8 py-5">
                        <div>
                          <p className="font-black text-sm">{order.id}</p>
                          <p className="text-xs text-zinc-400 font-medium">{order.payment_method || 'Sin método'} · {order.delivery_type || 'Sin entrega'}</p>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div>
                          <p className="font-bold text-sm text-zinc-900">{order.customerLabel}</p>
                          <p className="text-xs text-zinc-400 font-medium">{order.customer_email || order.customer_phone || 'Sin contacto'}</p>
                        </div>
                      </td>
                      <td className="px-8 py-5 font-black text-zinc-900">{currency.format(order.totalCents / 100)}</td>
                      <td className="px-8 py-5">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${statusTone[order.payment_status] || 'bg-zinc-100 text-zinc-700'}`}>
                          {formatLabel(order.payment_status)}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${statusTone[order.fulfillment_status] || 'bg-zinc-100 text-zinc-700'}`}>
                          {formatLabel(order.fulfillment_status)}
                        </span>
                      </td>
                      <td className="px-8 py-5 font-bold text-zinc-700">{order.itemCount}</td>
                      <td className="px-8 py-5 text-sm font-medium text-zinc-600">{formatDate(order.created_at)}</td>
                      <td className="px-8 py-5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedOrderId(order.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-black uppercase tracking-wide text-zinc-700 transition hover:bg-zinc-50"
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-8 py-12 text-center text-sm font-semibold text-zinc-500">
                        No hay órdenes que coincidan con los filtros activos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-[32px] border border-zinc-100 shadow-sm p-6">
            <h2 className="font-black text-xl mb-4">Detalle de orden</h2>
            {selectedOrder ? (
              <div className="space-y-5">
                <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Cliente</p>
                  <p className="font-black text-zinc-950">{selectedOrder.customerLabel}</p>
                  <p className="text-sm text-zinc-500 font-medium">{selectedOrder.customer_email || 'Sin email'}</p>
                  <p className="text-sm text-zinc-500 font-medium">{selectedOrder.customer_phone || 'Sin teléfono'}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Pago</p>
                    <select
                      value={selectedOrder.payment_status || ''}
                      onChange={(event) => updateOrderField(selectedOrder.id, { payment_status: event.target.value }, `Estado de pago actualizado para ${selectedOrder.id}.`)}
                      disabled={busyOrderId === selectedOrder.id}
                      className="w-full appearance-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {['pending', 'paid', 'failed', 'refunded'].map((status) => (
                        <option key={status} value={status}>{formatLabel(status)}</option>
                      ))}
                    </select>
                    <p className="text-sm font-semibold text-zinc-700 mt-3">Proveedor: {selectedOrder.paymentProvider}</p>
                    <p className="text-xs text-zinc-500 mt-1">Ref: {selectedOrder.paymentReference}</p>
                    <p className="text-xs text-zinc-500 mt-1">Pagado: {formatDate(selectedOrder.paidAt)}</p>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Operación</p>
                    <select
                      value={selectedOrder.fulfillment_status || ''}
                      onChange={(event) => updateOrderField(selectedOrder.id, { fulfillment_status: event.target.value }, `Estado operativo actualizado para ${selectedOrder.id}.`)}
                      disabled={busyOrderId === selectedOrder.id}
                      className="w-full appearance-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {['new', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled'].map((status) => (
                        <option key={status} value={status}>{formatLabel(status)}</option>
                      ))}
                    </select>
                    <p className="text-sm font-semibold text-zinc-700 mt-3">Entrega: {selectedOrder.delivery_type || '—'}</p>
                    <p className="text-xs text-zinc-500 mt-1">Dirección: {selectedOrder.delivery_address || '—'}</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-zinc-950 text-white p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-3">Caja y margen</p>
                  <div className="grid grid-cols-2 gap-4 text-sm font-bold">
                    <div>
                      <p className="text-zinc-400">Venta</p>
                      <p className="text-xl font-black">{currency.format(selectedOrder.totalCents / 100)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-400">Margen bruto</p>
                      <p className="text-xl font-black">{currency.format(selectedOrder.grossMarginCents / 100)}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-3">Ítems</p>
                  <div className="space-y-3">
                    {selectedOrder.items.length > 0 ? selectedOrder.items.map((item, index) => (
                      <div key={`${selectedOrder.id}-${index}`} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-black text-sm text-zinc-900">{item.product_name || item.product_id || 'Producto'}</p>
                            <p className="text-xs text-zinc-500 font-medium">SKU: {item.sku || '—'}</p>
                          </div>
                          <div className="text-right text-sm font-bold text-zinc-700">
                            <p>x{item.quantity || 0}</p>
                            <p>{currency.format(((item.unit_price_cents || 0) * (item.quantity || 0)) / 100)}</p>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-zinc-200 p-4 text-sm font-medium text-zinc-500">
                        La orden no trae items asociados en esta consulta.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-100 bg-white p-4 space-y-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Contacto</p>
                    <div className="grid gap-3">
                      <input
                        type="text"
                        value={selectedOrder.customer_phone || ''}
                        onChange={(event) => updateOrderField(selectedOrder.id, { customer_phone: event.target.value }, `Teléfono actualizado para ${selectedOrder.id}.`)}
                        disabled={busyOrderId === selectedOrder.id}
                        placeholder="Teléfono cliente"
                        className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <input
                        type="text"
                        value={selectedOrder.customer_email || ''}
                        onChange={(event) => updateOrderField(selectedOrder.id, { customer_email: event.target.value }, `Email actualizado para ${selectedOrder.id}.`)}
                        disabled={busyOrderId === selectedOrder.id}
                        placeholder="Email cliente"
                        className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Dirección / retiro</p>
                    <textarea
                      value={selectedOrder.delivery_address || ''}
                      onChange={(event) => updateOrderField(selectedOrder.id, { delivery_address: event.target.value }, `Dirección actualizada para ${selectedOrder.id}.`)}
                      disabled={busyOrderId === selectedOrder.id}
                      rows="3"
                      placeholder="Dirección de despacho o instrucción de retiro"
                      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                    />
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Notas</p>
                    <textarea
                      value={selectedOrder.notes || ''}
                      onChange={(event) => updateOrderField(selectedOrder.id, { notes: event.target.value }, `Notas actualizadas para ${selectedOrder.id}.`)}
                      disabled={busyOrderId === selectedOrder.id}
                      rows="4"
                      placeholder="Observaciones operativas internas"
                      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700 outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 flex items-start gap-3">
                  {busyOrderId === selectedOrder.id ? <Loader2 size={18} className="mt-0.5 animate-spin" /> : <AlertCircle size={18} className="mt-0.5" />}
                  <span>Este MVP ya permite cambio manual de estados. La siguiente iteración debería sumar edición operativa, acciones masivas y SLA visible.</span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-200 p-6 text-sm font-medium text-zinc-500">
                No hay una orden seleccionada todavía.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrdersDashboard;
