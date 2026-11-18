ALTER TABLE "equipment_type" ADD COLUMN "checklist" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "inspection_result" ADD COLUMN "checks" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
-- Racks (types with risk levels) get the check points of the library rack type.
UPDATE "equipment_type"
SET "checklist" = '[{"key":"floor_anchoring","label":"Kotvení do podlahy","defectText":"Chybí nebo je poškozené kotvení do podlahy","severity":"amber"},{"key":"load_sign","label":"Štítek s nosností","defectText":"Chybí štítek s nosností","severity":"amber"}]'::jsonb,
  "version" = "version" + 1,
  "updated_at" = now()
WHERE "risk_levels" = true AND "checklist" = '[]'::jsonb;
