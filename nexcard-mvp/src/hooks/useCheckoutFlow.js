import { useEffect, useState } from 'react';
import { api, getLastOrderProof, getLastOrderSnapshot } from '../services/api';
import { trackEvent } from '../utils/ga4';
import { pollGuestOrderReceipt, resolveReturnProof } from './checkoutReturn';

const VERIFYING_PAYMENT_MESSAGE = 'Estamos confirmando tu pago con Mercado Pago. Esto puede tardar unos segundos.';
const PENDING_PAYMENT_MESSAGE = 'Tu pago aún no aparece confirmado. Si Mercado Pago ya te descontó, la confirmación puede tardar unos minutos.';
const RECEIPT_UNAVAILABLE_MESSAGE = 'No pudimos recuperar los datos de esta orden automáticamente. Revisaremos tu orden y te contactaremos si necesitamos más información.';

function buildUnavailableGuestReceipt(orderId) {
  return {
    id: orderId,
    payment_status: 'pending',
    guestReceiptUnavailable: true,
    isVerifyingPayment: false,
    payment_verification_message: RECEIPT_UNAVAILABLE_MESSAGE,
  };
}

export function useCheckoutFlow() {
  const [checkoutStep, setCheckoutStep] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);

  const handleCheckoutStart = () => {
    setCheckoutStep('catalog');
  };

  const handleProceedToCart = (getTotalItems) => {
    if (getTotalItems() > 0) {
      setCheckoutStep('cart');
    }
  };

  const handleProceedToCheckout = () => {
    trackEvent('checkout_started');
    setCheckoutStep('checkout');
  };

  const handleOrderSuccess = (order) => {
    setCurrentOrder(order);
    setCheckoutStep('confirmation');
  };

  const handleBackToShop = () => {
    setCheckoutStep('catalog');
  };

  const handleBackToCart = () => {
    setCheckoutStep('cart');
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const orderId = params.get('order');

    if (!payment || !orderId) return undefined;

    const controller = new AbortController();
    const isSuccessReturn = payment === 'success';
    const proof = resolveReturnProof(orderId, getLastOrderProof());
    const snapshot = getLastOrderSnapshot();
    const matchingSnapshot = snapshot?.id === orderId ? snapshot : null;

    if (isSuccessReturn) {
      trackEvent('payment_return_success_seen', { order_id: orderId });
    }

    window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
    setCheckoutStep('confirmation');

    if (!proof) {
      setCurrentOrder(buildUnavailableGuestReceipt(orderId));
      return () => controller.abort();
    }

    const updateReceipt = (receipt, options = {}) => {
      if (controller.signal.aborted) return;

      setCurrentOrder((order) => ({
        ...(order?.id === orderId ? order : matchingSnapshot || {}),
        ...receipt,
        id: orderId,
        isVerifyingPayment: options.isVerifyingPayment ?? false,
        payment_verification_message: options.message ?? null,
      }));
    };

    if (isSuccessReturn) {
      setCurrentOrder({
        ...(matchingSnapshot || {}),
        id: orderId,
        payment_status: 'pending',
        isVerifyingPayment: true,
        payment_verification_message: VERIFYING_PAYMENT_MESSAGE,
      });

      pollGuestOrderReceipt({
        fetchReceipt: api.getGuestOrderReceipt,
        proof,
        signal: controller.signal,
        onReceipt: (receipt) => {
          const isPaid = receipt.payment_status === 'paid';
          updateReceipt(receipt, {
            isVerifyingPayment: !isPaid,
            message: isPaid ? 'Pago confirmado por NexCard.' : VERIFYING_PAYMENT_MESSAGE,
          });
        },
      }).then((receipt) => {
        if (controller.signal.aborted || receipt?.payment_status === 'paid') return;
        updateReceipt({ id: orderId, payment_status: 'pending' }, {
          isVerifyingPayment: false,
          message: PENDING_PAYMENT_MESSAGE,
        });
      });
    } else {
      setCurrentOrder({
        ...(matchingSnapshot || {}),
        id: orderId,
        payment_status: 'pending',
        isVerifyingPayment: false,
        payment_verification_message: null,
      });

      api.getGuestOrderReceipt(proof, { signal: controller.signal })
        .then((receipt) => updateReceipt(receipt))
        .catch(() => {
          if (!controller.signal.aborted) {
            setCurrentOrder(buildUnavailableGuestReceipt(orderId));
          }
        });
    }

    return () => controller.abort();
  }, []);

  return {
    checkoutStep,
    currentOrder,
    setCheckoutStep,
    setCurrentOrder,
    handleCheckoutStart,
    handleProceedToCart,
    handleProceedToCheckout,
    handleOrderSuccess,
    handleBackToShop,
    handleBackToCart,
  };
}
