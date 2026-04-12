import React from 'react';
import { useCart } from '../store/cartStore';
import { Trash2, ShoppingBag } from 'lucide-react';

export default function Cart({ onProceedCheckout }) {
  const { items, removeItem, updateQuantity, getTotalCents, getTotalItems } = useCart();
  const totalCents = getTotalCents();
  const totalItems = getTotalItems();
  const totalCLP = (totalCents / 100).toLocaleString('es-CL');

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white grid place-items-center">
        <div className="text-center">
          <ShoppingBag size={64} className="mx-auto mb-4 text-zinc-600" />
          <p className="text-2xl font-bold mb-2">Tu carrito está vacío</p>
          <p className="text-zinc-400">Agrega productos para comenzar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-black mb-8">Carrito de Compras</h1>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-8">
          {items.map((item) => (
            <div key={item.product_id} className="flex items-center justify-between py-4 border-b border-zinc-800 last:border-b-0">
              <div className="flex-1">
                <h3 className="font-bold text-lg">{item.product_name}</h3>
                <p className="text-zinc-400 text-sm">SKU: {item.product_sku}</p>
                <p className="text-emerald-400 font-semibold mt-1">
                  ${(item.unit_price_cents / 100).toLocaleString('es-CL')} c/u
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-zinc-800 rounded-lg p-1">
                  <button
                    onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                    className="px-2 py-1 hover:bg-zinc-700 rounded"
                  >
                    −
                  </button>
                  <span className="px-3 font-bold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                    className="px-2 py-1 hover:bg-zinc-700 rounded"
                  >
                    +
                  </button>
                </div>

                <div className="w-24 text-right">
                  <p className="text-sm text-zinc-400">Subtotal</p>
                  <p className="font-bold text-lg">
                    ${((item.unit_price_cents * item.quantity) / 100).toLocaleString('es-CL')}
                  </p>
                </div>

                <button
                  onClick={() => removeItem(item.product_id)}
                  className="p-2 hover:bg-zinc-800 rounded-lg text-red-400 transition-colors"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-emerald-900 border border-emerald-700 rounded-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-zinc-300">Items:</span>
            <span className="font-bold">{totalItems}</span>
          </div>
          <div className="flex justify-between items-center text-2xl font-black">
            <span>Total:</span>
            <span className="text-emerald-400">${totalCLP}</span>
          </div>
        </div>

        <button
          onClick={onProceedCheckout}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-lg transition-colors text-lg"
        >
          Proceder al Checkout →
        </button>
      </div>
    </div>
  );
}
