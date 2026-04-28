import React, { useState, useEffect } from 'react';
import { useCart } from '../store/cartStore';
import { api } from '../services/api';
import { ArrowLeft, ShieldCheck, AlertCircle, Tag } from 'lucide-react';
import CardPreview from './CardPreview';

export default function CheckoutForm({ onOrderSuccess, onBack }) {
  const { items, getTotalCents, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mercado-pago');
  const [abandonedCartId, setAbandonedCartId] = useState(null);
  const [couponCode, setCouponCode] = useState(() => new URLSearchParams(window.location.search).get('coupon') || '');
  const [couponData, setCouponData] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');

  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    acceptTerms: false,
  });

  const [invoiceData, setInvoiceData] = useState({
    requiresInvoice: false,
    invoiceRut: '',
    invoiceRazonSocial: '',
  });
  const [rutError, setRutError] = useState('');

  const validateRutFormat = (rut) => {
    const clean = rut.trim().replace(/\./g, '').replace('-', '');
    if (!/^\d{7,8}[\dkK]$/.test(clean)) return false;
    const digits = clean.slice(0, -1);
    const dv = clean.slice(-1).toUpperCase();
    let sum = 0;
    let mul = 2;
    for (let i = digits.length - 1; i >= 0; i--) {
      sum += parseInt(digits[i]) * mul;
      mul = mul === 7 ? 2 : mul + 1;
    }
    const remainder = 11 - (sum % 11);
    const expected = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);
    return dv === expected;
  };

  const handleInvoiceChange = (e) => {
    const { name, value, type, checked } = e.target;
    setRutError('');
    setInvoiceData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const [customization, setCustomization] = useState({
    full_name: '',
    job_title: '',
    company: '',
    template: 'minimal',
    primary_color: '#10B981',
    notes: '',
  });

  const handleCustomizationChange = (e) => {
    const { name, value } = e.target;
    setCustomization((prev) => ({ ...prev, [name]: value }));
  };

  const totalCents = getTotalCents();

  useEffect(() => {
    const urlCoupon = new URLSearchParams(window.location.search).get('coupon');
    if (urlCoupon) validateCoupon(urlCoupon);
  }, []);

  const validateCoupon = async (code) => {
    const trimmed = (code || couponCode).trim().toUpperCase();
    if (!trimmed) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const result = await api.validateWheelCoupon(trimmed);
      if (result) {
        setCouponData(result);
        setCouponCode(trimmed);
      } else {
        setCouponError('Cupón inválido o ya utilizado');
        setCouponData(null);
      }
    } catch {
      setCouponError('Error al validar el cupón');
    } finally {
      setCouponLoading(false);
    }
  };

  const getDiscountCents = () => {
    if (!couponData) return 0;
    const { prize } = couponData;
    if (prize.type === 'discount_percent') return Math.round(totalCents * prize.value / 100);
    if (prize.type === 'discount_amount') return Math.min(prize.value, totalCents);
    return 0;
  };

  const discountCents = getDiscountCents();
  const finalTotalCents = Math.max(0, totalCents - discountCents);
  const totalCLP = finalTotalCents.toLocaleString('es-CL');

  // Guard: si llegan aquí sin items, redirigir
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle size={48} className="text-yellow-400 mb-4" />
        <p className="text-xl font-bold mb-2">Tu carrito está vacío</p>
        <p className="text-zinc-400 mb-6 text-sm">No puedes iniciar un checkout sin productos</p>
        <button
          onClick={onBack}
          className="btn-press flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors"
        >
          <ArrowLeft size={18} />
          Volver al carrito
        </button>
      </div>
    );
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setError(''); // limpiar error al escribir
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const validateForm = () => {
    if (!formData.customerName.trim()) return 'Por favor ingresa tu nombre completo';
    if (formData.customerName.trim().length < 3) return 'El nombre debe tener al menos 3 caracteres';
    if (!formData.customerEmail.includes('@') || !formData.customerEmail.includes('.'))
      return 'Por favor ingresa un email válido';
    if (!formData.customerPhone.trim()) return 'Por favor ingresa un teléfono de contacto';
    if (formData.customerPhone.replace(/\D/g, '').length < 8)
      return 'El teléfono debe tener al menos 8 dígitos';
    if (!formData.customerAddress.trim()) return 'Por favor ingresa tu dirección de despacho';
    if (formData.customerAddress.trim().length < 10) return 'La dirección parece muy corta, incluye calle y número';
    if (!formData.acceptTerms) return 'Debes aceptar los términos y condiciones para continuar';
    if (invoiceData.requiresInvoice) {
      if (!invoiceData.invoiceRut.trim()) return 'Ingresa el RUT de la empresa';
      if (!validateRutFormat(invoiceData.invoiceRut)) return 'RUT inválido. Verifica el formato y dígito verificador (ej: 12.345.678-9)';
      if (!invoiceData.invoiceRazonSocial.trim()) return 'Ingresa la razón social de la empresa';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      // Scroll al error
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Construir customization solo si hay algún campo llenado
      const hasCustomization = customization.full_name.trim() || customization.job_title.trim() ||
        customization.company.trim() || customization.notes.trim() ||
        customization.template !== 'minimal' || customization.primary_color !== '#10B981';

      const orderPayload = {
        customer_name: formData.customerName.trim(),
        customer_email: formData.customerEmail.trim().toLowerCase(),
        customer_phone: formData.customerPhone.trim(),
        customer_address: formData.customerAddress.trim(),
        payment_method: paymentMethod,
        payment_status: 'pending',
        fulfillment_status: 'new',
        amount_cents: finalTotalCents,
        discount_cents: discountCents || undefined,
        coupon_code: couponData ? couponCode : undefined,
        currency: 'CLP',
        card_customization: hasCustomization ? {
          full_name: customization.full_name.trim() || formData.customerName.trim(),
          job_title: customization.job_title.trim(),
          company: customization.company.trim(),
          template: customization.template,
          primary_color: customization.primary_color,
          notes: customization.notes.trim(),
        } : null,
        items: items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
        })),
        requires_invoice: invoiceData.requiresInvoice,
        invoice_rut: invoiceData.requiresInvoice ? invoiceData.invoiceRut.trim() : null,
        invoice_razon_social: invoiceData.requiresInvoice ? invoiceData.invoiceRazonSocial.trim() : null,
      };
      const result = await api.createOrder(orderPayload);

      if (result?.id) {
        if (paymentMethod === 'mercado-pago') {
          // Crear preferencia en MP vía Edge Function
          const { supabase } = await import('../services/supabaseClient');
          const { data, error } = await supabase.functions.invoke('create-mp-preference', {
            body: JSON.stringify({
              orderId: result.id,
              items: items.map(item => ({
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price_cents: item.unit_price_cents,
              })),
              customerEmail: formData.customerEmail,
              totalCents: finalTotalCents,
            }),
          });

          if (error || !data?.init_point) {
            throw new Error('No se pudo iniciar el pago con Mercado Pago');
          }

          if (abandonedCartId) api.markCartConverted(abandonedCartId);
          if (couponData?.spinId) api.redeemWheelCoupon(couponData.spinId, result.id).catch(() => {});
          clearCart();
          // Redirigir a Mercado Pago
          window.location.href = data.init_point;

        } else {
          // Transbank — flujo pendiente
          if (abandonedCartId) api.markCartConverted(abandonedCartId);
          if (couponData?.spinId) api.redeemWheelCoupon(couponData.spinId, result.id).catch(() => {});
          clearCart();
          onOrderSuccess(result);
        }
      } else {
        throw new Error('La orden no retornó un ID válido');
      }
    } catch (err) {
      const message = err?.message || 'Error inesperado al procesar la orden';
      setError(
        message.includes('duplicate')
          ? 'Ya existe una orden con estos datos. Revisa tu email.'
          : message.includes('network') || message.includes('fetch')
          ? 'Error de conexión. Verifica tu internet e intenta nuevamente.'
          : message
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-colors text-sm';

  const labelClass = 'block text-sm font-semibold mb-1.5 text-zinc-300';

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            disabled={loading}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm disabled:opacity-50 min-h-[44px] px-2"
          >
            <ArrowLeft size={16} />
            Volver
          </button>
          <h1 className="text-3xl sm:text-4xl font-black">Checkout</h1>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-1">
          {[
            { label: 'Catálogo', step: 0 },
            { label: 'Carrito', step: 1 },
            { label: 'Datos', step: 2 },
            { label: 'Pago', step: 3 },
          ].map(({ label, step }, i) => {
            const current = step === 2;
            const done = step < 2;
            return (
              <React.Fragment key={step}>
                {i > 0 && <div className="h-px w-6 shrink-0 bg-zinc-700" />}
                <div className={`flex items-center gap-1.5 shrink-0 text-xs font-bold px-2 py-1 rounded-full ${current ? 'bg-emerald-600 text-white' : done ? 'text-emerald-400' : 'text-zinc-600'}`}>
                  {done ? '✓' : <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[10px]" style={{ borderColor: current ? 'white' : '#52525b' }}>{step + 1}</span>}
                  {label}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Resumen carrito mobile */}
        <div className="lg:hidden bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-5">
          <h3 className="font-bold text-sm mb-3">Tu pedido</h3>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.product_id} className="flex justify-between text-sm">
                <span className="text-zinc-300">{item.product_name} <span className="text-zinc-500">×{item.quantity}</span></span>
                <span className="font-bold">${(item.unit_price_cents * item.quantity).toLocaleString('es-CL')}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-baseline pt-3 mt-3 border-t border-zinc-800">
            <span className="text-sm font-semibold">Total</span>
            <span className="text-lg font-black text-emerald-400">${totalCLP}</span>
          </div>
        </div>

        {/* Error global */}
        {error && (
          <div className="flex items-start gap-3 bg-red-950 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6">
            <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-400" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-5">

            {/* Datos personales */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-lg font-bold mb-5">Datos de contacto</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelClass}>Nombre completo</label>
                  <input
                    type="text"
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleChange}
                    placeholder="Juan Pérez García"
                    autoComplete="name"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Teléfono</label>
                  <input
                    type="tel"
                    name="customerPhone"
                    value={formData.customerPhone}
                    onChange={handleChange}
                    placeholder="+56 9 1234 5678"
                    autoComplete="tel"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  name="customerEmail"
                  value={formData.customerEmail}
                  onChange={handleChange}
                  onBlur={async (e) => {
                    const email = e.target.value.trim();
                    if (!email.includes('@') || !email.includes('.')) return;
                    if (items.length === 0) return;
                    try {
                      const result = await api.saveAbandonedCart({
                        email,
                        customerName: formData.customerName.trim() || null,
                        items: items.map(i => ({
                          product_id: i.product_id,
                          product_name: i.product_name,
                          quantity: i.quantity,
                          unit_price_cents: i.unit_price_cents,
                        })),
                        totalCents,
                      });
                      if (result?.id) setAbandonedCartId(result.id);
                    } catch {
                      // silencioso — no bloquear checkout
                    }
                  }}
                  placeholder="juan@example.com"
                  autoComplete="email"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Dirección de despacho</label>
                <textarea
                  name="customerAddress"
                  value={formData.customerAddress}
                  onChange={handleChange}
                  placeholder="Calle Principal 123, Depto 4B, Santiago, Región Metropolitana"
                  rows="3"
                  autoComplete="street-address"
                  className={inputClass + ' resize-none'}
                />
              </div>
            </div>

            {/* Personalización de tarjeta */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-lg font-bold mb-1">Personaliza tu tarjeta</h2>
              <p className="text-xs text-zinc-500 mb-5">Opcional — si lo dejas vacío, te contactamos en menos de 24h para definir el diseño. Tu despacho no se atrasa.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelClass}>Nombre para la tarjeta</label>
                  <input
                    type="text"
                    name="full_name"
                    value={customization.full_name}
                    onChange={handleCustomizationChange}
                    placeholder={formData.customerName || 'Tu nombre completo'}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Cargo / Profesión</label>
                  <input
                    type="text"
                    name="job_title"
                    value={customization.job_title}
                    onChange={handleCustomizationChange}
                    placeholder="CEO & Founder, Diseñador UX..."
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className={labelClass}>Empresa <span className="text-zinc-600 font-normal">(opcional)</span></label>
                <input
                  type="text"
                  name="company"
                  value={customization.company}
                  onChange={handleCustomizationChange}
                  placeholder="NexCard"
                  className={inputClass}
                />
              </div>

              <div className="mb-4">
                <label className={labelClass}>Plantilla base</label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  {[
                    { id: 'minimal', label: 'Minimalista' },
                    { id: 'dark', label: 'Dark premium' },
                    { id: 'corporate', label: 'Corporativo' },
                    { id: 'colorful', label: 'Colorido' },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setCustomization({ ...customization, template: id })}
                      className="template-option btn-press flex flex-col items-center gap-1.5 p-3 min-h-[44px] rounded-xl"
                      style={{
                        border: customization.template === id ? '2px solid #10B981' : '2px solid transparent',
                        boxShadow: customization.template === id ? '0 0 0 1px #10B98133' : 'none',
                        background: 'transparent',
                      }}
                    >
                      <CardPreview
                        template={id}
                        name={customization.full_name || 'Tu Nombre'}
                        jobTitle={customization.job_title || 'Tu Cargo'}
                        company={customization.company}
                        primaryColor={customization.primary_color}
                        size="thumb"
                      />
                      <span className="text-zinc-400" style={{ fontSize: 11 }}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className={labelClass}>Color principal</label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="color"
                    name="primary_color"
                    value={customization.primary_color}
                    onChange={handleCustomizationChange}
                    className="h-11 w-14 rounded-lg cursor-pointer bg-zinc-800 border border-zinc-700 p-1"
                  />
                  <span className="text-sm text-zinc-400 font-mono">{customization.primary_color}</span>
                </div>
              </div>

              <div>
                <label className={labelClass}>Notas adicionales <span className="text-zinc-600 font-normal">(opcional)</span></label>
                <textarea
                  name="notes"
                  value={customization.notes}
                  onChange={handleCustomizationChange}
                  rows="2"
                  maxLength={500}
                  placeholder="Ej: Agregar logo de empresa, usar foto de LinkedIn..."
                  className={inputClass + ' resize-none'}
                />
              </div>
            </div>

            {/* Método de pago */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-lg font-bold mb-4">Método de pago</h2>

              <div className="space-y-3">
                <label className="flex items-center p-4 border border-emerald-500 bg-emerald-900/20 rounded-xl cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="mercado-pago"
                    checked={true}
                    onChange={() => {}}
                    className="mr-3 accent-emerald-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">Mercado Pago</p>
                      <span className="text-xs bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded-full">Recomendado</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">Tarjeta, transferencia, efectivo</p>
                  </div>
                </label>
                <div
                  className="flex items-center p-4 border border-zinc-800 rounded-xl opacity-50 cursor-not-allowed pointer-events-none"
                  title="Disponible pronto"
                >
                  <div className="w-4 h-4 rounded-full border border-zinc-600 mr-3 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-zinc-500">Transbank WebPay</p>
                      <span className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">Próximamente</span>
                    </div>
                    <p className="text-xs text-zinc-600 mt-0.5">Tarjetas de crédito y débito</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Boleta / Factura empresa */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  name="requiresInvoice"
                  checked={invoiceData.requiresInvoice}
                  onChange={handleInvoiceChange}
                  className="accent-emerald-500 w-5 h-5 shrink-0"
                />
                <span className="text-sm font-semibold text-zinc-300">
                  Necesito boleta a nombre de empresa (factura)
                </span>
              </label>

              {invoiceData.requiresInvoice && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className={labelClass}>RUT empresa</label>
                    <input
                      type="text"
                      name="invoiceRut"
                      value={invoiceData.invoiceRut}
                      onChange={handleInvoiceChange}
                      onBlur={() => {
                        if (invoiceData.invoiceRut && !validateRutFormat(invoiceData.invoiceRut)) {
                          setRutError('Formato requerido: XX.XXX.XXX-X');
                        }
                      }}
                      placeholder="76.543.210-K"
                      className={inputClass}
                    />
                    {rutError && (
                      <p className="text-xs text-red-400 mt-1">{rutError}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Razón social</label>
                    <input
                      type="text"
                      name="invoiceRazonSocial"
                      value={invoiceData.invoiceRazonSocial}
                      onChange={handleInvoiceChange}
                      placeholder="Empresa S.A."
                      className={inputClass}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Términos */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  name="acceptTerms"
                  checked={formData.acceptTerms}
                  onChange={handleChange}
                  className="mt-0.5 accent-emerald-500 w-5 h-5 shrink-0"
                />
                <span className="text-sm text-zinc-300 leading-relaxed">
                  Acepto los{' '}
                  <a href="/privacidad" className="text-emerald-400 hover:underline">
                    términos y condiciones
                  </a>{' '}
                  y la{' '}
                  <a href="/privacidad" className="text-emerald-400 hover:underline">
                    política de privacidad
                  </a>{' '}
                  de NexCard
                </span>
              </label>
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onBack}
                disabled={loading}
                className="btn-press flex-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors text-sm"
              >
                ← Volver
              </button>
              <div className="flex-[2] flex flex-col gap-1.5">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-press w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
                >
                  {loading ? (
                    <>
                      <span className="spinner" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      Pagar con Mercado Pago →
                    </>
                  )}
                </button>
                <p className="text-xs text-zinc-400 text-center">Serás redirigido a Mercado Pago para completar el pago de forma segura</p>
              </div>
            </div>

          </form>

          {/* Resumen lateral */}
          <div className="lg:col-span-1">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 lg:sticky lg:top-8">
              <h3 className="font-bold mb-4 text-base">Resumen</h3>

              <div className="space-y-3 mb-4 pb-4 border-b border-zinc-800">
                {items.map((item) => (
                  <div key={item.product_id} className="flex justify-between text-sm">
                    <span className="text-zinc-300 leading-tight">
                      {item.product_name}
                      <span className="text-zinc-500 ml-1">×{item.quantity}</span>
                    </span>
                    <span className="font-semibold shrink-0 ml-2">
                      ${(item.unit_price_cents * item.quantity).toLocaleString('es-CL')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Coupon input */}
              <div className="mb-4">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      value={couponCode}
                      onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponData(null); setCouponError(''); }}
                      onKeyDown={e => e.key === 'Enter' && validateCoupon()}
                      placeholder="Código de descuento"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => validateCoupon()}
                    disabled={couponLoading || !couponCode.trim()}
                    className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {couponLoading ? '…' : 'Aplicar'}
                  </button>
                </div>
                {couponData && (
                  <p className="text-emerald-400 text-xs mt-1.5 font-semibold">
                    ✓ {couponData.prize.label} aplicado
                  </p>
                )}
                {couponError && <p className="text-red-400 text-xs mt-1.5">{couponError}</p>}
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-zinc-400">
                  <span>Subtotal</span>
                  <span>${totalCents.toLocaleString('es-CL')}</span>
                </div>
                {discountCents > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Descuento ({couponCode})</span>
                    <span>-${discountCents.toLocaleString('es-CL')}</span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-400">
                  <span>Envío</span>
                  <span className="text-emerald-400">Gratis</span>
                </div>
              </div>

              <div className="flex justify-between items-baseline pt-4 mt-4 border-t border-zinc-700">
                <span className="text-lg font-black">Total</span>
                <span className="text-2xl font-black text-emerald-400">${totalCLP}</span>
              </div>

              <p className="text-xs text-zinc-500 mt-3 text-center">
                Pago 100% seguro · SSL encriptado
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
