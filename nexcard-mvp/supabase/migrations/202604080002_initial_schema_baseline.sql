-- Baseline for NexCard initial public schema tables that existed in
-- production before the migration history was backfilled. Required so a
-- clean `supabase start` can replay migrations from 202604090001 onward.
--
-- Source of truth copied from production schema dump:
-- docs/schema-snapshots/202608141357_prod_schema_dump.sql
-- sha256: 9a4df6620720f487ffbf553bd57fc4f180614a83bd36d730a185c6210a3bdd38
--
-- Design notes:
-- - Idempotent/no-op on production where these tables already exist.
-- - No RLS policies are created here; historical migrations own them.
-- - Constraints are guarded so replays/prod applications do not collide.
-- - card_events/card_scans are included because their RLS migrations
--   (202604090003/202604090004) run before their later CREATE TABLE migration
--   (202604090005), so clean replay otherwise fails before reaching it.
-- - waitlist, order_status_history, and order_cards are included because later
--   migrations reference them before any local CREATE TABLE migration exists.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Shared trigger helper required by later historical migrations.
CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- public.organizations

CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_pkey'
      AND conrelid = 'public.organizations'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_slug_key'
      AND conrelid = 'public.organizations'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");
  END IF;
END $$;

ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


-- public.products

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


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_pkey'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_sku_key'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_sku_key" UNIQUE ("sku");
  END IF;
END $$;



CREATE INDEX IF NOT EXISTS "idx_products_status" ON "public"."products" USING "btree" ("status");


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


-- public.content_blocks

CREATE TABLE IF NOT EXISTS "public"."content_blocks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "block_key" "text" NOT NULL,
    "content" "jsonb" NOT NULL,
    "locale" "text" DEFAULT 'es-CL'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'content_blocks_block_key_locale_key'
      AND conrelid = 'public.content_blocks'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."content_blocks"
    ADD CONSTRAINT "content_blocks_block_key_locale_key" UNIQUE ("block_key", "locale");
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'content_blocks_pkey'
      AND conrelid = 'public.content_blocks'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."content_blocks"
    ADD CONSTRAINT "content_blocks_pkey" PRIMARY KEY ("id");
  END IF;
END $$;

ALTER TABLE "public"."content_blocks" ENABLE ROW LEVEL SECURITY;


-- public.events

CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "profile_slug" "text",
    "event_type" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_event_type_valid" CHECK (("event_type" = ANY (ARRAY['view'::"text", 'whatsapp'::"text", 'vcard'::"text", 'instagram'::"text", 'linkedin'::"text", 'website'::"text", 'calendar'::"text", 'share'::"text", 'client_crash'::"text"]))),
    CONSTRAINT "chk_profile_slug_length" CHECK (("char_length"("profile_slug") <= 80))
);


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_pkey'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");
  END IF;
END $$;



CREATE INDEX IF NOT EXISTS "idx_events_created_at" ON "public"."events" USING "btree" ("created_at" DESC);


CREATE INDEX IF NOT EXISTS "idx_events_profile_slug" ON "public"."events" USING "btree" ("profile_slug");


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


-- public.waitlist

CREATE TABLE IF NOT EXISTS "public"."waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'waitlist_email_key'
      AND conrelid = 'public.waitlist'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_email_key" UNIQUE ("email");
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'waitlist_pkey'
      AND conrelid = 'public.waitlist'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id");
  END IF;
END $$;

ALTER TABLE "public"."waitlist" ENABLE ROW LEVEL SECURITY;


-- public.inventory_items

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


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventory_items_pkey'
      AND conrelid = 'public.inventory_items'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventory_items_sku_unique'
      AND conrelid = 'public.inventory_items'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_sku_unique" UNIQUE ("sku");
  END IF;
END $$;



CREATE INDEX IF NOT EXISTS "idx_inventory_category" ON "public"."inventory_items" USING "btree" ("category");


CREATE INDEX IF NOT EXISTS "idx_inventory_items_sku" ON "public"."inventory_items" USING "btree" ("sku");


ALTER TABLE "public"."inventory_items" ENABLE ROW LEVEL SECURITY;


-- public.profiles

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


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_pkey'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_slug_key'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_slug_key" UNIQUE ("slug");
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_organization_id_fkey'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_user_id_fkey'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
  END IF;
END $$;



CREATE INDEX IF NOT EXISTS "idx_profiles_org_id" ON "public"."profiles" USING "btree" ("organization_id");


CREATE INDEX IF NOT EXISTS "idx_profiles_user_id" ON "public"."profiles" USING "btree" ("user_id");


CREATE UNIQUE INDEX IF NOT EXISTS "profiles_active_slug_unique_idx" ON "public"."profiles" USING "btree" ("slug") WHERE (("deleted_at" IS NULL) AND ("slug" IS NOT NULL));


CREATE INDEX IF NOT EXISTS "profiles_card_type_idx" ON "public"."profiles" USING "btree" ("card_type");


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


