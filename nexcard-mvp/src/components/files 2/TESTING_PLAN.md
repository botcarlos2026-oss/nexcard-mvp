# Plan de Testing - Checkout NexCard

## Escenarios de Prueba End-to-End

### Escenario 1: Flujo Completo Happy Path

**Caso:** Usuario compra 1 pack de 5 tarjetas exitosamente

**Pasos:**
1. ✅ Usuario abre `/shop`
2. ✅ Ve catálogo de 4 productos (PREMIUM-5, PREMIUM-10, PREMIUM-20, BASIC-5)
3. ✅ Hace click en "PREMIUM-5" → "Agregar al carrito"
4. ✅ Botón cambia a "¡Agregado!" por 2 segundos
5. ✅ Carrito almacena item en localStorage
6. ✅ Hace click "Proceder al Checkout"
7. ✅ Redirige a formulario checkout
8. ✅ Completa datos:
   - Nombre: Juan Pérez García
   - Email: juan@example.com
   - Teléfono: +56 9 1234 5678
   - Dirección: Calle Principal 123
9. ✅ Selecciona "Mercado Pago" como método de pago
10. ✅ Acepta términos y condiciones
11. ✅ Hace click "Confirmar Orden"
12. ✅ Orden se crea en Supabase con status `pending`
13. ✅ Ve página de confirmación con:
    - Número de orden (ID UUID)
    - Email de confirmación
    - Monto total ($4,999)
    - Botón "Volver al Catálogo"
14. ✅ Verifica en Supabase:
    - `orders` table: nuevo registro con `payment_status = 'pending'`
    - `order_items` table: 1 item con `product_id` de PREMIUM-5

**Esperado:** Orden creada exitosamente, datos guardados en BD

---

### Escenario 2: Múltiples Items en Carrito

**Caso:** Usuario agrega 3 productos diferentes

**Pasos:**
1. Agrega "PREMIUM-5" (cantidad 1)
2. Agrega "BASIC-5" (cantidad 2)
3. Agrega "PREMIUM-10" (cantidad 1)
4. Verifica carrito muestra:
   - PREMIUM-5 × 1 = $4,999
   - BASIC-5 × 2 = $5,998
   - PREMIUM-10 × 1 = $8,999
   - **Total: $19,996**
5. Carrito permite modificar cantidades (+/-)
6. Procede al checkout y confirma

**Esperado:**
- `order_items` tiene 3 registros
- Total en orden es $1,999,600 cents (19996 * 100)

---

### Escenario 3: Validación de Formulario

**Caso:** Intentar confirmar orden sin datos válidos

**Tests:**
1. **Sin nombre:**
   - Clickea "Confirmar Orden"
   - Error: "Por favor ingresa tu nombre completo"

2. **Email inválido:**
   - Ingresa: "noesemail"
   - Error: "Por favor ingresa un email válido"

3. **Sin teléfono:**
   - Deja vacío
   - Error: "Por favor ingresa un teléfono"

4. **Sin dirección:**
   - Deja vacío
   - Error: "Por favor ingresa tu dirección"

5. **Sin aceptar términos:**
   - Deja checkbox desmarcado
   - Error: "Debes aceptar los términos y condiciones"

**Esperado:** No se crea orden, solo muestra error en UI

---

### Escenario 4: Persistencia de Carrito

**Caso:** Usuario cierra navegador con items en carrito

**Pasos:**
1. Agrega 2 items al carrito
2. Cierra navegador/pestaña
3. Reabre sitio en misma sesión
4. Carrito aún muestra los 2 items

**Esperado:** localStorage persiste datos entre sesiones

---

### Escenario 5: Carrito Vacío

**Caso:** Usuario intenta proceder al checkout sin items

**Pasos:**
1. Accede a `/checkout` sin items en carrito
2. Debería redirigir a catálogo o mostrar mensaje

**Esperado:** No permite proceder sin al menos 1 item

---

### Escenario 6: Validación de Stock (Future)

**Caso:** Usuario intenta comprar más cantidad de lo disponible

**Pasos:**
1. Intenta agregar 1000 unidades de un producto
2. Sistema valida contra `inventory_items.stock`
3. Muestra error si no hay stock suficiente

**Nota:** Implementar en Fase 2

---

