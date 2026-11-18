import { describe, expect, it } from 'vitest';
import { GUIDES, guideBySlug, guideHtml } from './guides.js';

describe('guides', () => {
  it('builds the guides of docs/ into the app', () => {
    expect(GUIDES.map((g) => g.slug)).toEqual(['teren', 'kancelar', 'typy-vybaveni', 'provoz']);
    for (const guide of GUIDES) expect(guide.markdown.startsWith('# ')).toBe(true);
  });

  it('opens links between the guides in the app and the others in a new tab', () => {
    const html = guideHtml(guideBySlug('kancelar')!);
    expect(html).toContain('data-guide="typy-vybaveni"');
    const types = guideHtml(guideBySlug('typy-vybaveni')!);
    expect(types).toMatch(/<a target="_blank" rel="noopener noreferrer" href="https:/);
  });
});