-- public.orders

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


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_folio_key'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_folio_key" UNIQUE ("folio");
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_pkey'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_organization_id_fkey'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_qa_override_by_fkey'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_qa_override_by_fkey" FOREIGN KEY ("qa_override_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_qa_reviewed_by_fkey'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_qa_reviewed_by_fkey" FOREIGN KEY ("qa_reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_user_id_fkey'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
  END IF;
END $$;



CREATE INDEX IF NOT EXISTS "idx_orders_is_test" ON "public"."orders" USING "btree" ("is_test");


CREATE INDEX IF NOT EXISTS "idx_orders_org_id" ON "public"."orders" USING "btree" ("organization_id");


CREATE INDEX IF NOT EXISTS "idx_orders_user_id" ON "public"."orders" USING "btree" ("user_id");


CREATE UNIQUE INDEX IF NOT EXISTS "orders_client_checkout_attempt_id_key" ON "public"."orders" USING "btree" ("client_checkout_attempt_id") WHERE ("client_checkout_attempt_id" IS NOT NULL);


CREATE UNIQUE INDEX IF NOT EXISTS "orders_delivery_token_idx" ON "public"."orders" USING "btree" ("delivery_token") WHERE ("delivery_token" IS NOT NULL);


CREATE INDEX IF NOT EXISTS "orders_inventory_reserved_idx" ON "public"."orders" USING "btree" ("inventory_reserved") WHERE (("inventory_reserved" = true) AND ("inventory_decremented" = false));


CREATE UNIQUE INDEX IF NOT EXISTS "orders_mp_preference_id_key" ON "public"."orders" USING "btree" ("mp_preference_id") WHERE ("mp_preference_id" IS NOT NULL);


CREATE INDEX IF NOT EXISTS "orders_qa_override_at_idx" ON "public"."orders" USING "btree" ("qa_override_at");


CREATE INDEX IF NOT EXISTS "orders_qa_reviewed_at_idx" ON "public"."orders" USING "btree" ("qa_reviewed_at");


CREATE INDEX IF NOT EXISTS "orders_tracking_code_idx" ON "public"."orders" USING "btree" ("tracking_code") WHERE ("tracking_code" IS NOT NULL);


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


-- public.order_status_history

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


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_status_history_pkey'
      AND conrelid = 'public.order_status_history'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id");
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_status_history_actor_user_id_fkey'
      AND conrelid = 'public.order_status_history'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_status_history_order_id_fkey'
      AND conrelid = 'public.order_status_history'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");
  END IF;
END $$;



CREATE INDEX IF NOT EXISTS "order_status_history_actor_user_idx" ON "public"."order_status_history" USING "btree" ("actor_user_id");


ALTER TABLE "public"."order_status_history" ENABLE ROW LEVEL SECURITY;


-- public.cards

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


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cards_card_code_key'
      AND conrelid = 'public.cards'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_card_code_key" UNIQUE ("card_code");
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cards_pkey'
      AND conrelid = 'public.cards'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_pkey" PRIMARY KEY ("id");
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cards_order_id_fkey'
      AND conrelid = 'public.cards'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cards_organization_id_fkey'
      AND conrelid = 'public.cards'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cards_profile_id_fkey'
      AND conrelid = 'public.cards'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cards_replaced_by_fk'
      AND conrelid = 'public.cards'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_replaced_by_fk" FOREIGN KEY ("replaced_by_card_id") REFERENCES "public"."cards"("id") ON DELETE SET NULL;
  END IF;
END $$;



CREATE INDEX IF NOT EXISTS "cards_order_id_deleted_idx" ON "public"."cards" USING "btree" ("order_id") WHERE ("deleted_at" IS NULL);


CREATE INDEX IF NOT EXISTS "cards_order_id_idx" ON "public"."cards" USING "btree" ("order_id");


CREATE INDEX IF NOT EXISTS "cards_org_id_idx" ON "public"."cards" USING "btree" ("organization_id");


CREATE INDEX IF NOT EXISTS "cards_profile_id_idx" ON "public"."cards" USING "btree" ("profile_id");


CREATE UNIQUE INDEX IF NOT EXISTS "cards_public_token_key" ON "public"."cards" USING "btree" ("public_token");


CREATE INDEX IF NOT EXISTS "cards_status_idx" ON "public"."cards" USING "btree" ("status");


CREATE INDEX IF NOT EXISTS "idx_cards_org_id" ON "public"."cards" USING "btree" ("organization_id");


CREATE INDEX IF NOT EXISTS "idx_cards_profile_id" ON "public"."cards" USING "btree" ("profile_id");


ALTER TABLE "public"."cards" ENABLE ROW LEVEL SECURITY;


-- public.order_cards

CREATE TABLE IF NOT EXISTS "public"."order_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "card_id" "uuid" NOT NULL,
    "linked_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_cards_pkey'
      AND conrelid = 'public.order_cards'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."order_cards"
    ADD CONSTRAINT "order_cards_pkey" PRIMARY KEY ("id");
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_cards_card_id_fkey'
      AND conrelid = 'public.order_cards'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."order_cards"
    ADD CONSTRAINT "order_cards_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE CASCADE;
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_cards_order_id_fkey'
      AND conrelid = 'public.order_cards'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."order_cards"
    ADD CONSTRAINT "order_cards_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;
  END IF;
