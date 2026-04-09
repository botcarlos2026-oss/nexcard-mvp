# NexCard — Opción 3: visibilidad admin para historial/restore de perfiles

## Objetivo
Hacer visible desde admin que `profiles` ya tiene:
- snapshots
- soft delete
- restore posible
- audit trail

Sin convertir todavía esto en una consola compleja.

---

# 1. Recomendación de integración

## Ruta nueva recomendada
- `/admin/profiles`

### Por qué
- evita sobrecargar el dashboard principal
- mantiene separado el lifecycle de perfiles del lifecycle de cards
- permite escalar luego a restore UI sin contaminar la home admin

---

# 2. Dataset mínimo útil

## Por perfil
- `id`
- `slug`
- `full_name`
- `status`
- `deleted_at`
- `updated_at`
- cantidad de versiones en `profile_versions`
- último evento en `audit_log` relevante a `profile`

---

# 3. Qué debe poder ver admin en esta fase

## Lista mínima
- perfil
- estado
- si está archivado o no
- si tiene historial
- último cambio relevante

## No hace falta todavía
- restore desde botón
- diff visual entre versiones
- timeline complejo

---

# 4. Qué vendría después

## Iteración siguiente
- ver lista de versiones por perfil
- botón restore con confirmación fuerte
- auditoría más visible

---

# 5. Recomendación ejecutiva

El valor ahora no está en construir una gran consola de restore.
Está en hacer visible lo que ya existe, para que la capacidad no quede escondida en SQL manual.
