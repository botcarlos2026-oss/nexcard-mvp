# NexCard — Roadmap de lanzamiento por fases

**Fecha:** 2026-05-08  
**Objetivo del roadmap:** priorizar margen, caja y reducción de riesgo usando solo evidencia visible en el repo y documentación existente.  
**Convención:** **[Verificado]** = respaldado por código/docs/comandos revisados. **[Supuesto]** = inferencia razonable, pero no comprobada directamente en este workspace.

---

## 1) Estado base

### Resumen ejecutivo
NexCard está en **pre-lanzamiento avanzado**, con capacidad tecnológica real para vender y operar, pero todavía con brechas relevantes en cobro productivo, QA reproducible, control de acceso admin y disciplina operativa.

### Estado base verificado
- **[Verificado]** Frontend React 18 + Tailwind + Zustand en producción de build local (`npm run build` OK).
- **[Verificado]** Existe backend real apoyado en Supabase y Edge Functions para pagos, emails, tracking, refunds y alertas (`supabase/functions/*`).
- **[Verificado]** Existe checkout con Mercado Pago documentado y respaldado por funciones `create-mp-preference` y `mp-webhook`.
- **[Verificado]** Hay operación admin real para orders, inventory, cards, profiles, products, CRM, emails, review cards, team y wheel (`src/components/*`).
- **[Verificado]** Hay suite Cypress amplia, pero el preflight E2E falla en este workspace por variables faltantes `CYPRESS_login_email` y `CYPRESS_login_password`.
- **[Verificado]** `src/App.jsx` sigue centralizando routing, bootstrap y guardias admin (355 líneas).
- **[Verificado]** `src/services/api.js` concentra gran parte de la lógica comercial/operativa (1117 líneas).
- **[Verificado]** El acceso admin depende de whitelist hardcodeada de emails en `src/App.jsx`.
- **[Verificado]** `docs/STATUS.md` marca pendiente crítica la activación de credenciales de producción de Mercado Pago, la remoción de producto test, limpieza de `console.log` y billing de Vercel.
- **[Verificado]** Hay evidencia reciente de drift esquema/app: commit `45400fb` deshabilita scan tracking temporalmente por desalineación de `card_scans`.

### Estado base no totalmente cerrado
- **[Supuesto]** El sistema productivo en Supabase/Vercel podría estar más avanzado que el repo en algunos detalles operativos, pero eso no se puede afirmar sin revisar el entorno externo.
- **[Supuesto]** La operación física de fulfillment ya puede ejecutarse en pequeño volumen, pero no está validada aquí con pruebas end-to-end verdes.

### Lectura de negocio
- El cuello de botella actual **no** es falta de features para vender.
- El cuello de botella actual es **convertir venta en caja confiable** sin fugas operativas ni errores evitables.

---

## 2) Fases 0-3

## Fase 0 — Blindaje mínimo antes de cobrar real
**Objetivo:** cerrar lo indispensable para no lanzar con fuga de caja o riesgo operativo básico.

### Alcance
1. Activar Mercado Pago producción.
2. Validar webhook y trazabilidad order/payment con un pago real controlado.
3. Eliminar producto/test data que contamine operación (`TEST-1`).
4. Configurar billing de Vercel para evitar corte por trial.
5. Cerrar entorno E2E mínimo para smoke reproducible.
6. Limpiar `console.log` de debug pendiente en `api.js` si aplica al flujo productivo.

### Por qué va primero
- Es la fase con mayor impacto directo en **caja inmediata**.
- Reduce el riesgo de “vender sin cobrar bien” o “cobrar sin trazabilidad”.

### Entregable de salida
- Primer pago real validado de punta a punta.
- Orden visible en admin.
- Webhook reflejando estado pagado.
- Smoke test mínimo documentado.

---

## Fase 1 — Lanzamiento controlado de bajo volumen
**Objetivo:** empezar a vender en ventana acotada, privilegiando control y aprendizaje sobre volumen.

