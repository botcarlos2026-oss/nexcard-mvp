-- ============================================================
-- NexCard MVP — Seeds & Fixtures
-- Ejecutar en Supabase SQL Editor
-- IMPORTANTE: No crea usuarios en auth.users (eso se hace
-- por Supabase Auth). Los user_id son placeholders UUID que
-- deberás reemplazar con IDs reales tras el primer registro.
-- ============================================================

-- UUIDs fijos para referencias cruzadas
-- org_nexcard     = 'org-0000-0000-0000-000000000001'
-- org_masmedio    = 'org-0000-0000-0000-000000000002'
-- user_admin      = 'usr-0000-0000-0000-000000000001'  (reemplazar por auth.uid real)
-- user_carlos     = 'usr-0000-0000-0000-000000000002'
-- user_andrea     = 'usr-0000-0000-0000-000000000003'
-- user_empresa1   = 'usr-0000-0000-0000-000000000004'

-- ─────────────────────────────────────────
-- 1. ORGANIZATIONS
-- ─────────────────────────────────────────
INSERT INTO public.organizations (id, name, slug) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'NexCard Operaciones', 'nexcard-ops'),
  ('a0000000-0000-0000-0000-000000000002', 'Más Medios Chile', 'mas-medios-chile')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────
-- 2. PROFILES (sin user_id real — modo demo)
-- ─────────────────────────────────────────
INSERT INTO public.profiles (
  id, user_id, organization_id, slug, full_name, profession, bio,
  avatar_url, theme_color, is_dark_mode,
  whatsapp, instagram, linkedin, website, calendar_url,
  vcard_enabled, bank_enabled, bank_name, bank_type,
  bank_number, bank_rut, bank_email,
  view_count, status, account_type
) VALUES
  -- Perfil 1: Carlos Alvarez (individual, demo principal)
  (
    'b0000000-0000-0000-0000-000000000001',
    NULL,
    'a0000000-0000-0000-0000-000000000002',
    'carlos-alvarez',
    'Carlos Alvarez',
    'Head of Operations | Más Medios Chile',
    'Especialista en AdOps, Yield Management y optimización de procesos digitales para +120 medios de comunicación.',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=256&h=256',
    '#10B981', true,
    '56912345678', 'carlos_alvarez_cl', 'carlos-alvarez-ops',
    'https://nexcard.cl', 'https://calendly.com/carlos-alvarez',
    true, true,
    'Banco de Chile', 'Cuenta FAN', '123456789', '12.345.678-9', 'carlos@masmedios.cl',
    142, 'active', 'individual'
  ),
  -- Perfil 2: Andrea Ruiz (individual, diseño)
  (
    'b0000000-0000-0000-0000-000000000002',
    NULL,
    NULL,
    'andrea-ruiz',
    'Andrea Ruiz',
    'Diseñadora UX & Brand Strategy',
    'Creo experiencias digitales que conectan marcas con personas. +8 años trabajando con startups y agencias en LATAM.',
    'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=256&h=256',
    '#3B82F6', true,
    '56987654321', 'andrearuiz.ux', 'andrea-ruiz-design',
    'https://andrearuiz.cl', 'https://calendly.com/andrea-ruiz',
    true, false,
    NULL, NULL, NULL, NULL, NULL,
    87, 'active', 'individual'
  ),
  -- Perfil 3: Empresa Inmobiliaria (company)
  (
    'b0000000-0000-0000-0000-000000000003',
    NULL,
    'a0000000-0000-0000-0000-000000000001',
    'proptech-sur',
    'PropTech Sur',
    'Inmobiliaria Digital | Santiago',
    'Conectamos personas con propiedades en el sur de Santiago. Tecnología al servicio del mercado inmobiliario.',
    'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=256&h=256',
    '#EC4899', false,
    '56922334455', 'proptechsur', 'proptech-sur-cl',
    'https://proptechsur.cl', NULL,
    true, true,
    'Banco Santander', 'Cuenta Corriente', '987654321', '76.543.210-K', 'pagos@proptechsur.cl',
    231, 'active', 'company'
  ),
  -- Perfil 4: Perfil pendiente (sin activar)
  (
    'b0000000-0000-0000-0000-000000000004',
    NULL,
    NULL,
    'javier-morales',
    'Javier Morales',
    'Asesor Financiero Independiente',
    NULL,
    NULL,
    '#F59E0B', true,
    '56911223344', NULL, NULL, NULL, NULL,
    false, false,
    NULL, NULL, NULL, NULL, NULL,
    0, 'pending', 'individual'
  )
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────
-- 3. PRODUCTS
-- ─────────────────────────────────────────
INSERT INTO public.products (id, name, segment, price_cents, currency, type, active) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'NexCard Individual',      'individual', 1990000, 'CLP', 'single', true),
  ('c0000000-0000-0000-0000-000000000002', 'NexCard Individual Pack',  'individual', 4990000, 'CLP', 'pack',   true),
  ('c0000000-0000-0000-0000-000000000003', 'NexCard Pyme 5 tarjetas',  'sme',        7990000, 'CLP', 'pack',   true),
  ('c0000000-0000-0000-0000-000000000004', 'NexCard Pyme 10 tarjetas', 'sme',       14990000, 'CLP', 'pack',   true),
  ('c0000000-0000-0000-0000-000000000005', 'NexCard Enterprise 50',    'enterprise', 59990000,'CLP', 'pack',   true)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────
