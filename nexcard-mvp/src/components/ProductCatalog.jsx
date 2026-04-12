import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useCart } from '../store/cartStore';

export default function ProductCatalog({ onProceedToCart }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addedProduct, setAddedProduct] = useState(null);
  const { addItem, getTotalItems } = useCart();

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        const data = await api.getProducts();
        setProducts(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []);

  const handleAddToCart = (product) => {
    addItem(product, 1);
    setAddedProduct(product.id);
    setTimeout(() => setAddedProduct(null), 2000);
  };

  const handleGoToCart = () => {
    console.log('Yendo al carrito, onProceedToCart:', onProceedToCart);
    if (onProceedToCart) {
      onProceedToCart();
    } else {
      console.error('onProceedToCart no está definido');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">Cargando catálogo...</div>;
  }

  if (error) {
    return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center text-red-500">{error}</div>;
  }

  const totalItems = getTotalItems();

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl font-black mb-2">Catálogo NexCard</h1>
          <p className="text-zinc-400 mb-6">Selecciona el pack perfecto para tu negocio</p>
          
          {totalItems > 0 && (
            <div className="inline-block bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold mb-6">
              🛒 {totalItems} producto{totalItems !== 1 ? 's' : ''} en el carrito
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 hover:border-emerald-500/50 transition-all"
            >
              <h3 className="text-xl font-bold mb-2">{product.name}</h3>
              <p className="text-zinc-400 text-sm mb-4">{product.description}</p>
              
              <div className="mb-6">
                <span className="text-3xl font-black text-emerald-400">
                  ${(product.price_cents / 100).toLocaleString('es-CL')}
                </span>
                <p className="text-zinc-500 text-sm">{product.currency || 'CLP'}</p>
              </div>

              <button
                onClick={() => handleAddToCart(product)}
                className={`w-full py-3 rounded-lg font-bold transition-all mb-4 ${
                  addedProduct === product.id
                    ? 'bg-green-600 text-white'
                    : 'bg-zinc-800 hover:bg-emerald-600 text-white'
                }`}
              >
                {addedProduct === product.id ? '✅ Agregado!' : '🛒 Agregar al carrito'}
              </button>

              <p className="text-zinc-500 text-xs">SKU: {product.sku}</p>
            </div>
          ))}
        </div>

        {totalItems > 0 && (
          <div className="flex gap-4 justify-center mb-8">
            <button
              onClick={handleGoToCart}
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-lg transition-all transform hover:scale-105"
            >
              🛒 Ir al Carrito ({totalItems} items)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
