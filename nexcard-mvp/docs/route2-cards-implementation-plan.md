# NexCard — Route 2.3 implementation plan (Cards)

## Objetivo
Llevar el patrón de resiliencia a `cards` sin sobrecargar la primera iteración.

---

# Entregables mínimos
- `snapshot_card()`
- `soft_delete_card()`
- `revoke_card()`
- trazabilidad en `audit_log`
- lifecycle en `card_events`

---

# Por qué esta fase es valiosa
## Antes
- cambios de estado de tarjeta pueden quedar sin historia consistente
- revocaciones pueden hacerse ad hoc
- archivado puede ser ambiguo

## Después
- snapshots de tarjeta
- revocación formal
- archivado formal
- rastro en dos capas: `audit_log` + `card_events`

---

# Siguiente prueba sugerida después de aplicar
## Tarjeta de prueba recomendada
Usar una tarjeta no crítica / de test.

## Flujo
1. snapshot/revoke una tarjeta de prueba
2. revisar estado final en `cards`
3. revisar `card_events`
4. revisar `audit_log`

---

# Riesgo conocido
Aún no existe `restore_card()`.

## Decisión actual
Está bien no implementarlo todavía.
El mayor valor inicial en tarjetas está en:
- snapshot
- revocar
- archivar

Restore de tarjetas puede venir después, según necesidad real.

---

# Recomendación ejecutiva
Después de aplicar esta fase, el siguiente paso lógico será endurecer aún más la resolución NFC para excluir de forma explícita tarjetas archivadas/revocadas ya desde las funciones/bridge productivo.
