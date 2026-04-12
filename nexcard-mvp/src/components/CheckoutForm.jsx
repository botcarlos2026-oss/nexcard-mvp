import React, { useState } from 'react';
import { useCart } from '../store/cartStore';
import { api } from '../services/api';

export default function CheckoutForm({ onOrderSuccess, onBack }) {
  const { items, getTotalCents, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mercado-pago');
  
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    acceptTerms: false,
  });

  const totalCents = getTotalCents();
  const totalCLP = (totalCents / 100).toLocaleString('es-CL');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const validateForm = () => {
    if (!formData.customerName.trim()) {
      setError('Por favor ingresa tu nombre completo');
      return false;
    }
    if (!formData.customerEmail.includes('@')) {
      setError('Por favor ingresa un email válido');
      return false;
    }
    if (!formData.customerPhone.trim()) {
      setError('Por favor ingresa un teléfono');
      return false;
    }
    if (!formData.customerAddress.trim()) {
      setError('Por favor ingresa tu dirección');
      return false;
    }
    if (!formData.acceptTerms) {
      setError('Debes aceptar los términos y condiciones');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      const orderPayload = {
        customer_name: formData.customerName,
        customer_email: formData.customerEmail,
        customer_phone: formData.customerPhone,
        customer_address: formData.customerAddress,
        payment_method: paymentMethod,
        payment_status: 'pending',
        fulfillment_status: 'pending',
        amount_cents: totalCents,
        currency: 'CLP',
        items: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
        })),
      };

      const result = await api.createOrder(orderPayload);

      if (result.id) {
        clearCart();
        onOrderSuccess(result);
      } else {
        setError('No fue posible crear la orden');
      }
    } catch (err) {
      setError(err.message || 'Error al procesar orden');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-black mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formulario */}
          <form onSubmit={handleSubmit} className="lg:col-span-2">
            {error && (
              <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">Datos Personales</h2>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Nombre Completo</label>
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleChange}
                  placeholder="Juan Pérez García"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Email</label>
                <input
                  type="email"
                  name="customerEmail"
                  value={formData.customerEmail}
                  onChange={handleChange}
                  placeholder="juan@example.com"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Teléfono</label>
                <input
                  type="tel"
                  name="customerPhone"
                  value={formData.customerPhone}
                  onChange={handleChange}
                  placeholder="+56 9 1234 5678"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Dirección</label>
                <textarea
                  name="customerAddress"
                  value={formData.customerAddress}
                  onChange={handleChange}
                  placeholder="Calle Principal 123, Depto 4B, Santiago"
                  rows="3"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">Método de Pago</h2>

              <div className="space-y-3">
                <label className="flex items-center p-3 border border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-800 transition-colors" style={{ borderColor: paymentMethod === 'mercado-pago' ? '#10B981' : undefined }}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="mercado-pago"
                    checked={paymentMethod === 'mercado-pago'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mr-3"
                  />
                  <div>
                    <p className="font-semibold">Mercado Pago</p>
                    <p className="text-xs text-zinc-400">Tarjeta, transferencia, efectivo</p>
                  </div>
                </label>

                <label className="flex items-center p-3 border border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-800 transition-colors" style={{ borderColor: paymentMethod === 'transbank' ? '#10B981' : undefined }}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="transbank"
                    checked={paymentMethod === 'transbank'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mr-3"
                  />
                  <div>
                    <p className="font-semibold">Transbank WebPay</p>
                    <p className="text-xs text-zinc-400">Tarjetas de crédito y débito</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
              <label className="flex items-start cursor-pointer">
                <input
                  type="checkbox"
                  name="acceptTerms"
                  checked={formData.acceptTerms}
                  onChange={handleChange}
                  className="mt-1 mr-3"
                />
                <span className="text-sm">
                  Acepto los{' '}
                  <a href="#" className="text-emerald-400 hover:underline">
                    términos y condiciones
                  </a>{' '}
                  y la{' '}
                  <a href="#" className="text-emerald-400 hover:underline">
                    política de privacidad
                  </a>
                </span>
              </label>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={onBack}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-lg transition-colors"
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors"
              >
                {loading ? 'Procesando...' : 'Confirmar Orden'}
              </button>
            </div>
          </form>

          {/* Resumen */}
          <div className="lg:col-span-1">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 sticky top-8">
              <h3 className="text-lg font-bold mb-4">Resumen de Orden</h3>

              <div className="space-y-3 mb-6 pb-6 border-b border-zinc-800">
                {items.map((item) => (
                  <div key={item.product_id} className="flex justify-between text-sm">
                    <span>
                      {item.product_name} × {item.quantity}
                    </span>
                    <span className="font-semibold">
                      ${((item.unit_price_cents * item.quantity) / 100).toLocaleString('es-CL')}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-zinc-400">
                  <span>Subtotal</span>
                  <span>${totalCLP}</span>
                </div>
                <div className="flex justify-between text-sm text-zinc-400">
                  <span>Envío</span>
                  <span>$0</span>
                </div>
                <div className="flex justify-between text-2xl font-black text-emerald-400 pt-2 border-t border-zinc-700">
                  <span>Total</span>
                  <span>${totalCLP}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
