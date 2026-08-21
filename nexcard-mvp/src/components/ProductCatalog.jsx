import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useCart } from '../store/cartStore';
import { AlertCircle, ArrowRight, CheckCircle, CheckCircle2, Package, ShoppingCart } from 'lucide-react';
import { buildPricingPlan } from '../config/pricingCopy';

// Skeleton card para mostrar mientras carga
function ProductSkeleton() {
  return (
    <div className="min-h-[380px] rounded-[22px] border border-zinc-800 bg-zinc-900 p-6 animate-pulse">
      <div className="flex justify-between gap-4 mb-6">
        <div className="flex-1">
          <div className="h-7 bg-zinc-800 rounded w-3/4 mb-3" />
          <div className="h-3 bg-zinc-800 rounded w-full mb-2" />
          <div className="h-3 bg-zinc-800 rounded w-2/3" />
        </div>
        <div className="h-14 w-14 bg-zinc-800 rounded-[19px]" />
      </div>
      <div className="h-9 bg-zinc-800 rounded w-1/2 mb-6" />
      <div className="grid gap-3 mb-6">
        <div className="h-3 bg-zinc-800 rounded w-5/6" />
        <div className="h-3 bg-zinc-800 rounded w-4/6" />
        <div className="h-3 bg-zinc-800 rounded w-3/6" />
      </div>
      <div className="h-12 bg-zinc-800 rounded-xl mt-auto" />
    </div>
  );
}

