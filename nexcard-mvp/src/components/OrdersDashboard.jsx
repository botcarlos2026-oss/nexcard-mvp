import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Truck,
  ExternalLink,
} from 'lucide-react';
import AdminShell from './AdminShell';
import AdminCard from './ui/AdminCard';
import AdminBadge from './ui/AdminBadge';
import OrdersDashboardHeader from './orders/OrdersDashboardHeader';
import OrdersFiltersBar from './orders/OrdersFiltersBar';
import OrdersKanbanBoard from './orders/OrdersKanbanBoard';
import OrderTraceabilityCard from './orders/OrderTraceabilityCard';
import OrderQaAuditCard from './orders/OrderQaAuditCard';
import OrderNfcCard from './orders/OrderNfcCard';
import OrderRefundCard from './orders/OrderRefundCard';
import OrdersDetailSupportPanels from './orders/OrdersDetailSupportPanels';
import { useOrdersDashboardActions } from './orders/useOrdersDashboardActions';
import { useOrdersDashboardDetailState } from './orders/useOrdersDashboardDetailState';
import { useOrdersDashboardRuntime } from './orders/useOrdersDashboardRuntime';
import { isManualTestReason } from '../utils/orderOperationalSegmentation';
import {
  buildOrdersDashboardFunnelSnapshot,
  buildOrdersDashboardStats,
  buildOrdersAuditQueryString,
  buildTestReasonCounts,
  buildTestReasonOptions,
  currency,
  OPERATIONAL_FILTERS,
  filterAuditScopedOrders,
  filterOrdersDashboardRows,
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

  const [refundByOrder, setRefundByOrder] = useState({});
  const [refundForm, setRefundForm] = useState({ reason: 'Producto defectuoso', amount_cents: '', notes: '' });
  const [refundBusy, setRefundBusy] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [operationalFilter, setOperationalFilter] = useState('all');
  const [auditFilter, setAuditFilter] = useState('all');
  const [testReasonFilter, setTestReasonFilter] = useState('all');
  const [overrideAgeFilter, setOverrideAgeFilter] = useState('all');
  const [reviewStatusFilter, setReviewStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const detailPanelRef = useRef(null);
  const shippingPanelRef = useRef(null);
  const {
    newOrdersCount,
    refreshing,
    loadOrderHistory,
    handleRefresh,
    handleSelectOrder,
  } = useOrdersDashboardRuntime({
    orders,
    auditFilter,
    testReasonFilter,
    overrideAgeFilter,
    reviewStatusFilter,
    riskFilter,
    setRows,
    setSelectedOrderId,
    setOrderHistory,
  });

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
    operationalFilter,
  }), [auditScopedOrders, searchTerm, paymentFilter, fulfillmentFilter, dateFilter, testReasonFilter, operationalFilter]);

  const {
    selectedOrder,
    selectedOrderOverrideAudit,
    selectedOrderQaTimeline,
    loadSlugForOrder,
  } = useOrdersDashboardDetailState({
    filteredOrders,
    selectedOrderId,
    orderHistory,
    setNfcSlugLoading,
    setNfcSlug,
    loadOrderHistory,
    setDraftOrder,
    setDraftShipping,
    setLinkingCardId,
    setNfcQrDataUrl,
    setChecklistDone,
    setRefundForm,
    setTestOverrideReason,
    setReviewNote,
    refundByOrder,
    setRefundByOrder,
  });

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

  const scrollToOrderDetail = useCallback((target = 'detail') => {
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      const node = target === 'shipping' ? shippingPanelRef.current : detailPanelRef.current;
      node?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const selectOrderAndScroll = useCallback((orderId, target = 'detail') => {
    handleSelectOrder(orderId);
    scrollToOrderDetail(target);
  }, [handleSelectOrder, scrollToOrderDetail]);

  const getDispatchBlocker = useCallback(() => {
    if (!selectedOrder) return 'Selecciona una orden antes de registrar despacho.';
    if (selectedOrder.fulfillment_status !== 'ready') return 'Solo puedes registrar despacho para órdenes en estado ready.';
    if (!draftShipping.carrier) return 'Selecciona un courier.';
    if (!draftShipping.tracking_code.trim()) return 'Ingresa el código de seguimiento.';
    if (!checklistDone.every(Boolean)) return 'Completa el checklist pre-despacho.';
    return '';
  }, [checklistDone, draftShipping.carrier, draftShipping.tracking_code, selectedOrder]);

  const handleSaveShipping = useCallback(() => {
    const blocker = getDispatchBlocker();
    if (blocker) {
      setFeedback({ type: 'error', message: blocker });
      scrollToOrderDetail('shipping');
      return;
    }
    saveShipping();
  }, [getDispatchBlocker, saveShipping, scrollToOrderDetail]);

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

      <div className="space-y-6">
        {/* Bandeja Kanban de órdenes */}
        <AdminCard className="!p-0 overflow-hidden">
          <OrdersFiltersBar
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            operationalFilter={operationalFilter}
            onOperationalFilterChange={setOperationalFilter}
            operationalFilters={OPERATIONAL_FILTERS}
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

          <div key={`${dateFilter}-${operationalFilter}-${paymentFilter}-${fulfillmentFilter}-${auditFilter}-${testReasonFilter}-${overrideAgeFilter}-${reviewStatusFilter}-${riskFilter}`}>
            <div className="p-4 md:p-5">
              <OrdersKanbanBoard
                orders={filteredOrders}
                selectedOrderId={selectedOrderId}
                busyOrderId={busyOrderId}
                fulfillmentNext={FULFILLMENT_NEXT}
                onMarkPaid={handleMarkOrderPaid}
                onAdvanceFulfillment={handleAdvanceFulfillment}
                onSelectOrder={selectOrderAndScroll}
                onOperationalFilterChange={setOperationalFilter}
              />
            </div>
          </div>
        </AdminCard>

        {/* Panel detalle bajo el Kanban para no competir visualmente con la bandeja diaria */}
        <AdminCard>
          <div ref={detailPanelRef} className="scroll-mt-6" />
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-lg text-white">Detalle de orden</h2>
              <p className="mt-1 text-sm font-medium text-zinc-500">Se abre al seleccionar una card; queda debajo para mantener el Kanban como foco operativo.</p>
            </div>
            {selectedOrder && <AdminBadge variant="info">{selectedOrder.folio || selectedOrder.id}</AdminBadge>}
          </div>
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

              <OrdersDetailSupportPanels
                order={selectedOrder}
                orderHistory={orderHistory[selectedOrder?.id] || []}
                draftOrder={draftOrder}
                setDraftOrder={setDraftOrder}
                busyOrderId={busyOrderId}
                saveDraftOrder={saveDraftOrder}
                refundByOrder={refundByOrder}
                refundForm={refundForm}
                onRefundFormChange={setRefundForm}
                refundBusy={refundBusy}
                onProcessRefund={processRefund}
                OrderRefundCard={OrderRefundCard}
              />

              {/* Shipping tracking section */}
              <div ref={shippingPanelRef} className="scroll-mt-6 rounded-xl border border-zinc-700 bg-zinc-800 p-4 space-y-4">
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
                    {selectedOrder.delivery_token ? (
                      <a
                        href={`/seguimiento/${selectedOrder.id}/${selectedOrder.delivery_token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-bold bg-blue-600 hover:bg-blue-500"
                      >
                        <ExternalLink size={12} />
                        Ver seguimiento
                      </a>
                    ) : (
                      <span className="rounded-lg bg-zinc-700 px-3 py-2 text-xs font-bold text-zinc-400" title="Esta orden aún no tiene token público de seguimiento.">
                        Sin link público
                      </span>
                    )}
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
                    onClick={handleSaveShipping}
                    disabled={shippingBusy}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm transition-colors ${!getDispatchBlocker() ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-zinc-700 hover:bg-zinc-600'} disabled:opacity-50`}
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
