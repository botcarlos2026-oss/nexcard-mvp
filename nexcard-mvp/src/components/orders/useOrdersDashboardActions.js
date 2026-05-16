import { useCallback } from 'react';
import QRCode from 'qrcode';
import { api } from '../../services/api';
import { formatLabel } from './utils';

export function useOrdersDashboardActions({
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
  fulfillmentNext,
}) {
  const updateOrderField = useCallback(async (orderId, payload, successMessage) => {
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
  }, [setBusyOrderId, setFeedback, setRows]);

  const transitionOrderState = useCallback(async (orderId, payload, successMessage) => {
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
  }, [setBusyOrderId, setFeedback, setRows]);

  const saveDraftOrder = useCallback(async () => {
    if (!selectedOrder || !draftOrder) return;
    await updateOrderField(selectedOrder.id, draftOrder, `Datos operativos actualizados para ${selectedOrder.id}.`);
  }, [draftOrder, selectedOrder, updateOrderField]);

  const linkCardToOrder = useCallback(async () => {
    if (!selectedOrder || !linkingCardId) return;

    setBusyOrderId(selectedOrder.id);
    setFeedback({ type: '', message: '' });
    try {
      const response = await api.linkOrderCard(selectedOrder.id, linkingCardId);
      setRows(response.orders || []);
      setFeedback({ type: 'success', message: `Tarjeta vinculada formalmente a la orden ${selectedOrder.id}.` });
      setLinkingCardId('');
      loadSlugForOrder(response.orders?.find((order) => order.id === selectedOrder.id) || selectedOrder);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'No fue posible vincular la tarjeta a la orden.' });
    } finally {
      setBusyOrderId(null);
    }
  }, [linkingCardId, loadSlugForOrder, selectedOrder, setBusyOrderId, setFeedback, setLinkingCardId, setRows]);

  const confirmNfcProgramming = useCallback(async () => {
    if (!selectedOrder || !nfcSlug) return;
    const normalizedSlug = nfcSlug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(normalizedSlug)) {
      setFeedback({ type: 'error', message: 'El slug NFC solo puede contener letras minúsculas, números y guiones.' });
      return;
    }
    const linkedCard = selectedOrder.related_cards?.find((card) => card.order_id === selectedOrder.id) || selectedOrder.related_cards?.[0];
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
  }, [nfcSlug, selectedOrder, setFeedback, setNfcBusy, setNfcQrDataUrl, setRows]);

  const saveShipping = useCallback(async () => {
    if (!selectedOrder) return;
    setShippingBusy(true);
    setFeedback({ type: '', message: '' });
    try {
      const response = await api.dispatchOrder(selectedOrder.id, draftShipping);
      setRows(response.orders || []);
      const decremented = response.itemsDecremented || [];
      const decrMsg = decremented.length > 0
        ? ` Insumos descontados: ${decremented.map((item) => `${item.name} ×${item.quantity}`).join(', ')}.`
        : '';
      setFeedback({ type: 'success', message: `Orden despachada #${selectedOrder.id.slice(0, 8).toUpperCase()} — notificación enviada al cliente.${decrMsg}` });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'No se pudo registrar el despacho.' });
    } finally {
      setShippingBusy(false);
    }
  }, [draftShipping, selectedOrder, setFeedback, setRows, setShippingBusy]);

  const applyTestOverride = useCallback(async (targetOrder, nextIsTest) => {
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
  }, [setBusyOrderId, setFeedback, setRows, testOverrideReason]);

  const reviewTestClassification = useCallback(async (targetOrder) => {
    if (!targetOrder) return;

    setBusyOrderId(targetOrder.id);
    setFeedback({ type: '', message: '' });
    try {
      const response = await api.reviewOrderTestClassification(targetOrder.id, {
        review_note: reviewNote,
      });
      setRows(response.orders || []);
      setFeedback({ type: 'success', message: `Orden ${targetOrder.id} marcada como revisada en auditoría QA.` });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'No fue posible registrar la revisión QA/test.' });
    } finally {
      setBusyOrderId(null);
    }
  }, [reviewNote, setBusyOrderId, setFeedback, setRows]);

  const processRefund = useCallback(async () => {
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
      setRefundByOrder((prev) => ({ ...prev, [selectedOrder.id]: result.refund }));
      const updatedOrders = await api.getOrders();
      setRows(updatedOrders.orders || []);
      setFeedback({ type: 'success', message: `Reembolso procesado. ID MP: ${result.mp_refund_id}` });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'No se pudo procesar el reembolso.' });
    } finally {
      setRefundBusy(false);
    }
  }, [refundForm, selectedOrder, setFeedback, setRefundBusy, setRefundByOrder, setRows]);

  const handleMarkOrderPaid = useCallback((order) => {
    transitionOrderState(order.id, { payment_status: 'paid', reason: 'Marcada manualmente como pagada desde admin' }, `Orden ${order.id} marcada como pagada.`);
  }, [transitionOrderState]);

  const handleAdvanceFulfillment = useCallback((order) => {
    transitionOrderState(
      order.id,
      { fulfillment_status: fulfillmentNext[order.fulfillment_status], reason: 'Avance operacional desde admin' },
      `Orden ${order.id} avanzada a ${formatLabel(fulfillmentNext[order.fulfillment_status])}.`
    );
  }, [fulfillmentNext, transitionOrderState]);

  return {
    updateOrderField,
    transitionOrderState,
    saveDraftOrder,
    linkCardToOrder,
    confirmNfcProgramming,
    saveShipping,
    applyTestOverride,
    reviewTestClassification,
    processRefund,
    handleMarkOrderPaid,
    handleAdvanceFulfillment,
  };
}
