CREATE TABLE "import_job" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"file_name" text NOT NULL,
	"sheet_name" text,
	"header_row" integer NOT NULL,
	"headers" jsonb NOT NULL,
	"rows" jsonb NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"mapping" jsonb,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"committed_at" timestamp with time zone,
	CONSTRAINT "import_job_status_check" CHECK ("import_job"."status" in ('uploaded', 'committed'))
);
--> statement-breakpoint
CREATE TABLE "import_mapping" (
	"organization_id" uuid NOT NULL,
	"equipment_type_id" uuid NOT NULL,
	"headers" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_mapping_organization_id_equipment_type_id_pk" PRIMARY KEY("organization_id","equipment_type_id")
);
--> statement-breakpoint
ALTER TABLE "import_job" ADD CONSTRAINT "import_job_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_job" ADD CONSTRAINT "import_job_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_mapping" ADD CONSTRAINT "import_mapping_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_mapping" ADD CONSTRAINT "import_mapping_equipment_type_id_equipment_type_id_fk" FOREIGN KEY ("equipment_type_id") REFERENCES "public"."equipment_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_job_org_created_idx" ON "import_job" USING btree ("organization_id","created_at");