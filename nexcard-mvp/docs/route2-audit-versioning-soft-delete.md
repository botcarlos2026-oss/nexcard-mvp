# NexCard — Ruta 2: Audit log, versionado y soft delete

## Objetivo
Diseñar la siguiente capa de resiliencia operativa de NexCard:
- audit log
- versionado de perfiles
- soft delete

Esto no reemplaza seguridad de acceso.
La complementa con trazabilidad y restauración.

---

# 1. Por qué esta ruta importa

## Riesgos que resuelve
### 1. cambios accidentales
Un perfil o contenido se edita mal y no hay vuelta atrás.

### 2. borrados operativos
Sin soft delete, recuperar una entidad puede ser costoso o imposible.

### 3. migraciones imperfectas
Sin snapshots/versionado/auditoría es difícil reconstruir qué cambió.

### 4. soporte y accountability
Si un admin, owner u operador cambia algo sensible, debe existir traza.

---

# 2. Componentes de Ruta 2

## 2.1 `audit_log`
Registro inmutable de acciones relevantes.

## 2.2 `profile_versions`
Snapshots de perfiles para restaurar estados anteriores.

## 2.3 `deleted_at`
Soft delete en entidades críticas.

---

# 3. `audit_log` — diseño recomendado

## Tabla sugerida
`public.audit_log`

## Campos recomendados
- `id uuid pk`
- `actor_user_id uuid nullable`
- `actor_role text nullable`
- `entity_type text not null`
- `entity_id uuid not null`
- `action text not null`
- `before jsonb nullable`
- `after jsonb nullable`
- `context jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

## Qué registrar
### Acciones mínimas
- `insert`
- `update`
- `delete`
- `restore`
- `assign`
- `revoke`
- `replace`
- `role_change`

## Entidades mínimas
- `profiles`
- `cards`
- `memberships`
- `orders`
- `payments`
- `content_blocks`
- `inventory_items`

---

# 4. `profile_versions` — diseño recomendado

## Tabla sugerida
`public.profile_versions`

## Campos recomendados
- `id uuid pk`
- `profile_id uuid not null`
- `version integer not null`
- `snapshot jsonb not null`
- `created_by uuid nullable`
- `created_at timestamptz not null default now()`

## Cuándo crear snapshot
- antes de update relevante
- antes de archivado
- antes de restore
- opcionalmente antes de cambio masivo de branding/contenido

## Restauración
La restauración ideal no destruye historial.
Debe:
1. tomar una versión previa
2. crear nueva versión actual como snapshot de seguridad
3. aplicar estado restaurado al perfil activo
4. registrar `audit_log`

---

# 5. Soft delete — diseño recomendado

## Patrón
Agregar `deleted_at timestamptz nullable` a entidades críticas.

## Entidades prioritarias
- `profiles`
- `memberships`
- `cards`
- `orders`
- `order_items`
- `payments`
- `products`
- `organizations`
- `content_blocks`

## Regla operativa
- por defecto: no se borra físicamente
- se marca `deleted_at`
- lecturas públicas/operativas excluyen `deleted_at is not null`

## Excepciones
El borrado físico solo se usa en:
- datos transitorios técnicos
- limpieza controlada interna
- cumplimiento legal si aplica

---

# 6. Orden recomendado de implementación

## Fase R2.1 — base estructural
- crear `audit_log`
- crear `profile_versions`
- agregar `deleted_at` a tablas prioritarias

## Fase R2.2 — perfiles
- soft delete en `profiles`
- snapshots al actualizar perfil
- helper de restore

## Fase R2.3 — tarjetas
- audit de activación / revocación / reemplazo
- soft delete en `cards`

## Fase R2.4 — comercial / operación
- audit de `orders`, `payments`, `inventory`
- soft delete y trazabilidad operativa

---

# 7. Qué NO hacer

## No confiar solo en backups
Backup sirve para desastre grande.
Audit/versionado sirve para errores finos del día a día.

## No llenar audit_log con ruido inútil
No todo click merece log.
Registrar eventos operativamente relevantes.

## No versionar mal
Versionado sin estrategia puede inflar costos y complejidad.
Partir por perfiles es suficiente como primer bloque.

---

# 8. Recomendación ejecutiva

## Primer bloque correcto de Ruta 2
1. `audit_log`
2. `profile_versions`
3. `deleted_at` en `profiles`

¿Por qué?
Porque el perfil es el núcleo visible del producto.
Si puedes auditar, versionar y restaurar perfiles, ya ganas mucha resiliencia con costo razonable.

---

# 9. Conclusión
La seguridad de acceso evita intrusiones.
Ruta 2 evita que tu propio equipo o tus propios cambios rompan el producto sin capacidad de recuperación.

En NexCard, eso es lo que convierte una app funcional en un sistema operable.
