// Citazioni del documento aperto: motore CSL con lo stile scelto, etichette nel testo,
// ordine di comparsa per gli stili numerici, bibliografia generata e modificabile.
import { create } from 'zustand';
import type { Editor } from '@tiptap/core';
import { CitationEngine } from './engine';
import { setCitationRenderer, citationRenderer } from './renderer';
import { useResources } from '../resources/store';
import { useDocSettings } from '../layout/docSettings';
import { useWorkspace } from '../state/workspace';
import { platform, joinPath } from '../platform';
import { META_DIR } from '../vault/paths';
import { getEditor, onEditor } from '../state/editorRef';
import type { CitationItem, PMNode } from '../doc/types';
import type { CslItem } from '../resources/model';
import { cslHtmlToInline } from './html';
import { t } from '../i18n';
import { CITATION_LOCALES, docTexts, getWritingLang } from '../i18n/writing';

export interface StyleInfo {
  id: string;
  title: string;
  note: boolean;
  custom?: boolean;
}

export const BUNDLED_STYLES: StyleInfo[] = [
  { id: 'apa', title: 'APA 7', note: false },
  { id: 'modern-language-association', title: 'MLA 9', note: false },
  { id: 'chicago-author-date', title: 'Chicago (autore-data)', note: false },
  { id: 'chicago-notes-bibliography', title: 'Chicago (note e bibliografia)', note: true },
  { id: 'chicago-shortened-notes-bibliography', title: 'Chicago (note brevi)', note: true },
  { id: 'harvard-cite-them-right', title: 'Harvard', note: false },
  { id: 'ieee', title: 'IEEE', note: false },
  { id: 'elsevier-vancouver', title: 'Vancouver', note: false },
  { id: 'american-medical-association', title: 'AMA', note: false },
  { id: 'nature', title: 'Nature', note: false },
];

const xmlCache = new Map<string, string>();

async function bundled(file: string): Promise<string> {
  const hit = xmlCache.get(file);
  if (hit) return hit;
  const res = await fetch(`/csl/${file}`);
  if (!res.ok) throw new Error(`CSL ${file}: ${res.status}`);
  const x = await res.text();
  xmlCache.set(file, x);
  return x;
}

function customDir(): string | null {
  const root = useWorkspace.getState().vaultRoot;
  return root ? joinPath(root, META_DIR, 'csl') : null;
}

export async function listCustomStyles(): Promise<StyleInfo[]> {
  const dir = customDir();
  if (!dir || !(await platform.exists(dir))) return [];
  const out: StyleInfo[] = [];
  for (const e of await platform.list(dir)) {
    if (!e.name.endsWith('.csl')) continue;
    const xml = await platform.readText(e.path);
    const title = /<title>([^<]+)<\/title>/.exec(xml)?.[1] ?? e.name;
    out.push({ id: `custom:${e.name.replace(/\.csl$/, '')}`, title, note: /class="note"/.test(xml), custom: true });
  }
  return out;
}

async function styleXml(id: string): Promise<string> {
  if (id.startsWith('custom:')) {
    const dir = customDir();
    if (dir) return platform.readText(joinPath(dir, `${id.slice(7)}.csl`));
  }
  return bundled(`${BUNDLED_STYLES.some((s) => s.id === id) ? id : 'apa'}.csl`);
}

/** Importa un file .csl nel vault (resta disponibile per tutti i documenti del progetto). */
export async function importStyle(path: string): Promise<StyleInfo | null> {
  const dir = customDir();
  if (!dir) return null;
  const xml = await platform.readText(path);
  if (!/<style[\s>]/.test(xml)) throw new Error(t('cite.invalidStyle'));
  const name = (path.split('/').pop() ?? 'stile.csl').replace(/\.csl$/i, '').replace(/[^\w-]/g, '-');
  await platform.writeText(joinPath(dir, `${name}.csl`), xml);
  return { id: `custom:${name}`, title: /<title>([^<]+)<\/title>/.exec(xml)?.[1] ?? name, note: /class="note"/.test(xml), custom: true };
}

interface CiteState {
  engine: CitationEngine | null;
  styleId: string;
  error: string | null;
  rebuild(): Promise<void>;
}

