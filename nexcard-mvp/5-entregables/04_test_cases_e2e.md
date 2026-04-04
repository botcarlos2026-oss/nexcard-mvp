# NexCard MVP — Test Cases E2E
## Versión 1.0 · Abril 2026

> Referencia para QA manual o implementación con Playwright/Cypress.
> Prerequisito: seeds del archivo `01_seeds.sql` aplicados en Supabase.

---

## TC-01 · Login exitoso

**Ruta:** `/login`
**Actor:** Usuario registrado en Supabase Auth

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Ir a `/login` | Se renderiza formulario con campos email y contraseña |
| 2 | Ingresar email válido y contraseña correcta | Campos aceptan input |
| 3 | Click "Entrar" | Botón muestra spinner (loading) |
| 4 | Auth exitosa | Redirección a `/edit` |
| 5 | Recargar `/edit` | Sigue autenticado (sesión persiste) |

**Casos negativos:**
- Email inexistente → mensaje "No encontramos una cuenta con ese correo."
- Contraseña incorrecta → mensaje "Correo o contraseña incorrectos."
- Campo vacío → formulario no envía (required nativo)
- Sin conexión → mensaje de error de red

---

## TC-02 · Registro de nueva cuenta

**Ruta:** `/login` (modo register)

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Click "¿No tienes cuenta? Regístrate" | Toggle a modo registro |
| 2 | Ingresar email nuevo + contraseña ≥8 chars | Acepta input |
| 3 | Click "Crear cuenta" | Spinner visible |
| 4 | Registro exitoso | Redirección a `/edit` o mensaje de confirmar email |
| 5 | Verificar en Supabase → auth.users | Usuario aparece con email correcto |

**Casos negativos:**
- Email ya registrado → mensaje "Este correo ya tiene una cuenta."
- Contraseña < 8 chars → mensaje "La contraseña debe tener al menos 8 caracteres."

---

## TC-03 · Editar perfil (UserEditor)

**Prerequisito:** Sesión activa, perfil vinculado en `profiles`
**Ruta:** `/edit`

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Ir a `/edit` | Carga el editor con datos del perfil desde Supabase |
| 2 | Tab "Básico" → cambiar nombre | Input editable, cambio refleja en estado local |
| 3 | Tab "Diseño" → cambiar color | Preview de color actualiza en tiempo real |
| 4 | Tab "Enlaces" → ingresar Instagram | Campo acepta texto sin @ |
| 5 | Tab "Pago" → activar toggle bancario | Aparecen campos bancarios con animación |
| 6 | Click "Guardar" | Spinner en botón → toast "Cambios guardados correctamente." |
| 7 | Verificar en Supabase → profiles | Campos actualizados con timestamp updated_at nuevo |
| 8 | Recargar `/edit` | Datos persisten desde Supabase (no desde estado local) |

**Casos negativos:**
- Sin sesión activa en `/edit` → redirige a `/login`
- Error de red al guardar → mensaje "No pudimos guardar los cambios."

---

## TC-04 · Ver perfil público

**Prerequisito:** Perfil `carlos-alvarez` en tabla `profiles` con `status = 'active'`
**Ruta:** `/carlos-alvarez`

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Ir a `/carlos-alvarez` | Carga NexCardProfile con datos del perfil |
| 2 | Verificar nombre, profesión, bio visibles | Datos coinciden con DB |
| 3 | Click "Guardar Contacto" | Se descarga archivo `.vcf` con datos del perfil |
| 4 | Click WhatsApp | Abre `wa.me/56912345678` en nueva pestaña |
| 5 | Click "Datos para transferencia" | Acordeón se expande con datos bancarios |
| 6 | Hover sobre número de cuenta → Click copiar | Toast "¡Copiado!" → portapapeles tiene el valor |
| 7 | Click compartir (Share2) | Activa `navigator.share` en móvil o sin efecto en desktop |
| 8 | Verificar `events` en Supabase | No se registra evento de view (trackClick va al mock local aún) |

**Perfil con status ≠ active:**
- `/javier-morales` (status = 'pending') → debe mostrar error "Este perfil no existe o fue desactivado."

**Slug inexistente:**
- `/slug-que-no-existe` → error 404 de Supabase → pantalla de error genérico

---

## TC-05 · Setup Wizard (onboarding)

