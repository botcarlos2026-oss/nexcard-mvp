# 🚀 Checkout NexCard - Quick Start

**Tiempo estimado:** 15 minutos  
**Complejidad:** Bajo  
**Dependencias nuevas:** `zustand`

---

## Archivos a Actualizar/Crear

### 1. **NUEVO:** `src/store/cartStore.js`
Crea este archivo nuevo con Zustand store

### 2. **NUEVO:** `src/components/ProductCatalog.jsx`
Componente de catálogo

### 3. **NUEVO:** `src/components/Cart.jsx`
Componente de carrito

### 4. **NUEVO:** `src/components/CheckoutForm.jsx`
Formulario de checkout

### 5. **NUEVO:** `src/components/OrderConfirmation.jsx`
Página de confirmación

### 6. **REEMPLAZAR:** `src/services/api.js`
**Reemplaza COMPLETO** con el nuevo (incluye todas tus funciones + checkout)

### 7. **REEMPLAZAR:** `src/App.jsx`
**Reemplaza COMPLETO** con el nuevo (incluye rutas de checkout)

---

## Instalación Paso a Paso

### Paso 1: Instalar Zustand
```bash
cd nexcard-mvp
npm install zustand
```

### Paso 2: Copiar archivos
1. **Descarga todos los archivos .jsx y .js** de los outputs
2. Copia cada uno a su carpeta correcta:
   ```
   cartStore.js → src/store/cartStore.js (crea carpeta /store si no existe)
   ProductCatalog.jsx → src/components/
   Cart.jsx → src/components/
   CheckoutForm.jsx → src/components/
   OrderConfirmation.jsx → src/components/
   api.js → src/services/ (REEMPLAZA el actual)
   App.jsx → src/ (REEMPLAZA el actual)
   ```

### Paso 3: Actualizar imports en App.jsx
Los imports ya están en el nuevo App.jsx, solo asegúrate que existan las carpetas:
- `src/store/` (crear si no existe)
- `src/components/` (ya debe existir)

### Paso 4: Verificar package.json
El nuevo App.jsx importa `useCart` del store, zustand debe estar instalado:
```bash
npm list zustand
# Debería mostrar zustand@X.X.X
```

### Paso 5: Prueba
```bash
npm start
```

Debería:
- ✅ Compilar sin errores
- ✅ Mostrar landing página normal
- ✅ Si agregas botón "Comprar" → abre catálogo
- ✅ Catálogo carga productos de Supabase
- ✅ Agregar al carrito funciona

---

## Verificación Rápida

En el navegador (F12 → Console):
```javascript
// Debería funcionar sin error:
localStorage.getItem('nexcard-cart-storage')

// Debería retornar un JSON o null (si carrito vacío)
```

---

## Si algo falla

**Error: Module not found 'zustand'**
→ Ejecuta: `npm install zustand`

**Error: ProductCatalog not found**
→ Verifica que `ProductCatalog.jsx` esté en `src/components/`

**Error: cartStore not found**
→ Verifica que `cartStore.js` esté en `src/store/`

**Supabase error cargando productos**
→ Verifica que tabla `products` existe con datos activos

---

## Próximos pasos después de esto

1. ✅ Hacer un PR a GitHub para revisar cambios
2. ✅ Hacer merge a `main`
3. 🔜 Integrar Mercado Pago / Transbank (Fase 2)
4. 🔜 Crear webhooks para confirmación de pago

---

## Estructura final
```
nexcard-mvp/
├── src/
│   ├── store/
│   │   └── cartStore.js (NUEVO)
│   ├── components/
│   │   ├── ProductCatalog.jsx (NUEVO)
│   │   ├── Cart.jsx (NUEVO)
│   │   ├── CheckoutForm.jsx (NUEVO)
│   │   ├── OrderConfirmation.jsx (NUEVO)
│   │   └── ... (otros componentes)
│   ├── services/
│   │   ├── api.js (ACTUALIZADO)
│   │   └── ...
│   ├── App.jsx (ACTUALIZADO)
│   └── ...
├── package.json (zustand agregado)
└── ...
```

---

## ¿Necesitas ayuda?

Si tienes errores:
1. Copia el mensaje exacto del error
2. Verifica que todos los archivos estén en la carpeta correcta
3. Ejecuta `npm install` nuevamente
4. Borra `node_modules/.vite` o `.next` si usa eso

---

**¡Listo! Checkout operativo en 15 minutos. 🚀**
