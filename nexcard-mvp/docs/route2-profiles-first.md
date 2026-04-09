# NexCard — Ruta 2.2: Profiles first

## Objetivo
Convertir `profiles` en la primera entidad realmente:
- versionada
- auditable
- restaurable
- compatible con soft delete

---

# 1. Por qué empezar por perfiles

El perfil es:
- la cara pública del producto
- el activo editable más frecuente
- el punto donde un error humano tiene impacto visible inmediato

Si puedes:
- auditar cambios de perfil
- restaurar un estado anterior
- archivar sin borrar físicamente

entonces ya tienes una gran mejora operativa con relativamente poco acoplamiento.

---

# 2. Qué debe pasar en un update de perfil

## Flujo ideal
1. identificar perfil actual
2. guardar snapshot previo en `profile_versions`
3. aplicar update al perfil activo
4. registrar `audit_log`
5. devolver estado final

## Beneficio
Si el cambio sale mal, puedes volver atrás.

---

# 3. Qué debe pasar en un restore

## Flujo ideal
1. seleccionar una versión histórica
2. guardar snapshot del estado actual como nueva versión de seguridad
3. restaurar snapshot elegido sobre `profiles`
4. registrar `audit_log` con acción `restore`

## Beneficio
Restaurar no destruye historia.
Siempre deja rastro.

---

# 4. Qué debe pasar en soft delete

## Regla
No borrar físicamente `profiles` por defecto.

## Acción
- set `deleted_at = now()`
- opcionalmente `status = 'archived'`
- registrar `audit_log`

## Lectura pública
Perfiles archivados o con `deleted_at` no deben aparecer en rutas públicas.

---

# 5. Estrategia de implementación

## Paso 1 — funciones SQL helper
Crear funciones para:
- snapshot de perfil
- restore de perfil
- soft delete de perfil

## Paso 2 — ajustar acceso/aplicación
Que el flujo de edición pase por helpers o por una disciplina consistente.

## Paso 3 — ajustar lecturas
Añadir `deleted_at is null` en lecturas públicas y privadas relevantes.

---

# 6. Qué NO haría aún

## No triggerizar todo desde el día 1
Los triggers son potentes, pero pueden volver opaca la lógica si entran demasiado pronto.

## Recomendación
Primero dejar funciones explícitas y claras.
Luego, si conviene, evolucionar a triggers.

---

# 7. SQL recomendado para esta fase

## Helpers mínimos
- `snapshot_profile(profile_id, actor_user_id)`
- `restore_profile_version(profile_id, version, actor_user_id)`
- `soft_delete_profile(profile_id, actor_user_id)`

## Consideración
Como `profiles` tiene muchas columnas, la estrategia más práctica es guardar snapshot completo en JSONB y restaurar campo a campo solo de la entidad relevante.

---

# 8. Audit mínimo recomendado para perfiles

## Acciones
- `profile_update`
- `profile_restore`
- `profile_soft_delete`

## Contexto útil
- razón del cambio si existe
- origen (`editor`, `admin`, `system`)
- versión restaurada si aplica

---

# 9. Lecturas que deben excluir archivados

## Público
- perfil por slug

## Owner
- mi perfil

## Admin
- puede ver todo o diferenciar activos/archivados, según producto

---

# 10. Recomendación ejecutiva

El siguiente bloque correcto después de `route2_foundation.sql` es:
1. crear helpers de snapshot/restore/soft delete para perfiles
2. ajustar consultas de perfil para excluir `deleted_at`
3. luego recién pensar en llevar el mismo patrón a tarjetas y órdenes

---

# 11. Conclusión
Si `profiles` se vuelve la primera entidad realmente restaurable, NexCard gana una capacidad operativa clave:
no solo proteger acceso, sino también recuperarse de errores sin caos.
