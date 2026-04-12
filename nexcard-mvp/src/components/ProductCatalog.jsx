import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useCart } from '../store/cartStore';
import { ShoppingCart, Package, AlertCircle, CheckCircle2 } from 'lucide-react';

// Skeleton card para mostrar mientras carga
function ProductSkeleton() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 animate-pulse">
      <div className="h-5 bg-zinc-800 rounded w-3/4 mb-3" />
      <div className="h-3 bg-zinc-800 rounded w-full mb-2" />
      <div className="h-3 bg-zinc-800 rounded w-2/3 mb-6" />
      <div className="h-8 bg-zinc-800 rounded w-1/2 mb-6" />
      <div className="h-11 bg-zinc-800 rounded-lg" />
    </div>
  );
}

export default function ProductCatalog({ onProceedToCart }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addedProducts, setAddedProducts] = useState(new Set());
  const { addItem, getTotalItems } = useCart();

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await api.getProducts();
        setProducts(data);
      } catch (err) {
        setError(err.message || 'No fue posible cargar el catálogo');
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []);

  const handleAddToCart = (product) => {
    addItem(product, 1);
    setAddedProducts((prev) => new Set(prev).add(product.id));
    setTimeout(() => {
      setAddedProducts((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }, 2000);
  };

  const totalItems = getTotalItems();

  // Estado de error
  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle size={48} className="text-red-400 mb-4" />
        <p className="text-xl font-bold mb-2">No pudimos cargar el catálogo</p>
        <p className="text-zinc-400 mb-6 text-sm max-w-xs">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <Package size={28} className="text-emerald-400" />
            <h1 className="text-3xl sm:text-4xl font-black">Catálogo NexCard</h1>
          </div>
          <p className="text-zinc-400">Selecciona el pack perfecto para tu negocio</p>
        </div>

        {/* Grid productos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)
            : products.map((product) => {
                const isAdded = addedProducts.has(product.id);
                return (
                  <div
                    key={product.id}
                    className="bg-zinc-900 border border-zinc-800 hover:border-emerald-500/60 rounded-xl p-6 flex flex-col transition-all duration-200 hover:shadow-lg hover:shadow-emerald-900/20"
                  >
                    <h3 className="text-lg font-bold mb-2 leading-tight">{product.name}</h3>
                    <p className="text-zinc-400 text-sm mb-4 flex-1 leading-relaxed">
                      {product.description}
                    </p>

                    <div className="mb-5">
                      <span className="text-3xl font-black text-emerald-400">
                        ${(product.price_cents / 100).toLocaleString('es-CL')}
                      </span>
                      <span className="text-zinc-500 text-sm ml-1">CLP</span>
                    </div>

                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={isAdded}
                      className={`w-full py-3 rounded-lg font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                        isAdded
                          ? 'bg-emerald-700 text-white cursor-default'
                          : 'bg-zinc-800 hover:bg-emerald-600 active:bg-emerald-700 text-white'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <CheckCircle2 size={16} />
                          ¡Agregado!
                        </>
                      ) : (
                        <>
                          <ShoppingCart size={16} />
                          Agregar al carrito
                        </>
                      )}
                    </button>

                    <p className="text-zinc-600 text-xs mt-3 text-center">SKU: {product.sku}</p>
                  </div>
                );
              })}
        </div>

        {/* Barra flotante del carrito — aparece cuando hay items */}
        {!loading && totalItems > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-sm">
            <button
              onClick={onProceedToCart}
              className="w-full flex items-center justify-between bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold py-4 px-6 rounded-2xl shadow-2xl shadow-emerald-900/50 transition-all"
            >
              <span className="flex items-center gap-2">
                <ShoppingCart size={20} />
                Ver carrito
              </span>
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                {totalItems} {totalItems === 1 ? 'item' : 'items'}
              </span>
            </button>
          </div>
        )}

        {/* Espacio extra al fondo para que la barra flotante no tape contenido */}
        {!loading && totalItems > 0 && <div className="h-24" />}

      </div>
    </div>
  );
}
