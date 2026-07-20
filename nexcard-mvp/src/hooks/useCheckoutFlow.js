import { useEffect, useState } from 'react';
import { getLastOrderSnapshot } from '../services/api';
import { hasSupabase, supabase } from '../services/supabaseClient';

export function useCheckoutFlow() {
  const [checkoutStep, setCheckoutStep] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [paymentVerificationOrderId, setPaymentVerificationOrderId] = useState(null);

  const handleCheckoutStart = () => {
    setCheckoutStep('catalog');
  };

  const handleProceedToCart = (getTotalItems) => {
    if (getTotalItems() > 0) {
      setCheckoutStep('cart');
    }
  };

  const handleProceedToCheckout = () => {
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

    if (payment && orderId) {
      const snapshot = getLastOrderSnapshot();
      const isSuccessReturn = payment === 'success';

      window.history.replaceState({}, '', '/');

      setCurrentOrder({
        ...(snapshot?.id === orderId ? snapshot : {}),
        id: orderId,
        payment_status: isSuccessReturn ? 'verifying' : payment,
        isVerifyingPayment: isSuccessReturn,
        payment_verification_message: isSuccessReturn
          ? 'Estamos confirmando tu pago con Mercado Pago. Esto puede tardar unos segundos.'
          : null,
      });
      setCheckoutStep('confirmation');
      setPaymentVerificationOrderId(isSuccessReturn ? orderId : null);
    }
  }, []);

  useEffect(() => {
    if (!paymentVerificationOrderId) return undefined;

    let cancelled = false;

    const updateVerificationState = (payload) => {
      setCurrentOrder((order) => (
        order?.id === paymentVerificationOrderId
          ? { ...order, ...payload }
          : order
      ));
    };

    const stopVerifyingAsPending = (message) => {
      updateVerificationState({
        payment_status: 'pending',
        isVerifyingPayment: false,
        payment_verification_message: message,
      });
      setPaymentVerificationOrderId(null);
    };

    const verifyPaymentStatus = async () => {
      if (!hasSupabase || !supabase) {
        if (!cancelled) {
          stopVerifyingAsPending('No pudimos verificar el pago automáticamente. Revisaremos tu orden y te contactaremos si necesitamos más información.');
        }
        return;
      }

      const { data, error } = await supabase
        .from('orders')
        .select('id, payment_status, paid_at, fulfillment_status, updated_at')
        .eq('id', paymentVerificationOrderId)
        .single();

      if (cancelled) return;

      if (error || !data) {
        stopVerifyingAsPending('No pudimos verificar el pago automáticamente. Revisaremos tu orden.');
        return;
      }

      const isPaid = data.payment_status === 'paid';
      updateVerificationState({
        ...data,
        isVerifyingPayment: false,
        payment_verification_message: isPaid
          ? 'Pago confirmado por NexCard.'
          : 'Tu pago aún no aparece confirmado. Si Mercado Pago ya te descontó, la confirmación puede tardar unos minutos.',
      });
      setPaymentVerificationOrderId(null);
    };

    verifyPaymentStatus();

    return () => {
      cancelled = true;
    };
  }, [paymentVerificationOrderId]);

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
