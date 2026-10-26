CREATE TABLE "app_user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "app_user_role_check" CHECK ("app_user"."role" in ('admin', 'inspector'))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"company_id" varchar(20),
	"address" text,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"note" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_type" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"field_definitions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_interval_months" integer DEFAULT 12 NOT NULL,
	"protocol_template" text DEFAULT '' NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "equipment_type_interval_check" CHECK ("equipment_type"."default_interval_months" between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "inspection" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"lead_inspector_id" uuid NOT NULL,
	"inspection_date" date NOT NULL,
	"next_inspection_date" date,
	"status" text DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" uuid,
	"reopened_count" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "inspection_status_check" CHECK ("inspection"."status" in ('open', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "inspection_inspector" (
	"inspection_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "inspection_inspector_inspection_id_user_id_pk" PRIMARY KEY("inspection_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "inspection_result" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"inspection_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"outcome" text NOT NULL,
	"defect_description" text,
	"taken_out_of_service" boolean DEFAULT false NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "inspection_result_outcome_check" CHECK ("inspection_result"."outcome" in ('ok', 'defect')),
	CONSTRAINT "inspection_result_out_of_service_check" CHECK ("inspection_result"."outcome" = 'defect' or not "inspection_result"."taken_out_of_service")
);
--> statement-breakpoint
CREATE TABLE "inspection_type_scope" (
	"inspection_id" uuid NOT NULL,
	"equipment_type_id" uuid NOT NULL,
	CONSTRAINT "inspection_type_scope_inspection_id_equipment_type_id_pk" PRIMARY KEY("inspection_id","equipment_type_id")
);
--> statement-breakpoint
CREATE TABLE "item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"location_id" uuid,
	"equipment_type_id" uuid NOT NULL,
	"item_number" varchar(5) NOT NULL,
	"qr_code" text,
	"field_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'in_service' NOT NULL,
	"next_inspection_date" date,
	"retired_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "item_number_check" CHECK ("item"."item_number" ~ '^[0-9]{5}$'),
	CONSTRAINT "item_status_check" CHECK ("item"."status" in ('in_service', 'out_of_service'))
);
--> statement-breakpoint
CREATE TABLE "item_number_lease" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"device_label" text,
	"range_from" integer NOT NULL,
	"range_to" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_number_lease_range_check" CHECK ("item_number_lease"."range_from" <= "item_number_lease"."range_to")
);
--> statement-breakpoint
CREATE TABLE "location" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"path_ids" uuid[] NOT NULL,
	"sort_path" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"item_id" uuid,
	"inspection_result_id" uuid,
	"storage_key" text NOT NULL,
	"thumbnail_key" text,
	"mime_type" text NOT NULL,
	"width" integer,
	"height" integer,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"taken_at" timestamp with time zone,
	"caption" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_owner_check" CHECK (num_nonnulls("photo"."item_id", "photo"."inspection_result_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"device_label" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"note" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_app_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_type" ADD CONSTRAINT "equipment_type_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_lead_inspector_id_app_user_id_fk" FOREIGN KEY ("lead_inspector_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_closed_by_app_user_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_inspector" ADD CONSTRAINT "inspection_inspector_inspection_id_inspection_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_inspector" ADD CONSTRAINT "inspection_inspector_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_result" ADD CONSTRAINT "inspection_result_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_result" ADD CONSTRAINT "inspection_result_inspection_id_inspection_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_result" ADD CONSTRAINT "inspection_result_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_result" ADD CONSTRAINT "inspection_result_recorded_by_app_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_type_scope" ADD CONSTRAINT "inspection_type_scope_inspection_id_inspection_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_type_scope" ADD CONSTRAINT "inspection_type_scope_equipment_type_id_equipment_type_id_fk" FOREIGN KEY ("equipment_type_id") REFERENCES "public"."equipment_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_equipment_type_id_equipment_type_id_fk" FOREIGN KEY ("equipment_type_id") REFERENCES "public"."equipment_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_number_lease" ADD CONSTRAINT "item_number_lease_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_number_lease" ADD CONSTRAINT "item_number_lease_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_number_lease" ADD CONSTRAINT "item_number_lease_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_parent_id_location_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_inspection_result_id_inspection_result_id_fk" FOREIGN KEY ("inspection_result_id") REFERENCES "public"."inspection_result"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site" ADD CONSTRAINT "site_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site" ADD CONSTRAINT "site_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_org_created_idx" ON "audit_log" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "customer_org_name_idx" ON "customer" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_type_org_name_key" ON "equipment_type" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "inspection_site_date_idx" ON "inspection" USING btree ("site_id","inspection_date");--> statement-breakpoint
CREATE UNIQUE INDEX "inspection_result_inspection_item_key" ON "inspection_result" USING btree ("inspection_id","item_id");--> statement-breakpoint
CREATE INDEX "inspection_result_item_idx" ON "inspection_result" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "item_customer_number_key" ON "item" USING btree ("customer_id","item_number");--> statement-breakpoint
CREATE UNIQUE INDEX "item_org_qr_key" ON "item" USING btree ("organization_id","qr_code");--> statement-breakpoint
CREATE INDEX "item_site_idx" ON "item" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "item_location_idx" ON "item" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "item_next_inspection_idx" ON "item" USING btree ("organization_id","next_inspection_date");--> statement-breakpoint
CREATE INDEX "item_field_values_idx" ON "item" USING gin ("field_values");--> statement-breakpoint
CREATE INDEX "item_number_lease_customer_idx" ON "item_number_lease" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "location_site_sort_idx" ON "location" USING btree ("site_id","sort_path");--> statement-breakpoint
CREATE INDEX "location_path_ids_idx" ON "location" USING gin ("path_ids");--> statement-breakpoint
CREATE INDEX "photo_item_idx" ON "photo" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "photo_result_idx" ON "photo" USING btree ("inspection_result_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_hash_key" ON "session" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "site_customer_idx" ON "site" USING btree ("customer_id");