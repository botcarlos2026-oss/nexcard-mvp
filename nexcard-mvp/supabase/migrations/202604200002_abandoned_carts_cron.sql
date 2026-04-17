-- Scheduled trigger: invocar send-abandoned-cart cada hora
-- Requisito: pg_cron y pg_net habilitados en el proyecto Supabase
-- Para habilitarlos: Dashboard → Database → Extensions → pg_cron + pg_net

-- NOTA: si pg_cron no está disponible en el plan, este bloque lanzará
-- un error al ejecutar. En ese caso, usar Vercel Cron Jobs o ejecutar
-- manualmente desde el panel admin de EmailDashboard.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.unschedule('check-abandoned-carts');

    PERFORM cron.schedule(
      'check-abandoned-carts',
      '0 * * * *',
      $$
      SELECT net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/send-abandoned-cart',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body := '{"trigger":"cron"}'
      );
      $$
    );
  ELSE
    RAISE NOTICE 'pg_cron no disponible — activar manualmente desde Extensions o usar Vercel Cron Jobs';
  END IF;
END;
$$;