**Ruta:** `/setup`

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Ir a `/setup` | Pantalla fullscreen paso 0 |
| 2 | Seleccionar "Uso Personal" | Avanza automáticamente al paso 1 |
| 3 | Dejar nombre vacío → Click "Siguiente" | Botón deshabilitado (no avanza) |
| 4 | Ingresar nombre → Click "Siguiente" | Avanza al paso 2 (Bio) |
| 5 | Click "Saltar este paso" (o simplemente Siguiente) | Avanza al paso 3 (Color) |
| 6 | Seleccionar color azul | Color activo con ring visual |
| 7 | Paso 4: ingresar WhatsApp | Acepta número con código país |
| 8 | Click "Crear mi NexCard" | Llama onComplete → redirige a `/edit` |
| 9 | Verificar datos en `/edit` | Nombre, color y whatsapp del wizard están cargados |

**Verificar barra de progreso:**
- Paso 0 → 1 barra activa
- Paso 4 → todas las barras activas

---

## TC-06 · Admin Dashboard

**Prerequisito:** Usuario con membership `role = 'admin'` autenticado
**Ruta:** `/admin`

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Ir a `/admin` autenticado como admin | Carga dashboard con stats desde Supabase |
| 2 | Verificar "Ingresos cobrados" | Suma de orders con payment_status = 'paid' / 100 |
| 3 | Verificar "Perfiles activos" | Count de rows en profiles |
| 4 | Verificar "Pedidos abiertos" | Count de orders con fulfillment_status ≠ 'delivered' |
| 5 | Buscar "Andrea" en filtro | Tabla filtra en tiempo real sin llamada a DB |
| 6 | Hover sobre fila → Click ojo (ver perfil) | Abre `/andrea-ruiz` en nueva pestaña |
| 7 | Hover sobre fila → Click QR | Descarga `QR_NexCard_andrea-ruiz.png` (1024x1024) |
| 8 | Ir a `/admin` sin autenticar | ⚠️ Bug conocido: actualmente NO redirige (fix pendiente) |

**Verificar pedidos recientes:**
- Aparecen los 5 últimos del seed, ordenados por fecha desc
- Monto formateado en CLP sin decimales

---

## TC-07 · Inventario

**Prerequisito:** Seeds aplicados, usuario admin autenticado
**Ruta:** `/admin/inventory`

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Ir a `/admin/inventory` | Carga tabla con 7 ítems del seed |
| 2 | Verificar KPI "Valorización stock" | Suma correcta de stock × cost_cents/100 |
| 3 | Verificar KPI "Capacidad de impresión" | Suma de stock donde category = 'Tarjetas' |
| 4 | Verificar KPI "Ítems críticos" | Count donde stock ≤ min_stock |
| 5 | Identificar ribbon YMCKO (stock=3, min=2) | NO debe aparecer como crítico (3 > 2) |
| 6 | Identificar chips NFC (stock=200, min=80) | Debe aparecer en verde "OK" |
| 7 | Bloque Fargo DTC1500 al pie | Aparece con barra de vida útil al 98% |
| 8 | Click "Registrar entrada/compra" | ⚠️ Botón sin handler (fix pendiente) |

---

## TC-08 · Logout y protección de sesión

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | En `/edit` → Click ícono logout | Llama `supabase.auth.signOut()` |
| 2 | Redirige a `/login` | Formulario vacío, sin datos de sesión |
| 3 | Intentar ir a `/edit` | Redirige a `/login` |
| 4 | Verificar `localStorage` | `nexcard_auth` eliminado |
| 5 | Verificar en Supabase | Sesión invalidada en auth.sessions |

---

## TC-09 · Landing Page

**Ruta:** `/`

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| 1 | Ir a `/` | Carga LandingPage con contenido de Supabase (si hay CMS) o fallback |
| 2 | Sin content_block en DB | Usa `defaultLandingContent` del código |
| 3 | Con content_block en DB | Usa contenido del CMS (tras aplicar `02_cms_content_blocks.sql`) |
| 4 | Click "Personalizar mi NexCard" | Redirige a `/setup` |
| 5 | Click "Ingresar al Panel" (nav) | Redirige a `/login` |
| 6 | Click botón WhatsApp flotante | Abre wa.me en nueva pestaña |

---

## Matriz de Cobertura

| Feature | Smoke | Happy Path | Edge Cases | Bug conocido |
|---------|-------|------------|------------|--------------|
| Login / Register | ✅ | ✅ | ✅ | Register no llama supaRegister |
| Setup Wizard | ✅ | ✅ | Parcial | Sin generación de slug |
| Editar perfil | ✅ | ✅ | ✅ | Avatar sube a blob local |
| Perfil público | ✅ | ✅ | ✅ | trackClick no llega a Supabase |
| Admin dashboard | ✅ | ✅ | Parcial | Sin protección de ruta admin |
| Inventario | ✅ | ✅ | Parcial | Botón agregar sin handler |
| Landing CMS | ✅ | Parcial | — | — |
| Logout | ✅ | ✅ | ✅ | — |
