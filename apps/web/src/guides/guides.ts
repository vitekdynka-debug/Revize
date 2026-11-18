import { marked, type Tokens } from 'marked';
import kancelar from '../../../../docs/kancelar.md?raw';
import provoz from '../../../../docs/provoz.md?raw';
import teren from '../../../../docs/teren.md?raw';
import typy from '../../../../docs/typy-vybaveni.md?raw';

/**
 * The user guides of `docs/`, built into the app (always the version of the running app, also
 * in the demo and without the internet).
 */
export interface Guide {
  slug: string;
  /** The file in docs/ (links between the guides refer to it). */
  file: string;
  title: string;
  description: string;
  markdown: string;
}

export const GUIDES: Guide[] = [
  {
    slug: 'teren',
    file: 'teren.md',
    title: 'Terén',
    description: 'Kontrola na iPadu: seznam, skenování, výsledky, fotky, práce bez signálu.',
    markdown: teren,
  },
  {
    slug: 'kancelar',
    file: 'kancelar.md',
    title: 'Kancelář',
    description: 'Zákazníci, artikly, import, typy vybavení, kontroly, protokoly a exporty.',
    markdown: kancelar,
  },
  {
    slug: 'typy-vybaveni',
    file: 'typy-vybaveni.md',
    title: 'Typy vybavení',
    description: 'Knihovna typů podle norem: pole, intervaly, texty protokolu.',
    markdown: typy,
  },
  {
    slug: 'provoz',
    file: 'provoz.md',
    title: 'Provoz serveru',
    description: 'Pro správce: nasazení, zálohy a obnova, aktualizace.',
    markdown: provoz,
  },
];

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/**
 * The guide as HTML. A link to another guide (`kancelar.md#…`) carries `data-guide` for the
 * page to open it in the app; other links open in a new tab. The texts are ours (docs/), not
 * user input.
 */
export function guideHtml(guide: Guide): string {
  const renderer = new marked.Renderer();
  const link = renderer.link.bind(renderer);
  renderer.link = (token: Tokens.Link) => {
    const target = GUIDES.find((g) => token.href.split('#')[0] === g.file);
    if (target) {
      const text = renderer.parser.parseInline(token.tokens);
      return `<a href="#" data-guide="${target.slug}">${text}</a>`;
    }
    return link(token).replace('<a ', '<a target="_blank" rel="noopener noreferrer" ');
  };
  return marked.parse(guide.markdown, { renderer, async: false });
}
