


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "auth";


ALTER SCHEMA "auth" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "extensions";


ALTER SCHEMA "extensions" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "auth"."aal_level" AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE "auth"."aal_level" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."code_challenge_method" AS ENUM (
    's256',
    'plain'
);


ALTER TYPE "auth"."code_challenge_method" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_status" AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE "auth"."factor_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_type" AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE "auth"."factor_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_authorization_status" AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE "auth"."oauth_authorization_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_client_type" AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE "auth"."oauth_client_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_registration_type" AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE "auth"."oauth_registration_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_response_type" AS ENUM (
    'code'
);


ALTER TYPE "auth"."oauth_response_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."one_time_token_type" AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE "auth"."one_time_token_type" OWNER TO "supabase_auth_admin";


CREATE OR REPLACE FUNCTION "auth"."email"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION "auth"."email"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."email"() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';



CREATE OR REPLACE FUNCTION "auth"."jwt"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION "auth"."jwt"() OWNER TO "supabase_auth_admin";


CREATE OR REPLACE FUNCTION "auth"."role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION "auth"."role"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."role"() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';



CREATE OR REPLACE FUNCTION "auth"."uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION "auth"."uid"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."uid"() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';



CREATE OR REPLACE FUNCTION "extensions"."grant_pg_cron_access"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


ALTER FUNCTION "extensions"."grant_pg_cron_access"() OWNER TO "supabase_admin";


COMMENT ON FUNCTION "extensions"."grant_pg_cron_access"() IS 'Grants access to pg_cron';



CREATE OR REPLACE FUNCTION "extensions"."grant_pg_graphql_access"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


ALTER FUNCTION "extensions"."grant_pg_graphql_access"() OWNER TO "supabase_admin";


COMMENT ON FUNCTION "extensions"."grant_pg_graphql_access"() IS 'Grants access to pg_graphql';



CREATE OR REPLACE FUNCTION "extensions"."grant_pg_net_access"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION "extensions"."grant_pg_net_access"() OWNER TO "supabase_admin";


COMMENT ON FUNCTION "extensions"."grant_pg_net_access"() IS 'Grants access to pg_net';



CREATE OR REPLACE FUNCTION "extensions"."pgrst_ddl_watch"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION "extensions"."pgrst_ddl_watch"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "extensions"."pgrst_drop_watch"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION "extensions"."pgrst_drop_watch"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "extensions"."set_graphql_placeholder"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


ALTER FUNCTION "extensions"."set_graphql_placeholder"() OWNER TO "supabase_admin";


COMMENT ON FUNCTION "extensions"."set_graphql_placeholder"() IS 'Reintroduces placeholder function for graphql_public.graphql';



CREATE OR REPLACE FUNCTION "public"."activate_card"("target_card_id" "uuid", "actor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  current_card record;
begin
  if target_card_id is null then
    raise exception 'target_card_id is required';
  end if;

  select * into current_card
  from public.cards
  where id = target_card_id;

  if current_card.id is null then
    raise exception 'card_not_found';
  end if;

  if current_card.profile_id is null then
    raise exception 'card_must_be_assigned_before_activation';
  end if;

  if current_card.deleted_at is not null or current_card.status = 'archived' then
    raise exception 'cannot_activate_archived_card';
  end if;

  if current_card.status = 'revoked' then
    raise exception 'cannot_activate_revoked_card';
  end if;

  if current_card.activation_status = 'activated' or current_card.status = 'active' then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'already_active',
      'card_id', target_card_id
    );
  end if;

  update public.cards
  set
    status = 'active',
    activation_status = 'activated'
  where id = target_card_id;

  insert into public.card_events (
    card_id,
    event_type,
    created_at
  ) values (
    target_card_id,
    'activated',
    now()
  );

  insert into public.audit_log (
    actor_user_id,
    entity_type,
    entity_id,
    action,
    context,
    created_at
  ) values (
    actor_id,
    'card',
    target_card_id,
    'activate',
    jsonb_build_object(
      'previous_status', current_card.status,
      'previous_activation_status', current_card.activation_status
    ),
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'card_id', target_card_id
  );
end;
$$;