### Escenario 7: Método de Pago Seleccionado

**Caso:** Validar que se guarda correctamente el método de pago

**Tests:**
1. Selecciona "Mercado Pago" → Confirma → En BD: `payment_method = 'mercado-pago'`
2. Selecciona "Transbank WebPay" → Confirma → En BD: `payment_method = 'transbank'`

**Esperado:** Campo `payment_method` en `orders` coincide con selección

---

### Escenario 8: Rollback si Falla Insert de Items

**Caso:** Order se crea pero falla al crear order_items

**Pasos:**
1. Configura orden para que falle `order_items` insert
2. Intenta confirmar
3. Error es lanzado al usuario
4. Verifica BD: **No debería haber orden huérfana**

**Esperado:** Rollback automático (orden + items transaccional)

---

### Escenario 9: Performance de Catálogo

**Caso:** Catálogo carga rápidamente

**Tests:**
1. Abre `/shop`
2. Debería renderizar en <2 segundos
3. Productos se cargan desde Supabase (RLS activo)

**Esperado:** Ningún producto archivado visible, solo `status = 'active'`

---

### Escenario 10: RLS Funcionando

**Caso:** Verificar que RLS permite/bloquea correctamente

**Tests:**
1. **Lectura pública (anon):**
   - Puede ver productos con `status = 'active'` ✅
   - NO puede ver productos con `status = 'archived'` ✅

2. **Admin:**
   - Puede ver TODOS los productos ✅

3. **Order_items:**
   - Usuario autenticado solo ve sus propias órdenes ✅

**Esperado:** Policies funcionan correctamente

---

## Checklist Pre-Lanzamiento

- [ ] Todos los escenarios 1-7 pasados
- [ ] No hay errores en consola
- [ ] localStorage funciona
- [ ] Supabase RLS activo y validado
- [ ] Catálogo muestra solo productos activos
- [ ] Órdenes se crean con status `pending`
- [ ] Email validado (regex básico)
- [ ] Formulario no envía sin validación
- [ ] Redirecciones funcionan
- [ ] Estilos Tailwind responsivos

---

## Testing Manual (Sin Automatizar)

```bash
# Abre console DevTools (F12)
# Pestaña Application > Local Storage
# Verifica que haya 'nexcard-cart-storage'

# Abre Supabase Dashboard
# Tabla: orders
# Verifica último registro tiene:
# - customer_name
# - customer_email
# - payment_status = 'pending'
# - amount_cents (en centavos)

# Tabla: order_items
# Verifica que existan items de la orden:
# - order_id (referencia correcta)
# - product_id (válido)
# - quantity
# - unit_price_cents
```

---

## Automatizar con Cypress (Future)

```javascript
// cypress/e2e/checkout-complete-flow.cy.js

describe('Checkout Complete Flow', () => {
  it('should complete a full purchase', () => {
    cy.visit('/shop');
    
    // Agregar producto
    cy.contains('PREMIUM-5').parent().contains('Agregar al carrito').click();
    cy.contains('¡Agregado!').should('be.visible');
    
    // Proceder a checkout
    cy.contains('Proceder al Checkout').click();
    cy.contains('Carrito de Compras').should('be.visible');
    
    cy.contains('Proceder al Checkout').click();
    cy.contains('Checkout').should('be.visible');
    
    // Llenar formulario
    cy.get('input[name="customerName"]').type('Juan Pérez');
    cy.get('input[name="customerEmail"]').type('juan@example.com');
    cy.get('input[name="customerPhone"]').type('+56 9 1234 5678');
    cy.get('textarea[name="customerAddress"]').type('Calle Principal 123');
    cy.get('input[name="acceptTerms"]').check();
    
    // Confirmar
    cy.contains('Confirmar Orden').click();
    
    // Verificar confirmación
    cy.contains('¡Orden Confirmada!').should('be.visible');
    cy.contains('Número de Orden').should('be.visible');
  });
});
```

---

## Notas de Testing

- **Timezone:** Todos los timestamps están en UTC
- **Moneda:** Todo es en CLP (centavos en BD)
- **Session:** Usuario puede comprar sin autenticación (user_id puede ser NULL)
- **Carrito:** Se limpia después de orden exitosa (clearCart())

---

¿Necesitas más escenarios específicos? Agrega aquí.
