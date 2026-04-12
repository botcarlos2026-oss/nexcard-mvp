import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCart = create(
  persist(
    (set, get) => ({
      items: [],
      checkoutData: null,
      
      addItem: (product, quantity = 1) =>
        set((state) => {
          const existingItem = state.items.find((item) => item.product_id === product.id);
          if (existingItem) {
            return {
              items: state.items.map((item) =>
                item.product_id === product.id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              ),
            };
          }
          return {
            items: [
              ...state.items,
              {
                product_id: product.id,
                product_name: product.name,
                product_sku: product.sku,
                unit_price_cents: product.price_cents,
                quantity,
              },
            ],
          };
        }),

      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((item) => item.product_id !== productId),
        })),

      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.product_id === productId
              ? { ...item, quantity: Math.max(1, quantity) }
              : item
          ),
        })),

      clearCart: () => set({ items: [] }),

      getTotalCents: () => {
        const { items } = get();
        return items.reduce((total, item) => total + item.unit_price_cents * item.quantity, 0);
      },

      getTotalItems: () => {
        const { items } = get();
        return items.reduce((total, item) => total + item.quantity, 0);
      },

      setCheckoutData: (data) => set({ checkoutData: data }),

      getCheckoutData: () => get().checkoutData,
    }),
    {
      name: 'nexcard-cart-storage',
      partialize: (state) => ({ items: state.items }),
    }
  )
);
