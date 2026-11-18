ALTER TABLE "inspection_result" ADD COLUMN "checked_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Results recorded so far: the first recording known from the audit (the result and every later
-- version of it carry "recordedAt"), otherwise the time of the current recording.
UPDATE "inspection_result" AS r
SET "checked_at" = LEAST(
  r."recorded_at",
  COALESCE(
    (
      SELECT min((a."after"->>'recordedAt')::timestamptz)
      FROM "audit_log" AS a
      WHERE a."entity_type" = 'inspection_result'
        AND a."entity_id" = r."id"
        AND a."after" ? 'recordedAt'
    ),
    r."recorded_at"
  )
);
