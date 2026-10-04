// Motore delle citazioni: citeproc-js con stili CSL. Etichette nel testo, note e bibliografia.
import CSL from 'citeproc';
import type { CitationItem } from '../doc/types';
import type { CslItem } from '../resources/model';

export interface Locator {
  label?: string;
  locator?: string;
  suffix?: string;
}

const LABELS: [RegExp, string][] = [
  [/^(pp?|pagg?|pag)\.?$/i, 'page'],
  [/^(capp?|chap|ch)\.?$/i, 'chapter'],
  [/^(par|para|§)\.?$/i, 'paragraph'],
  [/^(sez|sec)\.?$/i, 'section'],
  [/^vols?\.?$/i, 'volume'],
  [/^(figg?|fig)\.?$/i, 'figure'],
  [/^(nn?|no)\.?$/i, 'issue'],
  [/^(vv?)\.?$/i, 'verse'],
  [/^(ll?)\.?$/i, 'line'],
  [/^t\.?$/i, 'volume'],
];

/** "p. 12" -> { label: 'page', locator: '12' }; "1:15" o "min. 1:15" -> suffisso. */
export function parseLocator(raw: string | undefined): Locator {
  if (!raw?.trim()) return {};
  const s = raw.trim();
  const time = /^(?:min\.?\s*)?(\d{1,2}:\d{2}(?::\d{2})?)$/i.exec(s);
  if (time) return { suffix: time[1] };
  const m = /^([^\s\d]+\.?)\s*(.+)$/.exec(s);
  if (m) {
    const lab = LABELS.find(([re]) => re.test(m[1]));
    if (lab) return { label: lab[1], locator: m[2] };
  }
  if (/^[\divxlcdm\-–,\s]+$/i.test(s)) return { label: 'page', locator: s };
  return { suffix: s };
}

export interface EngineOptions {
  style: string; // XML CSL
  locales: Record<string, string>; // 'it-IT' -> XML
  lang: string;
  items: Map<string, CslItem>; // chiave di citazione -> voce
}

export class CitationEngine {
  private engine: InstanceType<typeof CSL.Engine>;
  private items: Map<string, CslItem>;
  readonly isNote: boolean;
  private order: string[] = [];

  constructor(o: EngineOptions) {
    this.items = o.items;
    const fallbackLang = o.locales['en-US'] ?? Object.values(o.locales)[0];
    this.engine = new CSL.Engine(
      {
        retrieveLocale: (lang: string) => o.locales[lang] ?? o.locales[lang.split('-')[0]] ?? fallbackLang,
        retrieveItem: (id: string) => {
          const it = this.items.get(id);
          return it ? { ...it, id } : { id, type: 'document', title: id };
        },
      },
      o.style,
      o.lang,
      true,
    );
    this.isNote = this.engine.opt.xclass === 'note';
    this.engine.setOutputFormat('text');
  }

  has(key: string): boolean {
    return this.items.has(key);
  }

  /** Ordine di prima comparsa nel documento: serve agli stili numerici (IEEE, Vancouver). */
  setOrder(keys: string[]) {
    const known = keys.filter((k, i) => keys.indexOf(k) === i);
    if (known.join('|') === this.order.join('|')) return;
    this.order = known;
    this.engine.updateItems(known);
  }

  private toCiteproc(items: CitationItem[]) {
    return items.map((it) => {
      const loc = parseLocator(it.locator);
      const suffix = [loc.suffix, it.suffix].filter(Boolean).join(' ');
      return {
        id: it.key,
        ...(loc.locator ? { locator: loc.locator, label: loc.label } : {}),
        ...(it.prefix ? { prefix: it.prefix + ' ' } : {}),
        ...(suffix ? { suffix: (loc.suffix && !loc.locator ? ', ' : ' ') + suffix } : {}),
        ...(it.suppressAuthor ? { 'suppress-author': true } : {}),
      };
    });
  }

  /** Testo della citazione (o della nota, per gli stili a note). */
  cluster(items: CitationItem[], format: 'text' | 'html' = 'text'): string {
    const ids = items.map((i) => i.key).filter((k) => !this.order.includes(k));
    if (ids.length) this.setOrder([...this.order, ...ids]);
    this.engine.setOutputFormat(format);
    try {
      return this.engine.makeCitationCluster(this.toCiteproc(items));
    } catch {
      return items.map((i) => `@${i.key}`).join('; ');
    } finally {
      this.engine.setOutputFormat('text');
    }
  }

  /** Voci della bibliografia per le chiavi date, nell'ordine dello stile. */
  bibliography(keys: string[], format: 'text' | 'html' = 'html'): string[] {
    this.setOrder(keys);
    this.engine.setOutputFormat(format);
    try {
      const b = this.engine.makeBibliography();
      return b ? b[1].map((e) => e.trim()) : [];
    } finally {
      this.engine.setOutputFormat('text');
    }
  }
}
