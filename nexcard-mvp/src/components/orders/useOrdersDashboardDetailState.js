import { useCallback, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { buildQaDecisionTimeline } from './utils';

export function useOrdersDashboardDetailState({
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
}) {
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
  }, [setNfcSlug, setNfcSlugLoading]);

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
    if (selectedOrder.related_cards?.length > 0) {
      loadSlugForOrder(selectedOrder);
    }
    if (!refundByOrder[selectedOrder.id]) {
      api.getRefundForOrder(selectedOrder.id).then((refund) => {
        if (refund) setRefundByOrder((prev) => ({ ...prev, [selectedOrder.id]: refund }));
      }).catch(() => {});
    }
  }, [
    selectedOrder,
    loadOrderHistory,
    loadSlugForOrder,
    refundByOrder,
    setChecklistDone,
    setDraftOrder,
    setDraftShipping,
    setLinkingCardId,
    setNfcQrDataUrl,
    setNfcSlug,
    setRefundByOrder,
    setRefundForm,
    setReviewNote,
    setTestOverrideReason,
  ]);

  return {
    selectedOrder,
    selectedOrderOverrideAudit,
    selectedOrderQaTimeline,
    loadSlugForOrder,
  };
}
