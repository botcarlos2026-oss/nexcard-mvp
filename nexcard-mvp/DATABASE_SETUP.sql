-- 1. Crear la tabla de perfiles (profiles)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  profession TEXT,
  bio TEXT,
  avatar_url TEXT,
  theme_color TEXT DEFAULT '#000000',
  is_dark_mode BOOLEAN DEFAULT true,
  
  -- Redes Sociales
  whatsapp TEXT,
  instagram TEXT,
  linkedin TEXT,
  website TEXT,
  
  -- Acciones
  vcard_enabled BOOLEAN DEFAULT true,
  calendar_url TEXT,
  
  -- Datos Bancarios
  bank_enabled BOOLEAN DEFAULT false,
  bank_name TEXT,
  bank_type TEXT,
  bank_number TEXT,
  bank_rut TEXT,
  bank_email TEXT,
  
  -- Métricas y Auditoría
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar Row Level Security (RLS) para seguridad
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Seguridad (RLS - Row Level Security)
-- ESTO ES CRÍTICO: El motor de la base de datos (PostgreSQL) valida la identidad antes de entregar datos.

-- POLÍTICA 1: Lectura Pública
-- Cualquiera puede ver un perfil (es lo que permite que el NFC funcione), 
-- pero SOLO los campos de la tabla 'profiles'.
CREATE POLICY "Public profiles are viewable by everyone" 
ON profiles FOR SELECT 
USING (true);

-- POLÍTICA 2: Edición Privada (Blindada)
-- Solo el usuario autenticado (via JWT de Supabase) cuyo ID coincida 
-- con el campo user_id de la fila puede ejecutar un UPDATE.
-- Un usuario X NO PUEDE editar a un usuario Y porque auth.uid() no coincidirá.
CREATE POLICY "Users can update their own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- POLÍTICA 3: Inserción Controlada
-- Solo usuarios autenticados pueden crear un perfil y solo para ellos mismos.
CREATE POLICY "Users can insert their own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 4. Función para actualizar el timestamp de updated_at automáticamente
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE PROCEDURE handle_updated_at();

-- 5. Configuración de Storage para Fotos de Perfil
-- Crear el bucket 'avatars' en Supabase Storage
-- Nota: Esto se ejecuta en el panel de Storage o via API, pero aquí definimos las políticas.

-- Permitir que cualquier persona vea las fotos de perfil (Público)
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);

CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Solo el dueño puede subir o actualizar su propia foto
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
