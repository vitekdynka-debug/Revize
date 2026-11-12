-- Racks are one type (ADR-0018); the kind ("Paletový") is a field and lists show
-- "Paletový regál" from it. The type merged from pallet racks is renamed to "Regál",
-- unless the organization already has a type of that name.
UPDATE "equipment_type" AS t
SET "name" = 'Regál', "version" = t."version" + 1, "updated_at" = now()
WHERE t."name" = 'Paletový regál'
  AND NOT EXISTS (
    SELECT 1 FROM "equipment_type" AS o
    WHERE o."organization_id" = t."organization_id" AND o."name" = 'Regál'
  );