### Alcance
1. Abrir canal comercial principal usando la landing/preview existente.
2. Vender solo SKUs y flujos ya operables.
3. Operar con monitoreo manual diario de órdenes, pagos, stock y emails.
4. Ejecutar checklist operativa por cada venta/despacho.
5. Mantener acceso admin restringido a muy pocas personas.

### Qué sí monetiza en esta fase
- Venta de productos ya implementados con checkout actual.
- Upsell operativo simple sobre inventario y fulfillment existente.

### Qué se posterga deliberadamente
- Nuevas features de marketing cosmético.
- Escalado de equipo admin.
- Automatizaciones ambiciosas no críticas para cobrar.

---

## Fase 2 — Estabilización operativa y protección de margen
**Objetivo:** bajar costo por error, soporte y retrabajo una vez entren las primeras ventas reales.

### Alcance
1. Auditar y endurecer `orders/payments` con el patrón ya documentado de snapshot/audit/soft delete.
2. Corregir drift de `card_scans` antes de empujar NFC como flujo relevante.
3. Formalizar seeds/credenciales E2E y correr pack mínimo reproducible.
4. Mejorar trazabilidad de inventario con SKU real donde hoy hay fallback por nombre.
5. Revisar RLS y funciones públicas expuestas al flujo comercial.

### Por qué mejora margen
- Menos errores de inventario.
- Menos conciliación manual.
- Menos tiempo de soporte por estados inconsistentes.
- Menos riesgo de cobros/reembolsos mal trazados.

---

## Fase 3 — Escala prudente y reducción de dependencia del fundador
**Objetivo:** preparar crecimiento moderado sin que cada operación dependa de memoria manual o acceso privilegiado informal.

### Alcance
1. Reemplazar whitelist admin hardcodeada por modelo formal de roles/memberships.
2. Particionar `api.js` y alivianar `App.jsx` por dominio para reducir regresiones.
3. Consolidar playbooks de operación de órdenes, pagos, inventario, cards y perfiles.
4. Reabrir expansión NFC/review flows solo después de estabilizar el core comercial.
5. Evaluar segundo medio de pago o canales nuevos solo cuando el principal esté estable.

### Resultado esperado
- Más delegación operativa.
- Menor riesgo de cambios rápidos rompiendo caja.
- Base más sana para crecimiento comercial.

---

## 3) Criterio go/no-go por fase

### Fase 0
**Go si:**
- `npm run build` sigue OK.
- Existe pago real validado con Mercado Pago producción.
- Webhook deja `payment_status` correcto en admin.
- Billing de Vercel queda resuelto.
- Smoke mínimo documentado y repetible.

**No-go si:**
- MP sigue en test.
- No hay evidencia de primer cobro real reconciliado.
- El entorno mínimo E2E/smoke sigue incompleto.

### Fase 1
**Go si:**
- Ya se cobró al menos una venta real completa.
- Inventario y emails de confirmación se observan correctamente.
- El equipo puede revisar manualmente cada orden sin ambigüedad.

**No-go si:**
- Hay drift frecuente entre order/payment.
- Stock, tracking o confirmaciones no son confiables.
- Se detectan errores manuales repetidos en ventas piloto.

### Fase 2
**Go si:**
- Existe pack mínimo de pruebas reproducible.
- Orders/payments tienen mejor trazabilidad operativa.
- `card_scans` y/o flujos NFC dejan de estar desalineados si se van a usar comercialmente.
- Inventario crítico ya no depende de matching difuso como regla principal.

**No-go si:**
- La conciliación sigue siendo artesanal.
- El drift entre frontend, SQL y Edge Functions sigue activo.
- El costo de soporte por operación crece con cada venta.

### Fase 3
**Go si:**
- Roles/admin ya no dependen de whitelist estática.
- Hay playbooks y operación delegable.
- La base técnica soporta cambios sin tocar un monolito frágil cada vez.

**No-go si:**
- El fundador sigue siendo el único que entiende cobro, despacho y resolución de incidentes.
- Cada cambio comercial amenaza romper checkout, admin o inventario.

---

## 4) Dependencias críticas

