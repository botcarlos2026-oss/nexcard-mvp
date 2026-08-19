import React from 'react';
import { useCart } from '../store/cartStore';
import { Trash2, ShoppingBag, ArrowLeft, ShoppingCart } from 'lucide-react';

export default function Cart({ onProceedCheckout, onBack }) {
  const { items, removeItem, updateQuantity, getTotalCents, getTotalItems } = useCart();
  const totalCents = getTotalCents();
  const totalItems = getTotalItems();
  const totalCLP = totalCents.toLocaleString('es-CL');

  // Carrito vacío
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-8">
        <ShoppingBag size={64} className="mb-4 text-zinc-600" />
        <p className="text-2xl font-bold mb-2">Tu carrito está vacío</p>
        <p className="text-zinc-400 mb-8">Agrega productos para comenzar</p>
        <button
          onClick={onBack}
          className="btn-base btn-press flex items-center gap-2 px-6 min-h-[48px] rounded-lg btn-primary"
        >
          <ArrowLeft size={18} />
          Volver al catálogo
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft size={16} />
            Seguir comprando
          </button>
          <h1 className="text-3xl sm:text-4xl font-black flex items-center gap-3">
            <ShoppingCart size={32} className="text-emerald-400" />
            Carrito
          </h1>
        </div>

        {/* Items */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl mb-6 overflow-hidden">
          {items.map((item, index) => (
            <div
              key={item.product_id}
              className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 sm:p-5 ${
                index < items.length - 1 ? 'border-b border-zinc-800' : ''
              }`}
            >
              {/* Info producto */}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base sm:text-lg leading-tight truncate">
                  {item.product_name}
                </h3>
                <p className="text-zinc-500 text-xs mt-0.5">SKU: {item.product_sku}</p>
                <p className="text-emerald-400 font-semibold text-sm mt-1">
                  ${item.unit_price_cents.toLocaleString('es-CL')} c/u
                </p>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                {/* Cantidad */}
                <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1 shrink-0">
                  <button
                    onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                    className="w-11 h-11 flex items-center justify-center hover:bg-zinc-700 rounded text-lg font-bold transition-colors"
                    aria-label="Reducir cantidad"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                    className="w-11 h-11 flex items-center justify-center hover:bg-zinc-700 rounded text-lg font-bold transition-colors"
                    aria-label="Aumentar cantidad"
                  >
                    +
                  </button>
                </div>

                {/* Subtotal */}
                <div className="text-right shrink-0">
                  <p className="text-xs text-zinc-500 hidden sm:block">Subtotal</p>
                  <p className="font-bold text-sm sm:text-base">
                    ${(item.unit_price_cents * item.quantity).toLocaleString('es-CL')}
                  </p>
                </div>

                {/* Eliminar */}
                <button
                  onClick={() => removeItem(item.product_id)}
                  className="w-11 h-11 flex items-center justify-center hover:bg-red-900/40 rounded-lg text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                  aria-label={`Eliminar ${item.product_name}`}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Resumen total */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
          <div className="flex justify-between items-center text-sm text-zinc-400 mb-2">
            <span>Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'items'})</span>
            <span>${totalCLP} CLP</span>
          </div>
          <div className="flex justify-between items-center text-sm text-zinc-400 mb-4 pb-4 border-b border-zinc-800">
            <span>Envío</span>
            <span className="text-emerald-400">Gratis</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xl font-black">Total</span>
            <span className="text-2xl font-black text-emerald-400">${totalCLP} CLP</span>
          </div>
        </div>

        {/* Botón checkout */}
        <button
          onClick={onProceedCheckout}
          className="btn-base btn-press w-full min-h-[56px] rounded-xl font-bold text-lg btn-primary shadow-lg shadow-emerald-900/30"
        >
          Proceder al Checkout →
        </button>

      </div>
    </div>
  );
}
