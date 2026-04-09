# NexCard — Route 2.2 implementation plan (Profiles first)

## Objetivo
Llevar la foundation de Ruta 2 a un primer caso real: `profiles`.

---

# Entregables de esta fase

## SQL / DB
- `snapshot_profile()`
- `soft_delete_profile()`
- `restore_profile_version()`

## Operación
- snapshots previos a restauración
- audit de restore
- audit de soft delete

## App / backend (siguiente paso)
- usar snapshot explícito antes de cambios importantes
- excluir `deleted_at` de lecturas públicas
- agregar opción futura de restore/admin

---

# Beneficio operativo inmediato

## Antes
- cambios de perfil sin retorno formal
- archivado manual/ambiguo
- soporte sin historia confiable

## Después
- historial de snapshots
- restore reproducible
- soft delete consistente
- audit trail de cambios sensibles

---

# Riesgos conocidos

## Riesgo 1
La función de restore lista explícitamente campos de `profiles`.

### Implicancia
Si agregas nuevas columnas al perfil en el futuro, debes mantener esta función actualizada.

### Aceptable hoy
Sí, porque el beneficio operativo supera el costo y la tabla aún es manejable.

## Riesgo 2
No todas las actualizaciones de perfil pasarán automáticamente por snapshot si la app no usa los helpers todavía.

### Implicancia
Esta fase deja la base lista, pero no garantiza uso total hasta integrar la lógica de app/backend.

---

# Siguiente paso recomendado después de aplicar

## Paso 1
validar que las funciones existen

## Paso 2
hacer una prueba manual:
- snapshot perfil
- editar perfil
- restaurar versión

## Paso 3
ajustar consultas públicas/owner para excluir `deleted_at`

---

# Recomendación ejecutiva
Esta fase no es todavía automatización completa.
Es la primera capacidad real de recuperación de perfil.

Y para NexCard eso ya es una mejora material del sistema.
