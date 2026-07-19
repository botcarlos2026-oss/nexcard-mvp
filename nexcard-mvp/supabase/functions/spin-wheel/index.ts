import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VISITOR_RE = /^[A-Za-z0-9_-]{8,96}$/;
const IP_RE = /^(?:\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]{2,45}$/i;

const cleanIp = (value: string | null): string | null => {
  const ip = value?.trim();
  return ip && IP_RE.test(ip) ? ip : null;
};

const clientIp = (req: Request): string | null => {
  // Trust only Cloudflare's platform-provided header by default. Supabase/Vercel
  // proxy headers such as x-real-ip/x-forwarded-for are opt-in because callers can
  // spoof them unless the deployed edge path is proven to overwrite them.
  const cloudflareIp = cleanIp(req.headers.get('cf-connecting-ip'));
  if (cloudflareIp) return cloudflareIp;

  if (Deno.env.get('SPIN_WHEEL_TRUST_X_REAL_IP') === 'true') {
    const realIp = cleanIp(req.headers.get('x-real-ip'));
    if (realIp) return realIp;
  }

  if (Deno.env.get('SPIN_WHEEL_TRUST_X_FORWARDED_FOR') === 'true') {
    const chain = req.headers.get('x-forwarded-for')?.split(',').map((part) => cleanIp(part)).filter(Boolean) as string[] | undefined;
    return chain?.at(-1) || null;
  }

  return null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Método no permitido' }, 405);

  try {
    const { wheel_id, visitor_id } = await req.json();
    if (!wheel_id || !visitor_id) return json({ success: false, error: 'wheel_id y visitor_id requeridos' }, 400);
    if (!UUID_RE.test(String(wheel_id))) return json({ success: false, error: 'wheel_id inválido' }, 400);
    if (!VISITOR_RE.test(String(visitor_id))) return json({ success: false, error: 'visitor_id inválido' }, 400);

    const ip = clientIp(req);
    if (!ip) return json({ success: false, error: 'No se pudo verificar el origen del giro' }, 400);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase env faltante');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase.rpc('spin_wheel', {
      p_wheel_id: wheel_id,
      p_visitor_id: visitor_id,
      p_client_ip: ip,
      p_user_agent: req.headers.get('user-agent') || null,
    });

    if (error) throw error;
    const spin = Array.isArray(data) ? data[0] : data;
    if (!spin) throw new Error('No se pudo girar la ruleta');

    return json(spin);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    const limited = /recientemente|rate|limit/i.test(message);
    console.error(JSON.stringify({ event: 'spin_wheel_failed', limited, message }));
    return json({ success: false, error: limited ? 'Ya giraste recientemente' : 'No pudimos girar la ruleta' }, limited ? 429 : 500);
  }
});
