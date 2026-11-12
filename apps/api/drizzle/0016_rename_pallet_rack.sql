-- Racks are one type (ADR-0018); the kind ("Paletový") is a field and lists show
-- "Paletový regál" from it. The type merged from pallet racks is renamed to "Regál".
-- An archived type of that name (merged away) gives the name up first.
UPDATE "equipment_type" AS a
SET "name" = a."name" || ' (archiv)', "version" = a."version" + 1, "updated_at" = now()
WHERE a."name" = 'Regál'
  AND a."archived_at" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "equipment_type" AS p
    WHERE p."organization_id" = a."organization_id" AND p."name" = 'Paletový regál'
      AND p."archived_at" IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM "equipment_type" AS o
    WHERE o."organization_id" = a."organization_id" AND o."name" = 'Regál (archiv)'
  );
--> statement-breakpoint
UPDATE "equipment_type" AS t
SET "name" = 'Regál', "version" = t."version" + 1, "updated_at" = now()
WHERE t."name" = 'Paletový regál'
  AND t."archived_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "equipment_type" AS o
    WHERE o."organization_id" = t."organization_id" AND o."name" = 'Regál'
  );