ALTER FUNCTION "public"."activate_card"("target_card_id" "uuid", "actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_dispatch_order"("target_order_id" "uuid", "p_carrier" "text", "p_tracking_code" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  current_order public.orders%rowtype;
  cfg record;
  inventory_row public.inventory_items%rowtype;
  normalized_carrier text := lower(trim(coalesce(p_carrier, '')));
  normalized_tracking text := upper(trim(coalesce(p_tracking_code, '')));
  items_decremented jsonb := '[]'::jsonb;
  shipped_at_value timestamptz := now();
  new_delivery_token uuid := gen_random_uuid();
  new_delivery_token_expires_at timestamptz := now() + interval '45 days';
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.has_role('admin') then
    raise exception 'Solo administradores pueden despachar órdenes';
  end if;

  if normalized_carrier not in ('blueexpress', 'chilexpress', 'starken', 'correos', 'dhl', 'fedex', 'manual') then
    raise exception 'Carrier inválido: %', p_carrier;
  end if;

  if normalized_tracking = '' or length(normalized_tracking) < 4 then
    raise exception 'Código de seguimiento inválido';
  end if;

  if normalized_tracking !~ '^[A-Z0-9-]+$' then
    raise exception 'El código de seguimiento solo puede contener letras, números y guiones';
  end if;

  select *
  into current_order
  from public.orders
  where id = target_order_id
  for update;

  if not found then
    raise exception 'Orden no encontrada';
  end if;

  if current_order.deleted_at is not null then
    raise exception 'No puedes despachar una orden archivada';
  end if;

  if current_order.payment_status <> 'paid' then
    raise exception 'Solo puedes despachar órdenes pagadas';
  end if;

  if current_order.fulfillment_status <> 'ready' then
    raise exception 'Solo puedes despachar órdenes en estado ready';
  end if;

  if coalesce(current_order.inventory_decremented, false) then
    raise exception 'Esta orden ya descontó stock; no se puede despachar dos veces';
  end if;

  for cfg in
    select *
    from public.dispatch_config
    where active = true
    order by sku
  loop
    select *
    into inventory_row
    from public.inventory_items
    where sku = cfg.sku
    for update;

    if not found then
      raise exception 'Dispatch config apunta a SKU inexistente: %', cfg.sku;
    end if;

    if coalesce(inventory_row.stock, 0) < cfg.quantity_per_dispatch then
      raise exception 'Stock insuficiente para "%": disponible %, requerido %', coalesce(inventory_row.item, inventory_row.name, inventory_row.sku), coalesce(inventory_row.stock, 0), cfg.quantity_per_dispatch;
    end if;
  end loop;

  for cfg in
    select *
    from public.dispatch_config
    where active = true
    order by sku
  loop
    update public.inventory_items
    set stock = stock - cfg.quantity_per_dispatch,
        updated_at = now()
    where sku = cfg.sku;

    select *
    into inventory_row
    from public.inventory_items
    where sku = cfg.sku;

    insert into public.inventory_movements (
      inventory_item_id,
      movement_type,
      quantity,
      reason,
      order_id
    ) values (
      inventory_row.id,
      'out',
      cfg.quantity_per_dispatch,
      format('Despacho orden %s', target_order_id),
      target_order_id
    );

    items_decremented := items_decremented || jsonb_build_array(jsonb_build_object(
      'sku', cfg.sku,
      'name', coalesce(inventory_row.item, inventory_row.name, inventory_row.sku),
      'quantity', cfg.quantity_per_dispatch,
      'remaining_stock', inventory_row.stock
    ));
  end loop;

  shipped_at_value := coalesce(current_order.shipped_at, now());
  new_delivery_token_expires_at := shipped_at_value + interval '45 days';

  perform set_config('app.order_transition_bypass', 'true', true);

  update public.orders
  set carrier = normalized_carrier,
      tracking_code = normalized_tracking,
      fulfillment_status = 'shipped',
      shipped_at = shipped_at_value,
      inventory_reserved = true,
      inventory_reserved_at = coalesce(current_order.inventory_reserved_at, now()),
      inventory_decremented = true,
      inventory_decremented_at = now(),
      delivery_token = new_delivery_token,
      delivery_token_expires_at = new_delivery_token_expires_at,
      updated_at = now()
  where id = target_order_id;

  perform public.insert_order_history_entry(target_order_id, 'carrier', coalesce(current_order.carrier, ''), normalized_carrier);
  perform public.insert_order_history_entry(target_order_id, 'tracking_code', coalesce(current_order.tracking_code, ''), normalized_tracking);
  perform public.insert_order_history_entry(target_order_id, 'fulfillment_status', current_order.fulfillment_status, 'shipped');
  perform public.insert_order_history_entry(target_order_id, 'shipped_at', coalesce(current_order.shipped_at::text, ''), coalesce(shipped_at_value::text, ''));
  perform public.insert_order_history_entry(target_order_id, 'inventory_reserved', coalesce(current_order.inventory_reserved::text, ''), 'true');
  perform public.insert_order_history_entry(target_order_id, 'inventory_decremented', coalesce(current_order.inventory_decremented::text, ''), 'true');
  perform public.insert_order_history_entry(target_order_id, 'delivery_token', coalesce(current_order.delivery_token::text, ''), new_delivery_token::text);
  perform public.insert_order_history_entry(target_order_id, 'delivery_token_expires_at', coalesce(current_order.delivery_token_expires_at::text, ''), new_delivery_token_expires_at::text);

  return jsonb_build_object(
    'order_id', target_order_id,
    'carrier', normalized_carrier,
    'tracking_code', normalized_tracking,
    'fulfillment_status', 'shipped',
    'delivery_token', new_delivery_token,
    'delivery_token_expires_at', new_delivery_token_expires_at,
    'items_decremented', items_decremented
  );
end;
$_$;


ALTER FUNCTION "public"."admin_dispatch_order"("target_order_id" "uuid", "p_carrier" "text", "p_tracking_code" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "organization_id" "uuid",
    "customer_name" "text",
    "customer_email" "text",
    "payment_method" "text",
    "payment_status" "text" DEFAULT 'pending'::"text",
    "fulfillment_status" "text" DEFAULT 'new'::"text",
    "amount_cents" bigint NOT NULL,
    "currency" "text" DEFAULT 'CLP'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "carrier" "text",
    "tracking_code" "text",
    "shipped_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "delivery_token" "uuid" DEFAULT "gen_random_uuid"(),
    "delivery_confirmed_by" "text",
    "card_customization" "jsonb",
    "folio" "text",
    "mp_payment_id" "text",
    "bsale_document_id" integer,
    "bsale_document_url" "text",
    "bsale_emitted_at" timestamp with time zone,
    "requires_invoice" boolean DEFAULT false,
    "invoice_rut" "text",
    "invoice_razon_social" "text",
    "customer_phone" "text",
    "customer_address" "text",
    "inventory_reserved" boolean DEFAULT false,
    "inventory_decremented" boolean DEFAULT false,
    "inventory_reserved_at" timestamp with time zone,
    "inventory_decremented_at" timestamp with time zone,
    "delivery_token_expires_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "ready_at" timestamp with time zone,
    "activated_at" timestamp with time zone,
    "is_test" boolean DEFAULT false NOT NULL,
    "test_reason" "text",
    "qa_reviewed_at" timestamp with time zone,
    "qa_reviewed_by" "uuid",
    "qa_reviewed_by_label" "text",
    "qa_review_note" "text",
    "qa_override_at" timestamp with time zone,
    "qa_override_by" "uuid",
    "qa_override_by_label" "text",
    "qa_override_resolved_at" timestamp with time zone,
    "client_checkout_attempt_id" "text",
    "client_checkout_fingerprint" "text",
    "mp_preference_id" "text",
    "mp_preference_init_point" "text",
    "mp_preference_creation_token" "text",
    CONSTRAINT "orders_carrier_check" CHECK ((("carrier" IS NULL) OR ("carrier" = ANY (ARRAY['blueexpress'::"text", 'chilexpress'::"text", 'starken'::"text", 'correos'::"text", 'dhl'::"text", 'fedex'::"text", 'manual'::"text"])))),
    CONSTRAINT "orders_delivery_confirmed_by_check" CHECK ((("delivery_confirmed_by" IS NULL) OR ("delivery_confirmed_by" = ANY (ARRAY['carrier_webhook'::"text", 'admin'::"text", 'customer'::"text"])))),
    CONSTRAINT "orders_fulfillment_status_check" CHECK (("fulfillment_status" = ANY (ARRAY['new'::"text", 'in_production'::"text", 'ready'::"text", 'shipped'::"text", 'delivered'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "orders_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'authorized'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."orders"."is_test" IS 'Bandera estructural para segregar órdenes QA/internas del reporting operativo real.';



COMMENT ON COLUMN "public"."orders"."test_reason" IS 'Motivo de clasificación QA/interna (internal_email, internal_domain, name_pattern).';



CREATE OR REPLACE FUNCTION "public"."admin_override_order_test_classification"("target_order_id" "uuid", "target_is_test" boolean, "target_reason" "text" DEFAULT NULL::"text") RETURNS "public"."orders"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  previous_order public.orders;
  updated_order public.orders;
  normalized_reason text := nullif(trim(coalesce(target_reason, '')), '');
  actor_id uuid := auth.uid();
  actor_role_value text := case
    when auth.role() = 'service_role' then 'service_role'
    when coalesce(public.has_role('admin'), false) then 'admin'
    else coalesce(auth.role(), 'unknown')
  end;
  actor_label_value text := coalesce(
    nullif(auth.jwt() ->> 'email', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'email', ''),
    nullif(auth.jwt() -> 'app_metadata' ->> 'email', ''),
    case when auth.role() = 'service_role' then 'service_role' else null end,
    'admin'
  );
begin
  if not (coalesce(public.has_role('admin'), false) or auth.role() = 'service_role') then
    raise exception 'Solo admin puede modificar la clasificación QA/test de órdenes';
  end if;

  select * into previous_order
  from public.orders
  where id = target_order_id;

  if previous_order.id is null then
    raise exception 'Orden no encontrada';
  end if;

  update public.orders
  set
    is_test = target_is_test,
    test_reason = case
      when target_is_test then coalesce(normalized_reason, 'manual_admin_override')
      else coalesce(normalized_reason, 'manual_admin_override_real')
    end,
    qa_override_at = case when target_is_test then now() else previous_order.qa_override_at end,
    qa_override_by = case when target_is_test then actor_id else previous_order.qa_override_by end,
    qa_override_by_label = case when target_is_test then actor_label_value else previous_order.qa_override_by_label end,
    qa_override_resolved_at = case when target_is_test then null else now() end,
    qa_reviewed_at = null,
    qa_reviewed_by = null,
    qa_reviewed_by_label = null,
    qa_review_note = null,
    updated_at = now()
  where id = target_order_id
  returning * into updated_order;

  insert into public.order_status_history (
    order_id,
    field,
    old_value,
    new_value,
    actor_user_id,
    actor_role,
    actor_label
  )
  values
    (target_order_id, 'is_test', case when previous_order.is_test then 'true' else 'false' end, case when updated_order.is_test then 'true' else 'false' end, actor_id, actor_role_value, actor_label_value),
    (target_order_id, 'test_reason', coalesce(previous_order.test_reason, ''), coalesce(updated_order.test_reason, ''), actor_id, actor_role_value, actor_label_value),
    (target_order_id, 'qa_review_reset', coalesce(previous_order.qa_reviewed_by_label, ''), '', actor_id, actor_role_value, actor_label_value);

  return updated_order;
end;
$$;


ALTER FUNCTION "public"."admin_override_order_test_classification"("target_order_id" "uuid", "target_is_test" boolean, "target_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."admin_override_order_test_classification"("target_order_id" "uuid", "target_is_test" boolean, "target_reason" "text") IS 'Permite a un admin forzar manualmente la clasificación QA/test de una orden, registrar quién hizo el override y mantener timestamps SLA dedicados.';



CREATE OR REPLACE FUNCTION "public"."admin_review_order_test_classification"("target_order_id" "uuid", "review_note" "text" DEFAULT NULL::"text") RETURNS "public"."orders"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  previous_order public.orders;
  updated_order public.orders;
  normalized_note text := nullif(trim(coalesce(review_note, '')), '');
  actor_id uuid := auth.uid();
  actor_role_value text := case
    when auth.role() = 'service_role' then 'service_role'
    when coalesce(public.has_role('admin'), false) then 'admin'
    else coalesce(auth.role(), 'unknown')
  end;
  actor_label_value text := coalesce(
    nullif(auth.jwt() ->> 'email', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'email', ''),
    nullif(auth.jwt() -> 'app_metadata' ->> 'email', ''),
    case when auth.role() = 'service_role' then 'service_role' else null end,
    'admin'
  );
begin
  if not (coalesce(public.has_role('admin'), false) or auth.role() = 'service_role') then
    raise exception 'Solo admin puede revisar la clasificación QA/test de órdenes';
  end if;

  select * into previous_order
  from public.orders
  where id = target_order_id;

  if previous_order.id is null then
    raise exception 'Orden no encontrada';
  end if;

  update public.orders
  set
    qa_reviewed_at = now(),
    qa_reviewed_by = actor_id,
    qa_reviewed_by_label = actor_label_value,
    qa_review_note = normalized_note,
    updated_at = now()
  where id = target_order_id
  returning * into updated_order;

  insert into public.order_status_history (
    order_id,
    field,
    old_value,
    new_value,
    actor_user_id,
    actor_role,
    actor_label
  )
  values
    (target_order_id, 'qa_reviewed_at', coalesce(previous_order.qa_reviewed_at::text, ''), coalesce(updated_order.qa_reviewed_at::text, ''), actor_id, actor_role_value, actor_label_value),
    (target_order_id, 'qa_reviewed_by_label', coalesce(previous_order.qa_reviewed_by_label, ''), coalesce(updated_order.qa_reviewed_by_label, ''), actor_id, actor_role_value, actor_label_value),
    (target_order_id, 'qa_review_note', coalesce(previous_order.qa_review_note, ''), coalesce(updated_order.qa_review_note, ''), actor_id, actor_role_value, actor_label_value);

  return updated_order;
end;
$$;


ALTER FUNCTION "public"."admin_review_order_test_classification"("target_order_id" "uuid", "review_note" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."admin_review_order_test_classification"("target_order_id" "uuid", "review_note" "text") IS 'Permite a un admin marcar como revisada una clasificación QA/test y registrar quién auditó después del override.';



CREATE OR REPLACE FUNCTION "public"."admin_transition_order_state"("target_order_id" "uuid", "next_payment_status" "text" DEFAULT NULL::"text", "next_fulfillment_status" "text" DEFAULT NULL::"text", "reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  current_order public.orders%rowtype;
  desired_payment text;
  desired_fulfillment text;
  delivered_at_value timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.has_role('admin') then
    raise exception 'Solo administradores pueden cambiar estados de órdenes';
  end if;

  if next_payment_status is null and next_fulfillment_status is null then
    raise exception 'Debes indicar al menos un cambio de estado';
  end if;

  select *
  into current_order
  from public.orders
  where id = target_order_id
  for update;

  if not found then
    raise exception 'Orden no encontrada';
  end if;

  if current_order.deleted_at is not null then
    raise exception 'No puedes modificar una orden archivada';
  end if;

  desired_payment := current_order.payment_status;
  desired_fulfillment := current_order.fulfillment_status;
  delivered_at_value := current_order.delivered_at;

  if next_payment_status is not null and next_payment_status is distinct from current_order.payment_status then
    if next_payment_status not in ('pending', 'paid', 'failed', 'cancelled', 'refunded') then
      raise exception 'Estado de pago inválido: %', next_payment_status;
    end if;

    case current_order.payment_status
      when 'pending' then
        if next_payment_status not in ('paid', 'failed', 'cancelled') then
          raise exception 'Transición de pago no permitida: % -> %', current_order.payment_status, next_payment_status;
        end if;
      when 'failed' then
        if next_payment_status not in ('pending', 'cancelled') then
          raise exception 'Transición de pago no permitida: % -> %', current_order.payment_status, next_payment_status;
        end if;
      when 'cancelled' then
        raise exception 'La orden está cancelada; no se puede cambiar el estado de pago';
      when 'paid' then
        if next_payment_status <> 'refunded' then
          raise exception 'Una orden pagada solo puede pasar a refunded';
        end if;
      when 'refunded' then
        raise exception 'La orden ya fue reembolsada';
      else
        raise exception 'Estado de pago actual no soportado: %', current_order.payment_status;
    end case;

    desired_payment := next_payment_status;
  end if;

  if next_fulfillment_status is not null and next_fulfillment_status is distinct from current_order.fulfillment_status then
    if next_fulfillment_status not in ('new', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled') then
      raise exception 'Estado operativo inválido: %', next_fulfillment_status;
    end if;

    case current_order.fulfillment_status
      when 'new' then
        if next_fulfillment_status not in ('in_production', 'cancelled') then
          raise exception 'Transición operativa no permitida: % -> %', current_order.fulfillment_status, next_fulfillment_status;
        end if;
      when 'in_production' then
        if next_fulfillment_status not in ('ready', 'cancelled') then
          raise exception 'Transición operativa no permitida: % -> %', current_order.fulfillment_status, next_fulfillment_status;
        end if;
      when 'ready' then
        if next_fulfillment_status = 'shipped' then
          raise exception 'Para pasar a shipped usa admin_dispatch_order()';
        end if;
        if next_fulfillment_status not in ('cancelled') then
          raise exception 'Transición operativa no permitida: % -> %', current_order.fulfillment_status, next_fulfillment_status;
        end if;
      when 'shipped' then
        if next_fulfillment_status <> 'delivered' then
          raise exception 'Transición operativa no permitida: % -> %', current_order.fulfillment_status, next_fulfillment_status;
        end if;
      when 'delivered' then
        raise exception 'La orden ya fue entregada';
      when 'cancelled' then
        raise exception 'La orden ya está cancelada';
      else
        raise exception 'Estado operativo actual no soportado: %', current_order.fulfillment_status;
    end case;

    if next_fulfillment_status in ('in_production', 'ready', 'shipped', 'delivered') and desired_payment <> 'paid' then
      raise exception 'La orden debe estar pagada antes de avanzar a %', next_fulfillment_status;
    end if;

    if next_fulfillment_status = 'delivered' and delivered_at_value is null then
      delivered_at_value := now();
    elsif next_fulfillment_status <> 'delivered' then
      delivered_at_value := current_order.delivered_at;
    end if;

    desired_fulfillment := next_fulfillment_status;
  end if;

  if desired_payment = current_order.payment_status and desired_fulfillment = current_order.fulfillment_status then
    raise exception 'La orden ya está en el estado solicitado';
  end if;

  perform set_config('app.order_transition_bypass', 'true', true);

  update public.orders
  set payment_status = desired_payment,
      fulfillment_status = desired_fulfillment,
      delivered_at = delivered_at_value,
      updated_at = now()
  where id = target_order_id;

  perform public.insert_order_history_entry(target_order_id, 'payment_status', current_order.payment_status, desired_payment);
  perform public.insert_order_history_entry(target_order_id, 'fulfillment_status', current_order.fulfillment_status, desired_fulfillment);
  perform public.insert_order_history_entry(target_order_id, 'delivered_at', coalesce(current_order.delivered_at::text, ''), coalesce(delivered_at_value::text, ''));

  return jsonb_build_object(
    'order_id', target_order_id,
    'payment_status', desired_payment,
    'fulfillment_status', desired_fulfillment,
    'reason', reason
  );
end;
$$;


ALTER FUNCTION "public"."admin_transition_order_state"("target_order_id" "uuid", "next_payment_status" "text", "next_fulfillment_status" "text", "reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_order_test_segmentation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  classification jsonb;
begin
  classification := public.classify_order_test_signal(new.customer_name, new.customer_email);
  new.is_test := coalesce((classification->>'is_test')::boolean, false);
  new.test_reason := classification->>'reason';
  return new;
end;
$$;


ALTER FUNCTION "public"."apply_order_test_segmentation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_card"("target_card_id" "uuid", "target_profile_id" "uuid", "actor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  current_card record;
begin
  if target_card_id is null then
    raise exception 'target_card_id is required';
  end if;

  if target_profile_id is null then
    raise exception 'target_profile_id is required';
  end if;

  select * into current_card
  from public.cards
  where id = target_card_id;

  if current_card.id is null then
    raise exception 'card_not_found';
  end if;

  if current_card.deleted_at is not null or current_card.status = 'archived' then
    raise exception 'cannot_assign_archived_card';
  end if;

  if current_card.status = 'revoked' then
    raise exception 'cannot_assign_revoked_card';
  end if;

  if current_card.activation_status = 'activated' or current_card.status = 'active' then
    raise exception 'cannot_assign_active_card';
  end if;

  if current_card.profile_id = target_profile_id then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'already_assigned',
      'card_id', target_card_id,
      'profile_id', target_profile_id
    );
  end if;

  if current_card.profile_id is not null and current_card.profile_id <> target_profile_id then
    raise exception 'card_assigned_to_other_profile_use_reassign';
  end if;

  update public.cards
  set
    profile_id = target_profile_id,
    status = 'assigned',
    activation_status = 'assigned'
  where id = target_card_id;

  insert into public.card_events (
    card_id,
    event_type,
    created_at
  ) values (
    target_card_id,
    'assigned',
    now()
  );

  insert into public.audit_log (
    actor_user_id,
    entity_type,
    entity_id,
    action,
    context,
    created_at
  ) values (
    actor_id,
    'card',
    target_card_id,
    'assign',
    jsonb_build_object('profile_id', target_profile_id),
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'card_id', target_card_id,
    'profile_id', target_profile_id
  );
end;
$$;


ALTER FUNCTION "public"."assign_card"("target_card_id" "uuid", "target_profile_id" "uuid", "actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_profile_slug_availability"("candidate_slug" "text", "current_order_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  normalized text := public.normalize_profile_slug(candidate_slug);
  existing_profile uuid;
  reservation public.profile_slug_reservations%rowtype;
begin
  perform public.expire_profile_slug_reservations();

  if not public.is_valid_profile_slug(normalized) then
    return jsonb_build_object(
      'available', false,
      'slug', normalized,
      'reason', 'invalid_format',
      'message', 'Usa 3-40 caracteres: letras, números y guiones.'
    );
  end if;

  select id into existing_profile
  from public.profiles
  where slug = normalized
    and deleted_at is null
  limit 1;

  if existing_profile is not null then
    return jsonb_build_object(
      'available', false,
      'slug', normalized,
      'reason', 'profile_exists',
      'message', 'Ese usuario ya está ocupado. Prueba otro.'
    );
  end if;

  select * into reservation
  from public.profile_slug_reservations
  where slug = normalized
    and status = 'reserved'
    and expires_at > now()
  limit 1;

  if reservation.id is not null and (current_order_id is null or reservation.order_id <> current_order_id) then
    return jsonb_build_object(
      'available', false,
      'slug', normalized,
      'reason', 'reserved',
      'message', 'Ese usuario está reservado por otra compra. Prueba otro.'
    );
  end if;

  return jsonb_build_object(
    'available', true,
    'slug', normalized,
    'reason', 'available',
    'message', 'Usuario disponible.'
  );
end;
$$;


ALTER FUNCTION "public"."check_profile_slug_availability"("candidate_slug" "text", "current_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."classify_order_test_signal"("input_customer_name" "text", "input_customer_email" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
declare
  v_email text := lower(trim(coalesce(input_customer_email, '')));
  v_name text := trim(coalesce(input_customer_name, ''));
begin
  if v_email = '' and v_name = '' then
    return jsonb_build_object('is_test', false, 'reason', null);
  end if;

  if v_email in (
    'bot.carlos.2026@gmail.com',
    'carlos.alvarez.contreras@gmail.com',
    'admin@nexcard.cl',
    'carlos@nexcard.cl',
    'hola@nexcard.cl'
  ) then
    return jsonb_build_object('is_test', true, 'reason', 'internal_email');
  end if;

  if v_email like '%@nexcard.cl' then
    return jsonb_build_object('is_test', true, 'reason', 'internal_domain');
  end if;

  if v_name ~* '(^|[^a-z])(qa|test|tst|smoke|demo|bot)([^a-z]|$)' then
    return jsonb_build_object('is_test', true, 'reason', 'name_pattern');
  end if;

  return jsonb_build_object('is_test', false, 'reason', null);
end;
$_$;


ALTER FUNCTION "public"."classify_order_test_signal"("input_customer_name" "text", "input_customer_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_order_delivery_by_token"("target_order_id" "uuid", "provided_delivery_token" "uuid", "confirmed_by" "text" DEFAULT 'customer'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  current_order public.orders%rowtype;
  delivered_at_value timestamptz := now();
begin
  if confirmed_by not in ('customer', 'admin', 'carrier_webhook') then
    raise exception 'confirmed_by inválido: %', confirmed_by;
  end if;

  select *
  into current_order
  from public.orders
  where id = target_order_id
    and delivery_token = provided_delivery_token
  for update;

  if not found then
    raise exception 'Orden o token inválido';
  end if;

  if current_order.deleted_at is not null then
    raise exception 'No puedes confirmar una orden archivada';
  end if;

  if current_order.delivery_token_expires_at is not null
     and current_order.delivery_token_expires_at < now() then
    raise exception 'El token de entrega expiró';
  end if;

  if current_order.delivered_at is not null or current_order.delivery_confirmed_by is not null then
    return jsonb_build_object(
      'status', 'already_confirmed',
      'order_id', current_order.id,
      'fulfillment_status', current_order.fulfillment_status,
      'delivered_at', current_order.delivered_at,
      'delivery_confirmed_by', current_order.delivery_confirmed_by
    );
  end if;

  if current_order.fulfillment_status <> 'shipped' then
    raise exception 'La orden no está en estado despachado';
  end if;

  perform set_config('app.order_transition_bypass', 'true', true);

  update public.orders
  set fulfillment_status = 'delivered',
      delivered_at = delivered_at_value,
      delivery_confirmed_by = confirmed_by,
      updated_at = delivered_at_value
  where id = target_order_id;

  perform public.insert_order_history_entry(target_order_id, 'fulfillment_status', current_order.fulfillment_status, 'delivered');
  perform public.insert_order_history_entry(target_order_id, 'delivered_at', coalesce(current_order.delivered_at::text, ''), delivered_at_value::text);
  perform public.insert_order_history_entry(target_order_id, 'delivery_confirmed_by', coalesce(current_order.delivery_confirmed_by, ''), confirmed_by);

  return jsonb_build_object(
    'status', 'success',
    'order_id', current_order.id,
    'fulfillment_status', 'delivered',
    'delivered_at', delivered_at_value,
    'delivery_confirmed_by', confirmed_by,
    'customer_name', current_order.customer_name
  );
end;
$$;


ALTER FUNCTION "public"."confirm_order_delivery_by_token"("target_order_id" "uuid", "provided_delivery_token" "uuid", "confirmed_by" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_profile_slug_reservation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  normalized text := public.normalize_profile_slug(new.slug);
  caller_user_id uuid := auth.uid();
begin
  update public.profile_slug_reservations psr
  set status = 'consumed',
      profile_id = new.id,
      reserved_by_user_id = caller_user_id,
      consumed_at = now(),
      updated_at = now()
  where psr.slug = normalized
    and psr.status = 'reserved'
    and psr.expires_at > now()
    and exists (
      select 1
      from public.profile_claims pc
      where pc.order_id = psr.order_id
        and pc.status = 'claimed'
        and pc.claimed_by_user_id = caller_user_id
    );

  return new;
end;
$$;


ALTER FUNCTION "public"."consume_profile_slug_reservation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_order_with_items"("p_order" "jsonb", "p_items" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_order_id uuid;
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_total integer := 0;
  v_coupon_code text := upper(nullif(trim(p_order->>'coupon_code'), ''));
  v_desired_slug text := public.normalize_profile_slug(p_order->>'desired_profile_slug');
  v_requires_invoice boolean := coalesce((p_order->>'requires_invoice')::boolean, false);
  v_invoice_rut text := nullif(trim(p_order->>'invoice_rut'), '');
  v_invoice_razon_social text := nullif(trim(p_order->>'invoice_razon_social'), '');
  v_item jsonb;
  v_product record;
  v_qty integer;
  v_prize_type text;
  v_prize_value integer;
  v_spin_id uuid;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La orden no contiene productos';
  end if;

  if nullif(trim(p_order->>'customer_name'), '') is null then
    raise exception 'Nombre de cliente requerido';
  end if;

  if nullif(trim(p_order->>'customer_email'), '') is null then
    raise exception 'Email de cliente requerido';
  end if;

  if v_desired_slug is null then
    raise exception 'Usuario público requerido';
  end if;

  if v_requires_invoice then
    if v_invoice_rut is null then
      raise exception 'RUT de factura requerido';
    end if;
    if not public.is_valid_chilean_rut(v_invoice_rut) then
      raise exception 'RUT de factura inválido';
    end if;
    if v_invoice_razon_social is null then
      raise exception 'Razón social de factura requerida';
    end if;
  elsif v_invoice_rut is not null and not public.is_valid_chilean_rut(v_invoice_rut) then
    raise exception 'RUT de factura inválido';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if nullif(v_item->>'product_id', '') is null then
      raise exception 'Producto inválido en la orden';
    end if;

    v_qty := greatest(coalesce((v_item->>'quantity')::integer, 0), 0);
    if v_qty <= 0 then
      raise exception 'Cantidad inválida para producto %', v_item->>'product_id';
    end if;

    select id, price_cents, status, deleted_at
      into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid;

    if not found or v_product.deleted_at is not null or coalesce(v_product.status, 'active') <> 'active' then
      raise exception 'Producto no disponible: %', v_item->>'product_id';
    end if;

    v_subtotal := v_subtotal + (coalesce(v_product.price_cents, 0) * v_qty);
  end loop;

  if v_coupon_code is not null then
    select ws.id, wp.type, wp.value
      into v_spin_id, v_prize_type, v_prize_value
    from public.wheel_spins ws
    join public.wheel_prizes wp on wp.id = ws.prize_id
    where upper(ws.generated_coupon_code) = v_coupon_code
      and coalesce(wp.active, true) = true
      and coalesce(ws.redeemed, false) = false
    order by ws.spun_at asc
    limit 1
    for update of ws;

    if not found then
      raise exception 'Cupón inválido o ya utilizado';
    end if;

    if v_prize_type = 'discount_percent' then
      v_discount := round(v_subtotal * (greatest(v_prize_value, 0)::numeric / 100.0));
    elsif v_prize_type = 'discount_amount' then
      v_discount := least(greatest(v_prize_value, 0), v_subtotal);
    else
      v_discount := 0;
    end if;
  end if;

  v_total := greatest(v_subtotal - v_discount, 0);
  if v_total <= 0 then
    raise exception 'Monto final inválido para la orden';
  end if;

  insert into public.orders (
    user_id,
    customer_name,
    customer_email,
    customer_phone,
    customer_address,
    payment_method,
    payment_status,
    fulfillment_status,
    amount_cents,
    currency,
    card_customization,
    requires_invoice,
    invoice_rut,
    invoice_razon_social
  ) values (
    nullif(p_order->>'user_id', '')::uuid,
    trim(p_order->>'customer_name'),
    lower(trim(p_order->>'customer_email')),
    nullif(trim(p_order->>'customer_phone'), ''),
    nullif(trim(p_order->>'customer_address'), ''),
    p_order->>'payment_method',
    'pending',
    'new',
    v_total,
    coalesce(p_order->>'currency', 'CLP'),
    coalesce(p_order->'card_customization', '{}'::jsonb) || jsonb_build_object('desired_slug', v_desired_slug),
    v_requires_invoice,
    v_invoice_rut,
    v_invoice_razon_social
  )
  returning id into v_order_id;

  if v_spin_id is not null then
    update public.wheel_spins
      set redeemed = true,
          redeemed_at = now(),
          order_id = v_order_id
    where id = v_spin_id
      and coalesce(redeemed, false) = false;

    if not found then
      raise exception 'Cupón inválido o ya utilizado';
    end if;
  end if;

  perform public.reserve_profile_slug_for_order(
    v_order_id,
    v_desired_slug,
    lower(trim(p_order->>'customer_email')),
    interval '2 hours'
  );

  insert into public.order_items (order_id, product_id, quantity, unit_price_cents, currency)
  select
    v_order_id,
    p.id,
    greatest(coalesce((item->>'quantity')::integer, 0), 1),
    p.price_cents,
    coalesce(item->>'currency', p_order->>'currency', 'CLP')
  from jsonb_array_elements(p_items) as item
  join public.products p on p.id = (item->>'product_id')::uuid
  where p.deleted_at is null
    and coalesce(p.status, 'active') = 'active';

  return v_order_id;
end;
$$;


ALTER FUNCTION "public"."create_order_with_items"("p_order" "jsonb", "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_cart_update_token"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE
    AS $$
declare
  raw_headers text := current_setting('request.headers', true);
  token text;
begin
  if raw_headers is null or raw_headers = '' then
    return null;
  end if;

  token := nullif(raw_headers::jsonb ->> 'x-cart-token', '');
  if token is null then
    return null;
  end if;

  begin
    return token::uuid;
  exception when invalid_text_representation then
    return null;
  end;
end;
$$;


ALTER FUNCTION "public"."current_cart_update_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_stock"("p_sku" "text", "p_quantity" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE inventory_items
  SET stock = stock - p_quantity,
      updated_at = NOW()
  WHERE sku = p_sku
    AND stock >= p_quantity;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock insuficiente para SKU: %', p_sku;
  END IF;
END;
$$;


ALTER FUNCTION "public"."decrement_stock"("p_sku" "text", "p_quantity" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."emit_order_operational_events"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  bypass_transition boolean := coalesce(current_setting('app.order_transition_bypass', true), '') = 'true';
begin
  if tg_op = 'INSERT' then
    if new.payment_status = 'paid' then
      perform public.log_order_operational_event(new.id, 'paid', 'payment_status_paid', 'orders_trigger', coalesce(new.paid_at, new.created_at, now()), jsonb_build_object('payment_status', new.payment_status));
    end if;

    if new.fulfillment_status in ('ready', 'shipped', 'delivered') then
      perform public.log_order_operational_event(new.id, 'ready', 'fulfillment_ready', 'orders_trigger', coalesce(new.ready_at, new.updated_at, new.created_at, now()), jsonb_build_object('fulfillment_status', new.fulfillment_status));
    end if;

    if new.fulfillment_status in ('shipped', 'delivered') then
      perform public.log_order_operational_event(new.id, 'shipped', 'fulfillment_shipped', 'orders_trigger', coalesce(new.shipped_at, new.updated_at, new.created_at, now()), jsonb_build_object('carrier', new.carrier, 'tracking_code', new.tracking_code));
    end if;

    if new.fulfillment_status = 'delivered' then
      perform public.log_order_operational_event(new.id, 'delivered', 'fulfillment_delivered', 'orders_trigger', coalesce(new.delivered_at, new.updated_at, new.created_at, now()), jsonb_build_object('delivery_confirmed_by', new.delivery_confirmed_by));
    end if;

    return new;
  end if;

  if not bypass_transition and new.payment_status is distinct from old.payment_status then
    perform public.insert_order_history_entry(new.id, 'payment_status', coalesce(old.payment_status, ''), coalesce(new.payment_status, ''));
  end if;

  if not bypass_transition and new.fulfillment_status is distinct from old.fulfillment_status then
    perform public.insert_order_history_entry(new.id, 'fulfillment_status', coalesce(old.fulfillment_status, ''), coalesce(new.fulfillment_status, ''));
  end if;

  if new.paid_at is distinct from old.paid_at then
    perform public.insert_order_history_entry(new.id, 'paid_at', coalesce(old.paid_at::text, ''), coalesce(new.paid_at::text, ''));
  end if;

  if new.ready_at is distinct from old.ready_at then
    perform public.insert_order_history_entry(new.id, 'ready_at', coalesce(old.ready_at::text, ''), coalesce(new.ready_at::text, ''));
  end if;

  if new.activated_at is distinct from old.activated_at then
    perform public.insert_order_history_entry(new.id, 'activated_at', coalesce(old.activated_at::text, ''), coalesce(new.activated_at::text, ''));
  end if;

  if new.payment_status is distinct from old.payment_status and new.payment_status = 'paid' then
    perform public.log_order_operational_event(new.id, 'paid', 'payment_status_paid', 'orders_trigger', coalesce(new.paid_at, now()), jsonb_build_object('old_payment_status', old.payment_status, 'new_payment_status', new.payment_status));
  end if;

  if new.fulfillment_status is distinct from old.fulfillment_status and new.fulfillment_status = 'ready' then
    perform public.log_order_operational_event(new.id, 'ready', 'fulfillment_ready', 'orders_trigger', coalesce(new.ready_at, now()), jsonb_build_object('old_fulfillment_status', old.fulfillment_status, 'new_fulfillment_status', new.fulfillment_status));
  end if;

  if new.fulfillment_status is distinct from old.fulfillment_status and new.fulfillment_status = 'shipped' then
    perform public.log_order_operational_event(new.id, 'shipped', 'fulfillment_shipped', 'orders_trigger', coalesce(new.shipped_at, now()), jsonb_build_object('carrier', new.carrier, 'tracking_code', new.tracking_code));
  end if;

  if new.fulfillment_status is distinct from old.fulfillment_status and new.fulfillment_status = 'delivered' then
    perform public.log_order_operational_event(new.id, 'delivered', 'fulfillment_delivered', 'orders_trigger', coalesce(new.delivered_at, now()), jsonb_build_object('delivery_confirmed_by', new.delivery_confirmed_by));
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."emit_order_operational_events"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_profile_slug_reservation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  normalized text := public.normalize_profile_slug(new.slug);
  active_reservation public.profile_slug_reservations%rowtype;
  caller_user_id uuid := auth.uid();
  jwt_role text := current_setting('request.jwt.claim.role', true);
  allowed_by_claim boolean := false;
begin
  if not public.is_valid_profile_slug(normalized) then
    raise exception 'Usa 3-40 caracteres: letras, números y guiones.' using errcode = 'P0001';
  end if;

  new.slug := normalized;

  perform public.expire_profile_slug_reservations();

  select * into active_reservation
  from public.profile_slug_reservations
  where slug = normalized
    and status = 'reserved'
    and expires_at > now()
  limit 1;

  if active_reservation.id is null then
    return new;
  end if;

  if jwt_role = 'service_role' then
    return new;
  end if;

  select exists (
    select 1
    from public.profile_claims pc
    where pc.order_id = active_reservation.order_id
      and pc.status = 'claimed'
      and pc.claimed_by_user_id = caller_user_id
  ) into allowed_by_claim;

  if not allowed_by_claim then
    raise exception 'Ese usuario está reservado por otra compra. Prueba otro.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_profile_slug_reservation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_order_pending_cards"("target_order_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  current_order public.orders%rowtype;
  expected_count integer := 0;
  existing_count integer := 0;
  missing_count integer := 0;
  claimed_profile_id uuid := null;
  new_card_id uuid;
  first_card_id uuid;
  created_count integer := 0;
begin
  select *
  into current_order
  from public.orders
  where id = target_order_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  if current_order.payment_status <> 'paid' then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'order_not_paid',
      'order_id', target_order_id,
      'payment_status', current_order.payment_status
    );
  end if;

  select greatest(coalesce(sum(oi.quantity), 0), 1)::integer
  into expected_count
  from public.order_items oi
  where oi.order_id = target_order_id
    and coalesce(oi.deleted_at is null, true);

  select pc.claimed_profile_id
  into claimed_profile_id
  from public.profile_claims pc
  where pc.order_id = target_order_id
    and pc.status = 'claimed'
    and pc.claimed_profile_id is not null
  order by pc.updated_at desc nulls last, pc.created_at desc
  limit 1;

  select count(distinct card_id)::integer
  into existing_count
  from (
    select c.id as card_id
    from public.cards c
    where c.order_id = target_order_id
      and c.deleted_at is null

    union

    select oc.card_id
    from public.order_cards oc
    join public.cards c on c.id = oc.card_id
    where oc.order_id = target_order_id
      and c.deleted_at is null
  ) existing_cards;

  missing_count := greatest(expected_count - existing_count, 0);

  for _ in 1..missing_count loop
    insert into public.cards (
      organization_id,
      order_id,
      profile_id,
      public_token,
      status,
      activation_status,
      issued_at,
      assigned_at,
      metadata
    ) values (
      current_order.organization_id,
      target_order_id,
      claimed_profile_id,
      replace(gen_random_uuid()::text, '-', ''),
      'pending_production',
      case when claimed_profile_id is null then 'unassigned' else 'assigned' end,
      now(),
      case when claimed_profile_id is null then null else now() end,
      jsonb_build_object(
        'source', 'ensure_order_pending_cards',
        'mode', 'hybrid_manual_nfc_setup',
        'auto_created_from_paid_order', true
      )
    )
    returning id into new_card_id;

    insert into public.order_cards(order_id, card_id, linked_by)
    values (target_order_id, new_card_id, null)
    on conflict (order_id, card_id) do nothing;

    insert into public.card_events(card_id, event_type, actor_user_id, context)
    values (
      new_card_id,
      'created_from_paid_order',
      null,
      jsonb_build_object(
        'order_id', target_order_id,
        'profile_id', claimed_profile_id,
        'status', 'pending_production',
        'activation_status', case when claimed_profile_id is null then 'unassigned' else 'assigned' end
      )
    );

    insert into public.audit_log(actor_user_id, actor_role, entity_type, entity_id, action, context)
    values (
      null,
      'system',
      'card',
      new_card_id,
      'card_created_from_paid_order',
      jsonb_build_object('order_id', target_order_id, 'profile_id', claimed_profile_id)
    );

    created_count := created_count + 1;
  end loop;

  if claimed_profile_id is not null then
    with updated_cards as (
      update public.cards
      set profile_id = claimed_profile_id,
          activation_status = 'assigned',
          assigned_at = coalesce(assigned_at, now()),
          updated_at = now()
      where order_id = target_order_id
        and deleted_at is null
        and profile_id is null
      returning id
    )
    insert into public.card_events(card_id, event_type, actor_user_id, context)
    select
      id,
      'assigned_to_claimed_profile',
      null,
      jsonb_build_object('order_id', target_order_id, 'profile_id', claimed_profile_id)
    from updated_cards;
  end if;

  select c.id
  into first_card_id
  from public.cards c
  where c.order_id = target_order_id
    and c.deleted_at is null
  order by c.created_at asc
  limit 1;

  if first_card_id is not null then
    update public.profile_claims
    set card_id = coalesce(card_id, first_card_id),
        updated_at = now()
    where order_id = target_order_id
      and card_id is null;
  end if;

  perform public.log_order_operational_event(
    target_order_id,
    'ready',
    case when created_count > 0 then 'pending_cards_created' else 'pending_cards_confirmed' end,
    'ensure_order_pending_cards',
    now(),
    jsonb_build_object(
      'expected_count', expected_count,
      'existing_count', existing_count,
      'created_count', created_count,
      'profile_id', claimed_profile_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'order_id', target_order_id,
    'expected_count', expected_count,
    'existing_count', existing_count,
    'created_count', created_count,
    'profile_id', claimed_profile_id
  );
end;
$$;


ALTER FUNCTION "public"."ensure_order_pending_cards"("target_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_order_pending_cards_from_claim"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status = 'claimed'
     and new.claimed_profile_id is not null
     and (tg_op = 'INSERT'
       or new.status is distinct from old.status
       or new.claimed_profile_id is distinct from old.claimed_profile_id) then
    perform public.ensure_order_pending_cards(new.order_id);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."ensure_order_pending_cards_from_claim"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_order_pending_cards_from_order"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.payment_status = 'paid'
     and (tg_op = 'INSERT' or new.payment_status is distinct from old.payment_status) then
    perform public.ensure_order_pending_cards(new.id);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."ensure_order_pending_cards_from_order"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_profile_slug_reservations"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  affected integer := 0;
begin
  update public.profile_slug_reservations
  set status = 'expired', updated_at = now()
  where status = 'reserved'
    and expires_at <= now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;


ALTER FUNCTION "public"."expire_profile_slug_reservations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_order_folio"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_year text := extract(year from coalesce(new.created_at, now()))::text;
  v_max_suffix integer := 0;
begin
  select coalesce(max(split_part(folio, '-', 3)::integer), 0)
    into v_max_suffix
  from public.orders
  where folio like ('NX-' || v_year || '-%');

  perform setval('public.order_folio_seq', greatest(v_max_suffix, 0), true);

  new.folio := 'NX-' || v_year || '-' || lpad(nextval('public.order_folio_seq')::text, 3, '0');
  return new;
end;
$$;


ALTER FUNCTION "public"."generate_order_folio"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_membership_role"("org_id" "uuid") RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM memberships WHERE user_id = auth.uid() AND organization_id = org_id LIMIT 1;
$$;


ALTER FUNCTION "public"."get_my_membership_role"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_orders_sensitive_updates"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  bypass_enabled text := current_setting('app.order_transition_bypass', true);
begin
  if bypass_enabled = 'true' then
    return new;
  end if;

  if new.payment_status is distinct from old.payment_status
     or new.fulfillment_status is distinct from old.fulfillment_status
     or new.carrier is distinct from old.carrier
     or new.tracking_code is distinct from old.tracking_code
     or new.shipped_at is distinct from old.shipped_at
     or new.delivered_at is distinct from old.delivered_at
     or new.inventory_reserved is distinct from old.inventory_reserved
     or new.inventory_reserved_at is distinct from old.inventory_reserved_at
     or new.inventory_decremented is distinct from old.inventory_decremented
     or new.inventory_decremented_at is distinct from old.inventory_decremented_at then
    raise exception 'Los campos sensibles de órdenes solo pueden cambiarse mediante RPCs protegidos';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."guard_orders_sensitive_updates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("required_role" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.role = required_role
      and m.deleted_at is null
  );
$$;


ALTER FUNCTION "public"."has_role"("required_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_view_count"("profile_slug" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  UPDATE public.profiles
  SET view_count = view_count + 1
  WHERE slug = profile_slug
    AND status = 'active';
$$;


ALTER FUNCTION "public"."increment_view_count"("profile_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_order_history_entry"("p_order_id" "uuid", "p_field" "text", "p_old_value" "text", "p_new_value" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_old_value is distinct from p_new_value then
    insert into public.order_status_history (order_id, field, old_value, new_value)
    values (p_order_id, p_field, p_old_value, p_new_value);
  end if;
end;
$$;


ALTER FUNCTION "public"."insert_order_history_entry"("p_order_id" "uuid", "p_field" "text", "p_old_value" "text", "p_new_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_org_member"("target_org" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.organization_id = target_org
      and m.deleted_at is null
  );
$$;


ALTER FUNCTION "public"."is_org_member"("target_org" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_chilean_rut"("raw_rut" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
declare
  clean text;
  body text;
  check_digit text;
  reversed_body text;
  sum_value integer := 0;
  multiplier integer := 2;
  i integer;
  digit integer;
  remainder integer;
  expected text;
begin
  clean := upper(regexp_replace(coalesce(raw_rut, ''), '[^0-9K]', '', 'g'));
  if clean !~ '^[0-9]{7,8}[0-9K]$' then
    return false;
  end if;

  body := substring(clean from 1 for length(clean) - 1);
  check_digit := substring(clean from length(clean) for 1);
  reversed_body := reverse(body);

  for i in 1..length(reversed_body) loop
    digit := substring(reversed_body from i for 1)::integer;
    sum_value := sum_value + (digit * multiplier);
    multiplier := multiplier + 1;
    if multiplier > 7 then
      multiplier := 2;
    end if;
  end loop;

  remainder := 11 - (sum_value % 11);
  expected := case
    when remainder = 11 then '0'
    when remainder = 10 then 'K'
    else remainder::text
  end;

  return expected = check_digit;
end;
$_$;


ALTER FUNCTION "public"."is_valid_chilean_rut"("raw_rut" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_profile_slug"("input" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $_$
  select coalesce(input, '') ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'
$_$;


ALTER FUNCTION "public"."is_valid_profile_slug"("input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_order_card"("target_order_id" "uuid", "target_card_id" "uuid", "actor_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  current_card record;
  existing_link record;
begin
  select id, status, activation_status, profile_id
  into current_card
  from public.cards
  where id = target_card_id;

  if not found then
    raise exception 'card_not_found';
  end if;

  select *
  into existing_link
  from public.order_cards
  where card_id = target_card_id;

  if found and existing_link.order_id <> target_order_id then
    raise exception 'card_already_linked_to_other_order';
  end if;

  insert into public.order_cards(order_id, card_id, linked_by)
  values (target_order_id, target_card_id, actor_id)
  on conflict (order_id, card_id) do update
    set linked_by = excluded.linked_by
  returning * into existing_link;

  insert into public.audit_log(entity_type, entity_id, action, context)
  values (
    'order',
    target_order_id,
    'link_card',
    jsonb_build_object(
      'actor_id', actor_id,
      'card_id', target_card_id,
      'card_status', current_card.status,
      'activation_status', current_card.activation_status,
      'profile_id', current_card.profile_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'order_id', target_order_id,
    'card_id', target_card_id
  );
end;
$$;


ALTER FUNCTION "public"."link_order_card"("target_order_id" "uuid", "target_card_id" "uuid", "actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_email_event"("p_recipient_email" "text", "p_email_type" "text", "p_order_id" "uuid" DEFAULT NULL::"uuid", "p_subject" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT 'sent'::"text", "p_provider" "text" DEFAULT 'resend'::"text", "p_provider_message_id" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  inserted_id uuid;
begin
  if p_recipient_email is null or btrim(p_recipient_email) = '' then
    raise exception 'recipient_email requerido';
  end if;

  insert into public.email_log (
    recipient_email,
    email_type,
    order_id,
    subject,
    status,
    provider,
    provider_message_id,
    metadata
  ) values (
    lower(trim(p_recipient_email)),
    p_email_type,
    p_order_id,
    p_subject,
    coalesce(p_status, 'sent'),
    coalesce(p_provider, 'resend'),
    p_provider_message_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;


ALTER FUNCTION "public"."log_email_event"("p_recipient_email" "text", "p_email_type" "text", "p_order_id" "uuid", "p_subject" "text", "p_status" "text", "p_provider" "text", "p_provider_message_id" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_order_operational_event"("p_order_id" "uuid", "p_stage" "text", "p_event_type" "text", "p_source" "text" DEFAULT 'system'::"text", "p_event_at" timestamp with time zone DEFAULT "now"(), "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.order_operational_events (
    order_id,
    stage,
    event_type,
    source,
    event_at,
    payload
  ) values (
    p_order_id,
    p_stage,
    p_event_type,
    coalesce(nullif(trim(p_source), ''), 'system'),
    coalesce(p_event_at, now()),
    coalesce(p_payload, '{}'::jsonb)
  );
end;
$$;


ALTER FUNCTION "public"."log_order_operational_event"("p_order_id" "uuid", "p_stage" "text", "p_event_type" "text", "p_source" "text", "p_event_at" timestamp with time zone, "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_abandoned_cart_converted_public"("cart_id" "uuid", "cart_update_token" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  updated_count integer;
begin
  if cart_id is null or cart_update_token is null then
    return false;
  end if;

  update public.abandoned_carts
     set status = 'converted',
         converted_at = now(),
         updated_at = now()
   where id = cart_id
     and update_token = cart_update_token
     and status in ('abandoned', 'email_sent');

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;


ALTER FUNCTION "public"."mark_abandoned_cart_converted_public"("cart_id" "uuid", "cart_update_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_order_activated"("target_order_id" "uuid", "target_card_id" "uuid" DEFAULT NULL::"uuid", "p_source" "text" DEFAULT 'system'::"text", "p_payload" "jsonb" DEFAULT '{}'::"jsonb", "p_activated_at" timestamp with time zone DEFAULT "now"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  current_order public.orders%rowtype;
  activation_time timestamptz := coalesce(p_activated_at, now());
  event_type text := 'activation_reconfirmed';
begin
  select *
  into current_order
  from public.orders
  where id = target_order_id
  for update;

  if not found then
    raise exception 'Orden no encontrada';
  end if;

  if current_order.deleted_at is not null then
    raise exception 'No puedes activar una orden archivada';
  end if;

  if current_order.activated_at is null then
    update public.orders
    set activated_at = activation_time,
        updated_at = now()
    where id = target_order_id;

    event_type := 'activation_completed';
  end if;

  perform public.log_order_operational_event(
    target_order_id,
    'activated',
    event_type,
    p_source,
    activation_time,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('card_id', target_card_id)
  );

  return jsonb_build_object(
    'order_id', target_order_id,
    'activated_at', coalesce(current_order.activated_at, activation_time),
    'event_type', event_type
  );
end;
$$;


ALTER FUNCTION "public"."mark_order_activated"("target_order_id" "uuid", "target_card_id" "uuid", "p_source" "text", "p_payload" "jsonb", "p_activated_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_order_fulfillment_status"("target_order_id" "uuid", "new_status" "text", "actor_id" "uuid", "reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  before_state jsonb;
  current_status text;
begin
  if new_status not in ('new', 'printing', 'shipping', 'delivered', 'canceled') then
    raise exception 'Invalid order fulfillment status: %', new_status;
  end if;

  select to_jsonb(o), o.fulfillment_status
  into before_state, current_status
  from public.orders o
  where o.id = target_order_id;

  if before_state is null then
    raise exception 'Order not found';
  end if;

  if (before_state ->> 'deleted_at') is not null then
    raise exception 'Cannot change fulfillment status on soft deleted order';
  end if;

  if current_status = new_status then
    raise exception 'Order fulfillment status already %', new_status;
  end if;

  perform public.snapshot_order(target_order_id, actor_id);

  update public.orders
  set fulfillment_status = new_status,
      updated_at = now()
  where id = target_order_id;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'order',
    target_order_id,
    'order_fulfillment_status_change',
    before_state,
    (select to_jsonb(o) from public.orders o where o.id = target_order_id),
    jsonb_build_object(
      'from_status', current_status,
      'to_status', new_status,
      'reason', reason
    )
  );
end;
$$;


ALTER FUNCTION "public"."mark_order_fulfillment_status"("target_order_id" "uuid", "new_status" "text", "actor_id" "uuid", "reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_order_payment_status"("target_order_id" "uuid", "new_status" "text", "actor_id" "uuid", "reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  before_state jsonb;
  current_status text;
begin
  if new_status not in ('pending', 'authorized', 'paid', 'failed', 'refunded') then
    raise exception 'Invalid order payment status: %', new_status;
  end if;

  select to_jsonb(o), o.payment_status
  into before_state, current_status
  from public.orders o
  where o.id = target_order_id;

  if before_state is null then
    raise exception 'Order not found';
  end if;

  if (before_state ->> 'deleted_at') is not null then
    raise exception 'Cannot change payment status on soft deleted order';
  end if;

  if current_status = new_status then
    raise exception 'Order payment status already %', new_status;
  end if;

  perform public.snapshot_order(target_order_id, actor_id);

  update public.orders
  set payment_status = new_status,
      updated_at = now()
  where id = target_order_id;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'order',
    target_order_id,
    'order_payment_status_change',
    before_state,
    (select to_jsonb(o) from public.orders o where o.id = target_order_id),
    jsonb_build_object(
      'from_status', current_status,
      'to_status', new_status,
      'reason', reason
    )
  );
end;
$$;


ALTER FUNCTION "public"."mark_order_payment_status"("target_order_id" "uuid", "new_status" "text", "actor_id" "uuid", "reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_payment_status"("target_payment_id" "uuid", "new_status" "text", "actor_id" "uuid", "reason" "text" DEFAULT NULL::"text", "external_ref" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  before_state jsonb;
  current_status text;
  current_external_id text;
begin
  if new_status not in ('pending', 'authorized', 'paid', 'failed', 'refunded') then
    raise exception 'Invalid payment status: %', new_status;
  end if;

  select to_jsonb(p), p.status, p.external_id
  into before_state, current_status, current_external_id
  from public.payments p
  where p.id = target_payment_id;

  if before_state is null then
    raise exception 'Payment not found';
  end if;

  if (before_state ->> 'deleted_at') is not null then
    raise exception 'Cannot change status on soft deleted payment';
  end if;

  if current_status = new_status
     and coalesce(current_external_id, '') = coalesce(external_ref, current_external_id, '') then
    raise exception 'Payment status/external reference already in requested state';
  end if;

  perform public.snapshot_payment(target_payment_id, actor_id);

  update public.payments
  set status = new_status,
      external_id = coalesce(external_ref, external_id),
      updated_at = now()
  where id = target_payment_id;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'payment',
    target_payment_id,
    'payment_status_change',
    before_state,
    (select to_jsonb(p) from public.payments p where p.id = target_payment_id),
    jsonb_build_object(
      'from_status', current_status,
      'to_status', new_status,
      'from_external_id', current_external_id,
      'to_external_id', coalesce(external_ref, current_external_id),
      'reason', reason
    )
  );
end;
$$;


ALTER FUNCTION "public"."mark_payment_status"("target_payment_id" "uuid", "new_status" "text", "actor_id" "uuid", "reason" "text", "external_ref" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_profile_slug"("input" "text") RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select regexp_replace(
    regexp_replace(
      trim(lower(unaccent(coalesce(input, '')))),
      '[^a-z0-9\s-]', '', 'g'
    ),
    '[\s-]+', '-', 'g'
  )
$$;


ALTER FUNCTION "public"."normalize_profile_slug"("input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_profile_status_self_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if coalesce(auth.role(), '') = 'service_role' or coalesce(public.has_role('admin'), false) then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    raise exception 'profile_status_admin_only' using errcode = '42501';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_profile_status_self_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reassign_card"("target_card_id" "uuid", "target_profile_id" "uuid", "actor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  current_card record;
begin
  if target_card_id is null then
    raise exception 'target_card_id is required';
  end if;

  if target_profile_id is null then
    raise exception 'target_profile_id is required';
  end if;

  select * into current_card
  from public.cards
  where id = target_card_id;

  if current_card.id is null then
    raise exception 'card_not_found';
  end if;

  if current_card.deleted_at is not null or current_card.status = 'archived' then
    raise exception 'cannot_reassign_archived_card';
  end if;

  if current_card.status = 'revoked' then
    raise exception 'cannot_reassign_revoked_card';
  end if;

  if current_card.activation_status = 'activated' or current_card.status = 'active' then
    raise exception 'cannot_reassign_active_card';
  end if;

  if current_card.profile_id = target_profile_id then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'already_assigned',
      'card_id', target_card_id,
      'profile_id', target_profile_id
    );
  end if;

  update public.cards
  set
    profile_id = target_profile_id,
    status = 'assigned',
    activation_status = 'assigned'
  where id = target_card_id;

  insert into public.card_events (
    card_id,
    event_type,
    created_at
  ) values (
    target_card_id,
    'reassigned',
    now()
  );

  insert into public.audit_log (
    actor_user_id,
    entity_type,
    entity_id,
    action,
    context,
    created_at
  ) values (
    actor_id,
    'card',
    target_card_id,
    'reassign',
    jsonb_build_object(
      'previous_profile_id', current_card.profile_id,
      'new_profile_id', target_profile_id,
      'previous_status', current_card.status,
      'previous_activation_status', current_card.activation_status
    ),
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'card_id', target_card_id,
    'previous_profile_id', current_card.profile_id,
    'profile_id', target_profile_id
  );
end;
$$;


ALTER FUNCTION "public"."reassign_card"("target_card_id" "uuid", "target_profile_id" "uuid", "actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reconcile_order_payment_status"("target_order_id" "uuid", "actor_id" "uuid" DEFAULT NULL::"uuid", "reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  current_order public.orders%rowtype;
  queue_row public.order_payment_reconciliation_queue%rowtype;
  next_fulfillment text;
  effective_reason text := coalesce(reason, 'payment_ledger_reconciliation');
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.has_role('admin') then
    raise exception 'Solo admins o service role pueden reconciliar órdenes';
  end if;

  select *
  into current_order
  from public.orders
  where id = target_order_id
  for update;

  if not found then
    raise exception 'Orden no encontrada';
  end if;

  if current_order.deleted_at is not null then
    raise exception 'No puedes reconciliar una orden archivada';
  end if;

  select *
  into queue_row
  from public.order_payment_reconciliation_queue
  where order_id = target_order_id;

  if queue_row.active_payments = 0 then
    return jsonb_build_object(
      'order_id', target_order_id,
      'changed', false,
      'status', 'missing_active_payment_ledger',
      'order_payment_status', current_order.payment_status,
      'payment_statuses', queue_row.payment_statuses
    );
  end if;

  if queue_row.suggested_order_payment_status is null then
    return jsonb_build_object(
      'order_id', target_order_id,
      'changed', false,
      'status', 'no_recommendation',
      'order_payment_status', current_order.payment_status,
      'payment_statuses', queue_row.payment_statuses
    );
  end if;

  if queue_row.suggested_order_payment_status = current_order.payment_status then
    return jsonb_build_object(
      'order_id', target_order_id,
      'changed', false,
      'status', 'already_aligned',
      'order_payment_status', current_order.payment_status,
      'payment_statuses', queue_row.payment_statuses
    );
  end if;

  if current_order.payment_status = 'paid' and queue_row.suggested_order_payment_status not in ('paid', 'refunded') then
    return jsonb_build_object(
      'order_id', target_order_id,
      'changed', false,
      'status', 'manual_review_required',
      'order_payment_status', current_order.payment_status,
      'suggested_order_payment_status', queue_row.suggested_order_payment_status,
      'payment_statuses', queue_row.payment_statuses,
      'reason', 'paid_order_would_be_downgraded'
    );
  end if;

  if current_order.payment_status = 'refunded' and queue_row.suggested_order_payment_status <> 'refunded' then
    return jsonb_build_object(
      'order_id', target_order_id,
      'changed', false,
      'status', 'manual_review_required',
      'order_payment_status', current_order.payment_status,
      'suggested_order_payment_status', queue_row.suggested_order_payment_status,
      'payment_statuses', queue_row.payment_statuses,
      'reason', 'refunded_order_should_not_be_reopened'
    );
  end if;

  next_fulfillment := case
    when queue_row.suggested_order_payment_status = 'paid' and current_order.fulfillment_status = 'new' then 'in_production'
    else null
  end;

  perform public.admin_transition_order_state(
    target_order_id,
    queue_row.suggested_order_payment_status,
    next_fulfillment,
    effective_reason
  );

  return jsonb_build_object(
    'order_id', target_order_id,
    'changed', true,
    'status', 'reconciled',
    'from_payment_status', current_order.payment_status,
    'to_payment_status', queue_row.suggested_order_payment_status,
    'next_fulfillment_status', coalesce(next_fulfillment, current_order.fulfillment_status),
    'payment_statuses', queue_row.payment_statuses
  );
end;
$$;


ALTER FUNCTION "public"."reconcile_order_payment_status"("target_order_id" "uuid", "actor_id" "uuid", "reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_wheel_spin_email"("p_spin_id" "uuid", "p_visitor_id" "text", "p_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  p_visitor_id := nullif(trim(p_visitor_id), '');
  p_email := lower(nullif(trim(p_email), ''));
  if p_spin_id is null or p_visitor_id is null or p_email is null or position('@' in p_email) <= 1 then
    return false;
  end if;

  update public.wheel_spins
    set email = p_email
  where id = p_spin_id
    and visitor_id = p_visitor_id
    and email is null;

  return found;
end;
$$;


ALTER FUNCTION "public"."record_wheel_spin_email"("p_spin_id" "uuid", "p_visitor_id" "text", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_inventory_for_order"("target_order_id" "uuid", "actor_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  req_rec record;
  reserved_count integer := 0;
begin
  if target_order_id is null then
    raise exception 'target_order_id is required';
  end if;

  if exists (
    select 1
    from public.inventory_movements m
    where m.order_id = target_order_id
      and m.movement_type = 'out'
  ) then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'already_reserved'
    );
  end if;

  for req_rec in
    select
      oi.order_id,
      oi.product_id,
      oi.quantity as order_quantity,
      pir.inventory_item_id,
      pir.quantity_required,
      ii.item as inventory_item_name,
      ii.stock as current_stock
    from public.order_items oi
    join public.product_inventory_requirements pir
      on pir.product_id = oi.product_id
    join public.inventory_items ii
      on ii.id = pir.inventory_item_id
    where oi.order_id = target_order_id
      and oi.deleted_at is null
  loop
    if coalesce(req_rec.current_stock, 0) < (coalesce(req_rec.order_quantity, 0) * coalesce(req_rec.quantity_required, 0)) then
      raise exception 'Insufficient stock for %, available %, needed %',
        req_rec.inventory_item_name,
        coalesce(req_rec.current_stock, 0),
        (coalesce(req_rec.order_quantity, 0) * coalesce(req_rec.quantity_required, 0));
    end if;
  end loop;

  for req_rec in
    select
      oi.order_id,
      oi.product_id,
      oi.quantity as order_quantity,
      pir.inventory_item_id,
      pir.quantity_required,
      ii.item as inventory_item_name
    from public.order_items oi
    join public.product_inventory_requirements pir
      on pir.product_id = oi.product_id
    join public.inventory_items ii
      on ii.id = pir.inventory_item_id
    where oi.order_id = target_order_id
      and oi.deleted_at is null
  loop
    insert into public.inventory_movements (
      inventory_item_id,
      movement_type,
      quantity,
      reason,
      order_id,
      created_at
    ) values (
      req_rec.inventory_item_id,
      'out',
      (coalesce(req_rec.order_quantity, 0) * coalesce(req_rec.quantity_required, 0)),
      format('Reserva automática por orden %s', target_order_id),
      target_order_id,
      now()
    );

    update public.inventory_items
    set stock = stock - (coalesce(req_rec.order_quantity, 0) * coalesce(req_rec.quantity_required, 0))
    where id = req_rec.inventory_item_id;

    reserved_count := reserved_count + 1;
  end loop;

  insert into public.audit_log (
    actor_user_id,
    entity_type,
    entity_id,
    action,
    context,
    created_at
  ) values (
    actor_id,
    'order',
    target_order_id,
    'inventory_reserved',
    jsonb_build_object('reserved_rows', reserved_count),
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'skipped', false,
    'reserved_rows', reserved_count
  );
end;
$$;


ALTER FUNCTION "public"."reserve_inventory_for_order"("target_order_id" "uuid", "actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_profile_slug_for_order"("target_order_id" "uuid", "candidate_slug" "text", "customer_email" "text", "reserve_for" interval DEFAULT '02:00:00'::interval) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  normalized text := public.normalize_profile_slug(candidate_slug);
  availability jsonb;
  existing_reservation public.profile_slug_reservations%rowtype;
begin
  availability := public.check_profile_slug_availability(normalized, target_order_id);
  if coalesce((availability->>'available')::boolean, false) is not true then
    raise exception '%', availability->>'message' using errcode = 'P0001';
  end if;

  delete from public.profile_slug_reservations
  where slug = normalized
    and status in ('expired', 'released');

  select * into existing_reservation
  from public.profile_slug_reservations
  where order_id = target_order_id
  for update;

  if existing_reservation.id is not null then
    if existing_reservation.status = 'consumed' then
      raise exception 'La reserva de usuario ya fue consumida para esta orden' using errcode = 'P0001';
    end if;

    update public.profile_slug_reservations
    set slug = normalized,
        customer_email = lower(trim(customer_email)),
        status = 'reserved',
        expires_at = now() + reserve_for,
        consumed_at = null,
        released_at = null,
        updated_at = now()
    where id = existing_reservation.id;
  else
    insert into public.profile_slug_reservations(slug, order_id, customer_email, expires_at)
    values (normalized, target_order_id, lower(trim(customer_email)), now() + reserve_for);
  end if;

  return jsonb_build_object(
    'reserved', true,
    'slug', normalized,
    'order_id', target_order_id,
    'expires_at', now() + reserve_for
  );
end;
$$;


ALTER FUNCTION "public"."reserve_profile_slug_for_order"("target_order_id" "uuid", "candidate_slug" "text", "customer_email" "text", "reserve_for" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_card_by_token"("input_token" "text") RETURNS TABLE("card_id" "uuid", "profile_id" "uuid", "organization_id" "uuid", "public_token" "text", "status" "text", "activation_status" "text", "slug" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    c.id as card_id,
    c.profile_id,
    c.organization_id,
    c.public_token,
    c.status,
    c.activation_status,
    p.slug
  from public.cards c
  left join public.profiles p on p.id = c.profile_id
  where c.public_token = input_token
    and c.deleted_at is null
  limit 1
$$;


ALTER FUNCTION "public"."resolve_card_by_token"("input_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_profile_version"("target_profile_id" "uuid", "target_version" integer, "actor_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  restore_snapshot jsonb;
  before_state jsonb;
begin
  select snapshot
  into restore_snapshot
  from public.profile_versions
  where profile_id = target_profile_id
    and version = target_version;

  if restore_snapshot is null then
    raise exception 'Profile version not found';
  end if;

  select to_jsonb(p)
  into before_state
  from public.profiles p
  where p.id = target_profile_id;

  if before_state is null then
    raise exception 'Profile not found';
  end if;

  perform public.snapshot_profile(target_profile_id, actor_id);

  update public.profiles
  set slug = restore_snapshot->>'slug',
      full_name = restore_snapshot->>'full_name',
      profession = restore_snapshot->>'profession',
      bio = restore_snapshot->>'bio',
      avatar_url = restore_snapshot->>'avatar_url',
      theme_color = restore_snapshot->>'theme_color',
      is_dark_mode = coalesce((restore_snapshot->>'is_dark_mode')::boolean, is_dark_mode),
      whatsapp = restore_snapshot->>'whatsapp',
      instagram = restore_snapshot->>'instagram',
      linkedin = restore_snapshot->>'linkedin',
      website = restore_snapshot->>'website',
      vcard_enabled = coalesce((restore_snapshot->>'vcard_enabled')::boolean, vcard_enabled),
      calendar_url = restore_snapshot->>'calendar_url',
      bank_enabled = coalesce((restore_snapshot->>'bank_enabled')::boolean, bank_enabled),
      bank_name = restore_snapshot->>'bank_name',
      bank_type = restore_snapshot->>'bank_type',
      bank_number = restore_snapshot->>'bank_number',
      bank_rut = restore_snapshot->>'bank_rut',
      bank_email = restore_snapshot->>'bank_email',
      view_count = coalesce((restore_snapshot->>'view_count')::integer, view_count),
      status = coalesce(restore_snapshot->>'status', status),
      account_type = restore_snapshot->>'account_type',
      tiktok = restore_snapshot->>'tiktok',
      whatsapp_enabled = coalesce((restore_snapshot->>'whatsapp_enabled')::boolean, whatsapp_enabled),
      instagram_enabled = coalesce((restore_snapshot->>'instagram_enabled')::boolean, instagram_enabled),
      linkedin_enabled = coalesce((restore_snapshot->>'linkedin_enabled')::boolean, linkedin_enabled),
      tiktok_enabled = coalesce((restore_snapshot->>'tiktok_enabled')::boolean, tiktok_enabled),
      website_enabled = coalesce((restore_snapshot->>'website_enabled')::boolean, website_enabled),
      calendar_url_enabled = coalesce((restore_snapshot->>'calendar_url_enabled')::boolean, calendar_url_enabled),
      company = restore_snapshot->>'company',
      location = restore_snapshot->>'location',
      contact_email = restore_snapshot->>'contact_email',
      contact_phone = restore_snapshot->>'contact_phone',
      facebook = restore_snapshot->>'facebook',
      facebook_enabled = coalesce((restore_snapshot->>'facebook_enabled')::boolean, facebook_enabled),
      contact_phone_enabled = coalesce((restore_snapshot->>'contact_phone_enabled')::boolean, contact_phone_enabled),
      contact_email_enabled = coalesce((restore_snapshot->>'contact_email_enabled')::boolean, contact_email_enabled),
      portfolio_url = restore_snapshot->>'portfolio_url',
      portfolio_enabled = coalesce((restore_snapshot->>'portfolio_enabled')::boolean, portfolio_enabled),
      cover_image_url = restore_snapshot->>'cover_image_url',
      deleted_at = null,
      updated_at = now()
  where id = target_profile_id;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'profile',
    target_profile_id,
    'profile_restore',
    before_state,
    (select to_jsonb(p) from public.profiles p where p.id = target_profile_id),
    jsonb_build_object('restored_version', target_version)
  );
end;
$$;


ALTER FUNCTION "public"."restore_profile_version"("target_profile_id" "uuid", "target_version" integer, "actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_card"("target_card_id" "uuid", "actor_id" "uuid", "reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  before_state jsonb;
begin
  select to_jsonb(c)
  into before_state
  from public.cards c
  where c.id = target_card_id;

  if before_state is null then
    raise exception 'Card not found';
  end if;

  perform public.snapshot_card(target_card_id, actor_id);

  update public.cards
  set status = 'revoked',
      activation_status = 'revoked',
      revoked_at = now(),
      updated_at = now()
  where id = target_card_id;

  insert into public.card_events (card_id, event_type, actor_user_id, context)
  values (
    target_card_id,
    'revoked',
    actor_id,
    jsonb_build_object('reason', reason)
  );

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'card',
    target_card_id,
    'card_revoke',
    before_state,
    (select to_jsonb(c) from public.cards c where c.id = target_card_id),
    jsonb_build_object('reason', reason)
  );
end;
$$;


ALTER FUNCTION "public"."revoke_card"("target_card_id" "uuid", "actor_id" "uuid", "reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_abandoned_cart_public"("cart_email" "text", "cart_customer_name" "text", "cart_items" "jsonb", "cart_total_cents" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  existing_cart public.abandoned_carts;
  saved_cart public.abandoned_carts;
begin
  if nullif(trim(cart_email), '') is null then
    raise exception 'email_required' using errcode = '23502';
  end if;
  if cart_items is null or jsonb_typeof(cart_items) <> 'array' then
    raise exception 'items_required' using errcode = '23502';
  end if;
  if coalesce(cart_total_cents, -1) < 0 then
    raise exception 'invalid_total' using errcode = '22003';
  end if;

  select * into existing_cart
    from public.abandoned_carts
   where lower(email) = lower(trim(cart_email))
     and status in ('abandoned', 'email_sent')
     and created_at >= now() - interval '2 hours'
   order by created_at desc
   limit 1;

  if existing_cart.id is not null then
    update public.abandoned_carts
       set customer_name = nullif(trim(cart_customer_name), ''),
           items = cart_items,
           total_cents = cart_total_cents,
           updated_at = now()
     where id = existing_cart.id
     returning * into saved_cart;
  else
    insert into public.abandoned_carts (email, customer_name, items, total_cents, status)
    values (lower(trim(cart_email)), nullif(trim(cart_customer_name), ''), cart_items, cart_total_cents, 'abandoned')
    returning * into saved_cart;
  end if;

  return jsonb_build_object('id', saved_cart.id, 'update_token', saved_cart.update_token);
end;
$$;


ALTER FUNCTION "public"."save_abandoned_cart_public"("cart_email" "text", "cart_customer_name" "text", "cart_items" "jsonb", "cart_total_cents" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_kpi_alert_state_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_kpi_alert_state_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_kpi_runtime_config_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_kpi_runtime_config_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_order_operational_timestamps"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.payment_status = 'paid' and new.paid_at is null then
    new.paid_at := coalesce(new.paid_at, now());
  end if;

  if new.fulfillment_status in ('ready', 'shipped', 'delivered') and new.ready_at is null then
    new.ready_at := coalesce(new.shipped_at, new.delivered_at, now());
  end if;

  if new.fulfillment_status = 'shipped' and new.shipped_at is null then
    new.shipped_at := now();
  end if;

  if new.fulfillment_status = 'delivered' and new.delivered_at is null then
    new.delivered_at := now();
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_order_operational_timestamps"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "organization_id" "uuid",
    "slug" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "profession" "text",
    "bio" "text",
    "avatar_url" "text",
    "theme_color" "text" DEFAULT '#10B981'::"text",
    "is_dark_mode" boolean DEFAULT true,
    "whatsapp" "text",
    "instagram" "text",
    "linkedin" "text",
    "website" "text",
    "vcard_enabled" boolean DEFAULT true,
    "calendar_url" "text",
    "bank_enabled" boolean DEFAULT false,
    "bank_name" "text",
    "bank_type" "text",
    "bank_number" "text",
    "bank_rut" "text",
    "bank_email" "text",
    "view_count" integer DEFAULT 0,
    "status" "text" DEFAULT 'active'::"text",
    "account_type" "text" DEFAULT 'individual'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tiktok" "text",
    "whatsapp_enabled" boolean DEFAULT true,
    "instagram_enabled" boolean DEFAULT true,
    "linkedin_enabled" boolean DEFAULT true,
    "tiktok_enabled" boolean DEFAULT true,
    "website_enabled" boolean DEFAULT true,
    "calendar_url_enabled" boolean DEFAULT true,
    "company" "text",
    "location" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "facebook" "text",
    "facebook_enabled" boolean DEFAULT true,
    "contact_phone_enabled" boolean DEFAULT true,
    "contact_email_enabled" boolean DEFAULT true,
    "portfolio_url" "text",
    "portfolio_enabled" boolean DEFAULT true,
    "cover_image_url" "text",
    "deleted_at" timestamp with time zone,
    "card_type" "text" DEFAULT 'nfc'::"text" NOT NULL,
    "review_url" "text",
    CONSTRAINT "chk_bio_length" CHECK (("char_length"("bio") <= 500)),
    CONSTRAINT "chk_full_name_length" CHECK (("char_length"("full_name") <= 120)),
    CONSTRAINT "chk_profession_length" CHECK (("char_length"("profession") <= 150)),
    CONSTRAINT "chk_slug_length" CHECK (("char_length"("slug") <= 80)),
    CONSTRAINT "chk_theme_color_format" CHECK ((("theme_color" ~ '^#[0-9A-Fa-f]{6}$'::"text") OR ("theme_color" IS NULL))),
    CONSTRAINT "chk_whatsapp_format" CHECK ((("whatsapp" ~ '^[0-9+\s\-()]{7,20}$'::"text") OR ("whatsapp" IS NULL))),
    CONSTRAINT "profiles_account_type_check" CHECK (("account_type" = ANY (ARRAY['individual'::"text", 'company'::"text"]))),
    CONSTRAINT "profiles_card_type_check" CHECK (("card_type" = ANY (ARRAY['nfc'::"text", 'review'::"text"]))),
    CONSTRAINT "profiles_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'disabled'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_profile_status"("profile_id" "uuid", "new_status" "text") RETURNS "public"."profiles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  updated_profile public.profiles;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not coalesce(public.has_role('admin'), false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  update public.profiles
     set status = new_status,
         updated_at = coalesce(now(), updated_at)
   where id = profile_id
   returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  return updated_profile;
end;
$$;


ALTER FUNCTION "public"."set_profile_status"("profile_id" "uuid", "new_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."snapshot_card"("target_card_id" "uuid", "actor_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  before_state jsonb;
begin
  select to_jsonb(c)
  into before_state
  from public.cards c
  where c.id = target_card_id;

  if before_state is null then
    raise exception 'Card not found';
  end if;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'card',
    target_card_id,
    'card_snapshot',
    before_state,
    null,
    '{}'::jsonb
  );
end;
$$;


ALTER FUNCTION "public"."snapshot_card"("target_card_id" "uuid", "actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."snapshot_order"("target_order_id" "uuid", "actor_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  before_state jsonb;
begin
  select to_jsonb(o)
  into before_state
  from public.orders o
  where o.id = target_order_id;

  if before_state is null then
    raise exception 'Order not found';
  end if;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'order',
    target_order_id,
    'order_snapshot',
    before_state,
    null,
    '{}'::jsonb
  );
end;
$$;


ALTER FUNCTION "public"."snapshot_order"("target_order_id" "uuid", "actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."snapshot_payment"("target_payment_id" "uuid", "actor_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  before_state jsonb;
begin
  select to_jsonb(p)
  into before_state
  from public.payments p
  where p.id = target_payment_id;

  if before_state is null then
    raise exception 'Payment not found';
  end if;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'payment',
    target_payment_id,
    'payment_snapshot',
    before_state,
    null,
    '{}'::jsonb
  );
end;
$$;


ALTER FUNCTION "public"."snapshot_payment"("target_payment_id" "uuid", "actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."snapshot_profile"("target_profile_id" "uuid", "actor_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  next_version integer;
  current_profile jsonb;
begin
  select to_jsonb(p)
  into current_profile
  from public.profiles p
  where p.id = target_profile_id;

  if current_profile is null then
    raise exception 'Profile not found';
  end if;

  select coalesce(max(version), 0) + 1
  into next_version
  from public.profile_versions
  where profile_id = target_profile_id;

  insert into public.profile_versions (profile_id, version, snapshot, created_by)
  values (target_profile_id, next_version, current_profile, actor_id);

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'profile',
    target_profile_id,
    'profile_snapshot',
    current_profile,
    null,
    jsonb_build_object('version', next_version)
  );

  return next_version;
end;
$$;


ALTER FUNCTION "public"."snapshot_profile"("target_profile_id" "uuid", "actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_card"("target_card_id" "uuid", "actor_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  before_state jsonb;
begin
  select to_jsonb(c)
  into before_state
  from public.cards c
  where c.id = target_card_id;

  if before_state is null then
    raise exception 'Card not found';
  end if;

  perform public.snapshot_card(target_card_id, actor_id);

  update public.cards
  set deleted_at = now(),
      status = 'archived',
      updated_at = now()
  where id = target_card_id;

  insert into public.card_events (card_id, event_type, actor_user_id, context)
  values (
    target_card_id,
    'soft_deleted',
    actor_id,
    '{}'::jsonb
  );

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'card',
    target_card_id,
    'card_soft_delete',
    before_state,
    (select to_jsonb(c) from public.cards c where c.id = target_card_id),
    '{}'::jsonb
  );
end;
$$;


ALTER FUNCTION "public"."soft_delete_card"("target_card_id" "uuid", "actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_order"("target_order_id" "uuid", "actor_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  before_state jsonb;
begin
  select to_jsonb(o)
  into before_state
  from public.orders o
  where o.id = target_order_id;

  if before_state is null then
    raise exception 'Order not found';
  end if;

  if (before_state ->> 'deleted_at') is not null then
    raise exception 'Order already soft deleted';
  end if;

  perform public.snapshot_order(target_order_id, actor_id);

  update public.orders
  set deleted_at = now(),
      updated_at = now()
  where id = target_order_id;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'order',
    target_order_id,
    'order_soft_delete',
    before_state,
    (select to_jsonb(o) from public.orders o where o.id = target_order_id),
    '{}'::jsonb
  );
end;
$$;


ALTER FUNCTION "public"."soft_delete_order"("target_order_id" "uuid", "actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_payment"("target_payment_id" "uuid", "actor_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  before_state jsonb;
begin
  select to_jsonb(p)
  into before_state
  from public.payments p
  where p.id = target_payment_id;

  if before_state is null then
    raise exception 'Payment not found';
  end if;

  if (before_state ->> 'deleted_at') is not null then
    raise exception 'Payment already soft deleted';
  end if;

  perform public.snapshot_payment(target_payment_id, actor_id);

  update public.payments
  set deleted_at = now(),
      updated_at = now()
  where id = target_payment_id;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'payment',
    target_payment_id,
    'payment_soft_delete',
    before_state,
    (select to_jsonb(p) from public.payments p where p.id = target_payment_id),
    '{}'::jsonb
  );
end;
$$;


ALTER FUNCTION "public"."soft_delete_payment"("target_payment_id" "uuid", "actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_profile"("target_profile_id" "uuid", "actor_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  before_state jsonb;
begin
  select to_jsonb(p)
  into before_state
  from public.profiles p
  where p.id = target_profile_id;

  if before_state is null then
    raise exception 'Profile not found';
  end if;

  perform public.snapshot_profile(target_profile_id, actor_id);

  update public.profiles
  set deleted_at = now(),
      updated_at = now()
  where id = target_profile_id;

  insert into public.audit_log (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    before,
    after,
    context
  )
  values (
    actor_id,
    null,
    'profile',
    target_profile_id,
    'profile_soft_delete',
    before_state,
    (select to_jsonb(p) from public.profiles p where p.id = target_profile_id),
    '{}'::jsonb
  );
end;
$$;


ALTER FUNCTION "public"."soft_delete_profile"("target_profile_id" "uuid", "actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."spin_wheel"("p_wheel_id" "uuid", "p_visitor_id" "text", "p_client_ip" "text" DEFAULT NULL::"text", "p_user_agent" "text" DEFAULT NULL::"text") RETURNS TABLE("prize_id" "uuid", "prize_label" "text", "coupon_code" "text", "spin_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_prize record;
  v_total integer;
  v_rnd numeric;
  v_acc numeric := 0;
  v_code text;
  v_prefix text;
begin
  if p_wheel_id is null then
    raise exception 'wheel_id requerido';
  end if;

  p_visitor_id := nullif(trim(p_visitor_id), '');
  p_client_ip := nullif(trim(p_client_ip), '');
  p_user_agent := left(coalesce(nullif(trim(p_user_agent), ''), ''), 512);
  if p_visitor_id is null or length(p_visitor_id) < 8 then
    raise exception 'visitor_id inválido';
  end if;

  -- Serialize spins for the same campaign+visitor/IP so the rate-limit check and
  -- coupon insert are atomic under concurrent public Edge Function requests.
  perform pg_advisory_xact_lock(hashtext('wheel_spin_visitor'), hashtext(p_wheel_id::text || ':' || p_visitor_id));
  if p_client_ip is not null then
    perform pg_advisory_xact_lock(hashtext('wheel_spin_ip'), hashtext(p_wheel_id::text || ':' || p_client_ip));
  end if;

  if exists (
    select 1
    from public.wheel_spins ws
    where ws.wheel_id = p_wheel_id
      and ws.spun_at > now() - interval '24 hours'
      and (ws.visitor_id = p_visitor_id or (p_client_ip is not null and ws.client_ip = p_client_ip))
  ) then
    raise exception 'Ya giraste recientemente';
  end if;

  if not exists (
    select 1
    from public.wheel_config wc
    where wc.id = p_wheel_id
      and coalesce(wc.active, false) = true
      and (wc.start_date is null or wc.start_date <= now())
      and (wc.end_date is null or wc.end_date >= now())
  ) then
    raise exception 'Ruleta no disponible';
  end if;

  select coalesce(sum(greatest(coalesce(weight, 10), 1)), 0)
    into v_total
  from public.wheel_prizes
  where wheel_id = p_wheel_id
    and coalesce(active, true) = true;

  if coalesce(v_total, 0) <= 0 then
    raise exception 'Ruleta sin premios activos';
  end if;

  v_rnd := random() * v_total;

  for v_prize in
    select *
    from public.wheel_prizes
    where wheel_id = p_wheel_id
      and coalesce(active, true) = true
    order by display_order asc, created_at asc
  loop
    v_acc := v_acc + greatest(coalesce(v_prize.weight, 10), 1);
    if v_rnd <= v_acc then
      exit;
    end if;
  end loop;

  if v_prize.id is null then
    raise exception 'No se pudo seleccionar premio';
  end if;

  v_prefix := upper(regexp_replace(coalesce(nullif(v_prize.coupon_code, ''), 'NEXCARD'), '[^A-Za-z0-9]+', '', 'g'));
  v_prefix := left(coalesce(nullif(v_prefix, ''), 'NEXCARD'), 14);

  loop
    v_code := v_prefix || '-' || substr(upper(replace(gen_random_uuid()::text, '-', '')), 1, 8);
    exit when not exists (
      select 1
      from public.wheel_spins ws
      where upper(ws.generated_coupon_code) = upper(v_code)
    );
  end loop;

  insert into public.wheel_spins(wheel_id, prize_id, visitor_id, generated_coupon_code, client_ip, user_agent, redeemed)
  values (p_wheel_id, v_prize.id, p_visitor_id, v_code, p_client_ip, p_user_agent, false)
  returning id into spin_id;

  prize_id := v_prize.id;
  prize_label := v_prize.label;
  coupon_code := v_code;
  return next;
end;
$$;


ALTER FUNCTION "public"."spin_wheel"("p_wheel_id" "uuid", "p_visitor_id" "text", "p_client_ip" "text", "p_user_agent" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_order_activation_from_card"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  linked_order_id uuid;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  if not (new.status = 'active' or new.activation_status = 'activated') then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.status is not distinct from old.status
     and new.activation_status is not distinct from old.activation_status
     and new.activated_at is not distinct from old.activated_at then
    return new;
  end if;

  linked_order_id := new.order_id;

  if linked_order_id is null then
    select oc.order_id
    into linked_order_id
    from public.order_cards oc
    where oc.card_id = new.id
    limit 1;
  end if;

  if linked_order_id is null then
    return new;
  end if;

  perform public.mark_order_activated(
    linked_order_id,
    new.id,
    'card_trigger',
    jsonb_build_object(
      'card_status', new.status,
      'activation_status', new.activation_status,
      'profile_id', new.profile_id
    ),
    coalesce(new.activated_at, now())
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_order_activation_from_card"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_order_activation_from_claim"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status <> 'claimed' then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  perform public.mark_order_activated(
    new.order_id,
    new.card_id,
    'profile_claim_trigger',
    jsonb_build_object(
      'claimed_by_user_id', new.claimed_by_user_id,
      'claimed_profile_id', new.claimed_profile_id,
      'customer_email', new.customer_email
    ),
    coalesce(new.updated_at, new.created_at, now())
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_order_activation_from_claim"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_wheel_coupon"("p_code" "text") RETURNS TABLE("prize_id" "uuid", "spin_id" "uuid", "type" "text", "value" integer, "label" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    wp.id as prize_id,
    ws.id as spin_id,
    wp.type,
    wp.value,
    wp.label
  from public.wheel_spins ws
  join public.wheel_prizes wp on wp.id = ws.prize_id
  where upper(ws.generated_coupon_code) = upper(nullif(trim(p_code), ''))
    and coalesce(ws.redeemed, false) = false
    and coalesce(wp.active, true) = true
  order by ws.spun_at asc
  limit 1;
$$;


ALTER FUNCTION "public"."validate_wheel_coupon"("p_code" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "auth"."audit_log_entries" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "payload" json,
    "created_at" timestamp with time zone,
    "ip_address" character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE "auth"."audit_log_entries" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."audit_log_entries" IS 'Auth: Audit trail for user actions.';



CREATE TABLE IF NOT EXISTS "auth"."custom_oauth_providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_type" "text" NOT NULL,
    "identifier" "text" NOT NULL,
    "name" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "client_secret" "text" NOT NULL,
    "acceptable_client_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "scopes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "pkce_enabled" boolean DEFAULT true NOT NULL,
    "attribute_mapping" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "authorization_params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "email_optional" boolean DEFAULT false NOT NULL,
    "issuer" "text",
    "discovery_url" "text",
    "skip_nonce_check" boolean DEFAULT false NOT NULL,
    "cached_discovery" "jsonb",
    "discovery_cached_at" timestamp with time zone,
    "authorization_url" "text",
    "token_url" "text",
    "userinfo_url" "text",
    "jwks_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "custom_claims_allowlist" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "custom_oauth_providers_authorization_url_https" CHECK ((("authorization_url" IS NULL) OR ("authorization_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_authorization_url_length" CHECK ((("authorization_url" IS NULL) OR ("char_length"("authorization_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_client_id_length" CHECK ((("char_length"("client_id") >= 1) AND ("char_length"("client_id") <= 512))),
    CONSTRAINT "custom_oauth_providers_discovery_url_length" CHECK ((("discovery_url" IS NULL) OR ("char_length"("discovery_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_identifier_format" CHECK (("identifier" ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::"text")),
    CONSTRAINT "custom_oauth_providers_issuer_length" CHECK ((("issuer" IS NULL) OR (("char_length"("issuer") >= 1) AND ("char_length"("issuer") <= 2048)))),
    CONSTRAINT "custom_oauth_providers_jwks_uri_https" CHECK ((("jwks_uri" IS NULL) OR ("jwks_uri" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_jwks_uri_length" CHECK ((("jwks_uri" IS NULL) OR ("char_length"("jwks_uri") <= 2048))),
    CONSTRAINT "custom_oauth_providers_name_length" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 100))),
    CONSTRAINT "custom_oauth_providers_oauth2_requires_endpoints" CHECK ((("provider_type" <> 'oauth2'::"text") OR (("authorization_url" IS NOT NULL) AND ("token_url" IS NOT NULL) AND ("userinfo_url" IS NOT NULL)))),
    CONSTRAINT "custom_oauth_providers_oidc_discovery_url_https" CHECK ((("provider_type" <> 'oidc'::"text") OR ("discovery_url" IS NULL) OR ("discovery_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_oidc_issuer_https" CHECK ((("provider_type" <> 'oidc'::"text") OR ("issuer" IS NULL) OR ("issuer" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_oidc_requires_issuer" CHECK ((("provider_type" <> 'oidc'::"text") OR ("issuer" IS NOT NULL))),
    CONSTRAINT "custom_oauth_providers_provider_type_check" CHECK (("provider_type" = ANY (ARRAY['oauth2'::"text", 'oidc'::"text"]))),
    CONSTRAINT "custom_oauth_providers_token_url_https" CHECK ((("token_url" IS NULL) OR ("token_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_token_url_length" CHECK ((("token_url" IS NULL) OR ("char_length"("token_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_userinfo_url_https" CHECK ((("userinfo_url" IS NULL) OR ("userinfo_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_userinfo_url_length" CHECK ((("userinfo_url" IS NULL) OR ("char_length"("userinfo_url") <= 2048)))
);


ALTER TABLE "auth"."custom_oauth_providers" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."flow_state" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "auth_code" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "code_challenge" "text",
    "provider_type" "text" NOT NULL,
    "provider_access_token" "text",
    "provider_refresh_token" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "authentication_method" "text" NOT NULL,
    "auth_code_issued_at" timestamp with time zone,
    "invite_token" "text",
    "referrer" "text",
    "oauth_client_state_id" "uuid",
    "linking_target_id" "uuid",
    "email_optional" boolean DEFAULT false NOT NULL
);


ALTER TABLE "auth"."flow_state" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."flow_state" IS 'Stores metadata for all OAuth/SSO login flows';



CREATE TABLE IF NOT EXISTS "auth"."identities" (
    "provider_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "identity_data" "jsonb" NOT NULL,
    "provider" "text" NOT NULL,
    "last_sign_in_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "email" "text" GENERATED ALWAYS AS ("lower"(("identity_data" ->> 'email'::"text"))) STORED,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "auth"."identities" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."identities" IS 'Auth: Stores identities associated to a user.';



COMMENT ON COLUMN "auth"."identities"."email" IS 'Auth: Email is a generated column that references the optional email property in the identity_data';



CREATE TABLE IF NOT EXISTS "auth"."instances" (
    "id" "uuid" NOT NULL,
    "uuid" "uuid",
    "raw_base_config" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "auth"."instances" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."instances" IS 'Auth: Manages users across multiple sites.';



CREATE TABLE IF NOT EXISTS "auth"."mfa_amr_claims" (
    "session_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "authentication_method" "text" NOT NULL,
    "id" "uuid" NOT NULL
);


ALTER TABLE "auth"."mfa_amr_claims" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_amr_claims" IS 'auth: stores authenticator method reference claims for multi factor authentication';



CREATE TABLE IF NOT EXISTS "auth"."mfa_challenges" (
    "id" "uuid" NOT NULL,
    "factor_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "verified_at" timestamp with time zone,
    "ip_address" "inet" NOT NULL,
    "otp_code" "text",
    "web_authn_session_data" "jsonb"
);


ALTER TABLE "auth"."mfa_challenges" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_challenges" IS 'auth: stores metadata about challenge requests made';



CREATE TABLE IF NOT EXISTS "auth"."mfa_factors" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friendly_name" "text",
    "factor_type" "auth"."factor_type" NOT NULL,
    "status" "auth"."factor_status" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "secret" "text",
    "phone" "text",
    "last_challenged_at" timestamp with time zone,
    "web_authn_credential" "jsonb",
    "web_authn_aaguid" "uuid",
    "last_webauthn_challenge_data" "jsonb"
);


ALTER TABLE "auth"."mfa_factors" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_factors" IS 'auth: stores metadata about factors';



COMMENT ON COLUMN "auth"."mfa_factors"."last_webauthn_challenge_data" IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';



CREATE TABLE IF NOT EXISTS "auth"."oauth_authorizations" (
    "id" "uuid" NOT NULL,
    "authorization_id" "text" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "redirect_uri" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "state" "text",
    "resource" "text",
    "code_challenge" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "response_type" "auth"."oauth_response_type" DEFAULT 'code'::"auth"."oauth_response_type" NOT NULL,
    "status" "auth"."oauth_authorization_status" DEFAULT 'pending'::"auth"."oauth_authorization_status" NOT NULL,
    "authorization_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:03:00'::interval) NOT NULL,
    "approved_at" timestamp with time zone,
    "nonce" "text",
    CONSTRAINT "oauth_authorizations_authorization_code_length" CHECK (("char_length"("authorization_code") <= 255)),
    CONSTRAINT "oauth_authorizations_code_challenge_length" CHECK (("char_length"("code_challenge") <= 128)),
    CONSTRAINT "oauth_authorizations_expires_at_future" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "oauth_authorizations_nonce_length" CHECK (("char_length"("nonce") <= 255)),
    CONSTRAINT "oauth_authorizations_redirect_uri_length" CHECK (("char_length"("redirect_uri") <= 2048)),
    CONSTRAINT "oauth_authorizations_resource_length" CHECK (("char_length"("resource") <= 2048)),
    CONSTRAINT "oauth_authorizations_scope_length" CHECK (("char_length"("scope") <= 4096)),
    CONSTRAINT "oauth_authorizations_state_length" CHECK (("char_length"("state") <= 4096))
);


ALTER TABLE "auth"."oauth_authorizations" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_client_states" (
    "id" "uuid" NOT NULL,
    "provider_type" "text" NOT NULL,
    "code_verifier" "text",
    "created_at" timestamp with time zone NOT NULL
);


ALTER TABLE "auth"."oauth_client_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."oauth_client_states" IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';



CREATE TABLE IF NOT EXISTS "auth"."oauth_clients" (
    "id" "uuid" NOT NULL,
    "client_secret_hash" "text",
    "registration_type" "auth"."oauth_registration_type" NOT NULL,
    "redirect_uris" "text" NOT NULL,
    "grant_types" "text" NOT NULL,
    "client_name" "text",
    "client_uri" "text",
    "logo_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "client_type" "auth"."oauth_client_type" DEFAULT 'confidential'::"auth"."oauth_client_type" NOT NULL,
    "token_endpoint_auth_method" "text" NOT NULL,
    CONSTRAINT "oauth_clients_client_name_length" CHECK (("char_length"("client_name") <= 1024)),
    CONSTRAINT "oauth_clients_client_uri_length" CHECK (("char_length"("client_uri") <= 2048)),
    CONSTRAINT "oauth_clients_logo_uri_length" CHECK (("char_length"("logo_uri") <= 2048)),
    CONSTRAINT "oauth_clients_token_endpoint_auth_method_check" CHECK (("token_endpoint_auth_method" = ANY (ARRAY['client_secret_basic'::"text", 'client_secret_post'::"text", 'none'::"text"])))
);


ALTER TABLE "auth"."oauth_clients" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_consents" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "scopes" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "oauth_consents_revoked_after_granted" CHECK ((("revoked_at" IS NULL) OR ("revoked_at" >= "granted_at"))),
    CONSTRAINT "oauth_consents_scopes_length" CHECK (("char_length"("scopes") <= 2048)),
    CONSTRAINT "oauth_consents_scopes_not_empty" CHECK (("char_length"(TRIM(BOTH FROM "scopes")) > 0))
);


ALTER TABLE "auth"."oauth_consents" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."one_time_tokens" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_type" "auth"."one_time_token_type" NOT NULL,
    "token_hash" "text" NOT NULL,
    "relates_to" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "one_time_tokens_token_hash_check" CHECK (("char_length"("token_hash") > 0))
);


ALTER TABLE "auth"."one_time_tokens" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."refresh_tokens" (
    "instance_id" "uuid",
    "id" bigint NOT NULL,
    "token" character varying(255),
    "user_id" character varying(255),
    "revoked" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "parent" character varying(255),
    "session_id" "uuid"
);


ALTER TABLE "auth"."refresh_tokens" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."refresh_tokens" IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';



CREATE SEQUENCE IF NOT EXISTS "auth"."refresh_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNER TO "supabase_auth_admin";


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNED BY "auth"."refresh_tokens"."id";



CREATE TABLE IF NOT EXISTS "auth"."saml_providers" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "entity_id" "text" NOT NULL,
    "metadata_xml" "text" NOT NULL,
    "metadata_url" "text",
    "attribute_mapping" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "name_id_format" "text",
    CONSTRAINT "entity_id not empty" CHECK (("char_length"("entity_id") > 0)),
    CONSTRAINT "metadata_url not empty" CHECK ((("metadata_url" = NULL::"text") OR ("char_length"("metadata_url") > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK (("char_length"("metadata_xml") > 0))
);


ALTER TABLE "auth"."saml_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_providers" IS 'Auth: Manages SAML Identity Provider connections.';



CREATE TABLE IF NOT EXISTS "auth"."saml_relay_states" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "request_id" "text" NOT NULL,
    "for_email" "text",
    "redirect_to" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "flow_state_id" "uuid",
    CONSTRAINT "request_id not empty" CHECK (("char_length"("request_id") > 0))
);


ALTER TABLE "auth"."saml_relay_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_relay_states" IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';



CREATE TABLE IF NOT EXISTS "auth"."schema_migrations" (
    "version" character varying(255) NOT NULL
);


ALTER TABLE "auth"."schema_migrations" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."schema_migrations" IS 'Auth: Manages updates to the auth system.';



CREATE TABLE IF NOT EXISTS "auth"."sessions" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "factor_id" "uuid",
    "aal" "auth"."aal_level",
    "not_after" timestamp with time zone,
    "refreshed_at" timestamp without time zone,
    "user_agent" "text",
    "ip" "inet",
    "tag" "text",
    "oauth_client_id" "uuid",
    "refresh_token_hmac_key" "text",
    "refresh_token_counter" bigint,
    "scopes" "text",
    CONSTRAINT "sessions_scopes_length" CHECK (("char_length"("scopes") <= 4096))
);


ALTER TABLE "auth"."sessions" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sessions" IS 'Auth: Stores session data associated to a user.';



COMMENT ON COLUMN "auth"."sessions"."not_after" IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_hmac_key" IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_counter" IS 'Holds the ID (counter) of the last issued refresh token.';



CREATE TABLE IF NOT EXISTS "auth"."sso_domains" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK (("char_length"("domain") > 0))
);


ALTER TABLE "auth"."sso_domains" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_domains" IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';



CREATE TABLE IF NOT EXISTS "auth"."sso_providers" (
    "id" "uuid" NOT NULL,
    "resource_id" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "disabled" boolean,
    CONSTRAINT "resource_id not empty" CHECK ((("resource_id" = NULL::"text") OR ("char_length"("resource_id") > 0)))
);


ALTER TABLE "auth"."sso_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_providers" IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';



COMMENT ON COLUMN "auth"."sso_providers"."resource_id" IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';



CREATE TABLE IF NOT EXISTS "auth"."users" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "aud" character varying(255),
    "role" character varying(255),
    "email" character varying(255),
    "encrypted_password" character varying(255),
    "email_confirmed_at" timestamp with time zone,
    "invited_at" timestamp with time zone,
    "confirmation_token" character varying(255),
    "confirmation_sent_at" timestamp with time zone,
    "recovery_token" character varying(255),
    "recovery_sent_at" timestamp with time zone,
    "email_change_token_new" character varying(255),
    "email_change" character varying(255),
    "email_change_sent_at" timestamp with time zone,
    "last_sign_in_at" timestamp with time zone,
    "raw_app_meta_data" "jsonb",
    "raw_user_meta_data" "jsonb",
    "is_super_admin" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "phone" "text" DEFAULT NULL::character varying,
    "phone_confirmed_at" timestamp with time zone,
    "phone_change" "text" DEFAULT ''::character varying,
    "phone_change_token" character varying(255) DEFAULT ''::character varying,
    "phone_change_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone GENERATED ALWAYS AS (LEAST("email_confirmed_at", "phone_confirmed_at")) STORED,
    "email_change_token_current" character varying(255) DEFAULT ''::character varying,
    "email_change_confirm_status" smallint DEFAULT 0,
    "banned_until" timestamp with time zone,
    "reauthentication_token" character varying(255) DEFAULT ''::character varying,
    "reauthentication_sent_at" timestamp with time zone,
    "is_sso_user" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "is_anonymous" boolean DEFAULT false NOT NULL,
    CONSTRAINT "users_email_change_confirm_status_check" CHECK ((("email_change_confirm_status" >= 0) AND ("email_change_confirm_status" <= 2)))
);


ALTER TABLE "auth"."users" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."users" IS 'Auth: Stores user login data within a secure schema.';



COMMENT ON COLUMN "auth"."users"."is_sso_user" IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';



CREATE TABLE IF NOT EXISTS "auth"."webauthn_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "challenge_type" "text" NOT NULL,
    "session_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT "webauthn_challenges_challenge_type_check" CHECK (("challenge_type" = ANY (ARRAY['signup'::"text", 'registration'::"text", 'authentication'::"text"])))
);


ALTER TABLE "auth"."webauthn_challenges" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."webauthn_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credential_id" "bytea" NOT NULL,
    "public_key" "bytea" NOT NULL,
    "attestation_type" "text" DEFAULT ''::"text" NOT NULL,
    "aaguid" "uuid",
    "sign_count" bigint DEFAULT 0 NOT NULL,
    "transports" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "backup_eligible" boolean DEFAULT false NOT NULL,
    "backed_up" boolean DEFAULT false NOT NULL,
    "friendly_name" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone
);


ALTER TABLE "auth"."webauthn_credentials" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "public"."abandoned_carts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "customer_name" "text",
    "items" "jsonb" NOT NULL,
    "total_cents" integer NOT NULL,
    "status" "text" DEFAULT 'abandoned'::"text",
    "reminder_sent_at" timestamp with time zone,
    "converted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "update_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    CONSTRAINT "abandoned_carts_status_check" CHECK (("status" = ANY (ARRAY['abandoned'::"text", 'converted'::"text", 'email_sent'::"text", 'ignored'::"text"])))
);


ALTER TABLE "public"."abandoned_carts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "actor_role" "text",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "before" "jsonb",
    "after" "jsonb",
    "context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."audit_log" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."card_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "card_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "actor_user_id" "uuid",
    "context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."card_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."card_scans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "card_id" "uuid",
    "profile_id" "uuid",
    "organization_id" "uuid",
    "scan_source" "text" DEFAULT 'nfc'::"text" NOT NULL,
    "ip_hash" "text",
    "country" "text",
    "region" "text",
    "city" "text",
    "user_agent" "text",
    "referrer" "text",
    "risk_score" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "profile_slug" "text",
    "scanned_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "card_scans_scan_source_check" CHECK (("scan_source" = ANY (ARRAY['web'::"text", 'nfc'::"text", 'qr'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."card_scans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cards" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid",
    "profile_id" "uuid",
    "order_id" "uuid",
    "card_code" "text",
    "activation_status" "text" DEFAULT 'unassigned'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "public_token" "text" NOT NULL,
    "status" "text" NOT NULL,
    "issued_at" timestamp with time zone NOT NULL,
    "assigned_at" timestamp with time zone,
    "activated_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "replaced_by_card_id" "uuid",
    "replacement_reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "deleted_at" timestamp with time zone,
    "nfc_url" "text",
    "programmed_at" timestamp with time zone,
    "programmed_by" "text",
    CONSTRAINT "cards_activation_status_check" CHECK (("activation_status" = ANY (ARRAY['unassigned'::"text", 'assigned'::"text", 'activated'::"text", 'disabled'::"text", 'revoked'::"text", 'lost'::"text"]))),
    CONSTRAINT "cards_status_check" CHECK (("status" = ANY (ARRAY['pending_production'::"text", 'printed'::"text", 'assigned'::"text", 'programmed'::"text", 'active'::"text", 'suspended'::"text", 'revoked'::"text", 'lost'::"text", 'replaced'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_blocks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "block_key" "text" NOT NULL,
    "content" "jsonb" NOT NULL,
    "locale" "text" DEFAULT 'es-CL'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."content_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deal_id" "uuid",
    "contact_id" "uuid",
    "type" "text",
    "title" "text" NOT NULL,
    "description" "text",
    "scheduled_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "crm_activities_type_check" CHECK (("type" = ANY (ARRAY['call'::"text", 'email'::"text", 'meeting'::"text", 'note'::"text", 'whatsapp'::"text"])))
);


ALTER TABLE "public"."crm_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "company" "text",
    "source" "text" DEFAULT 'nfc_tap'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."crm_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_deals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid",
    "name" "text" NOT NULL,
    "amount_cents" integer DEFAULT 0,
    "stage" "text" DEFAULT 'nuevo_lead'::"text",
    "probability" integer DEFAULT 0,
    "closing_at" "date",
    "closed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "crm_deals_probability_check" CHECK ((("probability" >= 0) AND ("probability" <= 100))),
    CONSTRAINT "crm_deals_stage_check" CHECK (("stage" = ANY (ARRAY['nuevo_lead'::"text", 'contactado'::"text", 'propuesta'::"text", 'negociacion'::"text", 'cerrado_ganado'::"text", 'cerrado_perdido'::"text"])))
);


ALTER TABLE "public"."crm_deals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dispatch_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sku" "text" NOT NULL,
    "quantity_per_dispatch" integer DEFAULT 1 NOT NULL,
    "description" "text",
    "active" boolean DEFAULT true
);


ALTER TABLE "public"."dispatch_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_email" "text" NOT NULL,
    "email_type" "text" NOT NULL,
    "order_id" "uuid",
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'sent'::"text",
    "subject" "text",
    "provider" "text",
    "provider_message_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "email_log_email_type_check" CHECK (("email_type" = ANY (ARRAY['order_confirmation'::"text", 'shipping'::"text", 'profile_activation'::"text", 'abandoned_cart'::"text", 'followup'::"text", 'upsell'::"text", 'campaign'::"text", 'waitlist_launch'::"text", 'low_stock_alert'::"text", 'internal_notification'::"text"])))
);


ALTER TABLE "public"."email_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_unsubscribe" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "reason" "text",
    "unsubscribed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_unsubscribe" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "source" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "user_id" "uuid",
    "order_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "event_log_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'warn'::"text", 'error'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."event_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "profile_slug" "text",
    "event_type" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_event_type_valid" CHECK (("event_type" = ANY (ARRAY['view'::"text", 'whatsapp'::"text", 'vcard'::"text", 'instagram'::"text", 'linkedin'::"text", 'website'::"text", 'calendar'::"text", 'share'::"text", 'client_crash'::"text"]))),
    CONSTRAINT "chk_profile_slug_length" CHECK (("char_length"("profile_slug") <= 80))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "item" "text" NOT NULL,
    "category" "text",
    "stock" integer DEFAULT 0 NOT NULL,
    "min_stock" integer DEFAULT 0 NOT NULL,
    "unit" "text",
    "cost_cents" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sku" "text",
    "stock_min" integer DEFAULT 0,
    "stock_alert_sent_at" timestamp with time zone,
    "name" "text"
);


ALTER TABLE "public"."inventory_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_movements" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "inventory_item_id" "uuid" NOT NULL,
    "movement_type" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "reason" "text",
    "order_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_movements_movement_type_check" CHECK (("movement_type" = ANY (ARRAY['in'::"text", 'out'::"text", 'adjust'::"text"])))
);


ALTER TABLE "public"."inventory_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kpi_alert_evaluations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trigger_source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "score" numeric NOT NULL,
    "band" "text" NOT NULL,
    "should_send" boolean DEFAULT false NOT NULL,
    "dispatched" boolean DEFAULT false NOT NULL,
    "dry_run" boolean DEFAULT true NOT NULL,
    "blocked_reason" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kpi_alert_evaluations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kpi_alert_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "alert_key" "text" NOT NULL,
    "alert_band" "text",
    "payload_hash" "text" NOT NULL,
    "channel" "text" DEFAULT 'email'::"text" NOT NULL,
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "provider" "text",
    "provider_message_id" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kpi_alert_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kpi_alert_state" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "alert_key" "text" NOT NULL,
    "last_band" "text",
    "last_score" numeric,
    "cooldown_minutes" integer,
    "last_sent_at" timestamp with time zone,
    "last_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kpi_alert_state" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."kpi_cohorts" AS
 SELECT "date_trunc"('month'::"text", "fo"."first_purchase") AS "cohort_month",
    "count"(DISTINCT "fo"."customer_email") AS "new_customers",
    "count"(DISTINCT
        CASE
            WHEN (("o"."created_at" > "fo"."first_purchase") AND ("o"."payment_status" = 'paid'::"text")) THEN "o"."customer_email"
            ELSE NULL::"text"
        END) AS "repeat_customers"
   FROM (( SELECT "orders"."customer_email",
            "min"("orders"."created_at") AS "first_purchase"
           FROM "public"."orders"
          WHERE (("orders"."payment_status" = 'paid'::"text") AND ("orders"."deleted_at" IS NULL))
          GROUP BY "orders"."customer_email") "fo"
     LEFT JOIN "public"."orders" "o" ON ((("o"."customer_email" = "fo"."customer_email") AND ("o"."payment_status" = 'paid'::"text"))))
  GROUP BY ("date_trunc"('month'::"text", "fo"."first_purchase"))
  ORDER BY ("date_trunc"('month'::"text", "fo"."first_purchase")) DESC;


ALTER VIEW "public"."kpi_cohorts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."waitlist" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."kpi_funnel" AS
 SELECT ( SELECT "count"(DISTINCT "waitlist"."email") AS "count"
           FROM "public"."waitlist") AS "waitlist_signups",
    ( SELECT "count"(*) AS "count"
           FROM "public"."abandoned_carts"
          WHERE ("abandoned_carts"."created_at" > ("now"() - '30 days'::interval))) AS "abandoned_carts_30d",
    ( SELECT "count"(*) AS "count"
           FROM "public"."orders"
          WHERE (("orders"."payment_status" = 'paid'::"text") AND ("orders"."created_at" > ("now"() - '30 days'::interval)))) AS "paid_orders_30d",
    ( SELECT "count"(*) AS "count"
           FROM "public"."orders"
          WHERE (("orders"."fulfillment_status" = 'delivered'::"text") AND ("orders"."created_at" > ("now"() - '30 days'::interval)))) AS "delivered_orders_30d";


ALTER VIEW "public"."kpi_funnel" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."kpi_monthly_revenue" AS
 SELECT "date_trunc"('month'::"text", "created_at") AS "month",
    "count"(*) AS "orders_count",
    "sum"("amount_cents") AS "revenue_cents",
    "avg"("amount_cents") AS "avg_ticket_cents"
   FROM "public"."orders"
  WHERE (("payment_status" = 'paid'::"text") AND ("deleted_at" IS NULL))
  GROUP BY ("date_trunc"('month'::"text", "created_at"))
  ORDER BY ("date_trunc"('month'::"text", "created_at")) DESC;


ALTER VIEW "public"."kpi_monthly_revenue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kpi_runtime_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kpi_runtime_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "quantity" integer NOT NULL,
    "unit_price_cents" bigint NOT NULL,
    "currency" "text" DEFAULT 'CLP'::"text" NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "order_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sku" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price_cents" integer NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "features" "jsonb" DEFAULT '[]'::"jsonb",
    "display_order" integer DEFAULT 0,
    "popular" boolean DEFAULT false,
    "cost_cents" integer DEFAULT 0,
    "pack_type" "text" DEFAULT 'standard'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "active_until" timestamp with time zone,
    CONSTRAINT "products_pack_type_check" CHECK (("pack_type" = ANY (ARRAY['standard'::"text", 'premium'::"text", 'enterprise'::"text", 'special_edition'::"text", 'bundle'::"text"]))),
    CONSTRAINT "products_price_cents_check" CHECK (("price_cents" > 0)),
    CONSTRAINT "products_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."kpi_top_products" AS
 SELECT "p"."id",
    "p"."sku",
    "p"."name",
    "count"("oi"."id") AS "times_ordered",
    COALESCE("sum"("oi"."quantity"), (0)::bigint) AS "units_sold",
    COALESCE("sum"(("oi"."quantity" * "oi"."unit_price_cents")), (0)::numeric) AS "revenue_cents"
   FROM (("public"."products" "p"
     LEFT JOIN "public"."order_items" "oi" ON (("oi"."product_id" = "p"."id")))
     LEFT JOIN "public"."orders" "o" ON ((("o"."id" = "oi"."order_id") AND ("o"."payment_status" = 'paid'::"text") AND ("o"."deleted_at" IS NULL))))
  GROUP BY "p"."id", "p"."sku", "p"."name"
  ORDER BY COALESCE("sum"(("oi"."quantity" * "oi"."unit_price_cents")), (0)::numeric) DESC NULLS LAST;


ALTER VIEW "public"."kpi_top_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memberships" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "memberships_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'company_owner'::"text", 'company_member'::"text"])))
);


ALTER TABLE "public"."memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "card_id" "uuid" NOT NULL,
    "linked_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_cards" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."order_folio_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."order_folio_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_operational_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "stage" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "source" "text" DEFAULT 'system'::"text" NOT NULL,
    "event_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_operational_events_stage_check" CHECK (("stage" = ANY (ARRAY['paid'::"text", 'ready'::"text", 'shipped'::"text", 'delivered'::"text", 'activated'::"text"])))
);


ALTER TABLE "public"."order_operational_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "provider" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "amount_cents" bigint NOT NULL,
    "currency" "text" DEFAULT 'CLP'::"text" NOT NULL,
    "external_id" "text",
    "payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "payments_provider_check" CHECK (("provider" = ANY (ARRAY['webpay'::"text", 'mercado_pago'::"text", 'manual'::"text"]))),
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'authorized'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."order_payment_reconciliation_queue" AS
 WITH "payment_rollup" AS (
         SELECT "o"."id" AS "order_id",
            "o"."payment_status" AS "order_payment_status",
            "array_remove"("array_agg"(DISTINCT
                CASE
                    WHEN ("p"."deleted_at" IS NULL) THEN "p"."status"
                    ELSE NULL::"text"
                END), NULL::"text") AS "payment_statuses",
            "count"("p".*) FILTER (WHERE ("p"."deleted_at" IS NULL)) AS "active_payments",
            "bool_or"(("p"."status" = 'refunded'::"text")) FILTER (WHERE ("p"."deleted_at" IS NULL)) AS "has_refunded",
            "bool_or"(("p"."status" = 'paid'::"text")) FILTER (WHERE ("p"."deleted_at" IS NULL)) AS "has_paid",
            "bool_or"(("p"."status" = ANY (ARRAY['pending'::"text", 'authorized'::"text"]))) FILTER (WHERE ("p"."deleted_at" IS NULL)) AS "has_pending_like",
            "bool_or"(("p"."status" = 'failed'::"text")) FILTER (WHERE ("p"."deleted_at" IS NULL)) AS "has_failed"
           FROM ("public"."orders" "o"
             LEFT JOIN "public"."payments" "p" ON (("p"."order_id" = "o"."id")))
          WHERE ("o"."deleted_at" IS NULL)
          GROUP BY "o"."id", "o"."payment_status"
        )
 SELECT "order_id",
    "order_payment_status",
    COALESCE("payment_statuses", '{}'::"text"[]) AS "payment_statuses",
    "active_payments",
        CASE
            WHEN ("active_payments" = 0) THEN NULL::"text"
            WHEN "has_refunded" THEN 'refunded'::"text"
            WHEN "has_paid" THEN 'paid'::"text"
            WHEN "has_pending_like" THEN 'pending'::"text"
            WHEN "has_failed" THEN 'failed'::"text"
            ELSE NULL::"text"
        END AS "suggested_order_payment_status",
        CASE
            WHEN ("active_payments" = 0) THEN false
            ELSE ("order_payment_status" IS DISTINCT FROM
            CASE
                WHEN "has_refunded" THEN 'refunded'::"text"
                WHEN "has_paid" THEN 'paid'::"text"
                WHEN "has_pending_like" THEN 'pending'::"text"
                WHEN "has_failed" THEN 'failed'::"text"
                ELSE NULL::"text"
            END)
        END AS "has_drift",
        CASE
            WHEN ("active_payments" = 0) THEN 'missing_active_payment_ledger'::"text"
            WHEN ("order_payment_status" IS DISTINCT FROM
            CASE
                WHEN "has_refunded" THEN 'refunded'::"text"
                WHEN "has_paid" THEN 'paid'::"text"
                WHEN "has_pending_like" THEN 'pending'::"text"
                WHEN "has_failed" THEN 'failed'::"text"
                ELSE NULL::"text"
            END) THEN 'payment_status_mismatch'::"text"
            ELSE NULL::"text"
        END AS "drift_reason"
   FROM "payment_rollup";


ALTER VIEW "public"."order_payment_reconciliation_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "field" "text" NOT NULL,
    "old_value" "text",
    "new_value" "text" NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "actor_user_id" "uuid",
    "actor_role" "text",
    "actor_label" "text"
);


ALTER TABLE "public"."order_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "card_id" "uuid",
    "customer_email" "text" NOT NULL,
    "claim_token" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "claimed_by_user_id" "uuid",
    "claimed_profile_id" "uuid",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profile_claims_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "profile_claims_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'claimed'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."profile_claims" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."prelaunch_order_integrity_audit" AS
 SELECT "o"."id" AS "order_id",
    "o"."folio",
    "o"."created_at",
    "o"."customer_email",
    "o"."payment_status",
    "o"."fulfillment_status",
    "o"."amount_cents",
    "o"."currency",
    "o"."mp_payment_id",
    (("o"."mp_payment_id" IS NULL) AND ("o"."payment_status" = 'paid'::"text")) AS "paid_without_mp_payment_id",
    COALESCE("payment_counts"."active_payment_ledgers", 0) AS "active_payment_ledgers",
    COALESCE("claim_counts"."profile_claims", 0) AS "profile_claims",
    COALESCE("card_counts"."cards", 0) AS "cards",
        CASE
            WHEN (("o"."payment_status" = 'paid'::"text") AND ("o"."mp_payment_id" IS NULL)) THEN 'legacy_or_manual_paid_without_mp'::"text"
            WHEN (("o"."payment_status" = 'paid'::"text") AND (COALESCE("payment_counts"."active_payment_ledgers", 0) = 0)) THEN 'paid_without_payment_ledger'::"text"
            WHEN (("o"."payment_status" = 'paid'::"text") AND (COALESCE("claim_counts"."profile_claims", 0) = 0)) THEN 'paid_without_activation_claim'::"text"
            WHEN (("o"."payment_status" = 'paid'::"text") AND (COALESCE("card_counts"."cards", 0) = 0)) THEN 'paid_without_card_lifecycle'::"text"
            ELSE 'ok'::"text"
        END AS "prelaunch_integrity_status"
   FROM ((("public"."orders" "o"
     LEFT JOIN ( SELECT "payments"."order_id",
            ("count"(*))::integer AS "active_payment_ledgers"
           FROM "public"."payments"
          WHERE COALESCE(("payments"."deleted_at" IS NULL), true)
          GROUP BY "payments"."order_id") "payment_counts" ON (("payment_counts"."order_id" = "o"."id")))
     LEFT JOIN ( SELECT "profile_claims"."order_id",
            ("count"(*))::integer AS "profile_claims"
           FROM "public"."profile_claims"
          GROUP BY "profile_claims"."order_id") "claim_counts" ON (("claim_counts"."order_id" = "o"."id")))
     LEFT JOIN ( SELECT "cards"."order_id",
            ("count"(*))::integer AS "cards"
           FROM "public"."cards"
          WHERE ("cards"."deleted_at" IS NULL)
          GROUP BY "cards"."order_id") "card_counts" ON (("card_counts"."order_id" = "o"."id")))
  WHERE ("o"."deleted_at" IS NULL);


ALTER VIEW "public"."prelaunch_order_integrity_audit" OWNER TO "postgres";


COMMENT ON VIEW "public"."prelaunch_order_integrity_audit" IS 'Read-only pre-launch audit view for legacy/manual/test order hygiene.';



CREATE TABLE IF NOT EXISTS "public"."product_bundle_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bundle_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "item_type" "text" DEFAULT 'card'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_bundle_items_item_type_check" CHECK (("item_type" = ANY (ARRAY['card'::"text", 'service'::"text", 'addon'::"text", 'dispatch'::"text", 'setup'::"text"]))),
    CONSTRAINT "product_bundle_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."product_bundle_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_bundles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "description" "text",
    "bundle_type" "text" DEFAULT 'quantity_pack'::"text" NOT NULL,
    "segment" "text",
    "cards_quantity" integer DEFAULT 1 NOT NULL,
    "price_cents" bigint NOT NULL,
    "compare_at_price_cents" bigint,
    "badge_text" "text",
    "active" boolean DEFAULT true NOT NULL,
    "is_visible_home" boolean DEFAULT true NOT NULL,
    "display_order" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "product_bundles_bundle_type_check" CHECK (("bundle_type" = ANY (ARRAY['quantity_pack'::"text", 'segment_pack'::"text", 'mixed_bundle'::"text"]))),
    CONSTRAINT "product_bundles_cards_quantity_check" CHECK (("cards_quantity" > 0)),
    CONSTRAINT "product_bundles_price_cents_check" CHECK (("price_cents" >= 0)),
    CONSTRAINT "product_bundles_segment_check" CHECK (("segment" = ANY (ARRAY['individual'::"text", 'sme'::"text", 'enterprise'::"text"])))
);


ALTER TABLE "public"."product_bundles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_inventory_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "inventory_item_id" "uuid" NOT NULL,
    "quantity_required" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_inventory_requirements_quantity_required_check" CHECK (("quantity_required" > 0))
);


ALTER TABLE "public"."product_inventory_requirements" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."products_with_margin" AS
 SELECT "id",
    "sku",
    "name",
    "description",
    "price_cents",
    "status",
    "created_at",
    "updated_at",
    "deleted_at",
    "features",
    "display_order",
    "popular",
    "cost_cents",
    "pack_type",
    "metadata",
    "active_until",
        CASE
            WHEN (("price_cents" > 0) AND ("cost_cents" > 0)) THEN "round"((((("price_cents" - "cost_cents"))::numeric / ("price_cents")::numeric) * (100)::numeric), 2)
            ELSE NULL::numeric
        END AS "margin_percent",
    ("price_cents" - "cost_cents") AS "profit_cents"
   FROM "public"."products";


ALTER VIEW "public"."products_with_margin" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_slug_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "customer_email" "text" NOT NULL,
    "status" "text" DEFAULT 'reserved'::"text" NOT NULL,
    "profile_id" "uuid",
    "reserved_by_user_id" "uuid",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '02:00:00'::interval) NOT NULL,
    "consumed_at" timestamp with time zone,
    "released_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profile_slug_reservations_status_check" CHECK (("status" = ANY (ARRAY['reserved'::"text", 'consumed'::"text", 'released'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."profile_slug_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "version" integer NOT NULL,
    "snapshot" "jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."profile_versions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refunds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "amount_cents" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "mp_refund_id" "text",
    "notes" "text",
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone,
    "processed_by" "text",
    CONSTRAINT "refunds_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'processed'::"text"])))
);


ALTER TABLE "public"."refunds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "customer_email" "text" NOT NULL,
    "business_name" "text" NOT NULL,
    "google_review_url" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "scan_count" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."review_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "bio" "text",
    "photo_url" "text",
    "linkedin_url" "text",
    "email" "text",
    "display_order" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_current_memberships" AS
 SELECT "id",
    "user_id",
    "organization_id",
    "role",
    "created_at"
   FROM "public"."memberships" "m"
  WHERE ("user_id" = "auth"."uid"());


ALTER VIEW "public"."v_current_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wheel_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "active" boolean DEFAULT false,
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "banner_url" "text",
    "banner_title" "text" DEFAULT 'Gira la ruleta'::"text",
    "banner_subtitle" "text" DEFAULT 'Premio garantizado en tu primera compra'::"text",
    "show_on_first_visit" boolean DEFAULT true,
    "show_floating_button" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."wheel_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wheel_prizes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wheel_id" "uuid",
    "label" "text" NOT NULL,
    "type" "text" NOT NULL,
    "value" integer DEFAULT 0,
    "coupon_code" "text",
    "weight" integer DEFAULT 10,
    "color" "text" DEFAULT '#10B981'::"text",
    "display_order" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "wheel_prizes_type_check" CHECK (("type" = ANY (ARRAY['discount_percent'::"text", 'discount_amount'::"text", 'free_shipping'::"text", 'free_product'::"text", 'other'::"text"]))),
    CONSTRAINT "wheel_prizes_weight_check" CHECK ((("weight" >= 1) AND ("weight" <= 100)))
);


ALTER TABLE "public"."wheel_prizes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."wheel_prizes_public" AS
 SELECT "id",
    "wheel_id",
    "label",
    "color",
    "display_order",
    "active"
   FROM "public"."wheel_prizes"
  WHERE (COALESCE("active", true) = true);


ALTER VIEW "public"."wheel_prizes_public" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wheel_spins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wheel_id" "uuid",
    "prize_id" "uuid",
    "visitor_id" "text" NOT NULL,
    "email" "text",
    "redeemed" boolean DEFAULT false,
    "redeemed_at" timestamp with time zone,
    "order_id" "uuid",
    "spun_at" timestamp with time zone DEFAULT "now"(),
    "generated_coupon_code" "text",
    "client_ip" "text",
    "user_agent" "text"
);


ALTER TABLE "public"."wheel_spins" OWNER TO "postgres";


ALTER TABLE ONLY "auth"."refresh_tokens" ALTER COLUMN "id" SET DEFAULT "nextval"('"auth"."refresh_tokens_id_seq"'::"regclass");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "amr_id_pk" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."audit_log_entries"
    ADD CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."custom_oauth_providers"
    ADD CONSTRAINT "custom_oauth_providers_identifier_key" UNIQUE ("identifier");



ALTER TABLE ONLY "auth"."custom_oauth_providers"
    ADD CONSTRAINT "custom_oauth_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."flow_state"
    ADD CONSTRAINT "flow_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_provider_id_provider_unique" UNIQUE ("provider_id", "provider");



ALTER TABLE ONLY "auth"."instances"
    ADD CONSTRAINT "instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_authentication_method_pkey" UNIQUE ("session_id", "authentication_method");



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_last_challenged_at_key" UNIQUE ("last_challenged_at");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_code_key" UNIQUE ("authorization_code");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_id_key" UNIQUE ("authorization_id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_client_states"
    ADD CONSTRAINT "oauth_client_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_clients"
    ADD CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_client_unique" UNIQUE ("user_id", "client_id");



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_token_unique" UNIQUE ("token");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_entity_id_key" UNIQUE ("entity_id");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_providers"
    ADD CONSTRAINT "sso_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."webauthn_challenges"
    ADD CONSTRAINT "webauthn_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."webauthn_credentials"
    ADD CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."abandoned_carts"
    ADD CONSTRAINT "abandoned_carts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."card_events"
    ADD CONSTRAINT "card_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."card_scans"
    ADD CONSTRAINT "card_scans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_card_code_key" UNIQUE ("card_code");



ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_blocks"
    ADD CONSTRAINT "content_blocks_block_key_locale_key" UNIQUE ("block_key", "locale");



ALTER TABLE ONLY "public"."content_blocks"
    ADD CONSTRAINT "content_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_activities"
    ADD CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_contacts"
    ADD CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_deals"
    ADD CONSTRAINT "crm_deals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dispatch_config"
    ADD CONSTRAINT "dispatch_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_log"
    ADD CONSTRAINT "email_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_unsubscribe"
    ADD CONSTRAINT "email_unsubscribe_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."email_unsubscribe"
    ADD CONSTRAINT "email_unsubscribe_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_log"
    ADD CONSTRAINT "event_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_sku_unique" UNIQUE ("sku");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_alert_evaluations"
    ADD CONSTRAINT "kpi_alert_evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_alert_history"
    ADD CONSTRAINT "kpi_alert_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_alert_state"
    ADD CONSTRAINT "kpi_alert_state_alert_key_key" UNIQUE ("alert_key");



ALTER TABLE ONLY "public"."kpi_alert_state"
    ADD CONSTRAINT "kpi_alert_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_runtime_config"
    ADD CONSTRAINT "kpi_runtime_config_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."kpi_runtime_config"
    ADD CONSTRAINT "kpi_runtime_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_user_id_organization_id_key" UNIQUE ("user_id", "organization_id");



ALTER TABLE ONLY "public"."order_cards"
    ADD CONSTRAINT "order_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_operational_events"
    ADD CONSTRAINT "order_operational_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_folio_key" UNIQUE ("folio");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_bundle_items"
    ADD CONSTRAINT "product_bundle_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_bundles"
    ADD CONSTRAINT "product_bundles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_bundles"
    ADD CONSTRAINT "product_bundles_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."product_inventory_requirements"
    ADD CONSTRAINT "product_inventory_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_sku_key" UNIQUE ("sku");



ALTER TABLE ONLY "public"."profile_claims"
    ADD CONSTRAINT "profile_claims_claim_token_key" UNIQUE ("claim_token");



ALTER TABLE ONLY "public"."profile_claims"
    ADD CONSTRAINT "profile_claims_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."profile_claims"
    ADD CONSTRAINT "profile_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_slug_reservations"
    ADD CONSTRAINT "profile_slug_reservations_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."profile_slug_reservations"
    ADD CONSTRAINT "profile_slug_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_slug_reservations"
    ADD CONSTRAINT "profile_slug_reservations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."profile_versions"
    ADD CONSTRAINT "profile_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_versions"
    ADD CONSTRAINT "profile_versions_profile_id_version_key" UNIQUE ("profile_id", "version");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_cards"
    ADD CONSTRAINT "review_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_cards"
    ADD CONSTRAINT "review_cards_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wheel_config"
    ADD CONSTRAINT "wheel_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wheel_prizes"
    ADD CONSTRAINT "wheel_prizes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wheel_spins"
    ADD CONSTRAINT "wheel_spins_pkey" PRIMARY KEY ("id");



CREATE INDEX "audit_logs_instance_id_idx" ON "auth"."audit_log_entries" USING "btree" ("instance_id");



CREATE UNIQUE INDEX "confirmation_token_idx" ON "auth"."users" USING "btree" ("confirmation_token") WHERE (("confirmation_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "custom_oauth_providers_created_at_idx" ON "auth"."custom_oauth_providers" USING "btree" ("created_at");



CREATE INDEX "custom_oauth_providers_enabled_idx" ON "auth"."custom_oauth_providers" USING "btree" ("enabled");



CREATE INDEX "custom_oauth_providers_identifier_idx" ON "auth"."custom_oauth_providers" USING "btree" ("identifier");



CREATE INDEX "custom_oauth_providers_provider_type_idx" ON "auth"."custom_oauth_providers" USING "btree" ("provider_type");



CREATE UNIQUE INDEX "email_change_token_current_idx" ON "auth"."users" USING "btree" ("email_change_token_current") WHERE (("email_change_token_current")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "email_change_token_new_idx" ON "auth"."users" USING "btree" ("email_change_token_new") WHERE (("email_change_token_new")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "factor_id_created_at_idx" ON "auth"."mfa_factors" USING "btree" ("user_id", "created_at");



CREATE INDEX "flow_state_created_at_idx" ON "auth"."flow_state" USING "btree" ("created_at" DESC);



CREATE INDEX "identities_email_idx" ON "auth"."identities" USING "btree" ("email" "text_pattern_ops");



COMMENT ON INDEX "auth"."identities_email_idx" IS 'Auth: Ensures indexed queries on the email column';



CREATE INDEX "identities_user_id_idx" ON "auth"."identities" USING "btree" ("user_id");



CREATE INDEX "idx_auth_code" ON "auth"."flow_state" USING "btree" ("auth_code");



CREATE INDEX "idx_oauth_client_states_created_at" ON "auth"."oauth_client_states" USING "btree" ("created_at");



CREATE INDEX "idx_user_id_auth_method" ON "auth"."flow_state" USING "btree" ("user_id", "authentication_method");



CREATE INDEX "mfa_challenge_created_at_idx" ON "auth"."mfa_challenges" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "mfa_factors_user_friendly_name_unique" ON "auth"."mfa_factors" USING "btree" ("friendly_name", "user_id") WHERE (TRIM(BOTH FROM "friendly_name") <> ''::"text");



CREATE INDEX "mfa_factors_user_id_idx" ON "auth"."mfa_factors" USING "btree" ("user_id");



CREATE INDEX "oauth_auth_pending_exp_idx" ON "auth"."oauth_authorizations" USING "btree" ("expires_at") WHERE ("status" = 'pending'::"auth"."oauth_authorization_status");



CREATE INDEX "oauth_clients_deleted_at_idx" ON "auth"."oauth_clients" USING "btree" ("deleted_at");



CREATE INDEX "oauth_consents_active_client_idx" ON "auth"."oauth_consents" USING "btree" ("client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_active_user_client_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_user_order_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "granted_at" DESC);



CREATE INDEX "one_time_tokens_relates_to_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("relates_to");



CREATE INDEX "one_time_tokens_token_hash_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("token_hash");



CREATE UNIQUE INDEX "one_time_tokens_user_id_token_type_key" ON "auth"."one_time_tokens" USING "btree" ("user_id", "token_type");



CREATE UNIQUE INDEX "reauthentication_token_idx" ON "auth"."users" USING "btree" ("reauthentication_token") WHERE (("reauthentication_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "recovery_token_idx" ON "auth"."users" USING "btree" ("recovery_token") WHERE (("recovery_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "refresh_tokens_instance_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id");



CREATE INDEX "refresh_tokens_instance_id_user_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id", "user_id");



CREATE INDEX "refresh_tokens_parent_idx" ON "auth"."refresh_tokens" USING "btree" ("parent");



CREATE INDEX "refresh_tokens_session_id_revoked_idx" ON "auth"."refresh_tokens" USING "btree" ("session_id", "revoked");



CREATE INDEX "refresh_tokens_updated_at_idx" ON "auth"."refresh_tokens" USING "btree" ("updated_at" DESC);



CREATE INDEX "saml_providers_sso_provider_id_idx" ON "auth"."saml_providers" USING "btree" ("sso_provider_id");



CREATE INDEX "saml_relay_states_created_at_idx" ON "auth"."saml_relay_states" USING "btree" ("created_at" DESC);



CREATE INDEX "saml_relay_states_for_email_idx" ON "auth"."saml_relay_states" USING "btree" ("for_email");



CREATE INDEX "saml_relay_states_sso_provider_id_idx" ON "auth"."saml_relay_states" USING "btree" ("sso_provider_id");



CREATE INDEX "sessions_not_after_idx" ON "auth"."sessions" USING "btree" ("not_after" DESC);



CREATE INDEX "sessions_oauth_client_id_idx" ON "auth"."sessions" USING "btree" ("oauth_client_id");



CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "sso_domains_domain_idx" ON "auth"."sso_domains" USING "btree" ("lower"("domain"));



CREATE INDEX "sso_domains_sso_provider_id_idx" ON "auth"."sso_domains" USING "btree" ("sso_provider_id");



CREATE UNIQUE INDEX "sso_providers_resource_id_idx" ON "auth"."sso_providers" USING "btree" ("lower"("resource_id"));



CREATE INDEX "sso_providers_resource_id_pattern_idx" ON "auth"."sso_providers" USING "btree" ("resource_id" "text_pattern_ops");



CREATE UNIQUE INDEX "unique_phone_factor_per_user" ON "auth"."mfa_factors" USING "btree" ("user_id", "phone");



CREATE INDEX "user_id_created_at_idx" ON "auth"."sessions" USING "btree" ("user_id", "created_at");



CREATE UNIQUE INDEX "users_email_partial_key" ON "auth"."users" USING "btree" ("email") WHERE ("is_sso_user" = false);



COMMENT ON INDEX "auth"."users_email_partial_key" IS 'Auth: A partial unique index that applies only when is_sso_user is false';



CREATE INDEX "users_instance_id_email_idx" ON "auth"."users" USING "btree" ("instance_id", "lower"(("email")::"text"));



CREATE INDEX "users_instance_id_idx" ON "auth"."users" USING "btree" ("instance_id");



CREATE INDEX "users_is_anonymous_idx" ON "auth"."users" USING "btree" ("is_anonymous");



CREATE INDEX "webauthn_challenges_expires_at_idx" ON "auth"."webauthn_challenges" USING "btree" ("expires_at");



CREATE INDEX "webauthn_challenges_user_id_idx" ON "auth"."webauthn_challenges" USING "btree" ("user_id");



CREATE UNIQUE INDEX "webauthn_credentials_credential_id_key" ON "auth"."webauthn_credentials" USING "btree" ("credential_id");



CREATE INDEX "webauthn_credentials_user_id_idx" ON "auth"."webauthn_credentials" USING "btree" ("user_id");



CREATE INDEX "abandoned_carts_email_idx" ON "public"."abandoned_carts" USING "btree" ("email");



CREATE INDEX "abandoned_carts_status_idx" ON "public"."abandoned_carts" USING "btree" ("status");



CREATE UNIQUE INDEX "abandoned_carts_update_token_idx" ON "public"."abandoned_carts" USING "btree" ("update_token");



CREATE INDEX "audit_log_actor_idx" ON "public"."audit_log" USING "btree" ("actor_user_id");



CREATE INDEX "audit_log_created_at_idx" ON "public"."audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "audit_log_entity_idx" ON "public"."audit_log" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "card_events_card_id_idx" ON "public"."card_events" USING "btree" ("card_id");



CREATE INDEX "card_events_created_at_idx" ON "public"."card_events" USING "btree" ("created_at" DESC);



CREATE INDEX "card_events_event_type_idx" ON "public"."card_events" USING "btree" ("event_type");



CREATE INDEX "card_scans_card_id_idx" ON "public"."card_scans" USING "btree" ("card_id");



CREATE INDEX "card_scans_created_at_idx" ON "public"."card_scans" USING "btree" ("created_at" DESC);



CREATE INDEX "card_scans_org_id_idx" ON "public"."card_scans" USING "btree" ("organization_id");



CREATE INDEX "card_scans_profile_slug_idx" ON "public"."card_scans" USING "btree" ("profile_slug");



CREATE INDEX "card_scans_scanned_at_idx" ON "public"."card_scans" USING "btree" ("scanned_at" DESC);



CREATE INDEX "cards_order_id_deleted_idx" ON "public"."cards" USING "btree" ("order_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "cards_order_id_idx" ON "public"."cards" USING "btree" ("order_id");



CREATE INDEX "cards_org_id_idx" ON "public"."cards" USING "btree" ("organization_id");



CREATE INDEX "cards_profile_id_idx" ON "public"."cards" USING "btree" ("profile_id");



CREATE UNIQUE INDEX "cards_public_token_key" ON "public"."cards" USING "btree" ("public_token");



CREATE INDEX "cards_status_idx" ON "public"."cards" USING "btree" ("status");



CREATE INDEX "event_log_created_at_idx" ON "public"."event_log" USING "btree" ("created_at" DESC);



CREATE INDEX "event_log_event_type_idx" ON "public"."event_log" USING "btree" ("event_type");



CREATE INDEX "event_log_order_id_idx" ON "public"."event_log" USING "btree" ("order_id") WHERE ("order_id" IS NOT NULL);



CREATE INDEX "event_log_severity_created_idx" ON "public"."event_log" USING "btree" ("severity", "created_at" DESC) WHERE ("severity" = ANY (ARRAY['error'::"text", 'critical'::"text"]));



CREATE INDEX "event_log_severity_idx" ON "public"."event_log" USING "btree" ("severity");



CREATE INDEX "event_log_source_idx" ON "public"."event_log" USING "btree" ("source");



CREATE INDEX "idx_cards_org_id" ON "public"."cards" USING "btree" ("organization_id");



CREATE INDEX "idx_cards_profile_id" ON "public"."cards" USING "btree" ("profile_id");



CREATE INDEX "idx_events_created_at" ON "public"."events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_events_profile_slug" ON "public"."events" USING "btree" ("profile_slug");



CREATE INDEX "idx_inventory_category" ON "public"."inventory_items" USING "btree" ("category");



CREATE INDEX "idx_inventory_items_sku" ON "public"."inventory_items" USING "btree" ("sku");



CREATE INDEX "idx_memberships_org_id" ON "public"."memberships" USING "btree" ("organization_id");



CREATE INDEX "idx_memberships_user_id" ON "public"."memberships" USING "btree" ("user_id");



CREATE INDEX "idx_order_cards_card_id" ON "public"."order_cards" USING "btree" ("card_id");



CREATE INDEX "idx_order_cards_order_id" ON "public"."order_cards" USING "btree" ("order_id");



CREATE INDEX "idx_order_items_order_id" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_order_items_product_id" ON "public"."order_items" USING "btree" ("product_id");



CREATE INDEX "idx_orders_is_test" ON "public"."orders" USING "btree" ("is_test");



CREATE INDEX "idx_orders_org_id" ON "public"."orders" USING "btree" ("organization_id");



CREATE INDEX "idx_orders_user_id" ON "public"."orders" USING "btree" ("user_id");



CREATE INDEX "idx_products_status" ON "public"."products" USING "btree" ("status");



CREATE INDEX "idx_profiles_org_id" ON "public"."profiles" USING "btree" ("organization_id");



CREATE INDEX "idx_profiles_user_id" ON "public"."profiles" USING "btree" ("user_id");



CREATE INDEX "kpi_alert_evaluations_created_at_idx" ON "public"."kpi_alert_evaluations" USING "btree" ("created_at" DESC);



CREATE INDEX "kpi_alert_history_alert_key_created_at_idx" ON "public"."kpi_alert_history" USING "btree" ("alert_key", "created_at" DESC);



CREATE INDEX "kpi_alert_history_payload_hash_idx" ON "public"."kpi_alert_history" USING "btree" ("payload_hash");



CREATE INDEX "kpi_alert_state_updated_at_idx" ON "public"."kpi_alert_state" USING "btree" ("updated_at" DESC);



CREATE INDEX "kpi_runtime_config_active_idx" ON "public"."kpi_runtime_config" USING "btree" ("active", "created_at" DESC);



CREATE INDEX "memberships_org_idx" ON "public"."memberships" USING "btree" ("organization_id");



CREATE INDEX "memberships_role_idx" ON "public"."memberships" USING "btree" ("role");



CREATE INDEX "memberships_user_id_idx" ON "public"."memberships" USING "btree" ("user_id");



CREATE INDEX "order_operational_events_order_id_idx" ON "public"."order_operational_events" USING "btree" ("order_id", "event_at" DESC);



CREATE INDEX "order_operational_events_stage_idx" ON "public"."order_operational_events" USING "btree" ("stage", "event_at" DESC);



CREATE INDEX "order_status_history_actor_user_idx" ON "public"."order_status_history" USING "btree" ("actor_user_id");



CREATE UNIQUE INDEX "orders_client_checkout_attempt_id_key" ON "public"."orders" USING "btree" ("client_checkout_attempt_id") WHERE ("client_checkout_attempt_id" IS NOT NULL);



CREATE UNIQUE INDEX "orders_delivery_token_idx" ON "public"."orders" USING "btree" ("delivery_token") WHERE ("delivery_token" IS NOT NULL);



CREATE INDEX "orders_inventory_reserved_idx" ON "public"."orders" USING "btree" ("inventory_reserved") WHERE (("inventory_reserved" = true) AND ("inventory_decremented" = false));



CREATE UNIQUE INDEX "orders_mp_preference_id_key" ON "public"."orders" USING "btree" ("mp_preference_id") WHERE ("mp_preference_id" IS NOT NULL);



CREATE INDEX "orders_qa_override_at_idx" ON "public"."orders" USING "btree" ("qa_override_at");



CREATE INDEX "orders_qa_reviewed_at_idx" ON "public"."orders" USING "btree" ("qa_reviewed_at");



CREATE INDEX "orders_tracking_code_idx" ON "public"."orders" USING "btree" ("tracking_code") WHERE ("tracking_code" IS NOT NULL);



CREATE UNIQUE INDEX "payments_provider_external_id_active_unique" ON "public"."payments" USING "btree" ("provider", "external_id") WHERE (("deleted_at" IS NULL) AND ("external_id" IS NOT NULL));



CREATE UNIQUE INDEX "payments_provider_external_id_key" ON "public"."payments" USING "btree" ("provider", "external_id") WHERE (("external_id" IS NOT NULL) AND ("deleted_at" IS NULL));



CREATE INDEX "product_bundle_items_bundle_idx" ON "public"."product_bundle_items" USING "btree" ("bundle_id", "sort_order");



CREATE INDEX "product_bundle_items_product_idx" ON "public"."product_bundle_items" USING "btree" ("product_id");



CREATE INDEX "product_bundles_active_idx" ON "public"."product_bundles" USING "btree" ("active", "is_visible_home");



CREATE INDEX "product_bundles_segment_idx" ON "public"."product_bundles" USING "btree" ("segment", "bundle_type");



CREATE INDEX "profile_claims_claimed_by_user_id_idx" ON "public"."profile_claims" USING "btree" ("claimed_by_user_id");



CREATE INDEX "profile_claims_customer_email_idx" ON "public"."profile_claims" USING "btree" ("customer_email");



CREATE INDEX "profile_claims_status_idx" ON "public"."profile_claims" USING "btree" ("status");



CREATE INDEX "profile_slug_reservations_active_idx" ON "public"."profile_slug_reservations" USING "btree" ("slug", "status", "expires_at");



CREATE INDEX "profile_slug_reservations_order_id_idx" ON "public"."profile_slug_reservations" USING "btree" ("order_id");



CREATE INDEX "profile_versions_created_at_idx" ON "public"."profile_versions" USING "btree" ("created_at" DESC);



CREATE INDEX "profile_versions_profile_id_idx" ON "public"."profile_versions" USING "btree" ("profile_id");



CREATE UNIQUE INDEX "profiles_active_slug_unique_idx" ON "public"."profiles" USING "btree" ("slug") WHERE (("deleted_at" IS NULL) AND ("slug" IS NOT NULL));



COMMENT ON INDEX "public"."profiles_active_slug_unique_idx" IS 'Pre-launch guard: prevents duplicate active public NexCard profile slugs.';



CREATE INDEX "profiles_card_type_idx" ON "public"."profiles" USING "btree" ("card_type");



CREATE UNIQUE INDEX "ux_order_cards_card_id" ON "public"."order_cards" USING "btree" ("card_id");



CREATE UNIQUE INDEX "ux_order_cards_order_card" ON "public"."order_cards" USING "btree" ("order_id", "card_id");



CREATE UNIQUE INDEX "ux_product_inventory_requirements_unique" ON "public"."product_inventory_requirements" USING "btree" ("product_id", "inventory_item_id");



CREATE INDEX "wheel_prizes_wheel_idx" ON "public"."wheel_prizes" USING "btree" ("wheel_id");



CREATE INDEX "wheel_spins_client_ip_recent_idx" ON "public"."wheel_spins" USING "btree" ("wheel_id", "client_ip", "spun_at") WHERE ("client_ip" IS NOT NULL);



CREATE INDEX "wheel_spins_coupon_unredeemed_idx" ON "public"."wheel_spins" USING "btree" ("upper"("generated_coupon_code"), "redeemed") WHERE ("generated_coupon_code" IS NOT NULL);



CREATE UNIQUE INDEX "wheel_spins_generated_coupon_code_key" ON "public"."wheel_spins" USING "btree" ("upper"("generated_coupon_code")) WHERE ("generated_coupon_code" IS NOT NULL);



CREATE INDEX "wheel_spins_visitor_idx" ON "public"."wheel_spins" USING "btree" ("visitor_id");



CREATE INDEX "wheel_spins_visitor_recent_idx" ON "public"."wheel_spins" USING "btree" ("wheel_id", "visitor_id", "spun_at");



CREATE OR REPLACE TRIGGER "set_order_folio" BEFORE INSERT ON "public"."orders" FOR EACH ROW WHEN (("new"."folio" IS NULL)) EXECUTE FUNCTION "public"."generate_order_folio"();



CREATE OR REPLACE TRIGGER "trg_cards_sync_order_activation" AFTER INSERT OR UPDATE ON "public"."cards" FOR EACH ROW EXECUTE FUNCTION "public"."sync_order_activation_from_card"();



CREATE OR REPLACE TRIGGER "trg_cards_updated" BEFORE UPDATE ON "public"."cards" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_cb_updated" BEFORE UPDATE ON "public"."content_blocks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_guard_orders_sensitive_updates" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."guard_orders_sensitive_updates"();



CREATE OR REPLACE TRIGGER "trg_inv_items_updated" BEFORE UPDATE ON "public"."inventory_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_kpi_alert_state_updated_at" BEFORE UPDATE ON "public"."kpi_alert_state" FOR EACH ROW EXECUTE FUNCTION "public"."set_kpi_alert_state_updated_at"();



CREATE OR REPLACE TRIGGER "trg_kpi_runtime_config_updated_at" BEFORE UPDATE ON "public"."kpi_runtime_config" FOR EACH ROW EXECUTE FUNCTION "public"."set_kpi_runtime_config_updated_at"();



CREATE OR REPLACE TRIGGER "trg_orders_apply_test_segmentation" BEFORE INSERT OR UPDATE OF "customer_name", "customer_email" ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."apply_order_test_segmentation"();



CREATE OR REPLACE TRIGGER "trg_orders_emit_operational_events" AFTER INSERT OR UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."emit_order_operational_events"();



CREATE OR REPLACE TRIGGER "trg_orders_ensure_pending_cards" AFTER INSERT OR UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_order_pending_cards_from_order"();



CREATE OR REPLACE TRIGGER "trg_orders_set_operational_timestamps" BEFORE INSERT OR UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_order_operational_timestamps"();



CREATE OR REPLACE TRIGGER "trg_orders_updated" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_org_updated" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_payments_updated" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_prevent_profile_status_self_update" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_profile_status_self_update"();



CREATE OR REPLACE TRIGGER "trg_product_bundle_items_updated" BEFORE UPDATE ON "public"."product_bundle_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_product_bundles_updated" BEFORE UPDATE ON "public"."product_bundles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profile_claims_ensure_pending_cards" AFTER INSERT OR UPDATE ON "public"."profile_claims" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_order_pending_cards_from_claim"();



CREATE OR REPLACE TRIGGER "trg_profile_claims_sync_order_activation" AFTER INSERT OR UPDATE ON "public"."profile_claims" FOR EACH ROW EXECUTE FUNCTION "public"."sync_order_activation_from_claim"();



CREATE OR REPLACE TRIGGER "trg_profile_claims_updated" BEFORE UPDATE ON "public"."profile_claims" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_consume_slug_reservation" AFTER INSERT OR UPDATE OF "slug" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."consume_profile_slug_reservation"();



CREATE OR REPLACE TRIGGER "trg_profiles_enforce_slug_reservation" BEFORE INSERT OR UPDATE OF "slug" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_profile_slug_reservation"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_auth_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "auth"."mfa_factors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_flow_state_id_fkey" FOREIGN KEY ("flow_state_id") REFERENCES "auth"."flow_state"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_oauth_client_id_fkey" FOREIGN KEY ("oauth_client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."webauthn_challenges"
    ADD CONSTRAINT "webauthn_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."webauthn_credentials"
    ADD CONSTRAINT "webauthn_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."card_events"
    ADD CONSTRAINT "card_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."card_events"
    ADD CONSTRAINT "card_events_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."card_scans"
    ADD CONSTRAINT "card_scans_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."card_scans"
    ADD CONSTRAINT "card_scans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."card_scans"
    ADD CONSTRAINT "card_scans_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_replaced_by_fk" FOREIGN KEY ("replaced_by_card_id") REFERENCES "public"."cards"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crm_activities"
    ADD CONSTRAINT "crm_activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crm_activities"
    ADD CONSTRAINT "crm_activities_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "public"."crm_deals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_contacts"
    ADD CONSTRAINT "crm_contacts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crm_deals"
    ADD CONSTRAINT "crm_deals_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dispatch_config"
    ADD CONSTRAINT "dispatch_config_sku_fkey" FOREIGN KEY ("sku") REFERENCES "public"."inventory_items"("sku");



ALTER TABLE ONLY "public"."email_log"
    ADD CONSTRAINT "email_log_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."event_log"
    ADD CONSTRAINT "event_log_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_cards"
    ADD CONSTRAINT "order_cards_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_cards"
    ADD CONSTRAINT "order_cards_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_operational_events"
    ADD CONSTRAINT "order_operational_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_qa_override_by_fkey" FOREIGN KEY ("qa_override_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_qa_reviewed_by_fkey" FOREIGN KEY ("qa_reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_bundle_items"
    ADD CONSTRAINT "product_bundle_items_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "public"."product_bundles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_bundle_items"
    ADD CONSTRAINT "product_bundle_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."product_inventory_requirements"
    ADD CONSTRAINT "product_inventory_requirements_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."profile_claims"
    ADD CONSTRAINT "profile_claims_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profile_claims"
    ADD CONSTRAINT "profile_claims_claimed_by_user_id_fkey" FOREIGN KEY ("claimed_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profile_claims"
    ADD CONSTRAINT "profile_claims_claimed_profile_id_fkey" FOREIGN KEY ("claimed_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profile_claims"
    ADD CONSTRAINT "profile_claims_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_slug_reservations"
    ADD CONSTRAINT "profile_slug_reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_slug_reservations"
    ADD CONSTRAINT "profile_slug_reservations_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profile_slug_reservations"
    ADD CONSTRAINT "profile_slug_reservations_reserved_by_user_id_fkey" FOREIGN KEY ("reserved_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profile_versions"
    ADD CONSTRAINT "profile_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profile_versions"
    ADD CONSTRAINT "profile_versions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."review_cards"
    ADD CONSTRAINT "review_cards_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wheel_prizes"
    ADD CONSTRAINT "wheel_prizes_wheel_id_fkey" FOREIGN KEY ("wheel_id") REFERENCES "public"."wheel_config"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wheel_spins"
    ADD CONSTRAINT "wheel_spins_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wheel_spins"
    ADD CONSTRAINT "wheel_spins_prize_id_fkey" FOREIGN KEY ("prize_id") REFERENCES "public"."wheel_prizes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wheel_spins"
    ADD CONSTRAINT "wheel_spins_wheel_id_fkey" FOREIGN KEY ("wheel_id") REFERENCES "public"."wheel_config"("id") ON DELETE SET NULL;



ALTER TABLE "auth"."audit_log_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."flow_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_amr_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_factors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."one_time_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."refresh_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_relay_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."schema_migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_domains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Allow anonymous users to insert orders" ON "public"."orders" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow inserting order items" ON "public"."order_items" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow reading order items" ON "public"."order_items" FOR SELECT USING (true);



CREATE POLICY "Allow users to read their own orders" ON "public"."orders" FOR SELECT USING ((("user_id" IS NULL) OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."abandoned_carts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "abandoned_carts_admin_all" ON "public"."abandoned_carts" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "abandoned_carts_anon_insert" ON "public"."abandoned_carts" FOR INSERT TO "anon" WITH CHECK ((("status" = 'abandoned'::"text") AND (NULLIF(TRIM(BOTH FROM "email"), ''::"text") IS NOT NULL) AND ("total_cents" >= 0)));



CREATE POLICY "abandoned_carts_anon_lifecycle_update" ON "public"."abandoned_carts" FOR UPDATE TO "anon" USING ((("update_token" = "public"."current_cart_update_token"()) AND ("status" = ANY (ARRAY['abandoned'::"text", 'email_sent'::"text"])))) WITH CHECK ((("update_token" = "public"."current_cart_update_token"()) AND ("status" = ANY (ARRAY['converted'::"text", 'ignored'::"text"]))));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_admin_all" ON "public"."audit_log" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



ALTER TABLE "public"."card_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "card_events_admin_manage" ON "public"."card_events" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "card_events_admin_read" ON "public"."card_events" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"text"));



ALTER TABLE "public"."card_scans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "card_scans_admin_manage" ON "public"."card_scans" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "card_scans_admin_select" ON "public"."card_scans" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"text"));



CREATE POLICY "card_scans_anon_insert" ON "public"."card_scans" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "card_scans_public_insert" ON "public"."card_scans" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("card_id" IS NOT NULL) AND ("scan_source" IS NOT NULL) AND (COALESCE("risk_score", 0) >= 0)));



ALTER TABLE "public"."cards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cards_admin_manage" ON "public"."cards" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "cards_authenticated_read" ON "public"."cards" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "cards_org_member_read" ON "public"."cards" FOR SELECT TO "authenticated" USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "cards_owner_read" ON "public"."cards" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "cards"."profile_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "cb_admin_write" ON "public"."content_blocks" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "cb_public_read" ON "public"."content_blocks" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."content_blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crm_activities_admin_all" ON "public"."crm_activities" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



ALTER TABLE "public"."crm_contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crm_contacts_admin_all" ON "public"."crm_contacts" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



ALTER TABLE "public"."crm_deals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crm_deals_admin_all" ON "public"."crm_deals" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



ALTER TABLE "public"."dispatch_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dispatch_config_authenticated_all" ON "public"."dispatch_config" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."email_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "email_log_admin_insert" ON "public"."email_log" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "email_log_admin_select" ON "public"."email_log" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"text"));



ALTER TABLE "public"."email_unsubscribe" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "email_unsubscribe_admin_select" ON "public"."email_unsubscribe" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"text"));



CREATE POLICY "email_unsubscribe_public_insert" ON "public"."email_unsubscribe" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."event_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_log_admin_read" ON "public"."event_log" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"text"));



CREATE POLICY "event_log_anon_insert" ON "public"."event_log" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "event_log_auth_insert" ON "public"."event_log" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "event_log_service_all" ON "public"."event_log" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_admin_read" ON "public"."events" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"text"));



CREATE POLICY "events_public_insert" ON "public"."events" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "history_authenticated_insert" ON "public"."order_status_history" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "history_authenticated_read" ON "public"."order_status_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "inv_admin_manage" ON "public"."inventory_items" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "inv_movements_manage" ON "public"."inventory_movements" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



ALTER TABLE "public"."inventory_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_items_authenticated_read" ON "public"."inventory_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "inventory_items_authenticated_update" ON "public"."inventory_items" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."inventory_movements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_movements_authenticated_insert" ON "public"."inventory_movements" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "inventory_movements_authenticated_read" ON "public"."inventory_movements" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."kpi_alert_evaluations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kpi_alert_evaluations_auth_all" ON "public"."kpi_alert_evaluations" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."kpi_alert_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kpi_alert_history_auth_all" ON "public"."kpi_alert_history" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."kpi_alert_state" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kpi_alert_state_auth_all" ON "public"."kpi_alert_state" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."kpi_runtime_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kpi_runtime_config_auth_all" ON "public"."kpi_runtime_config" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "mem_admin_manage" ON "public"."memberships" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "mem_select_self" ON "public"."memberships" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_cards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_cards_admin_manage" ON "public"."order_cards" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "order_cards_admin_read" ON "public"."order_cards" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"text"));



ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_items_admin_manage" ON "public"."order_items" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "order_items_insert_anon" ON "public"."order_items" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "order_items_owner_insert" ON "public"."order_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND ("o"."user_id" = "auth"."uid"())))));



CREATE POLICY "order_items_owner_read" ON "public"."order_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND ("o"."user_id" = "auth"."uid"())))));



CREATE POLICY "order_items_select_anon" ON "public"."order_items" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."order_operational_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_operational_events_admin_manage" ON "public"."order_operational_events" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "order_operational_events_admin_read" ON "public"."order_operational_events" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"text"));



ALTER TABLE "public"."order_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders_admin_all" ON "public"."orders" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "orders_admin_update" ON "public"."orders" FOR UPDATE TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "orders_owner_insert" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "orders_owner_read" ON "public"."orders" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "org_admin_manage" ON "public"."organizations" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "org_member_read" ON "public"."organizations" FOR SELECT TO "authenticated" USING (("public"."is_org_member"("id") OR "public"."has_role"('admin'::"text")));



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_admin_manage" ON "public"."payments" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "payments_owner_read" ON "public"."payments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "payments"."order_id") AND ("o"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."product_bundle_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_bundle_items_admin_manage" ON "public"."product_bundle_items" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "product_bundle_items_public_read" ON "public"."product_bundle_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."product_bundles" "b"
  WHERE (("b"."id" = "product_bundle_items"."bundle_id") AND ("b"."active" = true) AND ("b"."deleted_at" IS NULL)))));



ALTER TABLE "public"."product_bundles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_bundles_admin_manage" ON "public"."product_bundles" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "product_bundles_public_read_active" ON "public"."product_bundles" FOR SELECT USING ((("active" = true) AND ("deleted_at" IS NULL)));



ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_admin_manage" ON "public"."products" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "products_public_read" ON "public"."products" FOR SELECT TO "authenticated", "anon" USING ((COALESCE("status", 'active'::"text") = 'active'::"text"));



CREATE POLICY "products_read_public" ON "public"."products" FOR SELECT USING (("status" = 'active'::"text"));



ALTER TABLE "public"."profile_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_slug_reservations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profile_slug_reservations_admin_manage" ON "public"."profile_slug_reservations" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "profile_slug_reservations_admin_read" ON "public"."profile_slug_reservations" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"text"));



ALTER TABLE "public"."profile_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profile_versions_admin_all" ON "public"."profile_versions" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_admin_read" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."has_role"('admin'::"text"));



CREATE POLICY "profiles_admin_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "profiles_owner_insert" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "profiles_owner_read" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "profiles_owner_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "profiles_public_read" ON "public"."profiles" FOR SELECT TO "authenticated", "anon" USING ((COALESCE("status", 'active'::"text") = 'active'::"text"));



ALTER TABLE "public"."refunds" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "refunds_admin_all" ON "public"."refunds" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



ALTER TABLE "public"."review_cards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review_cards_admin_all" ON "public"."review_cards" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "review_cards_anon_select" ON "public"."review_cards" FOR SELECT TO "anon" USING (("active" = true));



ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_members_admin_all" ON "public"."team_members" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "team_members_anon_select" ON "public"."team_members" FOR SELECT TO "anon" USING (("active" = true));



ALTER TABLE "public"."waitlist" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "waitlist_insert_anon" ON "public"."waitlist" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "waitlist_read_authenticated" ON "public"."waitlist" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."wheel_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wheel_config_admin_all" ON "public"."wheel_config" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "wheel_config_anon_select" ON "public"."wheel_config" FOR SELECT TO "anon" USING (("active" = true));



ALTER TABLE "public"."wheel_prizes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wheel_prizes_admin_all" ON "public"."wheel_prizes" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



ALTER TABLE "public"."wheel_spins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wheel_spins_admin_all" ON "public"."wheel_spins" TO "authenticated" USING ("public"."has_role"('admin'::"text")) WITH CHECK ("public"."has_role"('admin'::"text"));



CREATE POLICY "wheel_spins_anon_update_own_email" ON "public"."wheel_spins" FOR UPDATE TO "anon" USING (false) WITH CHECK (false);



GRANT USAGE ON SCHEMA "auth" TO "anon";
GRANT USAGE ON SCHEMA "auth" TO "authenticated";
GRANT USAGE ON SCHEMA "auth" TO "service_role";
GRANT ALL ON SCHEMA "auth" TO "supabase_auth_admin";
GRANT ALL ON SCHEMA "auth" TO "dashboard_user";
GRANT USAGE ON SCHEMA "auth" TO "postgres";



GRANT USAGE ON SCHEMA "extensions" TO "anon";
GRANT USAGE ON SCHEMA "extensions" TO "authenticated";
GRANT USAGE ON SCHEMA "extensions" TO "service_role";
GRANT ALL ON SCHEMA "extensions" TO "dashboard_user";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "auth"."email"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."jwt"() TO "postgres";
GRANT ALL ON FUNCTION "auth"."jwt"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."role"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."uid"() TO "dashboard_user";



REVOKE ALL ON FUNCTION "extensions"."grant_pg_cron_access"() FROM "supabase_admin";
GRANT ALL ON FUNCTION "extensions"."grant_pg_cron_access"() TO "supabase_admin" WITH GRANT OPTION;
GRANT ALL ON FUNCTION "extensions"."grant_pg_cron_access"() TO "dashboard_user";



GRANT ALL ON FUNCTION "extensions"."grant_pg_graphql_access"() TO "postgres" WITH GRANT OPTION;



REVOKE ALL ON FUNCTION "extensions"."grant_pg_net_access"() FROM "supabase_admin";
GRANT ALL ON FUNCTION "extensions"."grant_pg_net_access"() TO "supabase_admin" WITH GRANT OPTION;
GRANT ALL ON FUNCTION "extensions"."grant_pg_net_access"() TO "dashboard_user";



GRANT ALL ON FUNCTION "extensions"."pgrst_ddl_watch"() TO "postgres" WITH GRANT OPTION;



GRANT ALL ON FUNCTION "extensions"."pgrst_drop_watch"() TO "postgres" WITH GRANT OPTION;



GRANT ALL ON FUNCTION "extensions"."set_graphql_placeholder"() TO "postgres" WITH GRANT OPTION;



GRANT ALL ON FUNCTION "public"."activate_card"("target_card_id" "uuid", "actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."activate_card"("target_card_id" "uuid", "actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."activate_card"("target_card_id" "uuid", "actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_dispatch_order"("target_order_id" "uuid", "p_carrier" "text", "p_tracking_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_dispatch_order"("target_order_id" "uuid", "p_carrier" "text", "p_tracking_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_dispatch_order"("target_order_id" "uuid", "p_carrier" "text", "p_tracking_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_dispatch_order"("target_order_id" "uuid", "p_carrier" "text", "p_tracking_code" "text") TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_override_order_test_classification"("target_order_id" "uuid", "target_is_test" boolean, "target_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_override_order_test_classification"("target_order_id" "uuid", "target_is_test" boolean, "target_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_override_order_test_classification"("target_order_id" "uuid", "target_is_test" boolean, "target_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_review_order_test_classification"("target_order_id" "uuid", "review_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_review_order_test_classification"("target_order_id" "uuid", "review_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_review_order_test_classification"("target_order_id" "uuid", "review_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_transition_order_state"("target_order_id" "uuid", "next_payment_status" "text", "next_fulfillment_status" "text", "reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_transition_order_state"("target_order_id" "uuid", "next_payment_status" "text", "next_fulfillment_status" "text", "reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_transition_order_state"("target_order_id" "uuid", "next_payment_status" "text", "next_fulfillment_status" "text", "reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_transition_order_state"("target_order_id" "uuid", "next_payment_status" "text", "next_fulfillment_status" "text", "reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_order_test_segmentation"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_order_test_segmentation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_order_test_segmentation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_card"("target_card_id" "uuid", "target_profile_id" "uuid", "actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_card"("target_card_id" "uuid", "target_profile_id" "uuid", "actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_card"("target_card_id" "uuid", "target_profile_id" "uuid", "actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_profile_slug_availability"("candidate_slug" "text", "current_order_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_profile_slug_availability"("candidate_slug" "text", "current_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_profile_slug_availability"("candidate_slug" "text", "current_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_profile_slug_availability"("candidate_slug" "text", "current_order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."classify_order_test_signal"("input_customer_name" "text", "input_customer_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."classify_order_test_signal"("input_customer_name" "text", "input_customer_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."classify_order_test_signal"("input_customer_name" "text", "input_customer_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."confirm_order_delivery_by_token"("target_order_id" "uuid", "provided_delivery_token" "uuid", "confirmed_by" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirm_order_delivery_by_token"("target_order_id" "uuid", "provided_delivery_token" "uuid", "confirmed_by" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_order_delivery_by_token"("target_order_id" "uuid", "provided_delivery_token" "uuid", "confirmed_by" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_order_delivery_by_token"("target_order_id" "uuid", "provided_delivery_token" "uuid", "confirmed_by" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."consume_profile_slug_reservation"() TO "anon";
GRANT ALL ON FUNCTION "public"."consume_profile_slug_reservation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_profile_slug_reservation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_order_with_items"("p_order" "jsonb", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_order_with_items"("p_order" "jsonb", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_order_with_items"("p_order" "jsonb", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_cart_update_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_cart_update_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_cart_update_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_stock"("p_sku" "text", "p_quantity" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_stock"("p_sku" "text", "p_quantity" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_stock"("p_sku" "text", "p_quantity" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."emit_order_operational_events"() TO "anon";
GRANT ALL ON FUNCTION "public"."emit_order_operational_events"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."emit_order_operational_events"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_profile_slug_reservation"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_profile_slug_reservation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_profile_slug_reservation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."ensure_order_pending_cards"("target_order_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_order_pending_cards"("target_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_order_pending_cards"("target_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_order_pending_cards"("target_order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_order_pending_cards_from_claim"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_order_pending_cards_from_claim"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_order_pending_cards_from_claim"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_order_pending_cards_from_order"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_order_pending_cards_from_order"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_order_pending_cards_from_order"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."expire_profile_slug_reservations"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expire_profile_slug_reservations"() TO "anon";
GRANT ALL ON FUNCTION "public"."expire_profile_slug_reservations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."expire_profile_slug_reservations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_order_folio"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_order_folio"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_order_folio"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_membership_role"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_membership_role"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_membership_role"("org_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_orders_sensitive_updates"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_orders_sensitive_updates"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_orders_sensitive_updates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_orders_sensitive_updates"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_role"("required_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_role"("required_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("required_role" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."has_role"("required_role" "text") TO "anon";



GRANT ALL ON FUNCTION "public"."increment_view_count"("profile_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_view_count"("profile_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_view_count"("profile_slug" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_order_history_entry"("p_order_id" "uuid", "p_field" "text", "p_old_value" "text", "p_new_value" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_order_history_entry"("p_order_id" "uuid", "p_field" "text", "p_old_value" "text", "p_new_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_order_history_entry"("p_order_id" "uuid", "p_field" "text", "p_old_value" "text", "p_new_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_order_history_entry"("p_order_id" "uuid", "p_field" "text", "p_old_value" "text", "p_new_value" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_org_member"("target_org" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_org_member"("target_org" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_org_member"("target_org" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_org_member"("target_org" "uuid") TO "anon";



GRANT ALL ON FUNCTION "public"."is_valid_chilean_rut"("raw_rut" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_chilean_rut"("raw_rut" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_chilean_rut"("raw_rut" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_valid_profile_slug"("input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_profile_slug"("input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_profile_slug"("input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_order_card"("target_order_id" "uuid", "target_card_id" "uuid", "actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."link_order_card"("target_order_id" "uuid", "target_card_id" "uuid", "actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_order_card"("target_order_id" "uuid", "target_card_id" "uuid", "actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_email_event"("p_recipient_email" "text", "p_email_type" "text", "p_order_id" "uuid", "p_subject" "text", "p_status" "text", "p_provider" "text", "p_provider_message_id" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_email_event"("p_recipient_email" "text", "p_email_type" "text", "p_order_id" "uuid", "p_subject" "text", "p_status" "text", "p_provider" "text", "p_provider_message_id" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_email_event"("p_recipient_email" "text", "p_email_type" "text", "p_order_id" "uuid", "p_subject" "text", "p_status" "text", "p_provider" "text", "p_provider_message_id" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_email_event"("p_recipient_email" "text", "p_email_type" "text", "p_order_id" "uuid", "p_subject" "text", "p_status" "text", "p_provider" "text", "p_provider_message_id" "text", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_order_operational_event"("p_order_id" "uuid", "p_stage" "text", "p_event_type" "text", "p_source" "text", "p_event_at" timestamp with time zone, "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_order_operational_event"("p_order_id" "uuid", "p_stage" "text", "p_event_type" "text", "p_source" "text", "p_event_at" timestamp with time zone, "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_order_operational_event"("p_order_id" "uuid", "p_stage" "text", "p_event_type" "text", "p_source" "text", "p_event_at" timestamp with time zone, "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_order_operational_event"("p_order_id" "uuid", "p_stage" "text", "p_event_type" "text", "p_source" "text", "p_event_at" timestamp with time zone, "p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_abandoned_cart_converted_public"("cart_id" "uuid", "cart_update_token" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_abandoned_cart_converted_public"("cart_id" "uuid", "cart_update_token" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_abandoned_cart_converted_public"("cart_id" "uuid", "cart_update_token" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_abandoned_cart_converted_public"("cart_id" "uuid", "cart_update_token" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_order_activated"("target_order_id" "uuid", "target_card_id" "uuid", "p_source" "text", "p_payload" "jsonb", "p_activated_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_order_activated"("target_order_id" "uuid", "target_card_id" "uuid", "p_source" "text", "p_payload" "jsonb", "p_activated_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."mark_order_activated"("target_order_id" "uuid", "target_card_id" "uuid", "p_source" "text", "p_payload" "jsonb", "p_activated_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_order_activated"("target_order_id" "uuid", "target_card_id" "uuid", "p_source" "text", "p_payload" "jsonb", "p_activated_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_order_fulfillment_status"("target_order_id" "uuid", "new_status" "text", "actor_id" "uuid", "reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_order_fulfillment_status"("target_order_id" "uuid", "new_status" "text", "actor_id" "uuid", "reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_order_fulfillment_status"("target_order_id" "uuid", "new_status" "text", "actor_id" "uuid", "reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_order_payment_status"("target_order_id" "uuid", "new_status" "text", "actor_id" "uuid", "reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_order_payment_status"("target_order_id" "uuid", "new_status" "text", "actor_id" "uuid", "reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_order_payment_status"("target_order_id" "uuid", "new_status" "text", "actor_id" "uuid", "reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_payment_status"("target_payment_id" "uuid", "new_status" "text", "actor_id" "uuid", "reason" "text", "external_ref" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_payment_status"("target_payment_id" "uuid", "new_status" "text", "actor_id" "uuid", "reason" "text", "external_ref" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_payment_status"("target_payment_id" "uuid", "new_status" "text", "actor_id" "uuid", "reason" "text", "external_ref" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_profile_slug"("input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_profile_slug"("input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_profile_slug"("input" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."prevent_profile_status_self_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_profile_status_self_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_profile_status_self_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_profile_status_self_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reassign_card"("target_card_id" "uuid", "target_profile_id" "uuid", "actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reassign_card"("target_card_id" "uuid", "target_profile_id" "uuid", "actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reassign_card"("target_card_id" "uuid", "target_profile_id" "uuid", "actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reconcile_order_payment_status"("target_order_id" "uuid", "actor_id" "uuid", "reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reconcile_order_payment_status"("target_order_id" "uuid", "actor_id" "uuid", "reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reconcile_order_payment_status"("target_order_id" "uuid", "actor_id" "uuid", "reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reconcile_order_payment_status"("target_order_id" "uuid", "actor_id" "uuid", "reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_wheel_spin_email"("p_spin_id" "uuid", "p_visitor_id" "text", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_wheel_spin_email"("p_spin_id" "uuid", "p_visitor_id" "text", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_wheel_spin_email"("p_spin_id" "uuid", "p_visitor_id" "text", "p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reserve_inventory_for_order"("target_order_id" "uuid", "actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reserve_inventory_for_order"("target_order_id" "uuid", "actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reserve_inventory_for_order"("target_order_id" "uuid", "actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reserve_profile_slug_for_order"("target_order_id" "uuid", "candidate_slug" "text", "customer_email" "text", "reserve_for" interval) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reserve_profile_slug_for_order"("target_order_id" "uuid", "candidate_slug" "text", "customer_email" "text", "reserve_for" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."reserve_profile_slug_for_order"("target_order_id" "uuid", "candidate_slug" "text", "customer_email" "text", "reserve_for" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reserve_profile_slug_for_order"("target_order_id" "uuid", "candidate_slug" "text", "customer_email" "text", "reserve_for" interval) TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolve_card_by_token"("input_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_card_by_token"("input_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_card_by_token"("input_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_card_by_token"("input_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."restore_profile_version"("target_profile_id" "uuid", "target_version" integer, "actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."restore_profile_version"("target_profile_id" "uuid", "target_version" integer, "actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_profile_version"("target_profile_id" "uuid", "target_version" integer, "actor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_card"("target_card_id" "uuid", "actor_id" "uuid", "reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_card"("target_card_id" "uuid", "actor_id" "uuid", "reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_card"("target_card_id" "uuid", "actor_id" "uuid", "reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_abandoned_cart_public"("cart_email" "text", "cart_customer_name" "text", "cart_items" "jsonb", "cart_total_cents" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_abandoned_cart_public"("cart_email" "text", "cart_customer_name" "text", "cart_items" "jsonb", "cart_total_cents" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."save_abandoned_cart_public"("cart_email" "text", "cart_customer_name" "text", "cart_items" "jsonb", "cart_total_cents" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_abandoned_cart_public"("cart_email" "text", "cart_customer_name" "text", "cart_items" "jsonb", "cart_total_cents" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_kpi_alert_state_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_kpi_alert_state_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_kpi_alert_state_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_kpi_runtime_config_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_kpi_runtime_config_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_kpi_runtime_config_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_order_operational_timestamps"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_order_operational_timestamps"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_order_operational_timestamps"() TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_profile_status"("profile_id" "uuid", "new_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_profile_status"("profile_id" "uuid", "new_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_profile_status"("profile_id" "uuid", "new_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_profile_status"("profile_id" "uuid", "new_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."snapshot_card"("target_card_id" "uuid", "actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."snapshot_card"("target_card_id" "uuid", "actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."snapshot_card"("target_card_id" "uuid", "actor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."snapshot_order"("target_order_id" "uuid", "actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."snapshot_order"("target_order_id" "uuid", "actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."snapshot_order"("target_order_id" "uuid", "actor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."snapshot_payment"("target_payment_id" "uuid", "actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."snapshot_payment"("target_payment_id" "uuid", "actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."snapshot_payment"("target_payment_id" "uuid", "actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."snapshot_profile"("target_profile_id" "uuid", "actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."snapshot_profile"("target_profile_id" "uuid", "actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."snapshot_profile"("target_profile_id" "uuid", "actor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."soft_delete_card"("target_card_id" "uuid", "actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_card"("target_card_id" "uuid", "actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_card"("target_card_id" "uuid", "actor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."soft_delete_order"("target_order_id" "uuid", "actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_order"("target_order_id" "uuid", "actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_order"("target_order_id" "uuid", "actor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."soft_delete_payment"("target_payment_id" "uuid", "actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_payment"("target_payment_id" "uuid", "actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_payment"("target_payment_id" "uuid", "actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."soft_delete_profile"("target_profile_id" "uuid", "actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."soft_delete_profile"("target_profile_id" "uuid", "actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_profile"("target_profile_id" "uuid", "actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."spin_wheel"("p_wheel_id" "uuid", "p_visitor_id" "text", "p_client_ip" "text", "p_user_agent" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."spin_wheel"("p_wheel_id" "uuid", "p_visitor_id" "text", "p_client_ip" "text", "p_user_agent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."spin_wheel"("p_wheel_id" "uuid", "p_visitor_id" "text", "p_client_ip" "text", "p_user_agent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."spin_wheel"("p_wheel_id" "uuid", "p_visitor_id" "text", "p_client_ip" "text", "p_user_agent" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_order_activation_from_card"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_order_activation_from_card"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_order_activation_from_card"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_order_activation_from_claim"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_order_activation_from_claim"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_order_activation_from_claim"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_wheel_coupon"("p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_wheel_coupon"("p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_wheel_coupon"("p_code" "text") TO "service_role";



GRANT ALL ON TABLE "auth"."audit_log_entries" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."audit_log_entries" TO "postgres";
GRANT SELECT ON TABLE "auth"."audit_log_entries" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "auth"."custom_oauth_providers" TO "postgres";
GRANT ALL ON TABLE "auth"."custom_oauth_providers" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."flow_state" TO "postgres";
GRANT SELECT ON TABLE "auth"."flow_state" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."flow_state" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."identities" TO "postgres";
GRANT SELECT ON TABLE "auth"."identities" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."identities" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."instances" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."instances" TO "postgres";
GRANT SELECT ON TABLE "auth"."instances" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_amr_claims" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_amr_claims" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_amr_claims" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_challenges" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_challenges" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_challenges" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_factors" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_factors" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_factors" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_client_states" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_client_states" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_clients" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_clients" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_consents" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_consents" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."one_time_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."one_time_tokens" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."one_time_tokens" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."refresh_tokens" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."refresh_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."refresh_tokens" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "dashboard_user";
GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "postgres";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_providers" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_relay_states" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_relay_states" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_relay_states" TO "dashboard_user";



GRANT SELECT ON TABLE "auth"."schema_migrations" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sessions" TO "postgres";
GRANT SELECT ON TABLE "auth"."sessions" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sessions" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_domains" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_domains" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_domains" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_providers" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."users" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."users" TO "postgres";
GRANT SELECT ON TABLE "auth"."users" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "auth"."webauthn_challenges" TO "postgres";
GRANT ALL ON TABLE "auth"."webauthn_challenges" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."webauthn_credentials" TO "postgres";
GRANT ALL ON TABLE "auth"."webauthn_credentials" TO "dashboard_user";



GRANT ALL ON TABLE "public"."abandoned_carts" TO "anon";
GRANT ALL ON TABLE "public"."abandoned_carts" TO "authenticated";
GRANT ALL ON TABLE "public"."abandoned_carts" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."card_events" TO "anon";
GRANT ALL ON TABLE "public"."card_events" TO "authenticated";
GRANT ALL ON TABLE "public"."card_events" TO "service_role";



GRANT ALL ON TABLE "public"."card_scans" TO "anon";
GRANT ALL ON TABLE "public"."card_scans" TO "authenticated";
GRANT ALL ON TABLE "public"."card_scans" TO "service_role";



GRANT ALL ON TABLE "public"."cards" TO "anon";
GRANT ALL ON TABLE "public"."cards" TO "authenticated";
GRANT ALL ON TABLE "public"."cards" TO "service_role";



GRANT ALL ON TABLE "public"."content_blocks" TO "anon";
GRANT ALL ON TABLE "public"."content_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."content_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."crm_activities" TO "anon";
GRANT ALL ON TABLE "public"."crm_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_activities" TO "service_role";



GRANT ALL ON TABLE "public"."crm_contacts" TO "anon";
GRANT ALL ON TABLE "public"."crm_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."crm_deals" TO "anon";
GRANT ALL ON TABLE "public"."crm_deals" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_deals" TO "service_role";



GRANT ALL ON TABLE "public"."dispatch_config" TO "anon";
GRANT ALL ON TABLE "public"."dispatch_config" TO "authenticated";
GRANT ALL ON TABLE "public"."dispatch_config" TO "service_role";



GRANT ALL ON TABLE "public"."email_log" TO "anon";
GRANT ALL ON TABLE "public"."email_log" TO "authenticated";
GRANT ALL ON TABLE "public"."email_log" TO "service_role";



GRANT ALL ON TABLE "public"."email_unsubscribe" TO "anon";
GRANT ALL ON TABLE "public"."email_unsubscribe" TO "authenticated";
GRANT ALL ON TABLE "public"."email_unsubscribe" TO "service_role";



GRANT ALL ON TABLE "public"."event_log" TO "anon";
GRANT ALL ON TABLE "public"."event_log" TO "authenticated";
GRANT ALL ON TABLE "public"."event_log" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_items" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_movements" TO "anon";
GRANT ALL ON TABLE "public"."inventory_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_movements" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_alert_evaluations" TO "anon";
GRANT ALL ON TABLE "public"."kpi_alert_evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_alert_evaluations" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_alert_history" TO "anon";
GRANT ALL ON TABLE "public"."kpi_alert_history" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_alert_history" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_alert_state" TO "anon";
GRANT ALL ON TABLE "public"."kpi_alert_state" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_alert_state" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."kpi_cohorts" TO "anon";
GRANT ALL ON TABLE "public"."kpi_cohorts" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_cohorts" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist" TO "anon";
GRANT ALL ON TABLE "public"."waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."kpi_funnel" TO "anon";
GRANT ALL ON TABLE "public"."kpi_funnel" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_funnel" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."kpi_monthly_revenue" TO "anon";
GRANT ALL ON TABLE "public"."kpi_monthly_revenue" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_monthly_revenue" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_runtime_config" TO "anon";
GRANT ALL ON TABLE "public"."kpi_runtime_config" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_runtime_config" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."kpi_top_products" TO "anon";
GRANT ALL ON TABLE "public"."kpi_top_products" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_top_products" TO "service_role";



GRANT ALL ON TABLE "public"."memberships" TO "anon";
GRANT ALL ON TABLE "public"."memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."memberships" TO "service_role";



GRANT ALL ON TABLE "public"."order_cards" TO "anon";
GRANT ALL ON TABLE "public"."order_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."order_cards" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_folio_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_folio_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_folio_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_operational_events" TO "anon";
GRANT ALL ON TABLE "public"."order_operational_events" TO "authenticated";
GRANT ALL ON TABLE "public"."order_operational_events" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."order_payment_reconciliation_queue" TO "anon";
GRANT ALL ON TABLE "public"."order_payment_reconciliation_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."order_payment_reconciliation_queue" TO "service_role";



GRANT ALL ON TABLE "public"."order_status_history" TO "anon";
GRANT ALL ON TABLE "public"."order_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."order_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."profile_claims" TO "anon";
GRANT ALL ON TABLE "public"."profile_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_claims" TO "service_role";



GRANT ALL ON TABLE "public"."prelaunch_order_integrity_audit" TO "anon";
GRANT ALL ON TABLE "public"."prelaunch_order_integrity_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."prelaunch_order_integrity_audit" TO "service_role";



GRANT ALL ON TABLE "public"."product_bundle_items" TO "anon";
GRANT ALL ON TABLE "public"."product_bundle_items" TO "authenticated";
GRANT ALL ON TABLE "public"."product_bundle_items" TO "service_role";



GRANT ALL ON TABLE "public"."product_bundles" TO "anon";
GRANT ALL ON TABLE "public"."product_bundles" TO "authenticated";
GRANT ALL ON TABLE "public"."product_bundles" TO "service_role";



GRANT ALL ON TABLE "public"."product_inventory_requirements" TO "anon";
GRANT ALL ON TABLE "public"."product_inventory_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."product_inventory_requirements" TO "service_role";



GRANT ALL ON TABLE "public"."products_with_margin" TO "anon";
GRANT ALL ON TABLE "public"."products_with_margin" TO "authenticated";
GRANT ALL ON TABLE "public"."products_with_margin" TO "service_role";



GRANT ALL ON TABLE "public"."profile_slug_reservations" TO "anon";
GRANT ALL ON TABLE "public"."profile_slug_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_slug_reservations" TO "service_role";



GRANT ALL ON TABLE "public"."profile_versions" TO "anon";
GRANT ALL ON TABLE "public"."profile_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_versions" TO "service_role";



GRANT ALL ON TABLE "public"."refunds" TO "anon";
GRANT ALL ON TABLE "public"."refunds" TO "authenticated";
GRANT ALL ON TABLE "public"."refunds" TO "service_role";



GRANT ALL ON TABLE "public"."review_cards" TO "anon";
GRANT ALL ON TABLE "public"."review_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."review_cards" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."v_current_memberships" TO "anon";
GRANT ALL ON TABLE "public"."v_current_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."v_current_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."wheel_config" TO "anon";
GRANT ALL ON TABLE "public"."wheel_config" TO "authenticated";
GRANT ALL ON TABLE "public"."wheel_config" TO "service_role";



GRANT ALL ON TABLE "public"."wheel_prizes" TO "anon";
GRANT ALL ON TABLE "public"."wheel_prizes" TO "authenticated";
GRANT ALL ON TABLE "public"."wheel_prizes" TO "service_role";



GRANT ALL ON TABLE "public"."wheel_prizes_public" TO "anon";
GRANT ALL ON TABLE "public"."wheel_prizes_public" TO "authenticated";
GRANT ALL ON TABLE "public"."wheel_prizes_public" TO "service_role";



GRANT ALL ON TABLE "public"."wheel_spins" TO "anon";
GRANT ALL ON TABLE "public"."wheel_spins" TO "authenticated";
GRANT ALL ON TABLE "public"."wheel_spins" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "dashboard_user";












ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







