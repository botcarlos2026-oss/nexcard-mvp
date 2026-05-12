import { useEffect, useState } from 'react';
import { getLastOrderSnapshot } from '../services/api';

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
      window.history.replaceState({}, '', '/');
      setCurrentOrder({
        ...(snapshot?.id === orderId ? snapshot : {}),
        id: orderId,
        payment_status: payment === 'success' ? 'paid' : payment,
      });
      setCheckoutStep('confirmation');
    }
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
