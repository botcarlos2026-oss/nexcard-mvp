# NexCard — Opción C: Diseño productivo serio

## Objetivo
Definir la arquitectura objetivo de NexCard para salir del MVP y operar como producto durable, seguro y escalable.

Este documento cubre cinco bloques:
1. auth / roles
2. perfiles
3. tarjetas NFC
4. audit log / versionado / soft delete
5. backups / migraciones / operación

---

# 1. Principios de diseño

## 1.1 Seguridad primero, UX segundo, conveniencia tercera
En un producto de identidad digital, una brecha de autorización destruye confianza más rápido que cualquier bug visual.

## 1.2 Público, owner y admin son dominios distintos
Nunca mezclar:
- lectura pública
- edición del dueño
- operación administrativa

Cada dominio debe tener:
- rutas separadas
- queries separadas
- policies separadas
- métricas separadas

## 1.3 La tarjeta NFC no representa al usuario: representa un activo emitido
La tarjeta física debe modelarse como entidad propia (`cards`), no como simple alias del perfil.

## 1.4 Historial por defecto
Todo lo importante debe ser:
- auditable
- restaurable
- reversible

## 1.5 Cambios de esquema sin migración formal = deuda operacional
Toda evolución productiva debe pasar por migraciones versionadas y rollback plan.

---

# 2. Arquitectura objetivo

## 2.1 Capas

### Capa pública
- landing
- perfil público por slug
- resolución NFC pública controlada
- tracking anónimo

### Capa autenticada owner
- edición de perfil propio
- visualización de métricas propias
- gestión de links/contactos
- visualización de órdenes propias
- visualización de tarjetas propias

### Capa autenticada organization
- gestión multiusuario por organización
- visibilidad de recursos por tenancy
- operadores y owners con capacidades diferenciadas

### Capa admin
- dashboard global
- inventario
- órdenes globales
- cards globales
- contenido/cms
- soporte y auditoría

### Capa privilegiada backend
- webhooks de pagos
- emisión de tarjetas
- reconciliación
- migraciones
- procesos de auditoría / mantenimiento

---

# 3. Auth / roles

## 3.1 Fuente de verdad
- autenticación: `auth.users` (Supabase Auth)
- autorización: `memberships`
- privilegios globales: roles en `memberships`

## 3.2 Roles recomendados

### `admin`
Acceso global operativo.
Uso limitado a equipo interno.

### `company_owner`
Dueño o responsable principal de una organización.
Puede administrar perfiles y activos de su organización.

### `operator`
Rol operativo interno de la organización.
Puede gestionar parte de la operación, no todo.

### `member`
Usuario estándar con acceso a su propio perfil y recursos asignados.

## 3.3 Reglas
- un usuario puede tener múltiples memberships
- el scope de privilegios vive en `organization_id`
- `admin` puede mantenerse como rol global sin `organization_id`, o con org interna especial
- no usar emails hardcodeados para privilegios

## 3.4 Helpers recomendados
- `has_role(text)`
- `is_org_member(uuid)`
- `has_org_role(org_id, role)`
- `is_profile_owner(profile_id)`

---

# 4. Modelo de datos objetivo

## 4.1 organizations
Representa cuentas empresa, equipos o tenants.

Campos recomendados:
- `id uuid pk`
- `name text`
- `slug text unique`
- `status text` (`active`, `suspended`, `archived`)
- `plan text`
- `created_at`
- `updated_at`
- `deleted_at nullable`

## 4.2 memberships
Une usuarios autenticados con organizaciones y roles.

Campos recomendados:
- `id uuid pk`
- `user_id uuid -> auth.users.id`
- `organization_id uuid -> organizations.id`
- `role text`
- `status text` (`active`, `invited`, `revoked`)
- `created_at`
- `updated_at`
- `deleted_at nullable`

## 4.3 profiles
Perfil visible de una persona o entidad.

Campos recomendados:
- `id uuid pk`
- `user_id uuid nullable` (permite perfiles administrados por org)
- `organization_id uuid nullable`
- `slug text unique`
- `full_name text`
- `display_name text`
- `profession text`
- `company text`
- `bio text`
- `location text`
- `avatar_url text`
- `cover_image_url text`
- `theme_color text`
- `is_dark_mode boolean`
- `status text` (`draft`, `active`, `paused`, `archived`)
- `account_type text`
- `published_at timestamptz nullable`
- `created_at`
- `updated_at`
- `deleted_at nullable`
- `version integer default 1`

## 4.4 profile_links
Separar links/contact methods del perfil reduce acoplamiento y simplifica versionado.

