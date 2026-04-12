import React, { useState, useEffect } from 'react';
import { useCart } from '../store/cartStore';
import { api } from '../services/api';
import { ShoppingCart } from 'lucide-react';

export default function ProductCatalog() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { addItem } = useCart();
  const [addedItems, setAddedItems] = useState({});

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const data = await api.getProducts();
        setProducts(data || []);
      } catch (err) {
        setError(err.message || 'Error al cargar productos');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const handleAddToCart = (product) => {
    addItem(product, 1);
    setAddedItems((prev) => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAddedItems((prev) => ({ ...prev, [product.id]: false }));
    }, 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white grid place-items-center">
        <p className="text-lg">Cargando catálogo...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white grid place-items-center p-8">
        <div className="text-center">
          <p className="text-2xl font-bold mb-2">Error</p>
          <p className="text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-black mb-2">Catálogo NexCard</h1>
        <p className="text-zinc-400 mb-12">Selecciona el pack perfecto para tu negocio</p>

        {products.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-400">No hay productos disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 hover:border-zinc-700 transition-colors"
              >
                <h2 className="text-xl font-bold mb-2">{product.name}</h2>
                <p className="text-zinc-400 text-sm mb-4">{product.description}</p>

                <div className="mb-6">
                  <div className="text-3xl font-black text-emerald-400">
                    ${(product.price_cents / 100).toLocaleString('es-CL')}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">CLP</p>
                </div>

                <button
                  onClick={() => handleAddToCart(product)}
                  className={`w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                    addedItems[product.id]
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-800 text-white hover:bg-zinc-700'
                  }`}
                >
                  <ShoppingCart size={18} />
                  {addedItems[product.id] ? '¡Agregado!' : 'Agregar al carrito'}
                </button>

                <p className="text-xs text-zinc-500 mt-3">SKU: {product.sku}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