-- 4. ORDERS
-- ─────────────────────────────────────────
INSERT INTO public.orders (id, user_id, organization_id, customer_name, customer_email, payment_method, payment_status, fulfillment_status, amount_cents, currency) VALUES
  ('d0000000-0000-0000-0000-000000000001', NULL, NULL, 'Carlos Alvarez',    'carlos@masmedios.cl',    'webpay',       'paid',    'delivered', 1990000,  'CLP'),
  ('d0000000-0000-0000-0000-000000000002', NULL, NULL, 'Andrea Ruiz',       'andrea@andrearuiz.cl',   'mercado_pago', 'paid',    'delivered', 1990000,  'CLP'),
  ('d0000000-0000-0000-0000-000000000003', NULL, 'a0000000-0000-0000-0000-000000000001', 'PropTech Sur', 'pagos@proptechsur.cl', 'manual', 'paid', 'printing', 7990000, 'CLP'),
  ('d0000000-0000-0000-0000-000000000004', NULL, NULL, 'Javier Morales',    'javier@gmail.com',       'webpay',       'pending', 'new',       1990000,  'CLP'),
  ('d0000000-0000-0000-0000-000000000005', NULL, NULL, 'María Fernández',   'maria.f@outlook.com',    'webpay',       'failed',  'new',       4990000,  'CLP')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────
-- 5. ORDER ITEMS
-- ─────────────────────────────────────────
INSERT INTO public.order_items (order_id, product_id, quantity, unit_price_cents, currency) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 1, 1990000, 'CLP'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 1, 1990000, 'CLP'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 1, 7990000, 'CLP'),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 1, 1990000, 'CLP'),
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 1, 4990000, 'CLP')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────
-- 6. PAYMENTS
-- ─────────────────────────────────────────
INSERT INTO public.payments (order_id, provider, status, amount_cents, currency, external_id) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'webpay',       'paid',    1990000, 'CLP', 'WP-20260101-001'),
  ('d0000000-0000-0000-0000-000000000002', 'mercado_pago', 'paid',    1990000, 'CLP', 'MP-20260103-002'),
  ('d0000000-0000-0000-0000-000000000003', 'manual',       'paid',    7990000, 'CLP', 'MANUAL-2026-003'),
  ('d0000000-0000-0000-0000-000000000004', 'webpay',       'pending', 1990000, 'CLP', NULL),
  ('d0000000-0000-0000-0000-000000000005', 'webpay',       'failed',  4990000, 'CLP', 'WP-20260110-FAIL')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────