Campos recomendados:
- `id uuid pk`
- `profile_id uuid`
- `kind text` (`whatsapp`, `instagram`, `linkedin`, `email`, `phone`, `website`, `calendar`, `portfolio`, etc.)
- `value text`
- `enabled boolean`
- `sort_order integer`
- `created_at`
- `updated_at`
- `deleted_at nullable`

## 4.5 cards
Activo NFC emitido por la empresa.

Campos recomendados:
- `id uuid pk`
- `organization_id uuid`
- `profile_id uuid nullable`
- `order_id uuid nullable`
- `card_code text unique`
- `public_token text unique`
- `status text` (`printed`, `assigned`, `active`, `suspended`, `revoked`, `lost`)
- `activation_status text`
- `issued_at timestamptz`
- `assigned_at timestamptz nullable`
- `revoked_at timestamptz nullable`
- `replaced_by_card_id uuid nullable`
- `metadata jsonb`
- `created_at`
- `updated_at`
- `deleted_at nullable`

### Nota crítica
La tarjeta debe resolver por `public_token`, no por `profile.slug` directo.

Ruta objetivo:
- `/c/:public_token`

Eso permite:
- revocación
- reasignación
- tracking por tarjeta
- detección de anomalías
- resiliencia ante cambios futuros de routing

## 4.6 card_scans
Tabla específica para eventos NFC.

Campos recomendados:
- `id uuid pk`
- `card_id uuid`
- `profile_id uuid nullable`
- `country text nullable`
- `city text nullable`
- `ip_hash text nullable`
- `user_agent text nullable`
- `source text`
- `created_at`

Uso:
- detectar clones
- patrones de abuso
- métricas por tarjeta

## 4.7 orders
Orden comercial.

Campos recomendados:
- `id uuid pk`
- `user_id uuid nullable`
- `organization_id uuid nullable`
- `customer_name text`
- `customer_email text`
- `status text`
- `payment_status text`
- `fulfillment_status text`
- `amount_cents bigint`
- `currency text`
- `created_at`
- `updated_at`
- `deleted_at nullable`

## 4.8 order_items
Componentes de la orden.

Campos recomendados:
- `id uuid pk`
- `order_id uuid`
- `product_id uuid`
- `quantity integer`
- `unit_price_cents bigint`
- `currency text`
- `created_at`
- `updated_at`
- `deleted_at nullable`

## 4.9 payments
Pagos y conciliación.

Campos recomendados:
- `id uuid pk`
- `order_id uuid`
- `provider text`
- `status text`
- `amount_cents bigint`
- `currency text`
- `external_id text`
- `payload jsonb`
- `processed_at timestamptz nullable`
- `created_at`
- `updated_at`
- `deleted_at nullable`

## 4.10 inventory_items / inventory_movements
Correcto mantener separación:
- stock actual
- movimientos

Agregar idealmente:
- `organization_id nullable`
- `movement_type`
- `reference_type`
- `reference_id`
- `performed_by`

## 4.11 content_blocks
Correcto para CMS simple, pero idealmente sumar:
- `status text` (`draft`, `published`, `archived`)
- `version integer`
- `published_at`
- `updated_by`

---

# 5. Modelo de permisos objetivo

## 5.1 Público
Puede leer solamente:
- landing publicada
- perfiles activos
- productos activos
- resolución pública de tarjeta
- tracking anónimo de eventos permitidos

## 5.2 Owner
Puede:
- ver/editar su perfil
- ver sus órdenes
- ver sus pagos asociados
- ver sus tarjetas asignadas
- ver métricas propias

## 5.3 Organization owner / operator
Puede:
- ver perfiles de su organización
- ver tarjetas de su organización
- ver órdenes de su organización
- eventualmente operar inventario si el modelo lo requiere

## 5.4 Admin
Puede:
- ver todo
- operar todo
- auditar todo

## 5.5 Service role / backend
Solo para:
- webhooks
- procesos batch
- conciliación
- emisión de tarjetas
- mantenimiento

Nunca desde frontend.

---

# 6. NFC: diseño serio

## 6.1 Flujo recomendado
1. teléfono escanea tarjeta
2. abre `/c/:public_token`
3. backend resuelve tarjeta
4. valida estado (`active`, no revocada)
5. registra scan
6. redirige a perfil activo asociado

## 6.2 Ventajas
- URL estable a largo plazo
- tarjeta desacoplada del perfil
- posibilidad de cambiar perfil asociado
- posibilidad de revocar tarjeta sin cambiar arquitectura web

## 6.3 Señales de anomalía
Detectar si:
- misma tarjeta se usa en múltiples países en poco tiempo
- volumen de escaneos supera umbral razonable
- user agents incompatibles con uso esperado

