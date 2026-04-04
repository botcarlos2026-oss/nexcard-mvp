# NexCard MVP - Estructura de Base de Datos (Supabase/PostgreSQL)

## Tabla: `profiles`
Esta tabla contiene toda la información editable de cada tarjeta/usuario.

| Campo | Tipo | Descripción | Editable por Usuario |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Identificador único del perfil (Primary Key) | No |
| `slug` | String | URL personalizada (ej: `nexcard.cl/carlos-alvarez`) | No (al inicio) |
| `full_name` | String | Nombre para mostrar | Sí |
| `profession` | String | Cargo o especialidad | Sí |
| `bio` | Text | Breve descripción | Sí |
| `avatar_url` | String | URL de la imagen de perfil (Supabase Storage) | Sí |
| `theme_color` | String | Color principal (Hex: #000000) | Sí |
| `is_dark_mode` | Boolean | Switch para tema oscuro/claro | Sí |
| **SOCIAL LINKS** | | | |
| `whatsapp` | String | Número (formato internacional) | Sí |
| `instagram` | String | Usuario de IG | Sí |
| `linkedin` | String | URL de perfil | Sí |
| `website` | String | URL de sitio web | Sí |
| **ACTIONS** | | | |
| `vcard_enabled` | Boolean | Mostrar botón "Descargar Contacto" | Sí |
| `calendar_url` | String | Link de agendamiento (Calendly, etc.) | Sí |
| **BANK DATA (Acordeón)** | | | |
| `bank_enabled` | Boolean | Mostrar sección de transferencia | Sí |
| `bank_name` | String | Nombre del Banco | Sí |
| `bank_type` | String | Tipo de Cuenta | Sí |
| `bank_number` | String | Número de Cuenta | Sí |
| `bank_rut` | String | RUT del titular | Sí |
| `bank_email` | String | Email de confirmación | Sí |
| **METRICS** | | | |
| `view_count` | Integer | Contador de Taps/Visitas | No |
| `created_at` | Timestamp | Fecha de creación | No |

---

## Tabla: `users` (Auth)
Manejada nativamente por Supabase Auth para el login al Dashboard de edición.
Relación: `profiles.user_id` -> `users.id`.
