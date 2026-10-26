ALTER TABLE "item" DROP CONSTRAINT "item_number_check";--> statement-breakpoint
ALTER TABLE "item" ALTER COLUMN "item_number" SET DATA TYPE varchar(8);--> statement-breakpoint
-- Leading zeros carry no meaning (ADR-0012): store existing numbers in canonical form.
UPDATE "item" SET "item_number" = ltrim("item_number", '0') WHERE "item_number" ~ '^0+[1-9]';--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_number_check" CHECK ("item"."item_number" ~ '^[1-9][0-9]{0,7}$');