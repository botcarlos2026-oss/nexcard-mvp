# NexCard — Route 2.2.1 minimal

## Objetivo
Recuperar momentum de Ruta 2 con una versión mínima, verificable y robusta:
- `snapshot_profile(profile_id, actor_id)`
- `soft_delete_profile(profile_id, actor_id)`

Se deja `restore_profile_version()` para la siguiente iteración.

---

# Por qué esta versión
La versión anterior intentó resolver snapshot + soft delete + restore en una sola pasada.
Eso aumentó superficie de fallo.

La estrategia correcta ahora es:
1. validar snapshot
2. validar soft delete
3. después agregar restore

---

# Qué entrega esta fase

## `snapshot_profile()`
- guarda snapshot actual del perfil
- incrementa versión
- escribe `audit_log`
- devuelve número de versión creada

## `soft_delete_profile()`
- guarda snapshot previo
- marca `deleted_at`
- escribe `audit_log`

---

# Beneficio
Aunque todavía no exista restore, ya obtienes:
- versionado vivo
- trazabilidad viva
- archivado lógico consistente

Y eso permite seguir avanzando sin quedarte bloqueado por una función más compleja.

---

# Siguiente paso después de validar
Una vez comprobado que `snapshot_profile()` funciona, el siguiente paso es crear:
- `restore_profile_version()`

con pruebas controladas sobre un perfil real de test.
