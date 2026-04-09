# NexCard — Route 2.2.2 minimal restore

## Objetivo
Completar el circuito mínimo de perfiles:
- snapshot
- soft delete
- restore

## Enfoque
Mantener restore simple y explícito.
No triggerizar todavía.
No intentar generalizar a todas las entidades aún.

---

# Qué hace `restore_profile_version()`
1. carga un snapshot histórico desde `profile_versions`
2. toma snapshot del estado actual antes de restaurar
3. restaura campos relevantes sobre `profiles`
4. limpia `deleted_at`
5. registra `audit_log`

---

# Por qué esta versión es aceptable
- el perfil ya está validado como primera entidad de Ruta 2
- el costo de mantener la lista explícita de columnas es tolerable hoy
- la ganancia operativa de restore supera esa deuda

---

# Riesgo conocido
Si `profiles` cambia de esquema, esta función debe actualizarse.

## Mitigación
Mantenerla bajo control de migraciones y revisión cuando cambie la tabla.

---

# Resultado esperado
Al validar esta función, NexCard ya tendrá una capacidad real de recuperación de perfil de punta a punta.