export const useCitations = create<CiteState>(() => ({
  engine: null,
  styleId: 'apa',
  error: null,
  async rebuild() {
    const settings = useDocSettings.getState().settings;
    const sources = useResources.getState().resources.filter((r) => r.isSource && r.citeKey);
    const items = new Map<string, CslItem>(sources.map((r) => [r.citeKey!, { ...(r.csl ?? {}), title: r.csl?.title ?? r.title, type: r.csl?.type ?? 'document' }]));
    try {
      // la locale chiesta (se e' nel pacchetto) piu' l'inglese, che fa da riserva
      const lang = CITATION_LOCALES.some((l) => l.id === settings.citationLocale) ? settings.citationLocale : 'en-US';
      const ids = [...new Set([lang, 'en-US'])];
      const [style, ...xml] = await Promise.all([styleXml(settings.citationStyle), ...ids.map((id) => bundled(`locales-${id}.xml`))]);
      const engine = new CitationEngine({ style, lang, items, locales: Object.fromEntries(ids.map((id, i) => [id, xml[i]])) });
      useCitations.setState({ engine, styleId: settings.citationStyle, error: null });
      engine.setOrder(keysInDoc(getEditor()));
      setCitationRenderer({
        label: (ci) => (ci.every((x) => items.has(x.key)) ? engine.cluster(ci) : `(${ci.map((x) => `@${x.key}?`).join('; ')})`),
        isNoteStyle: () => engine.isNote,
        describe: (key) => {
          const r = sources.find((s) => s.citeKey === key);
          return r ? `${r.title}${engine.isNote ? '\n' + engine.cluster([{ key }]) : ''}` : null;
        },
      });
    } catch (e) {
      useCitations.setState({ engine: null, error: String(e) });
      setCitationRenderer(null);
    }
  },
}));

/** Chiavi citate nel documento, nell'ordine di prima comparsa (note comprese). */
export function keysInDoc(editor: Editor | null): string[] {
  if (!editor) return [];
  const keys: string[] = [];
  editor.state.doc.descendants((n) => {
    if (n.type.name === 'citation') for (const it of n.attrs.items as CitationItem[]) keys.push(it.key);
    if (n.type.name === 'footnote' && typeof n.attrs.text === 'string') {
      for (const m of (n.attrs.text as string).matchAll(/@([\p{L}\p{N}_][\p{L}\p{N}_:.-]*)/gu)) keys.push(m[1]);
    }
    return true;
  });
  return keys.filter((k, i) => keys.indexOf(k) === i);
}

/** Inserisce o rigenera la bibliografia (alla fine del documento, o dove gia' si trova). */
export function insertBibliography(editor: Editor): number {
  const engine = useCitations.getState().engine;
  if (!engine) return 0;
  const keys = keysInDoc(editor).filter((k) => engine.has(k));
  const entries = engine.bibliography(keys, 'html');
  const title = useDocSettings.getState().settings.bibliographyTitle || docTexts(getWritingLang()).bibliography;
  const content: PMNode[] = [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: title }] },
    ...(entries.length
      ? entries.map((html) => ({ type: 'paragraph', content: cslHtmlToInline(html) }))
      : [{ type: 'paragraph', content: [{ type: 'text', text: docTexts(getWritingLang()).bibEmpty }] }]),
  ];
  const node = editor.schema.nodeFromJSON({ type: 'bibliography', content });
  let existing: { pos: number; size: number } | null = null;
  editor.state.doc.descendants((n, pos) => {
    if (n.type.name === 'bibliography' && !existing) existing = { pos, size: n.nodeSize };
    return !existing;
  });
  const tr = editor.state.tr;
  if (existing) {
    const e = existing as { pos: number; size: number };
    tr.replaceWith(e.pos, e.pos + e.size, node);
  } else tr.insert(editor.state.doc.content.size, node);
  editor.view.dispatch(tr.scrollIntoView());
  return entries.length;
}

// ricostruzione quando cambiano stile, lingua o fonti
let timer: ReturnType<typeof setTimeout> | null = null;
function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void useCitations.getState().rebuild(), 150);
}
useDocSettings.subscribe((s, p) => {
  if (s.settings.citationStyle !== p.settings.citationStyle || s.settings.citationLocale !== p.settings.citationLocale || s.rel !== p.rel) schedule();
});
useResources.subscribe((s, p) => {
  if (s.resources !== p.resources) schedule();
});

// l'ordine di comparsa si aggiorna mentre si scrive (stili numerici)
let orderTimer: ReturnType<typeof setTimeout> | null = null;
let lastOrder = '';
onEditor((e) => {
  if (!e) return;
  schedule();
  e.on('update', () => {
    if (orderTimer) clearTimeout(orderTimer);
    orderTimer = setTimeout(() => {
      const engine = useCitations.getState().engine;
      if (!engine) return;
      const keys = keysInDoc(e);
      const sig = keys.join('|');
      if (sig === lastOrder) return;
      lastOrder = sig;
      engine.setOrder(keys);
      // stesse funzioni, nuovo tick: le etichette nel testo si ridisegnano
      refreshRenderer();
    }, 400);
  });
});

function refreshRenderer() {
  setCitationRenderer({ ...citationRenderer() });
}
