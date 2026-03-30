# NexCard MVP

Base del producto NexCard orientada a producción gradual.

## Qué quedó implementado en esta etapa
- Frontend React conectado a una capa de API
- Login local de prueba
- Perfil público dinámico por `slug`
- Editor de perfil conectado a backend local
- Dashboard admin conectado a datos persistidos
- Inventario conectado a backend local
- Landing preparada para CMS liviano
- Servidor Express local para pruebas de flujo end-to-end

## Stack actual de desarrollo
- React 18
- TailwindCSS
- Express local para mocks persistentes
- JSON file storage para pruebas en equipo local

## Cómo correr el proyecto
```bash
cd nexcard-mvp
npm install
npm run dev
```

### Servicios
- Frontend: `http://localhost:3000`
- API local: `http://localhost:4000/api`

## Credenciales demo
- `admin@nexcard.cl` / `admin123`
- `carlos@nexcard.cl` / `demo123`

## Rutas clave
- `/` → landing
- `/login` → acceso
- `/edit` → editor del perfil autenticado
- `/admin` → dashboard de control
- `/admin/inventory` → inventario
- `/:slug` → perfil público

## Siguiente salto correcto
1. Sustituir Express local por Supabase productivo.
2. Implementar roles persistentes + RLS.
3. Integrar orders + checkout Webpay / Mercado Pago.
4. Exponer CMS landing desde panel admin.
5. Luego activar la capa física/NFC.

## Nota estratégica
La lógica NFC quedó desacoplada a propósito. Primero se construye el activo rentable: adquisición, perfil editable, operación e inventario.
