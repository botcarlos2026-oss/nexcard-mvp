# Limpieza de warnings de lint — 2026-08-11

## Estado

OK técnico.

`npm run lint` queda en 0 errores / 0 warnings después de limpiar deuda no bloqueante detectada en frontend.

## Warnings corregidos

### 1. `src/components/CheckoutForm.jsx`

Warning original:

```text
117:15  warning  'acceptTerms' is assigned a value but never used  no-unused-vars
```

Causa:

- `acceptTerms` se extraía desde `formData` solo para excluirlo del objeto persistido en `sessionStorage`.
- La lógica era correcta, pero ESLint lo detectaba como variable asignada y no usada.

Resolución:

```js
const { acceptTerms: _acceptTerms, ...persistable } = formData;
```

Motivo:

- Mantiene el comportamiento esperado: no persistir aceptación de términos.
- Marca explícitamente el descarte intencional con prefijo `_`, permitido por la regla ESLint del proyecto.

### 2. `src/components/LandingPage.jsx`

Warning original:

```text
2:22  warning  'BadgeCheck' is defined but never used  no-unused-vars
```

Causa:

- `BadgeCheck` estaba importado desde `lucide-react`, pero no se usaba en el componente.

Resolución:

- Se eliminó `BadgeCheck` del import.

Motivo:

- Limpieza directa de import muerto, sin impacto funcional.

### 3. `src/components/OrderConfirmation.jsx`

Warning original:

```text
4:52  warning  'onContinueShopping' is defined but never used  no-unused-vars
```

Causa:

- `AppRouteRenderer.jsx` pasaba `onContinueShopping={handleBackToShop}` a `OrderConfirmation`.
- `OrderConfirmation` recibía la prop, pero no la usaba en su UI ni lógica.

Resolución:

- Se eliminó la prop del llamado en `AppRouteRenderer.jsx`.
- Se eliminó la prop de la firma de `OrderConfirmation`.

Motivo:

- Evita mantener un contrato muerto.
- No cambia el flujo visible porque no existía acción asociada a esa prop dentro de `OrderConfirmation`.

## Verificación

Comando ejecutado:

```bash
npm run lint
```

Resultado:

```text
status=0
warnings=0
errors=0
```

Log local:

```text
/tmp/nexcard-lint-clean-doc-20260811234225.log
```

## Nota de alcance

Durante la revisión de diff se observó un cambio adicional ya presente en `src/components/CheckoutForm.jsx` relacionado con el envío de `clientCheckoutAttemptId` y `clientCheckoutFingerprint` a `create-mp-preference`. Ese cambio no forma parte de esta limpieza de warnings y no fue modificado por esta documentación.
