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
  Link2,
  Calendar,
  Bell,
  RefreshCw,
  Download,
  Truck,
  ExternalLink,
  Wifi,
  QrCode,
} from 'lucide-react';
import { api } from '../services/api';
import QRCode from 'qrcode';
import CardPreview from './CardPreview';
import { generateCardSVG } from '../utils/cardTemplates';
import AdminShell from './AdminShell';
import AdminCard from './ui/AdminCard';
import AdminStat from './ui/AdminStat';
import { Table, THead, TH, TR, TD } from './ui/AdminTable';
import AdminBadge from './ui/AdminBadge';

const currency = (cents) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(cents);
};

const formatLabel = (value) => (value ? String(value).replace(/_/g, ' ') : '—');

const FULFILLMENT_NEXT = {
  new: 'in_production',
  in_production: 'ready',
  ready: 'shipped',
  shipped: 'delivered',
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

const paymentBadgeVariant = (status) => {
  if (status === 'paid') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'failed' || status === 'cancelled') return 'danger';
  if (status === 'refunded') return 'default';
  return 'default';
};

const fulfillmentBadgeVariant = (status) => {
  if (status === 'delivered') return 'success';
  if (status === 'shipped' || status === 'in_production') return 'info';
  if (status === 'new') return 'warning';
  if (status === 'cancelled') return 'danger';
  if (status === 'ready') return 'success';
  return 'default';
};