-- 7. CARDS (NFC)
-- ─────────────────────────────────────────
INSERT INTO public.cards (id, organization_id, profile_id, order_id, card_code, activation_status) VALUES
  ('e0000000-0000-0000-0000-000000000001', NULL, 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'NXC-2026-0001', 'activated'),
  ('e0000000-0000-0000-0000-000000000002', NULL, 'b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'NXC-2026-0002', 'activated'),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'NXC-2026-0003', 'assigned'),
  ('e0000000-0000-0000-0000-000000000004', NULL, NULL, NULL, 'NXC-2026-0004', 'unassigned'),
  ('e0000000-0000-0000-0000-000000000005', NULL, NULL, NULL, 'NXC-2026-0005', 'unassigned')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────
-- 8. INVENTORY ITEMS
-- ─────────────────────────────────────────
INSERT INTO public.inventory_items (id, item, category, stock, min_stock, unit, cost_cents) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'Tarjetas PVC en blanco',         'Tarjetas',   120, 50,  'unidad',  85000),
  ('f0000000-0000-0000-0000-000000000002', 'Chips NFC NTAG213',              'Chips NFC',  200, 80,  'unidad',  45000),
  ('f0000000-0000-0000-0000-000000000003', 'Ribbon color YMCKO Fargo',       'Insumos',      3,  2,  'rollo', 4200000),
  ('f0000000-0000-0000-0000-000000000004', 'Laminate overlay Fargo',         'Insumos',      5,  2,  'rollo', 1800000),
  ('f0000000-0000-0000-0000-000000000005', 'Impresora Fargo DTC1500',        'Maquinaria',   1,  1,  'unidad', 0),
  ('f0000000-0000-0000-0000-000000000006', 'Cajas de embalaje individuales', 'Embalaje',    80, 30,  'unidad',  12000),
  ('f0000000-0000-0000-0000-000000000007', 'Sobres de despacho',             'Embalaje',    60, 20,  'unidad',   8000)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────
-- 9. INVENTORY MOVEMENTS (historial demo)
-- ─────────────────────────────────────────
INSERT INTO public.inventory_movements (inventory_item_id, movement_type, quantity, reason, order_id) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'in',     150, 'Compra inicial proveedor',    NULL),
  ('f0000000-0000-0000-0000-000000000001', 'out',     30, 'Pedidos enero 2026',          NULL),
  ('f0000000-0000-0000-0000-000000000002', 'in',     250, 'Compra inicial chips NFC',    NULL),
  ('f0000000-0000-0000-0000-000000000002', 'out',     50, 'Producción batch 1',          NULL),
  ('f0000000-0000-0000-0000-000000000003', 'in',       5, 'Compra ribbons Fargo',        NULL),
  ('f0000000-0000-0000-0000-000000000003', 'out',      2, 'Uso producción enero',        NULL),
  ('f0000000-0000-0000-0000-000000000006', 'in',     100, 'Compra cajas embalaje',       NULL),
  ('f0000000-0000-0000-0000-000000000006', 'out',     20, 'Despachos enero 2026',        NULL)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────
-- 10. EVENTS (analytics demo)
-- ─────────────────────────────────────────
INSERT INTO public.events (profile_slug, event_type, metadata) VALUES
  ('carlos-alvarez', 'view',    '{"source": "nfc", "device": "mobile"}'),
  ('carlos-alvarez', 'whatsapp','{"source": "nfc"}'),
  ('carlos-alvarez', 'vcard',   '{"source": "nfc"}'),
  ('carlos-alvarez', 'view',    '{"source": "qr",  "device": "mobile"}'),
  ('carlos-alvarez', 'whatsapp','{"source": "qr"}'),
  ('andrea-ruiz',    'view',    '{"source": "nfc", "device": "mobile"}'),
  ('andrea-ruiz',    'instagram','{"source": "nfc"}'),
  ('andrea-ruiz',    'view',    '{"source": "link","device": "desktop"}'),
  ('proptech-sur',   'view',    '{"source": "nfc", "device": "mobile"}'),
  ('proptech-sur',   'whatsapp','{"source": "nfc"}'),
  ('proptech-sur',   'view',    '{"source": "nfc", "device": "mobile"}'),
  ('proptech-sur',   'vcard',   '{"source": "nfc"}')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────
-- NOTA FINAL
-- ─────────────────────────────────────────
-- Para agregar el primer usuario admin real:
-- 1. Regístrate en la app (/login → Registrarme)
-- 2. Copia el UUID de auth.users desde Supabase Dashboard
-- 3. Ejecuta:
--    INSERT INTO public.memberships (user_id, organization_id, role)
--    VALUES ('<tu-uuid>', 'a0000000-0000-0000-0000-000000000001', 'admin');
-- 4. Puedes también vincular tu perfil:
--    UPDATE public.profiles SET user_id = '<tu-uuid>'
--    WHERE slug = 'carlos-alvarez';
