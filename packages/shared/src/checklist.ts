import { z } from 'zod';

/**
 * Check points of an equipment type answered ANO / NE on every item in the field (ADR-0021),
 * e.g. for racks "Kotvení do podlahy" and "Štítek s nosností". NE makes the result a defect with
 * the point's text and level.
 */
export const CHECK_SEVERITIES = ['green', 'amber', 'red'] as const;
export type CheckSeverity = (typeof CHECK_SEVERITIES)[number];

export const checklistItemSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{0,49}$/, 'Klíč: malá písmena bez diakritiky, číslice a _'),
  /** The question in the field ("Kotvení do podlahy"). */
  label: z.string().trim().min(1, 'Zadejte název').max(100),
  /** Written into the defect description on NE ("Chybí kotvení do podlahy"). */
  defectText: z.string().trim().min(1, 'Zadejte text závady').max(200),
  /** Level of the defect on NE; types without risk levels take amber/green as a minor defect. */
  severity: z.enum(CHECK_SEVERITIES).default('amber'),
});
export type ChecklistItem = z.output<typeof checklistItemSchema>;

export const checklistSchema = z
  .array(checklistItemSchema)
  .max(30)
  .superRefine((items, ctx) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (seen.has(item.key)) {
        ctx.addIssue({ code: 'custom', path: [index, 'key'], message: 'Klíč se opakuje' });
      }
      seen.add(item.key);
    });
  });

/** Answers of the check points by key: true = ANO, false = NE. */
export const checksSchema = z.record(z.string(), z.boolean());
export type Checks = z.infer<typeof checksSchema>;

/** Check points of racks (ČSN EN 15635: anchoring and the load notice are checked every time). */
export const RACK_CHECKLIST: ChecklistItem[] = [
  {
    key: 'floor_anchoring',
    label: 'Kotvení do podlahy',
    defectText: 'Chybí nebo je poškozené kotvení do podlahy',
    severity: 'amber',
  },
  {
    key: 'load_sign',
    label: 'Štítek s nosností',
    defectText: 'Chybí štítek s nosností',
    severity: 'amber',
  },
];

/** The points answered NE, in the order of the list. */
export function failedChecks(checklist: readonly ChecklistItem[], checks: Checks): ChecklistItem[] {
  return checklist.filter((item) => checks[item.key] === false);
}

const RANK: Record<CheckSeverity, number> = { green: 0, amber: 1, red: 2 };

/**
 * The defect level the NE answers ask for (the highest of them); for types without risk levels
 * (fit / unfit) red stays red (unfit) and anything else is a minor defect (stored as green).
 * Null when every point is ANO.
 */
export function checksSeverity(
  checklist: readonly ChecklistItem[],
  checks: Checks,
  riskLevels: boolean,
): CheckSeverity | null {
  const failed = failedChecks(checklist, checks);
  if (!failed.length) return null;
  const highest = failed.reduce<CheckSeverity>(
    (level, item) => (RANK[item.severity] > RANK[level] ? item.severity : level),
    'green',
  );
  return riskLevels ? highest : highest === 'red' ? 'red' : 'green';
}

/**
 * The defect description with the point's text added (NE) or removed (ANO again). The texts of
 * the points stay on their own lines at the start, what the technician wrote follows.
 */
export function withCheckText(description: string, item: ChecklistItem, failed: boolean): string {
  const lines = description.split('\n').filter((line) => line.trim() !== item.defectText);
  if (failed) lines.unshift(item.defectText);
  return lines
    .join('\n')
    .replace(/^\n+|\n+$/g, '')
    .replace(/\n{3,}/g, '\n\n');
}