const OrdersDashboard = ({ orders = [] }) => {
  const [rows, setRows] = useState(orders);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('all');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [busyOrderId, setBusyOrderId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [draftOrder, setDraftOrder] = useState(null);
  const [linkingCardId, setLinkingCardId] = useState('');
  const [nfcSlug, setNfcSlug] = useState('');
  const [nfcSlugLoading, setNfcSlugLoading] = useState(false);
  const [nfcBusy, setNfcBusy] = useState(false);
  const [nfcQrDataUrl, setNfcQrDataUrl] = useState(null);
  const [draftShipping, setDraftShipping] = useState({ carrier: '', tracking_code: '' });
  const [shippingBusy, setShippingBusy] = useState(false);
  const DISPATCH_CHECKLIST = [
    'NFC programado con el link del cliente',
    'Diseño impreso y verificado',
    'QR funciona (escaneado con teléfono)',
    'Tarjeta embalada en caja',
    'Dirección de despacho confirmada',
  ];
  const [checklistDone, setChecklistDone] = useState(Array(5).fill(false));
  const [orderHistory, setOrderHistory] = useState({});

  const loadOrderHistory = async (orderId) => {
    if (orderHistory[orderId]) return;
    try {
      const { supabase } = await import('../services/supabaseClient');
      const { data } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', orderId)
        .order('changed_at', { ascending: false })
        .limit(10);
      setOrderHistory(prev => ({ ...prev, [orderId]: data || [] }));
    } catch (err) {
      console.warn('History error:', err);
    }
  };
  const [refundByOrder, setRefundByOrder] = useState({});
  const [refundForm, setRefundForm] = useState({ reason: 'Producto defectuoso', amount_cents: '', notes: '' });
  const [refundBusy, setRefundBusy] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [lastChecked, setLastChecked] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const incoming = orders.filter(o => new Date(o.created_at) > lastChecked);
    setNewOrdersCount(incoming.length);
    setRows(orders);
  }, [orders]);

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    const interval = setInterval(async () => {
      setRefreshing(true);
      try {
        const { api } = await import('../services/api');
        const response = await api.getOrders();
        const newOrders = response.orders || [];
        const newCount = newOrders.filter(o => new Date(o.created_at) > lastChecked).length;
        setNewOrdersCount(newCount);
        setRows(newOrders);
      } catch (err) {
        console.warn('Auto-refresh error:', err);
      } finally {
        setRefreshing(false);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [lastChecked]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { api } = await import('../services/api');
      const response = await api.getOrders();
      setRows(response.orders || []);
      setLastChecked(new Date());
      setNewOrdersCount(0);
    } catch (err) {
      console.warn('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const normalizedOrders = useMemo(() => rows.map((order) => {
    const items = order.order_items || order.items || [];
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
    const now = new Date();

    return normalizedOrders.filter((order) => {
      const matchesPayment = paymentFilter === 'all' || order.payment_status === paymentFilter;
      const matchesFulfillment = fulfillmentFilter === 'all' || order.fulfillment_status === fulfillmentFilter;

      // Filtro fecha
      if (dateFilter !== 'all') {
        const orderDate = new Date(order.created_at);
        if (dateFilter === 'today') {
          if (orderDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === 'week') {
          const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
          if (orderDate < weekAgo) return false;
        } else if (dateFilter === 'month') {
          const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
          if (orderDate < monthAgo) return false;
        }
      }

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

  useEffect(() => {
    if (!selectedOrder) {
      setDraftOrder(null);
      return;
    }
    loadOrderHistory(selectedOrder.id);

    setDraftOrder({
      customer_phone: selectedOrder.customer_phone || '',
      customer_email: selectedOrder.customer_email || '',
      delivery_address: selectedOrder.delivery_address || '',
      notes: selectedOrder.notes || '',
    });
    setDraftShipping({
      carrier: selectedOrder.carrier || '',
      tracking_code: selectedOrder.tracking_code || '',
    });
    setLinkingCardId('');
    setNfcSlug('');
    setNfcQrDataUrl(null);
    setChecklistDone(Array(5).fill(false));
    setRefundForm({ reason: 'Producto defectuoso', amount_cents: selectedOrder.amount_cents || '', notes: '' });
    // Auto-cargar slug si hay cards vinculadas
    if (selectedOrder.related_cards?.length > 0) {
      loadSlugForOrder(selectedOrder);
    }
    // Cargar refund existente para esta orden
    if (!refundByOrder[selectedOrder.id]) {
      api.getRefundForOrder(selectedOrder.id).then(r => {
        if (r) setRefundByOrder(prev => ({ ...prev, [selectedOrder.id]: r }));
      }).catch(() => {});
    }
  }, [selectedOrderId, selectedOrder?.id]);

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

  const saveDraftOrder = async () => {
    if (!selectedOrder || !draftOrder) return;
    await updateOrderField(selectedOrder.id, draftOrder, `Datos operativos actualizados para ${selectedOrder.id}.`);
  };

  const linkCardToOrder = async () => {
    if (!selectedOrder || !linkingCardId) return;

    setBusyOrderId(selectedOrder.id);
    setFeedback({ type: '', message: '' });
    try {
      const response = await api.linkOrderCard(selectedOrder.id, linkingCardId);
      setRows(response.orders || []);
      setFeedback({ type: 'success', message: `Tarjeta vinculada formalmente a la orden ${selectedOrder.id}.` });
      setLinkingCardId('');
      // Auto-cargar slug del cliente tras vincular
      loadSlugForOrder(response.orders?.find(o => o.id === selectedOrder.id) || selectedOrder);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'No fue posible vincular la tarjeta a la orden.' });
    } finally {
      setBusyOrderId(null);
    }
  };

  const loadSlugForOrder = async (order) => {
    setNfcSlugLoading(true);
    try {
      const slug = await api.getProfileSlugForOrder(order.id, order.customer_email);
      if (slug) setNfcSlug(slug);
    } catch (_) {
      // slug queda vacío, el admin lo ingresa manualmente
    } finally {
      setNfcSlugLoading(false);
    }
  };

  const confirmNfcProgramming = async () => {
    if (!selectedOrder || !nfcSlug) return;
    const linkedCard = selectedOrder.related_cards?.find(c => c.order_id === selectedOrder.id) || selectedOrder.related_cards?.[0];
    if (!linkedCard) {
      setFeedback({ type: 'error', message: 'Vincula primero una card a la orden.' });
      return;
    }
    const nfc_url = `https://nexcard.cl/${nfcSlug}`;
    setNfcBusy(true);
    setFeedback({ type: '', message: '' });
    try {
      const response = await api.updateCardNFC(linkedCard.id, { nfc_url });
      setRows(response.orders || []);
      // Generar QR de verificación (en memoria, sin descarga automática)
      const qrDataUrl = await QRCode.toDataURL(nfc_url, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 1,
        margin: 1,
        width: 256,
      });
      setNfcQrDataUrl(qrDataUrl);
      setFeedback({ type: 'success', message: `NFC programado: ${nfc_url}` });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Error al programar NFC.' });
    } finally {
      setNfcBusy(false);
    }
  };

  const saveShipping = async () => {
    if (!selectedOrder) return;
    setShippingBusy(true);
    setFeedback({ type: '', message: '' });
    try {
      const response = await api.dispatchOrder(selectedOrder.id, draftShipping);
      setRows(response.orders || []);
      const decremented = response.itemsDecremented || [];
      const decrMsg = decremented.length > 0
        ? ` Insumos descontados: ${decremented.map(d => `${d.name} ×${d.quantity}`).join(', ')}.`
        : '';
      setFeedback({ type: 'success', message: `Orden despachada #${selectedOrder.id.slice(0, 8).toUpperCase()} — notificación enviada al cliente.${decrMsg}` });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'No se pudo registrar el despacho.' });
    } finally {
      setShippingBusy(false);
    }
  };

  const processRefund = async () => {
    if (!selectedOrder) return;
    const amount = Number(refundForm.amount_cents);
    if (!amount || amount <= 0) {
      setFeedback({ type: 'error', message: 'El monto del reembolso debe ser mayor a 0.' });
      return;
    }
    setRefundBusy(true);
    setFeedback({ type: '', message: '' });
    try {
      const result = await api.createRefund({
        orderId: selectedOrder.id,
        reason: refundForm.reason,
        amount_cents: amount,
        notes: refundForm.notes,
      });
      setRefundByOrder(prev => ({ ...prev, [selectedOrder.id]: result.refund }));
      const updatedOrders = await api.getOrders();
      setRows(updatedOrders.orders || []);
      setFeedback({ type: 'success', message: `Reembolso procesado. ID MP: ${result.mp_refund_id}` });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'No se pudo procesar el reembolso.' });
    } finally {
      setRefundBusy(false);
    }
  };

  const stats = useMemo(() => {
    const paidOrders = normalizedOrders.filter((order) => order.payment_status === 'paid');
    const paidRevenue = paidOrders.reduce((sum, order) => sum + order.totalCents, 0);
    const pendingOrders = normalizedOrders.filter((order) => !['delivered', 'cancelled'].includes(order.fulfillment_status)).length;
    const overdueOrders = normalizedOrders.filter((order) => ['pending', 'new'].includes(order.payment_status) || ['new'].includes(order.fulfillment_status)).length;
    const avgTicket = normalizedOrders.length ? normalizedOrders.reduce((sum, order) => sum + order.totalCents, 0) / normalizedOrders.length : 0;

    return [
      { label: 'Ventas cobradas', value: currency(paidRevenue), accent: 'emerald' },
      { label: 'Pedidos pendientes', value: `${pendingOrders}`, accent: 'amber' },
      { label: 'Pedidos atrasados', value: `${overdueOrders}`, accent: 'red' },
      { label: 'Ticket promedio', value: currency(avgTicket), accent: null },
    ];
  }, [normalizedOrders]);

  const exportCSV = () => {
    const headers = ['ID', 'Cliente', 'Email', 'Método Pago', 'Estado Pago', 'Fulfillment', 'Monto CLP', 'Fecha'];
    const csvRows = filteredOrders.map(o => [
      o.id,
      o.customerLabel,
      o.customer_email || '',
      o.payment_method || '',
      o.payment_status || '',
      o.fulfillment_status || '',
      o.totalCents,
      formatDate(o.created_at),
    ]);
    const csv = [headers, ...csvRows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexcard-ordenes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell
      active="orders"
      title="Orders Control Center"
      subtitle="Caja, producción y cumplimiento en una sola mesa de control operativa."
    >
      {/* Stats */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <AdminStat key={stat.label} label={stat.label} value={stat.value} accent={stat.accent} />
        ))}
      </div>

      {feedback.message && (
        <div className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${feedback.type === 'success' ? 'border-emerald-800 bg-emerald-950/40 text-emerald-400' : 'border-red-800 bg-red-950/40 text-red-400'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-[1.5fr,1fr] gap-6">
        {/* Lista de órdenes */}
        <AdminCard className="!p-0 overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-zinc-500" />
                {['all', 'today', 'week', 'month'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setDateFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${dateFilter === f ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                  >
                    {f === 'all' ? 'Todos' : f === 'today' ? 'Hoy' : f === 'week' ? '7 días' : '30 días'}
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
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold text-zinc-300 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                  Actualizar
                </button>
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-bold text-white transition-colors"
                >
                  <Download size={13} />
                  Export CSV
                </button>
              </div>
            </div>
            <div className="flex gap-3 flex-1 flex-col sm:flex-row">
              <label className="relative block flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <input
                  type="search"
                  placeholder="Buscar por ID, cliente, email o teléfono"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors pl-9"
                />
              </label>
              <label className="relative block">
                <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <select
                  value={paymentFilter}
                  onChange={(event) => setPaymentFilter(event.target.value)}
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
                  value={fulfillmentFilter}
                  onChange={(event) => setFulfillmentFilter(event.target.value)}
                  className="w-full appearance-none px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors pl-9 sm:w-56"
                >
                  {fulfillmentStatuses.map((status) => (
                    <option key={status} value={status}>{status === 'all' ? 'Todos los estados' : formatLabel(status)}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div key={`${dateFilter}-${paymentFilter}-${fulfillmentFilter}`} className="overflow-x-auto">
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
                {filteredOrders.map((order) => (
                  <TR key={order.id} active={selectedOrderId === order.id}>
                    <TD>
                      <AdminBadge variant={order.folio ? 'default' : 'default'}>
                        {order.folio || '—'}
                      </AdminBadge>
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
                            onClick={() => updateOrderField(order.id, { payment_status: 'paid' }, `Orden ${order.id} marcada como pagada.`)}
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
                        {FULFILLMENT_NEXT[order.fulfillment_status] && (
                          <button
                            type="button"
                            onClick={() => updateOrderField(order.id, { fulfillment_status: FULFILLMENT_NEXT[order.fulfillment_status] }, `Orden ${order.id} avanzada a ${formatLabel(FULFILLMENT_NEXT[order.fulfillment_status])}.`)}
                            disabled={busyOrderId === order.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-950/40 border border-blue-800 text-blue-400 text-[10px] font-bold hover:bg-blue-950/70 transition-colors disabled:opacity-50"
                          >
                            → {formatLabel(FULFILLMENT_NEXT[order.fulfillment_status])}
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
                        onClick={() => setSelectedOrderId(order.id)}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-lg text-sm font-medium transition-colors"
                      >
                        Ver detalle
                      </button>
                    </TD>
                  </TR>
                ))}

                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-8 py-12 text-center text-sm font-semibold text-zinc-500">
                      No hay órdenes que coincidan con los filtros activos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminCard>

        {/* Panel detalle */}
        <AdminCard>
          <h2 className="font-bold text-lg text-white mb-4">Detalle de orden</h2>
          {selectedOrder ? (
            <div className="space-y-5">
              <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">Folio de producción</p>
                <p className="font-bold text-[18px] text-white">{selectedOrder.folio || '—'}</p>
                <p className="text-[11px] text-zinc-400 font-mono mt-1">{selectedOrder.id}</p>
              </div>

              <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Cliente</p>
                <p className="font-bold text-white">{selectedOrder.customerLabel}</p>
                <p className="text-sm text-zinc-400 font-medium">{selectedOrder.customer_email || 'Sin email'}</p>
                <p className="text-sm text-zinc-400 font-medium">{selectedOrder.customer_phone || 'Sin teléfono'}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Pago</p>
                  <select
                    value={selectedOrder.payment_status || ''}
                    onChange={(event) => updateOrderField(selectedOrder.id, { payment_status: event.target.value }, `Estado de pago actualizado para ${selectedOrder.id}.`)}
                    disabled={busyOrderId === selectedOrder.id}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                  >
                    {['pending', 'paid', 'failed', 'refunded'].map((status) => (
                      <option key={status} value={status}>{formatLabel(status)}</option>
                    ))}
                  </select>
                  <p className="text-sm font-semibold text-zinc-300 mt-3">Proveedor: {selectedOrder.paymentProvider}</p>
                  <p className="text-xs text-zinc-500 mt-1">Ref: {selectedOrder.paymentReference}</p>
                  <p className="text-xs text-zinc-500 mt-1">Pagado: {formatDate(selectedOrder.paidAt)}</p>
                </div>
                <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Operación</p>
                  <select
                    value={selectedOrder.fulfillment_status || ''}
                    onChange={(event) => updateOrderField(selectedOrder.id, { fulfillment_status: event.target.value }, `Estado operativo actualizado para ${selectedOrder.id}.`)}
                    disabled={busyOrderId === selectedOrder.id}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                  >
                    {['new', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled'].map((status) => (
                      <option key={status} value={status}>{formatLabel(status)}</option>
                    ))}
                  </select>
                  <p className="text-sm font-semibold text-zinc-300 mt-3">Entrega: {selectedOrder.delivery_type || '—'}</p>
                  <p className="text-xs text-zinc-500 mt-1">Dirección: {selectedOrder.delivery_address || '—'}</p>
                </div>
              </div>

              <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Caja, margen y stock</p>
                <div className="grid grid-cols-2 gap-4 text-sm font-bold">
                  <div>
                    <p className="text-zinc-400">Venta</p>
                    <p className="text-xl font-bold text-white">{currency(selectedOrder.totalCents)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-400">Margen bruto</p>
                    <p className="text-xl font-bold text-white">{currency(selectedOrder.grossMarginCents)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <AdminBadge variant={selectedOrder.inventory_reserved ? 'success' : 'warning'}>
                    {selectedOrder.inventory_reserved ? 'Reserva de stock registrada' : 'Stock aún no reservado'}
                  </AdminBadge>
                  <AdminBadge variant={selectedOrder.card_lifecycle_ready ? 'success' : 'default'}>
                    {selectedOrder.card_lifecycle_ready ? 'Cards listas para lifecycle' : 'Cards no vinculadas todavía'}
                  </AdminBadge>
                  <AdminBadge variant="info">
                    Fuente cards: {selectedOrder.related_cards_source === 'order_cards' ? 'vínculo formal' : 'match heurístico'}
                  </AdminBadge>
                  <AdminBadge variant={selectedOrder.activation_ready ? 'success' : selectedOrder.active_cards_count > 0 ? 'info' : 'default'}>
                    {selectedOrder.activation_ready ? `Lista para activar (${selectedOrder.activation_ready_count})` : selectedOrder.active_cards_count > 0 ? `Cards activas (${selectedOrder.active_cards_count})` : 'Aún no lista para activar'}
                  </AdminBadge>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Semáforo operativo</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Stock</p>
                    <p className="mt-2 text-sm font-bold text-white">{selectedOrder.inventory_reserved ? 'Reservado' : 'Pendiente'}</p>
                  </div>
                  <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Entrega</p>
                    <p className="mt-2 text-sm font-bold text-white">{selectedOrder.delivery_ready ? 'Lista / en curso' : 'Aún no lista'}</p>
                  </div>
                  <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Activación</p>
                    {(() => {
                      const nfcCard = selectedOrder.related_cards?.find(c => c.nfc_url);
                      if (nfcCard) {
                        return (
                          <p className="mt-2 text-sm font-bold text-emerald-400" title={nfcCard.nfc_url}>
                            Lista — NFC
                          </p>
                        );
                      }
                      return (
                        <p className="mt-2 text-sm font-bold text-white">
                          {selectedOrder.activation_ready ? `Lista (${selectedOrder.activation_ready_count})` : selectedOrder.active_cards_count > 0 ? `Con activas (${selectedOrder.active_cards_count})` : 'Pendiente'}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Boleta SII */}
              <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Boleta SII</p>
                {selectedOrder.bsale_document_id ? (
                  <div className="flex items-center gap-3">
                    <AdminBadge variant="success">✓ EMITIDA</AdminBadge>
                    <span className="text-xs text-zinc-500">Doc #{selectedOrder.bsale_document_id}</span>
                    {selectedOrder.bsale_document_url && (
                      <a
                        href={selectedOrder.bsale_document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline font-bold"
                      >
                        Ver PDF →
                      </a>
                    )}
                  </div>
                ) : selectedOrder.requires_invoice ? (
                  <div className="flex flex-col gap-1.5">
                    <AdminBadge variant="warning">⏳ PENDIENTE</AdminBadge>
                    {selectedOrder.invoice_rut && (
                      <p className="text-xs text-zinc-500">RUT: {selectedOrder.invoice_rut} · {selectedOrder.invoice_razon_social}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AdminBadge variant="default">No emitida</AdminBadge>
                    <span className="text-xs text-zinc-500">(integración Bsale pendiente)</span>
                  </div>
                )}
              </div>

              {/* FLUJO NFC: Paso A → Vincular card */}
              <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-4 space-y-5">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Programación NFC</p>

                {/* Paso A — Vincular card */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Paso A — Vincular card física</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={linkingCardId}
                      onChange={(event) => setLinkingCardId(event.target.value)}
                      disabled={busyOrderId === selectedOrder.id}
                      placeholder="UUID de card"
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors sm:w-72"
                    />
                    <button
                      type="button"
                      onClick={linkCardToOrder}
                      disabled={busyOrderId === selectedOrder.id || !linkingCardId}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    >
                      <Link2 size={16} />
                      Vincular
                    </button>
                  </div>
                  {selectedOrder.related_cards?.length > 0 && (
                    <p className="text-xs text-emerald-400 font-bold">
                      Card vinculada: {selectedOrder.related_cards[0].card_code || selectedOrder.related_cards[0].id}
                    </p>
                  )}
                </div>

                {/* Paso B — Configurar NFC (solo si hay card vinculada) */}
                {selectedOrder.related_cards?.length > 0 && (() => {
                  const linkedCard = selectedOrder.related_cards.find(c => c.order_id === selectedOrder.id) || selectedOrder.related_cards[0];
                  const alreadyProgrammed = linkedCard?.nfc_url;
                  if (alreadyProgrammed) return null;
                  return (
                    <div className="space-y-3 border-t border-zinc-700 pt-4">
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Paso B — Configurar URL del NFC</p>
                      <p className="text-xs text-zinc-500">
                        URL que se programará en el chip:{' '}
                        <span className="font-bold text-zinc-300">
                          https://nexcard.cl/{nfcSlug || '<slug>'}
                        </span>
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-sm font-bold text-zinc-500 shrink-0">nexcard.cl/</span>
                          <input
                            type="text"
                            value={nfcSlug}
                            onChange={(e) => setNfcSlug(e.target.value)}
                            placeholder={nfcSlugLoading ? 'Buscando slug...' : 'slug-del-cliente'}
                            disabled={nfcBusy || nfcSlugLoading}
                            className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={confirmNfcProgramming}
                          disabled={nfcBusy || !nfcSlug}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                        >
                          {nfcBusy ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
                          Confirmar NFC
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Paso C — Estado NFC programado */}
                {selectedOrder.related_cards?.length > 0 && (() => {
                  const linkedCard = selectedOrder.related_cards.find(c => c.order_id === selectedOrder.id) || selectedOrder.related_cards[0];
                  if (!linkedCard?.nfc_url && !nfcQrDataUrl) return null;
                  const programmedUrl = linkedCard?.nfc_url || `https://nexcard.cl/${nfcSlug}`;
                  return (
                    <div className="space-y-3 border-t border-zinc-700 pt-4">
                      <div className="flex items-center gap-2">
                        <AdminBadge variant="success">
                          <CheckCircle2 size={12} className="mr-1" />
                          NFC PROGRAMADO
                        </AdminBadge>
                      </div>
                      <p className="text-xs text-zinc-500">
                        URL: <a href={programmedUrl} target="_blank" rel="noreferrer" className="font-bold text-emerald-400 underline">{programmedUrl}</a>
                      </p>
                      {linkedCard?.programmed_at && (
                        <p className="text-xs text-zinc-500">Programado: {formatDate(linkedCard.programmed_at)}</p>
                      )}
                      {nfcQrDataUrl && (
                        <div className="flex flex-col items-start gap-2">
                          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide flex items-center gap-1.5">
                            <QrCode size={12} />
                            QR de verificación
                          </p>
                          <img src={nfcQrDataUrl} alt="QR NFC" className="w-32 h-32 rounded-xl border border-zinc-700" />
                          <p className="text-[11px] text-zinc-500">Escanea con tu teléfono para verificar</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Ítems</p>
                <div className="space-y-3">
                  {selectedOrder.items.length > 0 ? selectedOrder.items.map((item, index) => (
                    <div key={`${selectedOrder.id}-${index}`} className="rounded-xl border border-zinc-700 bg-zinc-800 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-bold text-sm text-white">{item.product_name || item.product_id || 'Producto'}</p>
                          <p className="text-xs text-zinc-500 font-medium">SKU: {item.sku || '—'}</p>
                        </div>
                        <div className="text-right text-sm font-bold text-zinc-300">
                          <p>x{item.quantity || 0}</p>
                          <p>{currency((item.unit_price_cents || 0) * (item.quantity || 0))}</p>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-xl border border-dashed border-zinc-700 p-4 text-sm font-medium text-zinc-500">
                      La orden no trae items asociados en esta consulta.
                    </div>
                  )}
                </div>
              </div>

              {selectedOrder.related_cards?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Cards relacionadas</p>
                  <div className="space-y-3">
                    {selectedOrder.related_cards.map((card) => (
                      <div key={card.id} className="rounded-xl border border-zinc-700 bg-zinc-800 p-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-bold text-sm text-white">{card.card_code}</p>
                          <p className="text-xs text-zinc-500 font-medium">{card.profile_id || 'Sin perfil'}</p>
                        </div>
                        <div className="text-right flex flex-col gap-1">
                          <AdminBadge variant={card.status === 'active' ? 'success' : card.status === 'revoked' ? 'danger' : 'default'}>{formatLabel(card.status)}</AdminBadge>
                          <AdminBadge variant={card.activation_status === 'activated' ? 'success' : card.activation_status === 'unassigned' ? 'warning' : 'default'}>{formatLabel(card.activation_status)}</AdminBadge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Historial de cambios */}
              {orderHistory[selectedOrder?.id]?.length > 0 && (
                <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Historial de cambios</p>
                  <div className="space-y-2">
                    {orderHistory[selectedOrder.id].map((entry, i) => (
                      <div key={i} className="flex items-start justify-between gap-4 py-2 border-b border-zinc-700 last:border-0">
                        <div>
                          <p className="text-xs font-bold text-zinc-300 capitalize">{entry.field.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-zinc-500">
                            <span className="line-through">{entry.old_value || '—'}</span>
                            {' → '}
                            <span className="text-emerald-400 font-bold">{entry.new_value}</span>
                          </p>
                        </div>
                        <p className="text-[10px] text-zinc-500 shrink-0">
                          {new Date(entry.changed_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-4 space-y-4">
                <div>
                  <p className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Contacto</p>
                  <div className="grid gap-3">
                    <input
                      type="text"
                      value={draftOrder?.customer_phone || ''}
                      onChange={(event) => setDraftOrder((prev) => ({ ...(prev || {}), customer_phone: event.target.value }))}
                      disabled={busyOrderId === selectedOrder.id}
                      placeholder="Teléfono cliente"
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                    />
                    <input
                      type="text"
                      value={draftOrder?.customer_email || ''}
                      onChange={(event) => setDraftOrder((prev) => ({ ...(prev || {}), customer_email: event.target.value }))}
                      disabled={busyOrderId === selectedOrder.id}
                      placeholder="Email cliente"
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Dirección / retiro</label>
                  <textarea
                    value={draftOrder?.delivery_address || ''}
                    onChange={(event) => setDraftOrder((prev) => ({ ...(prev || {}), delivery_address: event.target.value }))}
                    disabled={busyOrderId === selectedOrder.id}
                    rows="3"
                    placeholder="Dirección de despacho o instrucción de retiro"
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Notas</label>
                  <textarea
                    value={draftOrder?.notes || ''}
                    onChange={(event) => setDraftOrder((prev) => ({ ...(prev || {}), notes: event.target.value }))}
                    disabled={busyOrderId === selectedOrder.id}
                    rows="4"
                    placeholder="Observaciones operativas internas"
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDraftOrder({
                    customer_phone: selectedOrder.customer_phone || '',
                    customer_email: selectedOrder.customer_email || '',
                    delivery_address: selectedOrder.delivery_address || '',
                    notes: selectedOrder.notes || '',
                  })}
                  disabled={busyOrderId === selectedOrder.id}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Descartar cambios
                </button>
                <button
                  type="button"
                  onClick={saveDraftOrder}
                  disabled={busyOrderId === selectedOrder.id}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {busyOrderId === selectedOrder.id ? <Loader2 size={16} className="animate-spin" /> : null}
                  Guardar datos operativos
                </button>
              </div>

              {/* Shipping tracking section */}
              <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Truck size={16} className="text-blue-400" />
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Envío y seguimiento</p>
                </div>

                {selectedOrder.tracking_code && (
                  <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-0.5">
                        {selectedOrder.carrier === 'blueexpress' ? 'BlueExpress' :
                         selectedOrder.carrier === 'chilexpress' ? 'Chilexpress' :
                         selectedOrder.carrier || 'Courier'}
                      </p>
                      <p className="font-bold text-sm text-white font-mono">{selectedOrder.tracking_code}</p>
                    </div>
                    <a
                      href={`/seguimiento/${selectedOrder.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold"
                    >
                      <ExternalLink size={12} />
                      Ver seguimiento
                    </a>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Courier</label>
                    <select
                      value={draftShipping.carrier}
                      onChange={(e) => setDraftShipping(prev => ({ ...prev, carrier: e.target.value }))}
                      disabled={shippingBusy}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                    >
                      <option value="">Seleccionar courier</option>
                      <option value="blueexpress">BlueExpress</option>
                      <option value="chilexpress">Chilexpress</option>
                      <option value="starken">Starken</option>
                      <option value="correos">Correos de Chile</option>
                      <option value="dhl">DHL</option>
                      <option value="fedex">FedEx</option>
                      <option value="manual">Otro / Manual</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Código de seguimiento</label>
                    <input
                      type="text"
                      value={draftShipping.tracking_code}
                      onChange={(e) => setDraftShipping(prev => ({ ...prev, tracking_code: e.target.value }))}
                      disabled={shippingBusy}
                      placeholder="BX123456789CL"
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors font-mono"
                    />
                  </div>
                </div>

                {/* Checklist pre-despacho */}
                {(() => {
                  const completedCount = checklistDone.filter(Boolean).length;
                  const allDone = completedCount === DISPATCH_CHECKLIST.length;
                  const canDispatch = allDone && draftShipping.tracking_code.trim().length > 0;
                  return (
                    <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-3 space-y-3">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Checklist pre-despacho</p>
                      <div className="space-y-2">
                        {DISPATCH_CHECKLIST.map((item, i) => (
                          <label key={i} className="flex items-center gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={checklistDone[i]}
                              onChange={() => setChecklistDone(prev => prev.map((v, idx) => idx === i ? !v : v))}
                              className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                            />
                            <span className={`text-[13px] font-medium transition-colors ${checklistDone[i] ? 'line-through text-zinc-600' : 'text-zinc-300'}`}>
                              {item}
                            </span>
                          </label>
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${allDone ? 'bg-emerald-500' : 'bg-zinc-600'}`}
                            style={{ width: `${(completedCount / DISPATCH_CHECKLIST.length) * 100}%` }}
                          />
                        </div>
                        <p className={`text-[11px] font-bold transition-colors ${allDone ? 'text-emerald-400' : 'text-zinc-500'}`}>
                          {allDone ? 'Listo para despachar' : `${completedCount} de ${DISPATCH_CHECKLIST.length} verificaciones completadas`}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                <div className="relative group/dispatch">
                  <button
                    type="button"
                    onClick={saveShipping}
                    disabled={shippingBusy || !draftShipping.carrier || !draftShipping.tracking_code.trim() || !checklistDone.every(Boolean)}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm transition-colors ${checklistDone.every(Boolean) && draftShipping.tracking_code.trim() ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-zinc-700 opacity-50 cursor-not-allowed'} disabled:opacity-50`}
                  >
                    {shippingBusy ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
                    Registrar envío y notificar cliente
                  </button>
                  {(!checklistDone.every(Boolean) || !draftShipping.tracking_code.trim()) && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/dispatch:block z-10">
                      <div className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] font-medium px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                        Completa el checklist y número de seguimiento
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs font-medium text-zinc-500 text-center">
                  Cambia estado a <strong className="text-zinc-300">Shipped</strong> y envía email con link de seguimiento al cliente.
                </p>
              </div>

              {/* Personalización de tarjeta */}
              {selectedOrder.card_customization && (
                <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Personalización solicitada</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {selectedOrder.card_customization.full_name && (
                      <div>
                        <p className="text-xs text-zinc-500 font-semibold mb-0.5">Nombre</p>
                        <p className="text-white font-medium">{selectedOrder.card_customization.full_name}</p>
                      </div>
                    )}
                    {selectedOrder.card_customization.job_title && (
                      <div>
                        <p className="text-xs text-zinc-500 font-semibold mb-0.5">Cargo</p>
                        <p className="text-white font-medium">{selectedOrder.card_customization.job_title}</p>
                      </div>
                    )}
                    {selectedOrder.card_customization.company && (
                      <div>
                        <p className="text-xs text-zinc-500 font-semibold mb-0.5">Empresa</p>
                        <p className="text-white font-medium">{selectedOrder.card_customization.company}</p>
                      </div>
                    )}
                    {selectedOrder.card_customization.template && (
                      <div>
                        <p className="text-xs text-zinc-500 font-semibold mb-0.5">Plantilla</p>
                        <p className="text-white font-medium capitalize">{
                          { minimal: 'Minimalista', dark: 'Dark premium', corporate: 'Corporativo', colorful: 'Colorido' }[selectedOrder.card_customization.template] || selectedOrder.card_customization.template
                        }</p>
                      </div>
                    )}
                    {selectedOrder.card_customization.primary_color && (
                      <div>
                        <p className="text-xs text-zinc-500 font-semibold mb-0.5">Color principal</p>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full border border-zinc-600" style={{ backgroundColor: selectedOrder.card_customization.primary_color }} />
                          <span className="text-white font-mono text-xs">{selectedOrder.card_customization.primary_color}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {selectedOrder.card_customization.notes && (
                    <div>
                      <p className="text-xs text-zinc-500 font-semibold mb-0.5">Notas</p>
                      <p className="text-zinc-300 text-sm leading-relaxed">{selectedOrder.card_customization.notes}</p>
                    </div>
                  )}

                  <div className="pt-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Vista previa de la tarjeta</p>
                    <CardPreview
                      template={selectedOrder.card_customization.template || 'minimal'}
                      name={selectedOrder.card_customization.full_name || selectedOrder.customer_name || 'Tu Nombre'}
                      jobTitle={selectedOrder.card_customization.job_title || 'Tu Cargo'}
                      company={selectedOrder.card_customization.company || ''}
                      primaryColor={selectedOrder.card_customization.primary_color || '#10B981'}
                      size="full"
                    />
                    <button
                      type="button"
                      className="mt-3 w-full text-sm font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg py-2 px-4 transition-colors"
                      onClick={() => {
                        const svg = generateCardSVG(
                          selectedOrder.card_customization.template || 'minimal',
                          {
                            name: selectedOrder.card_customization.full_name || selectedOrder.customer_name || 'Tu Nombre',
                            jobTitle: selectedOrder.card_customization.job_title || 'Tu Cargo',
                            company: selectedOrder.card_customization.company || '',
                            primaryColor: selectedOrder.card_customization.primary_color || '#10B981',
                          }
                        );
                        const win = window.open('', '_blank');
                        win.document.write(`<!DOCTYPE html><html><head><style>@page{size:85.6mm 54mm;margin:0;}body{margin:0;display:flex;align-items:center;justify-content:center;width:85.6mm;height:54mm;}svg{width:85.6mm;height:54mm;}</style></head><body>${svg}</body></html>`);
                        win.document.close();
                        win.focus();
                        win.print();
                      }}
                    >
                      Imprimir diseño
                    </button>
                  </div>
                </div>
              )}

              {/* Gestión de devolución */}
              {(() => {
                const existingRefund = refundByOrder[selectedOrder.id];
                const canRefund = selectedOrder.payment_status === 'paid' && selectedOrder.fulfillment_status !== 'delivered' && !existingRefund;
                const isRefunded = selectedOrder.payment_status === 'refunded';

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
                          {refund.notes && (
                            <p className="text-xs text-zinc-500 italic mt-1">{refund.notes}</p>
                          )}
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
                          onChange={e => setRefundForm(f => ({ ...f, reason: e.target.value }))}
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
                          max={selectedOrder.amount_cents}
                          value={refundForm.amount_cents}
                          onChange={e => setRefundForm(f => ({ ...f, amount_cents: e.target.value }))}
                          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                          placeholder={`Máx. ${selectedOrder.amount_cents}`}
                        />
                        <p className="text-xs text-zinc-600 mt-1">Reembolso parcial posible — edita el monto si aplica</p>
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Notas internas (opcional)</label>
                        <textarea
                          rows={2}
                          value={refundForm.notes}
                          onChange={e => setRefundForm(f => ({ ...f, notes: e.target.value }))}
                          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors resize-none"
                          placeholder="Observaciones para el equipo..."
                        />
                      </div>
                      <button
                        type="button"
                        onClick={processRefund}
                        disabled={refundBusy || !refundForm.amount_cents}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {refundBusy ? <Loader2 size={16} className="animate-spin" /> : null}
                        {refundBusy ? 'Procesando reembolso...' : 'Procesar devolución'}
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div className="rounded-xl border border-amber-900 bg-amber-950/20 p-4 text-sm font-semibold text-amber-400 flex items-start gap-3">
                {busyOrderId === selectedOrder.id ? <Loader2 size={18} className="mt-0.5 animate-spin" /> : <AlertCircle size={18} className="mt-0.5" />}
                <span>Este MVP ya permite cambio manual de estados. La siguiente iteración debería sumar acciones masivas, SLA visible y reservas transaccionales nativas en DB.</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-sm font-medium text-zinc-500">
              No hay una orden seleccionada todavía.
            </div>
          )}
        </AdminCard>
      </div>
    </AdminShell>
  );
};

export default OrdersDashboard;
