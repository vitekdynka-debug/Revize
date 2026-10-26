ALTER TABLE "photo" DROP CONSTRAINT "photo_owner_check";--> statement-breakpoint
ALTER TABLE "photo" ADD COLUMN "inspection_id" uuid;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_inspection_id_inspection_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photo_inspection_idx" ON "photo" USING btree ("inspection_id");--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_owner_check" CHECK (num_nonnulls("photo"."item_id", "photo"."inspection_result_id", "photo"."inspection_id") = 1);