### Dependencias técnicas
- **Mercado Pago producción** para caja real.
- **Supabase** como columna vertebral de auth, datos, RLS, RPC y Edge Functions.
- **Vercel** con billing activo para continuidad operativa.
- **Resend** para emails transaccionales.
- **Variables de entorno y seeds E2E** para validación reproducible.

### Dependencias operativas
- Definición de SKUs críticos y disciplina de inventario.
- Procedimiento diario de revisión de órdenes/pagos/despachos.
- Dataset de prueba controlado para QA.

### Dependencias de control
- Auditoría de RLS y accesos admin.
- Corrección de drift `card_scans` si NFC entra al flujo comercial.
- Documentación viva de estados y transiciones de orders/payments.

---

## 5) Checklist operativa mínima

### Antes de abrir ventas
- [ ] MP producción activo.
- [ ] Webhook productivo validado.
- [ ] Billing de Vercel activo.
- [ ] Producto test removido del catálogo productivo.
- [ ] Variables E2E mínimas definidas.
- [ ] Smoke manual y/o Cypress mínimo documentado.

### Por cada orden real
- [ ] Confirmar orden creada en admin.
- [ ] Confirmar `payment_status` correcto.
- [ ] Confirmar email de cliente enviado.
- [ ] Confirmar reserva/descuento de stock si corresponde.
- [ ] Confirmar tracking o estado de fulfillment.

### Cierre diario mínimo
- [ ] Revisar órdenes nuevas.
- [ ] Revisar pagos pendientes vs pagados.
- [ ] Revisar incidencias de stock.
- [ ] Revisar errores de email/webhook.
- [ ] Registrar anomalías y retrabajos.

---

## 6) Prioridades por ROI / impacto en flujo de caja

## Prioridad 1 — Máximo ROI / impacto directo en caja
1. **Activar y validar MP producción.**  
   Impacto: habilita cobro real inmediato.
2. **Validar webhook + reconciliación order/payment.**  
   Impacto: evita fuga de caja y soporte caro.
3. **Asegurar continuidad de Vercel billing.**  
   Impacto: evita caída del canal de venta.

## Prioridad 2 — Alto ROI / protección de margen
4. **Cerrar smoke/E2E mínimo reproducible.**  
   Impacto: baja riesgo de romper checkout o admin al cambiar algo.
5. **Corregir inventario hacia SKU real.**  
   Impacto: menos errores de fulfillment y compras.
6. **Endurecer orders/payments con audit y guardrails.**  
   Impacto: menos conciliación manual y menos retrabajo.

## Prioridad 3 — ROI medio / reduce riesgo de escala
7. **Formalizar roles admin y dejar atrás whitelist hardcodeada.**
8. **Corregir drift `card_scans` antes de depender comercialmente de NFC.**
9. **Particionar `api.js` y simplificar `App.jsx`.**

## Prioridad 4 — ROI posterior / no urgente para lanzamiento inicial
10. **Segundo medio de pago.**
11. **CRM/automatizaciones más ambiciosas.**
12. **Expansión de features cosméticas o de marketing no críticas.**

---

## 7) Recomendación ejecutiva final

**Recomendación:** lanzar en **modo controlado**, no en modo “escala”.

### Tesis
NexCard ya tiene suficiente producto para empezar a capturar caja, pero todavía no tiene suficiente hardening para escalar sin fricción. El mejor movimiento no es agregar más features: es **cerrar cobro real, trazabilidad y operación mínima disciplinada**.

### Decisión sugerida
- **Sí** avanzar a lanzamiento si se completa la **Fase 0** en corto plazo.
- **No** ampliar catálogo, equipo admin o promesa NFC fuerte antes de cerrar Fase 1-2.

### Orden recomendado
1. Cobrar real.
2. Verificar reconciliación.
3. Operar poco volumen con control intenso.
4. Endurecer lo que más toca margen: pagos, inventario, accesos y drift.
5. Recién después acelerar crecimiento.

### Frase ejecutiva
**Primero caja confiable; después escala.**
