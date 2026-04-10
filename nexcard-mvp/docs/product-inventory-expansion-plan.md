# NexCard - expansión BOM operativa

## Objetivo
Pasar de consumo mínimo (PVC + NFC) a consumo operativo más real.

## Qué NO meter aquí
No mezclar esta capa con:
- descuentos empresa
- promociones
- pricing por volumen
- despacho como regla comercial

Eso pertenece a pricing / checkout / logística comercial.

## Qué sí pertenece aquí
Consumo físico por producto vendido.

## Capas recomendadas
### Capa 1 - núcleo ya activo
- Tarjetas PVC en blanco
- Chips NFC

### Capa 2 - producción
- Ribbon color YMCKO Fargo
- Laminate overlay Fargo

### Capa 3 - cumplimiento
- Cajas de embalaje individuales
- Sobres de despacho

## Siguiente diseño recomendado
La tabla `product_inventory_requirements` ya permite crecer.
Solo falta cargar mappings adicionales por producto.

## Ejemplo conceptual
### NexCard Individual
- PVC x1
- NFC x1
- Ribbon x1 (o factor técnico equivalente)
- Laminate x1
- Caja x1
- Sobre x1

### NexCard Pyme 5
- PVC x5
- NFC x5
- Ribbon x5
- Laminate x5
- Caja x5
- Sobre x5

## Nota técnica importante
Para ribbon/laminate puede convenir luego usar factores fraccionales o equivalencias por lote.
Ejemplo:
- 1 ribbon rinde 500 impresiones
- 1 laminate rinde 500 impresiones

Si se necesita ese nivel, la tabla debería evolucionar para soportar decimales o factores por rendimiento.

## Recomendación ejecutiva
Primero validar bien PVC + NFC.
Luego ampliar a cumplimiento (cajas/sobres).
Después modelar consumibles con rendimiento técnico (ribbon/laminate).
