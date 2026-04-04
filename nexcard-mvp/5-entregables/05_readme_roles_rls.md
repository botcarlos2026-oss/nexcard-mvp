# NexCard — Roles, RLS y Guía de Acceso

## Resumen del sistema de roles

NexCard usa un modelo de control de acceso basado en la tabla `memberships`, que vincula un `user_id` (de `auth.users`) con una `organization_id` y un `role`. Los roles válidos son:

| Rol | Quién es | Scope |
|-----|----------|-------|
| `admin` | Operador NexCard (tú) | Acceso total a todas las organizaciones |
| `company_owner` | Dueño de una empresa cliente | Administra su org: perfiles, tarjetas, pedidos |
| `company_member` | Empleado de empresa cliente | Lee y edita solo su propio perfil dentro de la org |
| *(sin membership)* | Usuario individual | Solo accede a su propio perfil (`user_id = auth.uid()`) |

---

## Tabla por tabla: quién puede leer y escribir

### `profiles`
| Operación | Quién puede |
|-----------|-------------|
| SELECT | **Cualquiera** (sin auth) — solo perfiles con `status = 'active'` |
| INSERT / UPDATE / DELETE | El propio usuario (`user_id = auth.uid()`) · admins · company_owner · company_member de la misma org |

> Un perfil con `status = 'disabled'` o `'pending'` **no es visible públicamente**.

---

### `organizations`
| Operación | Quién puede |
|-----------|-------------|
| SELECT | **Cualquiera** (sin auth) |
| INSERT / UPDATE / DELETE | admin o company_owner de esa org |

---

### `memberships`
| Operación | Quién puede |
|-----------|-------------|
| SELECT | Solo el propio usuario (ve sus propias membresías) |
| INSERT / UPDATE / DELETE | admin o company_owner de la misma org |

> **Importante:** un usuario recién registrado **no tiene membresía**. Debe ser agregado manualmente por un admin.

---

### `orders` / `order_items` / `payments`
| Operación | Quién puede |
|-----------|-------------|
| SELECT | El dueño del pedido (`user_id`) o cualquier miembro de la org del pedido |
| INSERT / UPDATE / DELETE | El dueño o admin/company_owner de la org |

---

### `cards`
| Operación | Quién puede |
|-----------|-------------|
| SELECT / INSERT / UPDATE / DELETE | Dueño del perfil vinculado a la tarjeta, o miembro de la org vinculada |

---

### `inventory_items` / `inventory_movements`
| Operación | Quién puede |
|-----------|-------------|
| SELECT | **Cualquiera** (sin auth) |
| INSERT / UPDATE / DELETE | Solo admin o company_owner |

---

### `content_blocks`
| Operación | Quién puede |
|-----------|-------------|
| SELECT | **Cualquiera** (sin auth) |
| INSERT / UPDATE / DELETE | Solo admin |

---

### `events`
| Operación | Quién puede |
|-----------|-------------|
| SELECT | **Cualquiera** |
| INSERT | **Cualquiera** (anon permitido — para registrar clicks sin auth) |
| UPDATE / DELETE | Nadie (append-only por diseño) |

---

## Cómo crear el primer usuario admin

### Paso 1: Registrar la cuenta
Ve a `/login` en tu app y crea una cuenta con tu email real. Esto crea el registro en `auth.users`.

### Paso 2: Obtener el UUID
En el dashboard de Supabase → **Authentication → Users** → copia el UUID de tu usuario.

### Paso 3: Asignar rol admin
Ejecuta en **SQL Editor** de Supabase:

```sql
-- Reemplaza '<tu-uuid>' con el UUID copiado
INSERT INTO public.memberships (user_id, organization_id, role)
VALUES (
  '<tu-uuid>',
  'a0000000-0000-0000-0000-000000000001',  -- NexCard Operaciones (del seed)
  'admin'
);
```

### Paso 4: Vincular tu perfil demo (opcional)
```sql
UPDATE public.profiles
SET user_id = '<tu-uuid>'
WHERE slug = 'carlos-alvarez';
```

---

## Cómo crear un company_owner (cliente empresa)

```sql
-- 1. El cliente se registra en /login (crea auth.users)
-- 2. Tú ejecutas:
INSERT INTO public.memberships (user_id, organization_id, role)
VALUES (
  '<uuid-del-cliente>',
  '<uuid-de-su-organizacion>',
  'company_owner'
);
```

---

## Cómo probar las RLS en Supabase

### Opción A: SQL Editor con `set role`
```sql
-- Simular un usuario autenticado
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "<uuid-del-usuario>"}';

-- Ahora las queries respetan RLS como si ese usuario estuviera logueado
SELECT * FROM public.profiles;
```

### Opción B: Desde la app con distintas cuentas
1. Crear cuenta A (sin membresía) → verificar que solo ve su propio perfil en `/edit`
2. Crear cuenta B (admin) → verificar que `/admin` muestra todos los perfiles
3. Intentar editar perfil de A desde cuenta B sin membresía → debe fallar silenciosamente

### Opción C: Postman / curl con anon key
```bash
# Lectura pública de perfiles activos (sin auth)
curl 'https://<project-ref>.supabase.co/rest/v1/profiles?status=eq.active' \
  -H 'apikey: <anon-key>'

# Debe devolver perfiles activos del seed
```

---

## Índices recomendados (aún no aplicados)

Ejecutar en SQL Editor para mejorar performance de las políticas RLS:

```sql
CREATE INDEX IF NOT EXISTS idx_memberships_user_id    ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org_id     ON public.memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id       ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id        ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_profile_slug    ON public.events(profile_slug);
CREATE INDEX IF NOT EXISTS idx_events_created_at      ON public.events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_id         ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_profile_id       ON public.cards(profile_id);
```

---

## Flujo completo de activación de una tarjeta NFC

```
1. Cliente paga → se crea orden en `orders` (payment_status: paid)
2. Admin imprime tarjeta → se crea registro en `cards` (activation_status: unassigned)
3. Admin despacha → fulfillment_status: shipping
4. Cliente recibe y escanea QR de activación (futuro)
5. Sistema vincula cards.profile_id con el perfil del cliente
6. activation_status → activated
7. Cliente puede tocar la tarjeta NFC → redirige a /[slug]
```

---

## Variables de entorno necesarias

```env
# .env.local (frontend React)
REACT_APP_SUPABASE_URL=https://<project-ref>.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<anon-key-publica>

# Solo para scripts de server/admin (NUNCA en frontend)
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-privada>
```

> La `anon key` es pública y segura para el frontend porque las RLS la protegen.
> La `service_role key` bypasea RLS — nunca exponerla en el cliente.