END $$;



CREATE INDEX IF NOT EXISTS "idx_order_cards_card_id" ON "public"."order_cards" USING "btree" ("card_id");


CREATE INDEX IF NOT EXISTS "idx_order_cards_order_id" ON "public"."order_cards" USING "btree" ("order_id");


CREATE UNIQUE INDEX IF NOT EXISTS "ux_order_cards_card_id" ON "public"."order_cards" USING "btree" ("card_id");


CREATE UNIQUE INDEX IF NOT EXISTS "ux_order_cards_order_card" ON "public"."order_cards" USING "btree" ("order_id", "card_id");


ALTER TABLE "public"."order_cards" ENABLE ROW LEVEL SECURITY;


-- public.card_events

CREATE TABLE IF NOT EXISTS "public"."card_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "card_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "actor_user_id" "uuid",
    "context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'card_events_pkey'
      AND conrelid = 'public.card_events'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."card_events"
    ADD CONSTRAINT "card_events_pkey" PRIMARY KEY ("id");
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'card_events_actor_user_id_fkey'
      AND conrelid = 'public.card_events'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."card_events"
    ADD CONSTRAINT "card_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'card_events_card_id_fkey'
      AND conrelid = 'public.card_events'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."card_events"
    ADD CONSTRAINT "card_events_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE CASCADE;
  END IF;
END $$;



CREATE INDEX IF NOT EXISTS "card_events_card_id_idx" ON "public"."card_events" USING "btree" ("card_id");


CREATE INDEX IF NOT EXISTS "card_events_created_at_idx" ON "public"."card_events" USING "btree" ("created_at" DESC);


CREATE INDEX IF NOT EXISTS "card_events_event_type_idx" ON "public"."card_events" USING "btree" ("event_type");


ALTER TABLE "public"."card_events" ENABLE ROW LEVEL SECURITY;


-- public.card_scans

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


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'card_scans_pkey'
      AND conrelid = 'public.card_scans'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."card_scans"
    ADD CONSTRAINT "card_scans_pkey" PRIMARY KEY ("id");
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'card_scans_card_id_fkey'
      AND conrelid = 'public.card_scans'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."card_scans"
    ADD CONSTRAINT "card_scans_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE CASCADE;
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'card_scans_organization_id_fkey'
      AND conrelid = 'public.card_scans'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."card_scans"
    ADD CONSTRAINT "card_scans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'card_scans_profile_id_fkey'
      AND conrelid = 'public.card_scans'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."card_scans"
    ADD CONSTRAINT "card_scans_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
  END IF;
END $$;



CREATE INDEX IF NOT EXISTS "card_scans_card_id_idx" ON "public"."card_scans" USING "btree" ("card_id");


CREATE INDEX IF NOT EXISTS "card_scans_created_at_idx" ON "public"."card_scans" USING "btree" ("created_at" DESC);


CREATE INDEX IF NOT EXISTS "card_scans_org_id_idx" ON "public"."card_scans" USING "btree" ("organization_id");


CREATE INDEX IF NOT EXISTS "card_scans_profile_slug_idx" ON "public"."card_scans" USING "btree" ("profile_slug");


CREATE INDEX IF NOT EXISTS "card_scans_scanned_at_idx" ON "public"."card_scans" USING "btree" ("scanned_at" DESC);


ALTER TABLE "public"."card_scans" ENABLE ROW LEVEL SECURITY;


-- public.order_items

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


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_pkey'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_order_id_fkey'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;
  END IF;
END $$;



CREATE INDEX IF NOT EXISTS "idx_order_items_order_id" ON "public"."order_items" USING "btree" ("order_id");


CREATE INDEX IF NOT EXISTS "idx_order_items_product_id" ON "public"."order_items" USING "btree" ("product_id");


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


-- public.payments

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


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_pkey'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_order_id_fkey'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;
  END IF;
END $$;



CREATE UNIQUE INDEX IF NOT EXISTS "payments_provider_external_id_active_unique" ON "public"."payments" USING "btree" ("provider", "external_id") WHERE (("deleted_at" IS NULL) AND ("external_id" IS NOT NULL));


CREATE UNIQUE INDEX IF NOT EXISTS "payments_provider_external_id_key" ON "public"."payments" USING "btree" ("provider", "external_id") WHERE (("external_id" IS NOT NULL) AND ("deleted_at" IS NULL));


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


-- public.inventory_movements

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


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventory_movements_pkey'
      AND conrelid = 'public.inventory_movements'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id");
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventory_movements_inventory_item_id_fkey'
      AND conrelid = 'public.inventory_movements'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE CASCADE;
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventory_movements_order_id_fkey'
      AND conrelid = 'public.inventory_movements'::regclass
  ) THEN
    ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE "public"."inventory_movements" ENABLE ROW LEVEL SECURITY;


COMMIT;
