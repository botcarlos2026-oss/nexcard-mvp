# NexCard - rollout simple para SKU real en inventario

## Objetivo
Dejar de depender de match textual entre `order_items` e `inventory_items`.

## Estado actual
Hoy la app:
- muestra SKU si existe
- intenta reservar por SKU primero
- cae a nombre si no encuentra match

Eso mejora MVP, pero no es modelo final.

## Siguiente salto correcto
### 1. Schema
Agregar columna real en `public.inventory_items`:
```sql
alter table public.inventory_items add column if not exists sku text;
create index if not exists idx_inventory_items_sku on public.inventory_items (sku);
```

### 2. Backfill inicial
Completar `sku` para cada item crítico de inventario.
Ejemplo operativo:
- tarjetas pvc → `CARD-PVC`
- chip nfc ntag215 → `NFC-NTAG215`
- ribbon fargo → `RIBBON-FARGO`
- caja embalaje → `BOX-STD`

### 3. Disciplina comercial
Asegurar que `order_items.sku` venga informado en los pedidos relevantes.

### 4. Endurecimiento de reserva
Una vez cargado SKU en inventario:
- reservar por igualdad exacta de SKU
- usar nombre solo como fallback temporal
- luego eliminar fallback difuso

## Beneficio
- menos errores operativos
- mejor trazabilidad
- mejor base para margen y compras

## Recomendación
Aplicar junto con la función SQL de `inventory-rpc-and-sku-next-step.sql`.
