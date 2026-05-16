import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Truck,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api';
import CardPreview from './CardPreview';
import { generateCardSVG } from '../utils/cardTemplates';
import AdminShell from './AdminShell';
import AdminCard from './ui/AdminCard';
import AdminBadge from './ui/AdminBadge';
import OrdersDashboardHeader from './orders/OrdersDashboardHeader';
import OrdersFiltersBar from './orders/OrdersFiltersBar';
import OrdersTable from './orders/OrdersTable';
import OrderTraceabilityCard from './orders/OrderTraceabilityCard';
import OrderQaAuditCard from './orders/OrderQaAuditCard';
import OrderNfcCard from './orders/OrderNfcCard';
import OrderRefundCard from './orders/OrderRefundCard';
import { useOrdersDashboardActions } from './orders/useOrdersDashboardActions';
import { isManualTestReason } from '../utils/orderOperationalSegmentation';
import {
  buildOrdersDashboardFunnelSnapshot,
  buildOrdersDashboardStats,
  buildOrdersAuditQueryString,
  buildQaDecisionTimeline,
  buildTestReasonCounts,
  buildTestReasonOptions,
  currency,
  filterAuditScopedOrders,
  filterOrdersDashboardRows,
  formatActorLabel,
  formatDate,
  formatLabel,
  normalizeOrdersForDashboard,
  parseOrdersAuditQueryState,
} from './orders/utils';

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
  const [reviewNote, setReviewNote] = useState('');
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
  const [reviewStatusFilter, setReviewStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
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
    const queryState = parseOrdersAuditQueryState({ search: window.location.search, forceAuditFilter });
    setAuditFilter(queryState.auditFilter);
    setTestReasonFilter(queryState.testReasonFilter);
    setOverrideAgeFilter(queryState.overrideAgeFilter);
    setReviewStatusFilter(queryState.reviewStatusFilter);
    setRiskFilter(queryState.riskFilter);
    if (queryState.selectedOrderId) setSelectedOrderId(queryState.selectedOrderId);
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

  const normalizedOrders = useMemo(() => normalizeOrdersForDashboard(rows), [rows]);

  const excludedOrdersCount = useMemo(() => normalizedOrders.filter((order) => order.isNonOperational).length, [normalizedOrders]);
  const excludedOrders = useMemo(() => normalizedOrders.filter((order) => order.isNonOperational), [normalizedOrders]);

  const testReasonCounts = useMemo(() => buildTestReasonCounts(excludedOrders), [excludedOrders]);

  const manualOverrideCount = useMemo(() => excludedOrders.filter((order) => isManualTestReason(order.testReasonResolved)).length, [excludedOrders]);
  const manualOverridePendingCount = useMemo(() => excludedOrders.filter((order) => isManualTestReason(order.testReasonResolved) && !order.qa_reviewed_at).length, [excludedOrders]);
  const manualOverrideReviewedCount = useMemo(() => excludedOrders.filter((order) => isManualTestReason(order.testReasonResolved) && order.qa_reviewed_at).length, [excludedOrders]);
  const manualOverrideBlockedCount = useMemo(() => excludedOrders.filter((order) => {
    if (!isManualTestReason(order.testReasonResolved)) return false;
    const isPaid = order.payment_status === 'paid';
    const notShipped = !['shipped', 'delivered'].includes(order.fulfillment_status);
    const notActivated = !order.activation_completed;
    return isPaid && notShipped && notActivated;
  }).length, [excludedOrders]);

  const testReasonOptions = useMemo(() => buildTestReasonOptions(testReasonCounts, manualOverrideCount), [testReasonCounts, manualOverrideCount]);

  const auditScopedOrders = useMemo(() => filterAuditScopedOrders({
    normalizedOrders,
    auditFilter,
    testReasonFilter,
    overrideAgeFilter,
    reviewStatusFilter,
    riskFilter,
  }), [normalizedOrders, auditFilter, testReasonFilter, overrideAgeFilter, reviewStatusFilter, riskFilter]);

  const paymentStatuses = useMemo(() => ['all', ...Array.from(new Set(normalizedOrders.map((order) => order.payment_status).filter(Boolean)))], [normalizedOrders]);
  const fulfillmentStatuses = useMemo(() => ['all', ...Array.from(new Set(normalizedOrders.map((order) => order.fulfillment_status).filter(Boolean)))], [normalizedOrders]);

  const filteredOrders = useMemo(() => filterOrdersDashboardRows({
    auditScopedOrders,
    searchTerm,
    paymentFilter,
    fulfillmentFilter,
    dateFilter,
    testReasonFilter,
  }), [auditScopedOrders, searchTerm, paymentFilter, fulfillmentFilter, dateFilter, testReasonFilter]);

  const selectedOrder = filteredOrders.find((order) => order.id === selectedOrderId) || filteredOrders[0] || null;

  const selectedOrderOverrideAudit = useMemo(() => {
    if (!selectedOrder) return null;
    const history = orderHistory[selectedOrder.id] || [];
    return history.find((entry) => entry.field === 'is_test' || entry.field === 'test_reason') || null;
  }, [selectedOrder, orderHistory]);

  const selectedOrderQaTimeline = useMemo(() => {
    if (!selectedOrder) return [];
    return buildQaDecisionTimeline(selectedOrder, orderHistory[selectedOrder.id] || []);
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
    setReviewNote(selectedOrder.qa_review_note || '');
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

  const {
    saveDraftOrder,
    linkCardToOrder,
    confirmNfcProgramming,
    saveShipping,
    applyTestOverride,
    reviewTestClassification,
    processRefund,
    handleMarkOrderPaid,
    handleAdvanceFulfillment,
    transitionOrderState,
  } = useOrdersDashboardActions({
    selectedOrder,
    draftOrder,
    linkingCardId,
    nfcSlug,
    draftShipping,
    testOverrideReason,
    reviewNote,
    refundForm,
    setBusyOrderId,
    setFeedback,
    setRows,
    setLinkingCardId,
    loadSlugForOrder,
    setNfcBusy,
    setNfcQrDataUrl,
    setShippingBusy,
    setRefundByOrder,
    setRefundBusy,
    fulfillmentNext: FULFILLMENT_NEXT,
  });

  const stats = useMemo(() => buildOrdersDashboardStats(auditScopedOrders), [auditScopedOrders]);

  const funnelSnapshot = useMemo(() => buildOrdersDashboardFunnelSnapshot(auditScopedOrders), [auditScopedOrders]);

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

  const clearQaFilters = useCallback(() => {
    setAuditFilter('all');
    setTestReasonFilter('all');
    setOverrideAgeFilter('all');
    setReviewStatusFilter('all');
    setRiskFilter('all');
    if (typeof window !== 'undefined') window.history.replaceState({}, '', buildOrdersAuditQueryString());
  }, []);

  const selectManualOverrideFilter = useCallback(() => {
    setAuditFilter('excluded');
    setTestReasonFilter('manual_override_only');
    setOverrideAgeFilter('all');
    setReviewStatusFilter('pending');
    setRiskFilter('all');
    if (!forceAuditFilter && typeof window !== 'undefined') {
      window.history.replaceState({}, '', buildOrdersAuditQueryString({
        auditFilter: 'excluded',
        testReasonFilter: 'manual_override_only',
        reviewStatusFilter: 'pending',
      }));
    }
  }, [forceAuditFilter]);

  const selectQaReasonFilter = useCallback((reason) => {
    setAuditFilter('excluded');
    setTestReasonFilter(reason);
    setOverrideAgeFilter('all');
    setReviewStatusFilter('all');
    setRiskFilter('all');
    if (!forceAuditFilter && typeof window !== 'undefined') {
      window.history.replaceState({}, '', buildOrdersAuditQueryString({
        auditFilter: 'excluded',
        testReasonFilter: reason,
      }));
    }
  }, [forceAuditFilter]);

  const handleAuditFilterChange = useCallback((value) => {
    setAuditFilter(value);
    if (value === 'all') {
      setTestReasonFilter('all');
      setOverrideAgeFilter('all');
      setReviewStatusFilter('all');
      setRiskFilter('all');
    }
    if (!forceAuditFilter && typeof window !== 'undefined') {
      window.history.replaceState({}, '', buildOrdersAuditQueryString({
        auditFilter: value,
        testReasonFilter: value === 'excluded' ? testReasonFilter : 'all',
        overrideAgeFilter: value === 'excluded' ? overrideAgeFilter : 'all',
        reviewStatusFilter: value === 'excluded' && testReasonFilter === 'manual_override_only' ? reviewStatusFilter : 'all',
        riskFilter: value === 'excluded' && testReasonFilter === 'manual_override_only' ? riskFilter : 'all',
      }));
    }
  }, [forceAuditFilter, overrideAgeFilter, reviewStatusFilter, riskFilter, testReasonFilter]);

  const handleTestReasonFilterChange = useCallback((value) => {
    setTestReasonFilter(value);
    if (value !== 'manual_override_only') {
      setOverrideAgeFilter('all');
      setReviewStatusFilter('all');
      setRiskFilter('all');
    } else if (reviewStatusFilter === 'all') {
      setReviewStatusFilter('pending');
    }
    if (!forceAuditFilter && typeof window !== 'undefined') {
      const effectiveReviewStatus = value === 'manual_override_only'
        ? (reviewStatusFilter === 'all' ? 'pending' : reviewStatusFilter)
        : 'all';
      const effectiveRisk = value === 'manual_override_only' ? riskFilter : 'all';
      window.history.replaceState({}, '', buildOrdersAuditQueryString({
        auditFilter: 'excluded',
        testReasonFilter: value,
        overrideAgeFilter: value === 'manual_override_only' ? overrideAgeFilter : 'all',
        reviewStatusFilter: value === 'manual_override_only' ? effectiveReviewStatus : 'all',
        riskFilter: value === 'manual_override_only' ? effectiveRisk : 'all',
      }));
    }
  }, [forceAuditFilter, overrideAgeFilter, reviewStatusFilter, riskFilter]);

  const handleOverrideAgeFilterChange = useCallback((value) => {
    setOverrideAgeFilter(value);
    if (!forceAuditFilter && typeof window !== 'undefined') {
      window.history.replaceState({}, '', buildOrdersAuditQueryString({
        auditFilter: 'excluded',
        testReasonFilter: 'manual_override_only',
        overrideAgeFilter: value,
        reviewStatusFilter,
        riskFilter,
      }));
    }
  }, [forceAuditFilter, reviewStatusFilter, riskFilter]);

  const handleReviewStatusFilterChange = useCallback((value) => {
    setReviewStatusFilter(value);
    if (!forceAuditFilter && typeof window !== 'undefined') {
      window.history.replaceState({}, '', buildOrdersAuditQueryString({
        auditFilter: 'excluded',
        testReasonFilter: 'manual_override_only',
        overrideAgeFilter,
        reviewStatusFilter: value,
        riskFilter,
      }));
    }
  }, [forceAuditFilter, overrideAgeFilter, riskFilter]);

  const handleRiskFilterChange = useCallback((value) => {
    setRiskFilter(value);
    if (!forceAuditFilter && typeof window !== 'undefined') {
      window.history.replaceState({}, '', buildOrdersAuditQueryString({
        auditFilter: 'excluded',
        testReasonFilter: 'manual_override_only',
        overrideAgeFilter,
        reviewStatusFilter,
        riskFilter: value,
      }));
    }
  }, [forceAuditFilter, overrideAgeFilter, reviewStatusFilter]);

  const handleSelectOrder = useCallback((orderId) => {
    setSelectedOrderId(orderId);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', buildOrdersAuditQueryString({
        auditFilter,
        testReasonFilter,
        overrideAgeFilter,
        reviewStatusFilter,
        riskFilter,
        orderId,
      }));
    }
  }, [auditFilter, overrideAgeFilter, reviewStatusFilter, riskFilter, testReasonFilter]);

  const content = (
    <>
      <OrdersDashboardHeader
        stats={stats}
        excludedOrdersCount={excludedOrdersCount}
        auditFilter={auditFilter}
        manualOverrideCount={manualOverrideCount}
        manualOverridePendingCount={manualOverridePendingCount}
        manualOverrideReviewedCount={manualOverrideReviewedCount}
        manualOverrideBlockedCount={manualOverrideBlockedCount}
        testReasonCounts={testReasonCounts}
        testReasonFilter={testReasonFilter}
        reviewStatusFilter={reviewStatusFilter}
        riskFilter={riskFilter}
        funnelSnapshot={funnelSnapshot}
        forceAuditFilter={forceAuditFilter}
        onSelectManualOverrides={selectManualOverrideFilter}
        onSelectReason={selectQaReasonFilter}
        onClearQaFilter={clearQaFilters}
      />

      {feedback.message && (
        <div className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${feedback.type === 'success' ? 'border-emerald-800 bg-emerald-950/40 text-emerald-400' : 'border-red-800 bg-red-950/40 text-red-400'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-[1.5fr,1fr] gap-6">
        {/* Lista de órdenes */}
        <AdminCard className="!p-0 overflow-hidden">
          <OrdersFiltersBar
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            newOrdersCount={newOrdersCount}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            onExportCsv={exportCSV}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            paymentFilter={paymentFilter}
            onPaymentFilterChange={setPaymentFilter}
            paymentStatuses={paymentStatuses}
            fulfillmentFilter={fulfillmentFilter}
            onFulfillmentFilterChange={setFulfillmentFilter}
            fulfillmentStatuses={fulfillmentStatuses}
            auditFilter={auditFilter}
            onAuditFilterChange={handleAuditFilterChange}
            forceAuditFilter={forceAuditFilter}
            testReasonOptions={testReasonOptions}
            testReasonFilter={testReasonFilter}
            onTestReasonFilterChange={handleTestReasonFilterChange}
            testReasonCounts={testReasonCounts}
            manualOverrideCount={manualOverrideCount}
            overrideAgeFilter={overrideAgeFilter}
            onOverrideAgeFilterChange={handleOverrideAgeFilterChange}
            reviewStatusFilter={reviewStatusFilter}
            onReviewStatusFilterChange={handleReviewStatusFilterChange}
            riskFilter={riskFilter}
            onRiskFilterChange={handleRiskFilterChange}
            formatLabel={formatLabel}
          />

          <div key={`${dateFilter}-${paymentFilter}-${fulfillmentFilter}-${auditFilter}-${testReasonFilter}-${overrideAgeFilter}-${reviewStatusFilter}-${riskFilter}`}>
            <OrdersTable
              orders={filteredOrders}
              selectedOrderId={selectedOrderId}
              busyOrderId={busyOrderId}
              fulfillmentNext={FULFILLMENT_NEXT}
              onMarkPaid={handleMarkOrderPaid}
              onAdvanceFulfillment={handleAdvanceFulfillment}
              onSelectOrder={handleSelectOrder}
            />
          </div>
        </AdminCard>

        {/* Panel detalle */}
        <AdminCard>
          <h2 className="font-bold text-lg text-white mb-4">Detalle de orden</h2>
          {selectedOrder ? (
            <div className="space-y-5">
              <OrderTraceabilityCard order={selectedOrder} />

              <OrderQaAuditCard
                order={selectedOrder}
                overrideAudit={selectedOrderOverrideAudit}
                qaTimeline={selectedOrderQaTimeline}
                busyOrderId={busyOrderId}
                reviewNote={reviewNote}
                onReviewNoteChange={setReviewNote}
                testOverrideReason={testOverrideReason}
                onTestOverrideReasonChange={setTestOverrideReason}
                onApplyTestOverride={applyTestOverride}
                onReviewTestClassification={reviewTestClassification}
              />

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

              <OrderNfcCard
                order={selectedOrder}
                linkingCardId={linkingCardId}
                onLinkingCardIdChange={setLinkingCardId}
                onLinkCardToOrder={linkCardToOrder}
                busyOrderId={busyOrderId}
                nfcSlug={nfcSlug}
                onNfcSlugChange={setNfcSlug}
                nfcSlugLoading={nfcSlugLoading}
                nfcBusy={nfcBusy}
                onConfirmNfcProgramming={confirmNfcProgramming}
                nfcQrDataUrl={nfcQrDataUrl}
              />

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

              <OrderRefundCard
                order={selectedOrder}
                refundByOrder={refundByOrder}
                refundForm={refundForm}
                onRefundFormChange={setRefundForm}
                refundBusy={refundBusy}
                onProcessRefund={processRefund}
              />

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