function CatalogSummary() {
  return (
    <aside className="rounded-[22px] border border-zinc-800 bg-zinc-900 p-5 md:p-6 lg:sticky lg:top-8">
      <div className="relative h-[255px] md:h-[285px] mb-5 overflow-visible">
        <div className="absolute inset-x-3 top-8 h-[205px] rounded-[34px] border border-white/10 bg-stone-500/15 rotate-[2deg]" />
        <div className="absolute right-0 top-0 w-[136px] h-[256px] rounded-[30px] border-[8px] border-zinc-800 bg-zinc-950 rotate-[5deg] p-3 pt-9 shadow-2xl shadow-black/45">
          <span className="absolute top-1.5 left-1/2 h-4 w-12 -translate-x-1/2 rounded-b-xl bg-zinc-800" />
          <span className="block h-8 rounded-xl border border-emerald-500/20 bg-emerald-500/20 mb-3" />
          <span className="block h-2.5 w-4/5 rounded-full bg-zinc-800 mb-2.5" />
          <span className="block h-2.5 w-3/5 rounded-full bg-zinc-800 mb-4" />
          <span className="block h-8 rounded-xl border border-emerald-500/20 bg-emerald-500/10" />
        </div>
        <div className="absolute left-0 top-[82px] h-[180px] w-[min(315px,82vw)] rounded-[26px] border border-white/15 bg-gradient-to-br from-zinc-800 to-black p-5 -rotate-[7deg] shadow-2xl shadow-black/55">
          <div className="h-7 w-11 rounded-lg bg-yellow-700" />
          <div className="absolute right-5 top-5 text-xs font-black tracking-[0.18em] text-emerald-300">NFC</div>
          <div className="absolute bottom-5 left-5 text-2xl font-black tracking-[-0.06em]">Nex<span className="text-emerald-300">Card</span></div>
        </div>
      </div>
      <h2 className="text-[1.9rem] font-black tracking-[-0.06em] leading-[0.98] mb-4">Compra por intención, no por SKU.</h2>
      <p className="text-zinc-400 leading-relaxed mb-5">Parte solo, equipa socios o resuelve un equipo comercial. Cada pack incluye tarjeta negro mate, QR de respaldo y perfil editable sin mensualidad.</p>
      <ul className="grid gap-3 text-sm text-zinc-300">
        <li><CheckCircle size={16} className="inline mr-2 text-emerald-300" />Pack recomendado visible.</li>
        <li><CheckCircle size={16} className="inline mr-2 text-emerald-300" />Precio por unidad fácil de comparar.</li>
        <li><CheckCircle size={16} className="inline mr-2 text-emerald-300" />Carrito siempre a un toque.</li>
      </ul>
    </aside>
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
        const includeTestProducts = new URLSearchParams(window.location.search).get('mp_test') === '1';
        const data = await api.getProducts({ includeTestProducts });
        setProducts((data || []).map((product) => buildPricingPlan(product)));
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
  const formatPrice = (n) => Number(n || 0).toLocaleString('es-CL');

  // Estado de error
  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle size={48} className="text-red-400 mb-4" />
        <p className="text-xl font-bold mb-2">No pudimos cargar el catálogo</p>
        <p className="text-zinc-400 mb-6 text-sm max-w-xs">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-base btn-press w-full min-h-[46px] rounded-lg btn-secondary"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white px-4 py-6 sm:px-8 sm:py-10">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-emerald-300 mb-4">
              <Package size={15} />
              Packs NexCard
            </div>
            <h1 className="text-[clamp(2.5rem,5.6vw,5.5rem)] font-black tracking-[-0.075em] leading-[0.92] max-w-3xl">Elige cuántas tarjetas necesitas hoy.</h1>
            <p className="text-zinc-400 mt-5 max-w-2xl leading-relaxed">Selecciona el pack que calza con tu uso real. Puedes revisar el carrito antes de pasar al pago.</p>
          </div>
          {!loading && totalItems > 0 && (
            <button
              onClick={onProceedToCart}
              className="btn-base btn-press inline-flex items-center justify-center gap-2 btn-primary shrink-0"
            >
              Ver carrito
              <ArrowRight size={18} />
            </button>
          )}
        </div>

        {/* Compra guiada */}
        <div className="grid gap-7 lg:grid-cols-[0.88fr_1.12fr] lg:items-start mb-10">
          <CatalogSummary />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)
              : products.map((product) => {
                  const isAdded = addedProducts.has(product.id);
                  return (
                    <article
                      key={product.id}
                      className={`relative min-h-[380px] rounded-[22px] border bg-zinc-900 p-[22px] flex flex-col transition-all duration-200 hover:-translate-y-0.5 ${
                        product.highlight
                          ? 'border-emerald-500/70 bg-gradient-to-b from-emerald-500/10 to-zinc-900 shadow-2xl shadow-emerald-950/25'
                          : 'border-zinc-800 hover:border-emerald-500/45'
                      }`}
                    >
                      {product.badge && (
                        <span className="absolute -top-3 left-5 bg-emerald-500 text-zinc-950 rounded-full px-3 py-1 text-xs font-black">
                          {product.badge}
                        </span>
                      )}
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-[1.65rem] font-black tracking-[-0.06em] leading-none mb-2">{product.catalogName || product.name}</h3>
                          <p className="text-zinc-400 text-sm leading-relaxed">
                            {product.description}
                          </p>
                        </div>
                        <div className="grid h-14 min-w-14 place-items-center rounded-[19px] border border-emerald-500/25 bg-emerald-500/10 text-xl font-black text-emerald-200">
                          {product.cards}
                        </div>
                      </div>

                      <div className="mt-6">
                        <span className="text-4xl font-black tracking-[-0.065em]">
                          ${formatPrice(product.price_cents)}
                        </span>
                        <span className="text-zinc-500 text-sm ml-1 font-bold">CLP</span>
                        <p className="text-emerald-300 text-sm font-black mt-1">
                          {product.save || `$${formatPrice(product.perUnit)} por tarjeta aprox.`}
                        </p>
                      </div>

                      <ul className="grid gap-2.5 my-6 text-sm text-zinc-300 flex-1">
                        {(product.features || []).map((feature) => (
                          <li key={feature} className="flex items-start gap-2 leading-relaxed">
                            <CheckCircle size={15} className="text-emerald-300 shrink-0 mt-0.5" />
                            {feature}
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={isAdded}
                        className={`btn-base btn-press w-full min-h-[48px] rounded-xl font-black flex items-center justify-center gap-2 ${
                          isAdded
                            ? 'btn-primary opacity-70 cursor-default'
                            : product.highlight
                              ? 'btn-primary'
                              : 'btn-secondary hover:border-emerald-500/35'
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
                            {product.highlight ? 'Agregar pack recomendado' : 'Agregar al carrito'}
                          </>
                        )}
                      </button>

                      <p className="text-zinc-600 text-xs mt-3 text-center uppercase tracking-[0.16em]">SKU: {product.displaySku || product.sku}</p>
                    </article>
                  );
                })}
          </div>
        </div>

        <div className="rounded-[22px] border border-zinc-800 bg-zinc-900 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-white font-black mb-1">¿Necesitas más de 7?</p>
            <p className="text-zinc-400">Para empresas grandes, WhatsApp directo sin mezclarlo con la compra estándar.</p>
          </div>
          <a
            href="https://wa.me/56993183021?text=Hola%20NexCard%2C%20quiero%20cotizar%20un%20plan%20corporativo"
            target="_blank"
            rel="noreferrer"
            className="btn-base btn-press inline-flex items-center justify-center btn-primary shrink-0"
          >
            Cotizar por WhatsApp
          </a>
        </div>

        {/* Barra flotante del carrito — aparece cuando hay items */}
        {!loading && totalItems > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-sm">
            <button
              onClick={onProceedToCart}
              className="btn-base btn-press w-full flex items-center justify-between btn-primary"
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
