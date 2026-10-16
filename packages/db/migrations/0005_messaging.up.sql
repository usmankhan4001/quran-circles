-- 0005_messaging
-- Messaging: updates feed, read state, message templates, outbox.

CREATE TABLE "updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_type" text NOT NULL,
	"city_id" uuid,
	"venue_id" uuid,
	"author_id" uuid,
	"kind" text NOT NULL,
	"title_en" text NOT NULL,
	"title_ur" text,
	"body_en" text NOT NULL,
	"body_ur" text,
	"session_id" uuid,
	"publish_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "updates_scope_type_chk" CHECK ("scope_type" IN ('national', 'city', 'venue')),
	CONSTRAINT "updates_kind_chk" CHECK ("kind" IN ('announcement', 'time_change', 'cancellation', 'special_lecture')),
	CONSTRAINT "updates_scope_shape_chk" CHECK ((scope_type = 'national' AND city_id IS NULL AND venue_id IS NULL) OR (scope_type = 'city' AND city_id IS NOT NULL AND venue_id IS NULL) OR (scope_type = 'venue' AND venue_id IS NOT NULL)),
	CONSTRAINT "updates_expiry_chk" CHECK ("expires_at" IS NULL OR "expires_at" > "publish_at")
);

CREATE TABLE "update_reads" (
	"user_id" uuid NOT NULL,
	"update_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "update_reads_pkey" PRIMARY KEY("user_id","update_id")
);

CREATE TABLE "message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"channel" text NOT NULL,
	"locale" text NOT NULL,
	"body" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"wa_template_name" text,
	"cost_category" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_templates_key_locale_unique" UNIQUE("key","locale"),
	CONSTRAINT "message_templates_channel_chk" CHECK ("channel" IN ('push', 'whatsapp', 'sms')),
	CONSTRAINT "message_templates_locale_chk" CHECK ("locale" IN ('en', 'ur')),
	CONSTRAINT "message_templates_cost_category_chk" CHECK ("cost_category" IN ('free', 'authentication', 'utility', 'marketing', 'service')),
	CONSTRAINT "message_templates_status_chk" CHECK ("status" IN ('draft', 'approved', 'retired'))
);

CREATE TABLE "message_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"channel" text NOT NULL,
	"template_key" text,
	"locale" text,
	"recipient_user_id" uuid,
	"recipient_phone_e164" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error_code" text,
	"cost_category" text NOT NULL,
	"city_id" uuid,
	"sent_by" uuid,
	"update_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	CONSTRAINT "message_outbox_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "message_outbox_channel_chk" CHECK ("channel" IN ('push', 'whatsapp', 'sms')),
	CONSTRAINT "message_outbox_locale_chk" CHECK ("locale" IN ('en', 'ur')),
	CONSTRAINT "message_outbox_status_chk" CHECK ("status" IN ('queued', 'sending', 'sent', 'delivered', 'failed', 'dead')),
	CONSTRAINT "message_outbox_cost_category_chk" CHECK ("cost_category" IN ('free', 'authentication', 'utility', 'marketing', 'service')),
	CONSTRAINT "message_outbox_recipient_phone_e164_chk" CHECK ("recipient_phone_e164" ~ '^\+[1-9][0-9]{7,14}$'),
	CONSTRAINT "message_outbox_attempts_chk" CHECK ("attempts" >= 0)
);

ALTER TABLE "updates" ADD CONSTRAINT "updates_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "updates" ADD CONSTRAINT "updates_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "updates" ADD CONSTRAINT "updates_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "updates" ADD CONSTRAINT "updates_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "update_reads" ADD CONSTRAINT "update_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "update_reads" ADD CONSTRAINT "update_reads_update_id_updates_id_fk" FOREIGN KEY ("update_id") REFERENCES "public"."updates"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "message_outbox" ADD CONSTRAINT "message_outbox_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "message_outbox" ADD CONSTRAINT "message_outbox_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "message_outbox" ADD CONSTRAINT "message_outbox_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "message_outbox" ADD CONSTRAINT "message_outbox_update_id_updates_id_fk" FOREIGN KEY ("update_id") REFERENCES "public"."updates"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "updates_scope_publish_idx" ON "updates" USING btree ("scope_type","city_id","venue_id","publish_at" desc);

CREATE INDEX "message_outbox_status_next_idx" ON "message_outbox" USING btree ("status","next_attempt_at");

CREATE INDEX "message_outbox_recipient_created_idx" ON "message_outbox" USING btree ("recipient_user_id","created_at");

CREATE INDEX "message_outbox_city_created_idx" ON "message_outbox" USING btree ("city_id","created_at");
