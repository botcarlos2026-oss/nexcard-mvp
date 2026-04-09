# NexCard — Especificación de implementación del endpoint `/c/:public_token`

## Objetivo
Bajar el Camino B a una especificación concreta de implementación para el repo actual.

---

# 1. Alcance inicial (v1)

## Lo que sí hace
- recibe `public_token`
- resuelve tarjeta
- valida estado
- obtiene perfil asociado
- redirige a `/:slug`

## Lo que no hace todavía
- geolocalización avanzada
- risk scoring sofisticado
- panel de anomalies
- auto-suspensión

---

# 2. Endpoint

## Método
`GET /c/:publicToken`

## Ubicación inicial
`server/index.js`

---

# 3. Contrato funcional

## Caso 1 — tarjeta activa y perfil válido
### Input
- token válido

### Acción
- buscar tarjeta por token
- validar `status = active`
- buscar perfil asociado
- redirigir a `/${profile.slug}`

### Output
- HTTP 302

## Caso 2 — tarjeta activa pero sin perfil
### Acción
- responder mensaje de activación pendiente

### Output
- HTTP 409 o 200 con pantalla controlada

## Caso 3 — tarjeta no válida
### Acción
- responder “tarjeta no disponible”

### Output
- HTTP 404 o 410 según caso

---

# 4. Mock/local mode

## Necesidad
El backend local actual usa `db.json`.

## Recomendación
Agregar a `db.json` y `seed.json`:
- `cards`

Y si quieres algo mínimo:
- `card_scans`

## Mock shape recomendado
```json
{
  "cards": [
    {
      "id": "card-1",
      "profile_id": "profile-1",
      "public_token": "demo-token-123",
      "status": "active"
    }
  ]
}
```

---

# 5. Pseudocódigo sugerido

```js
app.get('/c/:publicToken', (req, res) => {
  const db = readDb();
  const card = db.cards.find(c => c.public_token === req.params.publicToken);

  if (!card) {
    return res.status(404).send('Tarjeta no encontrada');
  }

  if (['revoked', 'lost', 'archived', 'replaced'].includes(card.status)) {
    return res.status(410).send('Tarjeta no disponible');
  }

  if (!card.profile_id) {
    return res.status(409).send('Tarjeta pendiente de activación');
  }

  const profile = db.profiles.find(p => p.id === card.profile_id && p.status === 'active');

  if (!profile) {
    return res.status(404).send('Perfil no disponible');
  }

  return res.redirect(`/${profile.slug}`);
});
```

---

# 6. Registro de scans

## V1 mínima
Si existe `db.card_scans`, registrar:
- `card_id`
- `profile_id`
- `created_at`
- `user_agent`

## V2 productiva
Insert en `public.card_scans` vía backend seguro.

---

# 7. HTTP semantics recomendadas

## `302 Found`
Para redirect normal a perfil.

## `404 Not Found`
Para token inexistente.

## `410 Gone`
Para tarjeta revocada/reemplazada/perdida.

## `409 Conflict`
Para tarjeta pendiente o inconsistente.

---

# 8. UX recomendada

## No devolver JSON para usuarios finales
Si el endpoint es público/NFC, mejor responder:
- redirect
- HTML simple segura

## Mensajes sugeridos
### 404
"Esta tarjeta no existe o ya no está disponible."

### 410
"Esta tarjeta fue desactivada. Si necesitas ayuda, contacta soporte."

### 409
"Esta tarjeta aún no está lista para usarse."

---

# 9. Roadmap técnico

## V1
- route local express
- redirect por token
- mensajes mínimos

## V2
- resolver por Supabase real
- insertar `card_scans`
- página bonita de estados inválidos

## V3
- risk score
- alertas
- panel admin

---

# 10. Decisión recomendada
Implementar primero el endpoint como:
- route Express pública
- redirect a slug
- sin mover todavía la vista del perfil

Esto permite validar NFC durable con el menor costo de cambio en el repo actual.
