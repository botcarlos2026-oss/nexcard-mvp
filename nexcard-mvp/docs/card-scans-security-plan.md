# NexCard — B1 para `card_scans`: diseño de acceso seguro

## Objetivo
Cerrar correctamente la seguridad de `card_scans` ahora que la telemetría NFC ya está viva.

Hoy `card_scans`:
- existe
- recibe inserts reales
- tiene `rowsecurity = false`
- no tiene policies

Eso sirve para validación rápida, pero no es el modelo final correcto.

---

# 1. Principio de diseño

`card_scans` no es una tabla pública de lectura general.
Contiene telemetría operativa y potencialmente señales de abuso/clonación.

Por lo tanto:
- **lectura pública:** no
- **escritura pública abierta:** solo si está estrictamente acotada
- **lectura admin:** sí
- **lectura por owner/org:** opcional, según producto

---

# 2. Riesgo actual

Con `rowsecurity = false` y grants amplios:
- cualquier cliente con la key adecuada podría leer más de la cuenta
- cualquier cliente podría insertar basura si conoce el esquema
- no hay separación entre telemetría válida y abuso potencial

Conclusión:
- hay que cerrar la tabla

---

# 3. Modelo recomendado de acceso

## Insert
Permitir `INSERT` para `anon` y `authenticated`, pero con `WITH CHECK` mínimo.

## Select
Permitir `SELECT` solo a:
- `admin`
- eventualmente org members más adelante si el producto lo requiere

## Update/Delete
No públicos.
Idealmente solo admin o directamente nadie desde cliente.

---

# 4. Política mínima recomendada

## Policy 1 — insert controlado
Permitir insertar únicamente si:
- `card_id is not null`
- `scan_source is not null`
- `risk_score >= 0`

No es blindaje perfecto, pero sí una primera cerca de contención.

## Policy 2 — admin read
Permitir leer solo a usuarios con rol `admin`.

## Policy 3 — admin manage opcional
Si quieres operar limpieza o correcciones desde panel interno, admin puede gestionar.

---

# 5. Decisión recomendada

## Fase actual
Aplicar:
- `enable row level security`
- `insert` controlado para `anon, authenticated`
- `select` admin-only
- `update/delete` admin-only o inexistente

## Fase futura
Si quieres mostrar métricas de scans al owner de una tarjeta/perfil:
- crear policy adicional basada en relación con `cards` / `profiles` / `memberships`

---

# 6. SQL objetivo

La idea es dejar `card_scans` en este estado:
- RLS activa
- inserción permitida de manera controlada
- lectura restringida
- admin con visibilidad total

---

# 7. Criterio de negocio

La telemetría NFC sirve para:
- detectar fraude
- detectar clonación
- entender uso real
- dar soporte

Eso la vuelve operativamente valiosa.
Y justo por eso no debe quedar abierta indefinidamente.

---

# 8. Recomendación ejecutiva

Sí conviene cerrar `card_scans` ahora.
No porque hoy esté explotando, sino porque ya dejó de ser experimento y ya está generando datos reales.
