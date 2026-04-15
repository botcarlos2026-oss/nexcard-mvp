# Nexcard — Project Status

## Estado general
Fase: PRE-LAUNCH  
Objetivo: activar credenciales de producción MP y lanzar  
Última actualización: Abril 2026

---

## 🟢 HECHO

### Infraestructura
- [x] Dominio nexcard.cl activo (Vercel + NIC.cl)
- [x] Supabase conectado y en producción
- [x] Vercel desplegado con CI/CD desde GitHub
- [x] HTTPS activo
- [x] Variables de entorno configuradas en Vercel y Supabase

### Pagos
- [x] Mercado Pago integrado (Checkout Pro)
- [x] Edge Function create-mp-preference
- [x] Edge Function mp-webhook
- [x] Flujo completo probado en sandbox

### Emails
- [x] Resend configurado con dominio nexcard.cl
- [x] SPF/DKIM verificados
- [x] Edge Function send-order-confirmation
- [x] Email cliente + notificación interna funcionando

### Admin
- [x] Dashboard con métricas reales
- [x] Orders Control Center completo
- [x] Inventario con movimientos
- [x] Cards dashboard
- [x] Profiles dashboard
- [x] Búsqueda global
- [x] Export CSV de órdenes
- [x] Gráfico ventas 7 días
- [x] Historial cambios de estado
- [x] Marcar orden como pagada

### Producto
- [x] Landing completa con precios NexCard
- [x] Sección Google Reviews Card (NexReview)
- [x] Checkout funcional
- [x] Carrito persistente (Zustand)
- [x] Perfil digital público (/:slug)
- [x] Coming Soon en / con waitlist a Supabase
- [x] /preview para ver landing completa

### Legal
- [x] Política de privacidad (Ley 19.628)
- [x] Términos y condiciones (Ley 19.496)
- [x] Consentimiento en waitlist

### Seguridad
- [x] RLS activo en todas las tablas
- [x] Admin protegido con whitelist de emails
- [x] Secretos en variables de entorno
- [x] Sin secretos expuestos en frontend

---

## 🟡 EN PROGRESO

### Mercado Pago
- [ ] Cambiar MP_ACCESS_TOKEN de TEST a producción
- [ ] Validar webhook en producción
- [ ] Test con pago real

---

## 🔴 PENDIENTE CRÍTICO

### Antes de lanzar
- [ ] MP_ACCESS_TOKEN → credenciales de producción
- [ ] Eliminar producto TEST-1 ($19.990) de Supabase
- [ ] Remover console.log de debug en api.js
- [ ] Agregar tarjeta de pago en Vercel (trial expira)

### Post-lanzamiento
- [ ] Transbank WebPay (segunda integración de pago)
- [ ] Panel configuración Google Reviews Card
- [ ] Redirect nexcard.cl/r/:slug → Google Reviews
- [ ] CRM con pipeline Kanban + WhatsApp Business
- [ ] Generador de contenido para redes sociales

---

## 🚀 PRE-RELEASE CHECKLIST

### Infraestructura
- [x] nexcard.cl activo
- [x] HTTPS OK
- [x] CI/CD desde GitHub → Vercel
- [ ] Vercel billing configurado

### Pagos
- [x] MP sandbox funcional
- [ ] MP producción activo
- [ ] Primer pago real procesado

### Producto
- [x] Flujo completo checkout funciona
- [x] Emails de confirmación llegan
- [x] Admin muestra datos reales
- [ ] Test en iPhone (flujo móvil)

### Legal
- [x] T&C en /terminos
- [x] Privacidad en /privacidad
- [x] Links correctos en checkout

---

## 🧪 SMOKE TEST FINAL

Antes de lanzar oficialmente:
- [ ] Abrir nexcard.cl → ver Coming Soon
- [ ] Abrir nexcard.cl/preview → ver landing
- [ ] Agregar producto al carrito
- [ ] Completar checkout con MP producción
- [ ] Verificar email de confirmación llega
- [ ] Verificar orden aparece en /admin/orders
- [ ] Verificar webhook actualizó payment_status a paid
- [ ] Test en iPhone con Safari

---

## ⚠️ RIESGOS IDENTIFICADOS

- MP en TEST — no procesa dinero real hasta cambiar token
- Trial Vercel expira — agregar tarjeta de pago
- via.placeholder.com en avatares — servicio externo puede caer
- Admin whitelist en código — no escala a más admins fácilmente

---

## 👤 Responsable
Owner: Carlos Alvarez  
WhatsApp: +56993183021  
Email: hola@nexcard.cl  
Proyecto: NexCard  

---

## 📊 Métricas actuales
- Órdenes en sistema: 2
- Perfiles activos: 5
- Emails en waitlist: 1+
- Revenue cobrado: $419.980 (pruebas)