## 6.4 Respuesta a incidente
Tarjeta marcada como:
- `suspended`
- `revoked`
- `replaced`

Y el endpoint `/c/:public_token` responde:
- landing segura
- mensaje de tarjeta no disponible
- opcionalmente contacto de soporte

---

# 7. Audit log / versionado / soft delete

## 7.1 Audit log inmutable
Tabla sugerida: `audit_log`

Campos:
- `id uuid pk`
- `actor_user_id uuid nullable`
- `actor_role text nullable`
- `entity_type text`
- `entity_id uuid`
- `action text` (`insert`, `update`, `delete`, `restore`, `assign`, `revoke`)
- `before jsonb nullable`
- `after jsonb nullable`
- `context jsonb`
- `created_at`

## 7.2 Versionado de perfiles
Tabla sugerida: `profile_versions`

Campos:
- `id uuid pk`
- `profile_id uuid`
- `version integer`
- `snapshot jsonb`
- `created_by uuid nullable`
- `created_at`

Crear snapshot en:
- cambios de contenido
- cambios de links
- activación / archivado

## 7.3 Soft delete
Aplicar `deleted_at` a:
- profiles
- memberships
- cards
- orders
- order_items
- payments
- products
- organizations

Regla:
- no hacer `delete` físico por defecto
- solo archivado lógico

## 7.4 Restauración
Toda entidad crítica debe poder restaurarse por:
- snapshot
- version history
- soft delete revert

---

# 8. Backups / migraciones / operación

## 8.1 Regla 3-2-1
- 3 copias
- 2 medios distintos
- 1 fuera de sitio

## 8.2 Restore testing
Frecuencia mínima recomendada:
- mensual en staging

Probar:
- restore completo
- restore parcial de tablas críticas
- recuperación de snapshots de perfil

## 8.3 Migraciones
Usar un sistema formal:
- Supabase migrations si se estandariza ahí
- o Prisma Migrate / Flyway / Alembic, pero uno solo

Reglas:
- una migración por cambio lógico
- rollback plan
- nunca schema drift manual sin registrar

## 8.4 Ambientes
Mínimo:
- local
- staging
- production

Staging debe reflejar:
- policies
- triggers
- funciones
- migraciones reales

## 8.5 Runbooks recomendados
Crear runbooks para:
- incidente de exposición de datos
- revocación de tarjeta comprometida
- falla de migración
- restore de base
- webhook de pagos caído

---

# 9. Roadmap recomendado

## Fase C1 — Consolidación authz
- eliminar parches restantes frontend
- normalizar helpers SQL
- revisar `v_current_memberships`
- documentar permisos por rol

## Fase C2 — Modelo de perfiles serio
- separar `profile_links`
- agregar `deleted_at`
- agregar versionado
- agregar snapshots

## Fase C3 — Tarjetas NFC productivas
- agregar `public_token`
- crear endpoint `/c/:public_token`
- crear `card_scans`
- revocación y reasignación

## Fase C4 — Operación comercial seria
- endurecer pagos por backend/webhooks
- reconciliación
- emisión de tarjetas conectada a órdenes

## Fase C5 — Durabilidad operacional
- migraciones formales
- backups probados
- audit log
- runbooks

---

# 10. Decisiones concretas recomendadas

## Decisión 1
No exponer nunca `payments`, `cards`, `inventory`, `memberships` al público.

## Decisión 2
La ruta pública de NFC debe depender de `cards.public_token`, no de `profiles.slug`.

## Decisión 3
Toda escritura sensible futura debe pasar por backend privilegiado o funciones controladas, no directo desde frontend.

## Decisión 4
Los perfiles deben tener historial restaurable.

## Decisión 5
Toda entidad crítica debe soportar soft delete.

---

# 11. Riesgos si no se implementa Opción C

## Riesgo comercial
Emitir miles de tarjetas sobre una arquitectura frágil encarece cada cambio futuro.

## Riesgo reputacional
Un error de acceso cruzado en identidad digital destruye confianza.

## Riesgo operativo
Sin audit/versionado/backups probados, un cambio mal hecho puede costar días de recuperación.

## Riesgo financiero
Arreglar arquitectura después de escalar siempre sale más caro que diseñarla antes.

---

# 12. Conclusión
La arquitectura actual ya quedó bastante más segura tras B.1, B.2 y B.3.
Pero para escalar NexCard como producto real, el siguiente salto no es una policy más: es consolidar el modelo de negocio y operación en torno a:
- tenancy claro
- tarjetas como activo propio
- historial y restauración
- pagos y emisión por backend seguro
- migraciones y backups formales

Esa es la base correcta para crecer sin hipotecar seguridad ni margen.
