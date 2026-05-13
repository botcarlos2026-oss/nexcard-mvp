import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock3,
  Search,
  Filter,
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
import { TH, TR, TD } from './ui/AdminTable';
import AdminBadge from './ui/AdminBadge';
import { deriveOrderTestClassification, isManualTestReason } from '../utils/orderOperationalSegmentation';

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
  shipped: 'delivered',
};

const PAYMENT_TRANSITIONS = {
  pending: ['paid', 'failed', 'cancelled'],
  failed: ['pending', 'cancelled'],
  paid: ['refunded'],
  cancelled: [],
  refunded: [],
};

const FULFILLMENT_TRANSITIONS = {
  new: ['in_production', 'cancelled'],
  in_production: ['ready', 'cancelled'],
  ready: ['cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

const formatActorLabel = (entry) => {
  if (!entry) return 'sistema';
  if (entry.actor_label) return entry.actor_label;
  if (entry.actor_role === 'service_role') return 'service_role';
  if (entry.actor_user_id) return `admin ${String(entry.actor_user_id).slice(0, 8)}`;
  if (entry.actor_role) return entry.actor_role;
  return 'sistema';
};

const deriveManualOverrideSeverity = (order) => {
  if (!isManualTestReason(order?.testReasonResolved || order?.test_reason)) {
    return { level: null, score: 0, ageHours: 0 };
  }
  const updatedAtMs = new Date(order?.updated_at || order?.created_at).getTime();
  const ageHours = Number.isNaN(updatedAtMs) ? 0 : Math.round((Date.now() - updatedAtMs) / (1000 * 60 * 60));
  const isPaid = order?.payment_status === 'paid';
  const notShipped = !['shipped', 'delivered'].includes(order?.fulfillment_status);
  const notActivated = !order?.activation_completed;
  const notReady = !['ready', 'shipped', 'delivered'].includes(order?.fulfillment_status);
  let level = 'low';
  let score = 1;
  if (ageHours >= 72) { level = 'medium'; score += 2; }
  else if (ageHours >= 24) { level = 'low'; score += 1; }
  if (isPaid && notActivated) { level = 'high'; score += 3; }
  if (isPaid && notShipped && notActivated && ageHours >= 72) { level = 'critical'; score += 4; }
  else if (isPaid && notReady && ageHours >= 24) { level = level === 'critical' ? 'critical' : 'high'; score += 2; }
  return { level, score, ageHours };
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

const FUNNEL_STEPS = [
  { key: 'paid', label: 'Paid' },
  { key: 'ready', label: 'Ready' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'activated', label: 'Activated' },
];

const deriveFunnelReached = (order) => ({
  paid: order.payment_status === 'paid',
  ready: order.payment_status === 'paid' && ['ready', 'shipped', 'delivered'].includes(order.fulfillment_status),
  shipped: order.payment_status === 'paid' && ['shipped', 'delivered'].includes(order.fulfillment_status),
  delivered: order.payment_status === 'paid' && order.fulfillment_status === 'delivered',
  activated: order.payment_status === 'paid' && order.activation_completed,
});

const deriveTraceabilityMoments = (order) => {
  const payments = order.payments || [];
  const paidAt = order.paid_at || payments.find((payment) => payment?.paid_at)?.paid_at || order.paidAt || null;
  return [
    { key: 'paid', label: 'Paid', at: paidAt, done: order.payment_status === 'paid' },
    { key: 'ready', label: 'Ready', at: order.ready_at || null, done: ['ready', 'shipped', 'delivered'].includes(order.fulfillment_status) },
    { key: 'shipped', label: 'Shipped', at: order.shipped_at || null, done: ['shipped', 'delivered'].includes(order.fulfillment_status) },
    { key: 'delivered', label: 'Delivered', at: order.delivered_at || null, done: order.fulfillment_status === 'delivered' },
    { key: 'activated', label: 'Activated', at: order.activated_at || order.activation_last_at || null, done: order.activation_completed },
  ];
};

const OrdersDashboard = ({ orders = [], forceAuditFilter = null, embedded = false }) => {
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
  const [testOverrideReason, setTestOverrideReason] = useState('');
  const DISPATCH_CHECKLIST = [
    'NFC programado con el link del cliente',
    'Diseño impreso y verificado',
    'QR funciona (escaneado con teléfono)',
    'Tarjeta embalada en caja',
    'Dirección de despacho confirmada',
  ];
  const [checklistDone, setChecklistDone] = useState(Array(5).fill(false));
  const [orderHistory, setOrderHistory] = useState({});

  const loadOrderHistory = useCallback(async (orderId) => {
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
  }, []);
  const [refundByOrder, setRefundByOrder] = useState({});
  const [refundForm, setRefundForm] = useState({ reason: 'Producto defectuoso', amount_cents: '', notes: '' });
  const [refundBusy, setRefundBusy] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [auditFilter, setAuditFilter] = useState('all');
  const [testReasonFilter, setTestReasonFilter] = useState('all');
  const [overrideAgeFilter, setOverrideAgeFilter] = useState('all');
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [lastChecked, setLastChecked] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const incoming = orders.filter(o => new Date(o.created_at) > lastChecked);
    setNewOrdersCount(incoming.length);
    setRows(orders);
  }, [orders, lastChecked]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      if (forceAuditFilter) setAuditFilter(forceAuditFilter);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const requestedAudit = params.get('audit') === 'excluded' ? 'excluded' : 'all';
    const requestedReason = params.get('test_reason') || 'all';
    const requestedOverrideAge = params.get('override_age') || 'all';
    const requestedOrderId = params.get('order_id') || null;
    setAuditFilter(forceAuditFilter || requestedAudit);
    setTestReasonFilter(requestedReason);
    setOverrideAgeFilter(requestedOverrideAge);
    if (requestedOrderId) setSelectedOrderId(requestedOrderId);
  }, [forceAuditFilter]);

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
    const qaClassification = deriveOrderTestClassification(order);

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
      qaClassification,
      isNonOperational: qaClassification.isTest,
      testReasonResolved: qaClassification.reason || null,
      manualOverrideSeverity: deriveManualOverrideSeverity({ ...order, testReasonResolved: qaClassification.reason || null }),
    };
  }), [rows]);

  const excludedOrdersCount = useMemo(() => normalizedOrders.filter((order) => order.isNonOperational).length, [normalizedOrders]);
  const excludedOrders = useMemo(() => normalizedOrders.filter((order) => order.isNonOperational), [normalizedOrders]);

  const testReasonCounts = useMemo(() => {
    return excludedOrders.reduce((acc, order) => {
      const reason = order.testReasonResolved || 'unclassified';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});
  }, [excludedOrders]);

  const manualOverrideCount = useMemo(() => excludedOrders.filter((order) => isManualTestReason(order.testReasonResolved)).length, [excludedOrders]);

  const testReasonOptions = useMemo(() => {
    const base = ['all'];
    if (manualOverrideCount > 0) base.push('manual_override_only');
    return [...base, ...Object.keys(testReasonCounts).sort()];
  }, [testReasonCounts, manualOverrideCount]);

  const auditScopedOrders = useMemo(() => {
    const nowMs = Date.now();
    return normalizedOrders.filter((order) => {
      const matchesAudit = auditFilter === 'all' || (auditFilter === 'excluded' && order.isNonOperational);
      const matchesReason = testReasonFilter === 'all'
        || (testReasonFilter === 'manual_override_only' && isManualTestReason(order.testReasonResolved))
        || order.testReasonResolved === testReasonFilter;
      let matchesOverrideAge = true;
      if (testReasonFilter === 'manual_override_only' && overrideAgeFilter !== 'all') {
        const updatedAtMs = new Date(order.updated_at || order.created_at).getTime();
        const ageHours = Number.isNaN(updatedAtMs) ? 0 : (nowMs - updatedAtMs) / (1000 * 60 * 60);
        matchesOverrideAge = overrideAgeFilter === '72h' ? ageHours >= 72 : ageHours >= 24;
      }
      return matchesAudit && matchesReason && matchesOverrideAge;
    });
  }, [normalizedOrders, auditFilter, testReasonFilter, overrideAgeFilter]);

  const paymentStatuses = useMemo(() => ['all', ...Array.from(new Set(normalizedOrders.map((order) => order.payment_status).filter(Boolean)))], [normalizedOrders]);
  const fulfillmentStatuses = useMemo(() => ['all', ...Array.from(new Set(normalizedOrders.map((order) => order.fulfillment_status).filter(Boolean)))], [normalizedOrders]);

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const now = new Date();

    const baseOrders = auditScopedOrders.filter((order) => {
      const matchesPayment = paymentFilter === 'all' || order.payment_status === paymentFilter;
      const matchesFulfillment = fulfillmentFilter === 'all' || order.fulfillment_status === fulfillmentFilter;

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
        order.testReasonResolved,
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(term);
    });

    if (testReasonFilter === 'manual_override_only') {
      return [...baseOrders].sort((a, b) => {
        const scoreDelta = (b.manualOverrideSeverity?.score || 0) - (a.manualOverrideSeverity?.score || 0);
        if (scoreDelta !== 0) return scoreDelta;
        return (b.manualOverrideSeverity?.ageHours || 0) - (a.manualOverrideSeverity?.ageHours || 0);
      });
    }

    return baseOrders;
  }, [auditScopedOrders, searchTerm, paymentFilter, fulfillmentFilter, dateFilter, testReasonFilter]);

  const selectedOrder = filteredOrders.find((order) => order.id === selectedOrderId) || filteredOrders[0] || null;

  const selectedOrderOverrideAudit = useMemo(() => {
    if (!selectedOrder) return null;
    const history = orderHistory[selectedOrder.id] || [];
    return history.find((entry) => entry.field === 'is_test' || entry.field === 'test_reason') || null;
  }, [selectedOrder, orderHistory]);

  const loadSlugForOrder = useCallback(async (order) => {
    setNfcSlugLoading(true);
    try {
      const slug = await api.getProfileSlugForOrder(order.id, order.customer_email);
      if (slug) setNfcSlug(slug);
    } catch (_) {
      // slug queda vacío, el admin lo ingresa manualmente
    } finally {
      setNfcSlugLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedOrder) {
      setDraftOrder(null);
      return;
    }
    loadOrderHistory(selectedOrder.id);

    setDraftOrder({
      customer_phone: selectedOrder.customer_phone || '',
      customer_email: selectedOrder.customer_email || '',
      customer_address: selectedOrder.customer_address || selectedOrder.delivery_address || '',
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
    setTestOverrideReason(selectedOrder.test_reason || '');
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
  }, [selectedOrder, loadOrderHistory, loadSlugForOrder, refundByOrder]);

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

  const transitionOrderState = async (orderId, payload, successMessage) => {
    setBusyOrderId(orderId);
    setFeedback({ type: '', message: '' });
    try {
      const response = await api.transitionOrderState(orderId, payload);
      setRows(response.orders || []);
      setFeedback({ type: 'success', message: successMessage });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'No fue posible cambiar el estado de la orden.' });
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

  const confirmNfcProgramming = async () => {
    if (!selectedOrder || !nfcSlug) return;
    const normalizedSlug = nfcSlug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(normalizedSlug)) {
      setFeedback({ type: 'error', message: 'El slug NFC solo puede contener letras minúsculas, números y guiones.' });
      return;
    }
    const linkedCard = selectedOrder.related_cards?.find(c => c.order_id === selectedOrder.id) || selectedOrder.related_cards?.[0];
    if (!linkedCard) {
      setFeedback({ type: 'error', message: 'Vincula primero una card a la orden.' });
      return;
    }
    const nfc_url = `https://nexcard.cl/${normalizedSlug}`;
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

  const applyTestOverride = async (targetOrder, nextIsTest) => {
    if (!targetOrder) return;

    setBusyOrderId(targetOrder.id);
    setFeedback({ type: '', message: '' });
    try {
      const response = await api.overrideOrderTestClassification(targetOrder.id, {
        is_test: nextIsTest,
        test_reason: testOverrideReason,
      });
      setRows(response.orders || []);
      setFeedback({
        type: 'success',
        message: nextIsTest
          ? `Orden ${targetOrder.id} marcada manualmente como QA/test.`
          : `Orden ${targetOrder.id} restaurada manualmente como operativa real.`,
      });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'No fue posible actualizar la clasificación QA/test.' });
    } finally {
      setBusyOrderId(null);
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
    const paidOrders = auditScopedOrders.filter((order) => order.payment_status === 'paid');
    const paidRevenue = paidOrders.reduce((sum, order) => sum + order.totalCents, 0);
    const pendingOrders = auditScopedOrders.filter((order) => !['delivered', 'cancelled'].includes(order.fulfillment_status)).length;
    const overdueOrders = auditScopedOrders.filter((order) => ['pending', 'new'].includes(order.payment_status) || ['new'].includes(order.fulfillment_status)).length;
    const avgTicket = auditScopedOrders.length ? auditScopedOrders.reduce((sum, order) => sum + order.totalCents, 0) / auditScopedOrders.length : 0;

    return [
      { label: 'Ventas cobradas', value: currency(paidRevenue), accent: 'emerald' },
      { label: 'Pedidos pendientes', value: `${pendingOrders}`, accent: 'amber' },
      { label: 'Pedidos atrasados', value: `${overdueOrders}`, accent: 'red' },
      { label: 'Ticket promedio', value: currency(avgTicket), accent: null },
    ];
  }, [auditScopedOrders]);

  const funnelSnapshot = useMemo(() => {
    const paidBase = auditScopedOrders.filter((order) => order.payment_status === 'paid').length;
    const counts = FUNNEL_STEPS.map((step) => {
      const reached = auditScopedOrders.filter((order) => deriveFunnelReached(order)[step.key]).length;
      return {
        ...step,
        count: reached,
        ratio: paidBase > 0 ? Math.round((reached / paidBase) * 100) : 0,
      };
    });

    return {
      paidBase,
      counts,
      exceptions: auditScopedOrders.filter((order) => (order.observability_alerts || []).length > 0),
    };
  }, [auditScopedOrders]);

  const exportCSV = () => {
    const headers = ['ID', 'Cliente', 'Email', 'Método Pago', 'Estado Pago', 'Fulfillment', 'Motivo QA/test', 'Monto CLP', 'Fecha'];
    const csvRows = filteredOrders.map(o => [
      o.id,
      o.customerLabel,
      o.customer_email || '',
      o.payment_method || '',
      o.payment_status || '',
      o.fulfillment_status || '',
      o.testReasonResolved || '',
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

  const content = (
    <>
      {/* Stats */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <AdminStat key={stat.label} label={stat.label} value={stat.value} accent={stat.accent} />
        ))}
      </div>

      {excludedOrdersCount > 0 && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <AdminBadge variant={auditFilter === 'excluded' ? 'info' : 'default'}>
              {excludedOrdersCount} orden(es) QA/interna(s)
            </AdminBadge>
            {manualOverrideCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setAuditFilter('excluded');
                  setTestReasonFilter('manual_override_only');
                  setOverrideAgeFilter('all');
                  if (!forceAuditFilter && typeof window !== 'undefined') {
                    window.history.replaceState({}, '', '/admin/orders?audit=excluded&test_reason=manual_override_only');
                  }
                }}
                className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${testReasonFilter === 'manual_override_only' ? 'border-fuchsia-700 bg-fuchsia-950/40 text-fuchsia-300' : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white'}`}
              >
                Solo overrides manuales · {manualOverrideCount}
              </button>
            )}
            {Object.entries(testReasonCounts).map(([reason, count]) => (
              <button
                key={reason}
                type="button"
                onClick={() => {
                  setAuditFilter('excluded');
                  setTestReasonFilter(reason);
                  setOverrideAgeFilter('all');
                  if (!forceAuditFilter && typeof window !== 'undefined') {
                    window.history.replaceState({}, '', `/admin/orders?audit=excluded&test_reason=${encodeURIComponent(reason)}`);
                  }
                }}
                className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${testReasonFilter === reason ? 'border-sky-700 bg-sky-950/40 text-sky-300' : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white'}`}
              >
                {formatLabel(reason)} · {count}
              </button>
            ))}
            {(auditFilter === 'excluded' || testReasonFilter !== 'all') && !forceAuditFilter ? (
              <button
                type="button"
                onClick={() => {
                  setAuditFilter('all');
                  setTestReasonFilter('all');
                  setOverrideAgeFilter('all');
                  if (typeof window !== 'undefined') window.history.replaceState({}, '', '/admin/orders');
                }}
                className="text-xs font-bold text-zinc-400 underline underline-offset-2 hover:text-white"
              >
                Limpiar filtro QA
              </button>
            ) : null}
          </div>
          <p className="text-xs text-zinc-500">
            Breakdown QA/test: {manualOverrideCount > 0 ? `Solo overrides manuales (${manualOverrideCount}) · ` : ''}{Object.entries(testReasonCounts).map(([reason, count]) => `${formatLabel(reason)} (${count})`).join(' · ')}
          </p>
          {testReasonFilter === 'manual_override_only' && (
            <p className="text-xs text-zinc-500">
              Priorización activa: severidad desc por aging + pagada + no enviada + no activada.
            </p>
          )}
        </div>
      )}

      <AdminCard className="mb-8">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div>
            <h2 className="font-bold text-white">Embudo operativo real</h2>
            <p className="text-sm text-zinc-400">Base pagada: {funnelSnapshot.paidBase} órdenes</p>
          </div>
          <AdminBadge variant={funnelSnapshot.exceptions.length > 0 ? 'warning' : 'success'}>
            {funnelSnapshot.exceptions.length} excepción{funnelSnapshot.exceptions.length === 1 ? '' : 'es'}
          </AdminBadge>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          {funnelSnapshot.counts.map((step) => (
            <div key={step.key} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500 font-bold">{step.label}</p>
              <p className="mt-2 text-2xl font-bold text-white">{step.count}</p>
              <p className="text-xs text-zinc-400 mt-1">{step.ratio}% de paid</p>
            </div>
          ))}
        </div>
        {funnelSnapshot.exceptions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {funnelSnapshot.exceptions.slice(0, 6).map((order) => (
              <span key={order.id} className="rounded-full border border-amber-800 bg-amber-950/40 px-3 py-1 text-[11px] font-bold text-amber-300">
                {order.customerLabel}: {(order.observability_alerts || [])[0]}
              </span>
            ))}
          </div>
        )}
      </AdminCard>

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
            <div className="flex gap-3 flex-1 flex-col sm:flex-row sm:flex-wrap">
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
              <label className="relative block">
                <QrCode className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <select
                  value={auditFilter}
                  onChange={(event) => {
                    const value = event.target.value;
                    setAuditFilter(value);
                    if (value === 'all') {
                      setTestReasonFilter('all');
                      setOverrideAgeFilter('all');
                    }
                    if (!forceAuditFilter && typeof window !== 'undefined') {
                      const nextUrl = value === 'excluded'
                        ? `/admin/orders?audit=excluded${testReasonFilter !== 'all' ? `&test_reason=${encodeURIComponent(testReasonFilter)}` : ''}${overrideAgeFilter !== 'all' ? `&override_age=${encodeURIComponent(overrideAgeFilter)}` : ''}`
                        : '/admin/orders';
                      window.history.replaceState({}, '', nextUrl);
                    }
                  }}
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
                      value={testReasonFilter}
                      onChange={(event) => {
                        const value = event.target.value;
                        setTestReasonFilter(value);
                        if (value !== 'manual_override_only') {
                          setOverrideAgeFilter('all');
                        }
                        if (!forceAuditFilter && typeof window !== 'undefined') {
                          const nextUrl = value === 'all'
                            ? '/admin/orders?audit=excluded'
                            : `/admin/orders?audit=excluded&test_reason=${encodeURIComponent(value)}${value === 'manual_override_only' && overrideAgeFilter !== 'all' ? `&override_age=${encodeURIComponent(overrideAgeFilter)}` : ''}`;
                          window.history.replaceState({}, '', nextUrl);
                        }
                      }}
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
                    <label className="relative block">
                      <Clock3 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                      <select
                        value={overrideAgeFilter}
                        onChange={(event) => {
                          const value = event.target.value;
                          setOverrideAgeFilter(value);
                          if (!forceAuditFilter && typeof window !== 'undefined') {
                            const nextUrl = value === 'all'
                              ? '/admin/orders?audit=excluded&test_reason=manual_override_only'
                              : `/admin/orders?audit=excluded&test_reason=manual_override_only&override_age=${encodeURIComponent(value)}`;
                            window.history.replaceState({}, '', nextUrl);
                          }
                        }}
                        className="w-full appearance-none px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors pl-9 sm:w-56"
                      >
                        <option value="all">Override age: todos</option>
                        <option value="24h">Override age: ≥24h</option>
                        <option value="72h">Override age: ≥72h</option>
                      </select>
                    </label>
                  )}
                </>
              )}
            </div>
          </div>

          <div key={`${dateFilter}-${paymentFilter}-${fulfillmentFilter}-${auditFilter}-${testReasonFilter}-${overrideAgeFilter}`} className="overflow-x-auto">
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
                            onClick={() => transitionOrderState(order.id, { payment_status: 'paid', reason: 'Marcada manualmente como pagada desde admin' }, `Orden ${order.id} marcada como pagada.`)}
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
                            onClick={() => transitionOrderState(order.id, { fulfillment_status: FULFILLMENT_NEXT[order.fulfillment_status], reason: 'Avance operacional desde admin' }, `Orden ${order.id} avanzada a ${formatLabel(FULFILLMENT_NEXT[order.fulfillment_status])}.`)}
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
                        onClick={() => {
                          setSelectedOrderId(order.id);
                          if (typeof window !== 'undefined') {
                            const params = new URLSearchParams(window.location.search);
                            params.set('order_id', order.id);
                            const nextPath = `${window.location.pathname}?${params.toString()}`;
                            window.history.replaceState({}, '', nextPath);
                          }
                        }}
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

              <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Trazabilidad post-pago</p>
                  <AdminBadge variant={selectedOrder.terminal_state === 'activated' ? 'success' : selectedOrder.observability_alerts?.length ? 'warning' : 'default'}>
                    {formatLabel(selectedOrder.terminal_state || selectedOrder.funnel_stage)}
                  </AdminBadge>
                </div>
                <div className="grid gap-3 md:grid-cols-5">
                  {deriveTraceabilityMoments(selectedOrder).map((moment) => (
                    <div key={moment.key} className="rounded-xl bg-zinc-900 border border-zinc-700 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500 font-bold">{moment.label}</p>
                      <p className={`mt-2 text-sm font-bold ${moment.done ? 'text-white' : 'text-zinc-500'}`}>
                        {moment.done ? 'OK' : 'Pendiente'}
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-1">{formatDate(moment.at)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <AdminBadge variant={selectedOrder.related_cards?.length > 0 ? 'success' : 'warning'}>
                    {selectedOrder.related_cards?.length > 0 ? `${selectedOrder.related_cards.length} card(s) trazadas` : 'Sin card trazada'}
                  </AdminBadge>
                  <AdminBadge variant={selectedOrder.activation_claim?.status === 'claimed' ? 'success' : selectedOrder.activation_claim ? 'info' : 'default'}>
                    Claim: {formatLabel(selectedOrder.activation_claim?.status || 'sin claim')}
                  </AdminBadge>
                  <AdminBadge variant={selectedOrder.observability_alerts?.length ? 'warning' : 'success'}>
                    {selectedOrder.observability_alerts?.length ? `${selectedOrder.observability_alerts.length} alerta(s)` : 'Sin alertas'}
                  </AdminBadge>
                </div>
                {selectedOrder.observability_alerts?.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {selectedOrder.observability_alerts.map((alert) => (
                      <div key={alert} className="rounded-lg border border-amber-800 bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-300">
                        {alert}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Cliente</p>
                  <p className="font-bold text-white">{selectedOrder.customerLabel}</p>
                  <p className="text-sm text-zinc-400 font-medium">{selectedOrder.customer_email || 'Sin email'}</p>
                  <p className="text-sm text-zinc-400 font-medium">{selectedOrder.customer_phone || 'Sin teléfono'}</p>
                </div>

                <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Segregación QA/test</p>
                      <p className="text-sm font-semibold text-white mt-1">
                        {selectedOrder.is_test ? 'Excluida de operación real' : 'Incluida en operación real'}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Motivo actual: {selectedOrder.test_reason ? formatLabel(selectedOrder.test_reason) : 'sin motivo'}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Último override: {selectedOrderOverrideAudit ? `${formatActorLabel(selectedOrderOverrideAudit)} · ${formatDate(selectedOrderOverrideAudit.changed_at)}` : 'sin trazabilidad manual registrada'}
                      </p>
                    </div>
                    <AdminBadge variant={selectedOrder.is_test ? 'warning' : 'success'}>
                      {selectedOrder.is_test ? 'QA/test' : 'Operativa real'}
                    </AdminBadge>
                  </div>
                  <textarea
                    value={testOverrideReason}
                    onChange={(event) => setTestOverrideReason(event.target.value)}
                    disabled={busyOrderId === selectedOrder.id}
                    rows="2"
                    placeholder={selectedOrder.is_test ? 'Ej: pedido real corregido manualmente' : 'Ej: smoke interno / demo'}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors resize-none"
                  />
                  <div className="flex flex-wrap gap-2">
                    {selectedOrder.is_test ? (
                      <button
                        type="button"
                        onClick={() => applyTestOverride(selectedOrder, false)}
                        disabled={busyOrderId === selectedOrder.id}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        Restaurar como orden real
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => applyTestOverride(selectedOrder, true)}
                        disabled={busyOrderId === selectedOrder.id}
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

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Pago</p>
                  <select
                    value={selectedOrder.payment_status || ''}
                    onChange={(event) => transitionOrderState(selectedOrder.id, { payment_status: event.target.value, reason: 'Cambio manual de pago desde admin' }, `Estado de pago actualizado para ${selectedOrder.id}.`)}
                    disabled={busyOrderId === selectedOrder.id}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                  >
                    {[selectedOrder.payment_status, ...(PAYMENT_TRANSITIONS[selectedOrder.payment_status] || [])].filter(Boolean).map((status) => (
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
                    onChange={(event) => transitionOrderState(selectedOrder.id, { fulfillment_status: event.target.value, reason: 'Cambio manual operativo desde admin' }, `Estado operativo actualizado para ${selectedOrder.id}.`)}
                    disabled={busyOrderId === selectedOrder.id}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                  >
                    {[selectedOrder.fulfillment_status, ...(FULFILLMENT_TRANSITIONS[selectedOrder.fulfillment_status] || [])].filter(Boolean).map((status) => (
                      <option key={status} value={status}>{formatLabel(status)}</option>
                    ))}
                  </select>
                  <p className="text-sm font-semibold text-zinc-300 mt-3">Entrega: {selectedOrder.delivery_type || '—'}</p>
                  <p className="text-xs text-zinc-500 mt-1">Dirección: {selectedOrder.customer_address || selectedOrder.delivery_address || '—'}</p>
                  {selectedOrder.fulfillment_status === 'ready' && (
                    <p className="text-xs text-amber-400 mt-2">Para pasar a despachado debes usar el módulo de despacho con carrier + tracking.</p>
                  )}
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
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-zinc-500">
                            {new Date(entry.changed_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                          <p className="text-[10px] text-zinc-600">
                            {formatActorLabel(entry)}
                          </p>
                        </div>
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
                    value={draftOrder?.customer_address || ''}
                    onChange={(event) => setDraftOrder((prev) => ({ ...(prev || {}), customer_address: event.target.value }))}
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
                    customer_address: selectedOrder.customer_address || selectedOrder.delivery_address || '',
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
                      href={selectedOrder.delivery_token ? `/seguimiento/${selectedOrder.id}/${selectedOrder.delivery_token}` : '#'}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-bold ${selectedOrder.delivery_token ? 'bg-blue-600' : 'bg-zinc-700 pointer-events-none opacity-60'}`}
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
                        win.document.write(`<!DOCTYPE html><html><head><style>@page{size:85.6mm 54mm;margin:0;bleed:1mm;}body{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;width:85.6mm;height:54mm;overflow:hidden;}.card{width:85.6mm;height:54mm;position:relative;}.safe-area{position:absolute;top:3mm;left:3mm;right:3mm;bottom:3mm;border:1px dashed rgba(255,0,0,0.3);pointer-events:none;}@media print{.safe-area{display:none;}}svg{width:85.6mm;height:54mm;}</style></head><body><div class="card"><div class="safe-area"></div>${svg}</div></body></html>`);
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
    </>
  );

  if (embedded) return content;

  return (
    <AdminShell
      active="orders"
      title="Orders Control Center"
      subtitle="Caja, producción y cumplimiento en una sola mesa de control operativa."
    >
      {content}
    </AdminShell>
  );
};

export default OrdersDashboard;
