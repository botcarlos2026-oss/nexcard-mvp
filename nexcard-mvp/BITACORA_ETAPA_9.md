# Bitácora de Desarrollo - Etapa 9: Estado Actual de NexCard y Cierre Pre-Lanzamiento

**Fecha:** 2026-05-06
**Branch:** `main`
**Contexto:** actualización consolidada del proyecto tras los últimos cambios subidos al repositorio.

---

## 1. Estado general del proyecto
NexCard ya no está en fase de prototipo simple. El proyecto evolucionó a una base operativa bastante cercana a lanzamiento controlado, con foco en:

- venta de tarjetas NFC
- checkout con Mercado Pago
- operación admin sobre Supabase
- inventario físico
- tracking de pedidos
- perfiles digitales editables
- módulos comerciales adicionales (CRM, team, wheel, review cards)

La arquitectura actual prioriza velocidad operativa y control comercial por sobre sofisticación de framework. La decisión sigue siendo correcta: el cuello de botella no es técnico, es ejecución comercial y hardening.

---

## 2. Stack vigente de desarrollo

### Frontend
- React 18 SPA
- Tailwind CSS
- Lucide React
- Zustand para carrito
- router manual en `src/App.jsx`

### Backend / datos
- Supabase como backend principal
  - PostgreSQL
  - Auth
  - RLS
  - RPCs
  - Edge Functions
- servidor Express local como fallback/mock para desarrollo

### Infra y servicios
- Vercel para deploy frontend
- Mercado Pago Checkout Pro para pagos
- Resend para emails transaccionales
- Cypress para pruebas E2E

---

## 3. Componentes operativos ya montados

### Comercial / web pública
- `/` quedó en modo **Coming Soon**
- `/preview` mantiene la landing comercial
- formulario de waitlist conectado a Supabase
- políticas y términos publicados

### Checkout
- catálogo de productos
- carrito persistido con Zustand
- formulario de checkout
- creación de orden en Supabase vía RPC `create_order_with_items`
- retorno desde Mercado Pago procesado en frontend
- pantalla de confirmación de compra

### Admin
Módulos disponibles hoy:
- dashboard general
- orders
- products
- cards
- profiles
- inventory
- review cards
- emails
- CRM
- team
- wheel
- print test / calibración

### Operación física
- inventario con movimientos
- despacho con descuento de stock vía RPC
- tracking de órdenes
- confirmación de entrega
- flujo de programación / asignación / activación de cards
- generador de calibración para impresión

---

## 4. Hallazgos relevantes del código actual

### 4.1 App centralizada
`src/App.jsx` sigue siendo el núcleo total del sistema:
- auth bootstrap
- gating admin por whitelist
- carga de dashboards
- routing completo
- flujo checkout
- tracking y confirmación

Esto da velocidad, pero ya empieza a concentrar demasiada responsabilidad. A corto plazo aguanta. A mediano plazo conviene particionar bootstrap, auth guards y routing por dominio.

### 4.2 Capa de API consolidada
`src/services/api.js` concentra gran parte del negocio:
- órdenes
- inventario
- cards
- perfiles
- CRM
- wheel
- review cards
- team
- productos
- abandoned carts
- refunds

Esto es útil para iterar rápido, pero es un riesgo de mantenibilidad. Ya es un archivo de alto acoplamiento.

### 4.3 Supabase quedó como columna vertebral real
La app depende de Supabase en casi todo lo importante:
- auth real
- RLS admin
- órdenes
- inventario
- cards
- productos
- CRM
- waitlist
- marketing / abandoned carts

Conclusión: el riesgo principal ya no es “hacer features”, sino **blindar políticas, edge functions y operación**.

---

## 5. Cambios recientes visibles en `main`
Según el historial reciente del repo:

1. **Persistencia del checkout en `sessionStorage`**
   - mejora importante para no perder formularios al cambiar pestaña

2. **Desactivación temporal del scan tracking**
   - señal de desalineación entre app y esquema `card_scans`
   - esto requiere corrección estructural para no romper analítica NFC

3. **Ajustes de rutas admin**
   - se agregaron y corrigieron rutas de `team` y `wheel`

4. **Mejoras visuales del perfil**
   - refinamiento de UI en datos bancarios

5. **Mejoras de impresión**
   - margen seguro + generador de calibración Fargo DTC1500

6. **Cambio comercial en home pública**
   - Google Reviews se retiró del sitio público
   - `/` volvió a `ComingSoon`
   - el módulo admin sigue disponible internamente

---

## 6. Riesgos actuales

### Riesgo 1 — Seguridad operativa
El proyecto ya tiene suficiente superficie como para justificar hardening inmediato:
- auditoría completa de RLS
- rate limiting en funciones públicas
- revisión de edge functions
- saneamiento de secretos y variables de entorno

### Riesgo 2 — Acoplamiento en frontend
`App.jsx` y `api.js` crecieron mucho. No bloquea lanzamiento, pero sí aumenta costo de cambio y riesgo de regresión.

### Riesgo 3 — Dependencia de configuración externa
Parte crítica del sistema no vive en el repo:
- Edge Functions
- secrets de Supabase
- estado real del proyecto Supabase

Eso complica auditoría, onboarding y reproducibilidad.

### Riesgo 4 — Inconsistencias entre esquema y frontend
El caso `card_scans` muestra una advertencia concreta: si el esquema evoluciona sin disciplina, la operación NFC se rompe silenciosamente.

---

## 7. Estado comercial/técnico real
Hoy NexCard ya tiene base para vender, operar y despachar. Lo que falta no es “hacer una app”, sino cerrar brechas de madurez:

- seguridad
- trazabilidad
- endurecimiento de acceso admin
- monitoreo
- consistencia entre repo, Supabase y edge functions

En términos de negocio: ya existe un activo operable. El siguiente salto rentable no es agregar features cosméticas, sino reducir riesgo operativo por venta.

---

## 8. Prioridades recomendadas

### Prioridad A — Hardening
- RLS audit tabla por tabla
- bloqueo de políticas permisivas
- rate limit en edge functions públicas
- revisión de secretos / gitignore / exposición de credenciales
- 2FA o doble validación en acceso admin

### Prioridad B — Estabilidad operacional
- corregir `card_scans`
- documentar edge functions reales desplegadas
- validar flujos de checkout end-to-end
- validar tracking y notificaciones

### Prioridad C — Orden técnico
- separar `api.js` por dominio
- reducir responsabilidad de `App.jsx`
- dejar bitácora y documentación alineadas con la realidad del repo

---

## 9. Conclusión ejecutiva
NexCard ya cruzó la etapa de MVP frágil. Ahora está en una zona más sensible: **sí puede operar, pero necesita disciplina de seguridad y control**.

Mi lectura estratégica es simple:
- **producto:** suficientemente armado
- **operación:** funcional
- **margen futuro:** depende de evitar errores operativos y escalar sin fugas
- **próximo trabajo correcto:** hardening post-lanzamiento, no maquillaje

---

## 10. Próximo bloque lógico
El siguiente bloque correcto es ejecutar una **Fase 7 real de seguridad y madurez**, pero ajustada al estado verdadero del repo y del proyecto Supabase:

- auditar lo que sí existe
- no asumir archivos ni funciones que no están en este código
- trabajar con evidencia real del entorno actual

Eso te protege caja, reputación y continuidad operativa.
