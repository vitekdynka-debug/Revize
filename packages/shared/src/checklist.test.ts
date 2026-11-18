import { describe, expect, it } from 'vitest';
import {
  RACK_CHECKLIST,
  checklistSchema,
  checksSeverity,
  failedChecks,
  withCheckText,
} from './checklist.js';

describe('check points', () => {
  it('finds the NE answers and the defect level they ask for', () => {
    expect(failedChecks(RACK_CHECKLIST, { floor_anchoring: true, load_sign: false })).toEqual([
      RACK_CHECKLIST[1],
    ]);
    expect(checksSeverity(RACK_CHECKLIST, { floor_anchoring: true }, true)).toBeNull();
    expect(checksSeverity(RACK_CHECKLIST, { load_sign: false }, true)).toBe('amber');
    // Fit / unfit types: a minor defect (stored as green), red stays unfit.
    expect(checksSeverity(RACK_CHECKLIST, { load_sign: false }, false)).toBe('green');
    const red = [{ ...RACK_CHECKLIST[0]!, severity: 'red' as const }];
    expect(checksSeverity(red, { floor_anchoring: false }, false)).toBe('red');
  });

  it('adds and removes the text of a point in the description', () => {
    const [anchoring, sign] = RACK_CHECKLIST;
    let text = withCheckText('', anchoring!, true);
    expect(text).toBe('Chybí nebo je poškozené kotvení do podlahy');
    text = withCheckText(`${text}\nOhnutý stojan`, sign!, true);
    expect(text).toBe(
      'Chybí štítek s nosností\nChybí nebo je poškozené kotvení do podlahy\nOhnutý stojan',
    );
    expect(withCheckText(text, anchoring!, false)).toBe('Chybí štítek s nosností\nOhnutý stojan');
    // Adding twice does not repeat it.
    expect(withCheckText(text, sign!, true).match(/štítek/g)).toHaveLength(1);
  });

  it('validates the list of a type', () => {
    expect(checklistSchema.safeParse(RACK_CHECKLIST).success).toBe(true);
    expect(
      checklistSchema.safeParse([
        RACK_CHECKLIST[0],
        { ...RACK_CHECKLIST[1], key: 'floor_anchoring' },
      ]).success,
    ).toBe(false);
  });
});
