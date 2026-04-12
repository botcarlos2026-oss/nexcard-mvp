# Instalación del Checkout - NexCard MVP

## Paso 1: Instalar dependencia Zustand

```bash
cd nexcard-mvp
npm install zustand
```

## Paso 2: Copiar archivos a tu proyecto

### 2.1 Crear CartStore
Copia el contenido de `cartStore.js` a:
```
src/store/cartStore.js
```

### 2.2 Crear componentes
Copia cada archivo a `src/components/`:
- `ProductCatalog.jsx` → `src/components/ProductCatalog.jsx`
- `Cart.jsx` → `src/components/Cart.jsx`
- `CheckoutForm.jsx` → `src/components/CheckoutForm.jsx`
- `OrderConfirmation.jsx` → `src/components/OrderConfirmation.jsx`

### 2.3 Actualizar API
En `src/services/api.js`:

**Al inicio del archivo, busca:** `export const api = {`

**Justo ANTES de `export const api = {`, agrega:**

```javascript
// ==================== PRODUCTS ====================

async function supabaseGetProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

// ==================== ORDERS CREATION ====================

async function supabaseCreateOrder(payload) {
  if (!hasSupabase) throw new Error('Supabase no configurado');
  
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id || null;

  const orderPayload = {
    user_id: userId,
    customer_name: payload.customer_name,
    customer_email: payload.customer_email,
    payment_method: payload.payment_method,
    payment_status: 'pending',
    fulfillment_status: 'pending',
    amount_cents: payload.amount_cents,
    currency: payload.currency || 'CLP',
  };

  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert([orderPayload])
    .select()
    .single();

  if (orderError) throw orderError;

  if (!orderData?.id) {
    throw new Error('No se pudo crear la orden');
  }

  const orderId = orderData.id;

  // Crear order_items
  if (payload.items && payload.items.length > 0) {
    const orderItems = payload.items.map((item) => ({
      order_id: orderId,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
      currency: payload.currency || 'CLP',
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      // Rollback: eliminar orden si falla inserción de items
      await supabase.from('orders').delete().eq('id', orderId);
      throw itemsError;
    }
  }

  return orderData;
}
```

**Dentro del objeto `api`, agrega estas dos funciones:**

```javascript
// Productos
getProducts: async () => {
  if (!hasSupabase) {
    throw new Error('Catálogo deshabilitado: Supabase es obligatorio');
  }
  return supabaseGetProducts();
},

// Crear orden (checkout)
createOrder: async (payload) => {
  if (!hasSupabase) {
    throw new Error('Checkout deshabilitado: Supabase es obligatorio');
  }
  return supabaseCreateOrder(payload);
},
```

## Paso 3: Actualizar App.jsx

En `src/App.jsx`:

### 3.1 Importar componentes y store
Después de los otros imports, agrega:

```javascript
import ProductCatalog from './components/ProductCatalog';
import Cart from './components/Cart';
import CheckoutForm from './components/CheckoutForm';
import OrderConfirmation from './components/OrderConfirmation';
import { useCart } from './store/cartStore';
```

### 3.2 Agregar estado para checkout
Dentro de la función `App()`, después del otro estado, agrega:

```javascript
const [checkoutStep, setCheckoutStep] = useState(null); // 'catalog' | 'cart' | 'checkout' | 'confirmation'
const [currentOrder, setCurrentOrder] = useState(null);
const { getTotalItems } = useCart();
```

### 3.3 Agregar handler para navegación
Después de la función `navigate`, agrega:

```javascript
const handleCheckoutStart = () => {
  setCheckoutStep('catalog');
};

const handleProceedToCart = () => {
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
```

### 3.4 Agregar rutas para checkout
En el bloque de returns finales (antes del último return), agrega:

```javascript
// Checkout flow
if (checkoutStep === 'catalog') {
  return <ProductCatalog />;
}

if (checkoutStep === 'cart') {
  return <Cart onProceedCheckout={handleProceedToCheckout} />;
}

if (checkoutStep === 'checkout') {
  return (
    <CheckoutForm
      onOrderSuccess={handleOrderSuccess}
      onBack={() => setCheckoutStep('cart')}
    />
  );
}

if (checkoutStep === 'confirmation') {
  return (
    <OrderConfirmation
      order={currentOrder}
      onContinueShopping={handleBackToShop}
    />
  );
}
```

## Paso 4: Agregar botón de compra en landing o navbar

En tu landing page o navbar, agrega un botón:

```jsx
<button
  onClick={() => navigate('/shop')}
  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-lg"
>
  Comprar Ahora
</button>
```

O si usas el flujo de estado:

```jsx
<button
  onClick={handleCheckoutStart}
  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-lg"
>
  Ir al Catálogo
</button>
```

## Paso 5: Prueba en desarrollo

```bash
npm start
```

1. Haz click en "Comprar"
2. Agrega productos al carrito
3. Procede al checkout
4. Completa datos
5. Confirma orden

## Estructura final esperada

```
nexcard-mvp/src/
├── components/
│   ├── ProductCatalog.jsx
│   ├── Cart.jsx
│   ├── CheckoutForm.jsx
│   ├── OrderConfirmation.jsx
│   └── ... (otros componentes)
├── store/
│   └── cartStore.js (nuevo)
├── services/
│   └── api.js (modificado)
└── App.jsx (modificado)
```

## Próximos pasos

1. ✅ Instalar dependencias
2. ✅ Copiar archivos
3. ✅ Actualizar api.js
4. ✅ Actualizar App.jsx
5. 🔜 Integrar Mercado Pago / Transbank
6. 🔜 Crear webhooks para confirmación de pago
7. 🔜 Implementar flujo de despacho

---

**¿Duda en algún paso? Pregunta directamente.**
