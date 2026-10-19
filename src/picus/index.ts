// Picus, il consigliere di scrittura: comandi e azioni. Nessuna impostazione a priori: si seleziona e
// si chiede (clic sul picchio o F7). Una parola sola -> sinonimi e contrari; piu' parole (o, senza
// selezione, la frase del cursore) -> tre riscritture, Formale, Neutra, Informale. Ctrl+F7 rivede la
// pergamena intera (giri di parole e ripetizioni sottolineati). Mentre si scrive non analizza nulla;
// motore e pacchetti si caricano in modo pigro, in un momento di calma dopo l'apertura dell'editor.
import { Bird, ScanText, ArrowDownToLine, EyeOff } from 'lucide-react';
import { registerCommands } from '../commands/registry';
import { getEditor, onEditor } from '../state/editorRef';
import { useWorkspace } from '../state/workspace';
import { getWritingLang, onWritingLang } from 'logos/i18n/writing';
import { platform } from '../platform';
import { thesaurusLang } from '../thesaurus/model';
import { textBlocks, type Block } from './blocks';
import { pickBlocks, placeFindings } from './scope';
import { picusHooks, picusKey, type Live } from './plugin';
import { usePicus, type Bubble, type DocEdit, type PieceOption, type RewriteView } from './store';
import { rank } from './rank';
import type { Engine, Finding, Suggestion } from './analyze';
import type { Rewrite } from './rewrite';

const say = (bubble: Bubble | null) => usePicus.setState({ bubble });

/** Motore pronto prima della prima domanda (in idle: non rallenta l'apertura). */
function warm() {
  const go = () => {
    void import('./packs').then((m) => m.loadEngine(getWritingLang())).catch(() => {});
    void import('./rewrite').catch(() => {});
    // il thesaurus si decomprime e si indicizza alla prima richiesta: meglio adesso che al primo clic
    const th = thesaurusLang(getWritingLang());
    if (th) void platform.thesaurus(th, 'a').catch(() => null);
  };
  const idle = (window as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback;
  if (idle) idle(go);
  else setTimeout(go, 500);
}

async function engineNow(): Promise<Engine | null> {
  const lang = getWritingLang();
  const { loadEngine } = await import('./packs');
  try {
    const engine = await loadEngine(lang);
    if (!engine) say({ kind: 'nopack', lang });
    return engine;
  } catch (e) {
    say({ kind: 'error', text: String(e instanceof Error ? e.message : e) });
    return null;
  }
}

/** offset nel testo del blocco della posizione `pos` del documento */
const offsetIn = (b: Block, pos: number) => {
  const i = b.map.findIndex((p) => p >= pos);
  return i < 0 ? b.text.length : i;
};

/** posizioni nel documento del tratto [start, end) del testo del blocco */
const docSpan = (b: Block, start: number, end: number) => ({ from: start < b.map.length ? b.map[start] : b.to, to: end > start ? b.map[end - 1] + 1 : start < b.map.length ? b.map[start] : b.to });

/**
 * Interroga Picus: con una parola sola selezionata sinonimi e contrari, altrimenti le riscritture
 * della selezione (o della frase del cursore); con `whole` la revisione di tutta la pergamena.
 */
export async function ask(whole = false) {
  const ed = getEditor();
  if (!ed) return;
  const engine = await engineNow();
  if (!engine) return;
  if (whole) return review(engine);
  const th = thesaurusLang(getWritingLang());
  const { from, to, empty } = ed.state.selection;
  const blocks = textBlocks(ed.state.doc);
  const [{ sentenceAt, rewrite }, { tokenize }] = await Promise.all([import('./rewrite'), import('./tokens')]);
  // i tratti da riscrivere, uno per blocco
  const ranges: { b: Block; s: number; e: number }[] = [];
  if (empty) {
    const b = blocks.find((x) => from >= x.from && from <= x.to);
    if (b) {
      const [s, e] = sentenceAt(b.text, offsetIn(b, from));
      ranges.push({ b, s, e });
    }
  } else {
    for (const b of blocks) {
      if (b.to <= from || b.from >= to) continue;
      let s = Math.max(0, offsetIn(b, from));
      let e = Math.min(b.text.length, offsetIn(b, to));
      while (s < e && /\s/.test(b.text[s])) s++;
      while (e > s && /\s/.test(b.text[e - 1])) e--;
      if (e > s) ranges.push({ b, s, e });
    }
  }
  if (!ranges.length) return say({ kind: 'quiet' });
  clear();

  // una parola sola selezionata: sinonimi e contrari, per tono
  const only = ranges.length === 1 && !empty ? ranges[0] : null;
  if (only && th && tokenize(only.b.text.slice(only.s, only.e), engine.pack.elision).length === 1) {
    const { synonymsAt } = await import('./synonyms');
    const f = await synonymsAt(engine, only.b.text, th, (key) => platform.thesaurus(th, key).catch(() => null), only.s, only.e);
    if (f) {
      const span = docSpan(only.b, f.start, f.end);
      ed.view.dispatch(ed.state.tr.setMeta(picusKey, { items: [{ ...span, f }], current: 0 }));
      usePicus.setState({ open: true, focus: usePicus.getState().focus + 1, bubble: null });
      return;
    }
  }

  // piu' parole: tre riscritture
  const lookupMany = async (keys: string[]) => {
    const list = th && keys.length ? await platform.thesaurusMany(th, keys).catch(() => keys.map(() => null)) : keys.map(() => null);
    return new Map(keys.map((k, i) => [k, list[i]]));
  };
  const results = await Promise.all(ranges.map((r) => rewrite(engine, r.b.text, r.s, r.e, th, lookupMany)));
  const view = toView(ranges, results);
  if (!view.pieces.length) return say({ kind: 'quiet' });
  usePicus.setState({ rewrite: view, focus: usePicus.getState().focus + 1, bubble: null });
}

/** Le riscritture nelle posizioni del documento, per il pannello. */
function toView(ranges: { b: Block; s: number; e: number }[], results: Rewrite[]): RewriteView {
  const edit = (b: Block, start: number, end: number, text: string): DocEdit => ({ ...docSpan(b, start, end), text });
  const versions = results[0].versions.map((v0, vi) => {
    let text = '';
    const changes: { start: number; end: number }[] = [];
    const edits: DocEdit[] = [];
    results.forEach((r, ri) => {
      const v = r.versions[vi];
      if (ri) text += '\n';
      v.changes.forEach((c) => changes.push({ start: c.start + text.length, end: c.end + text.length }));
      text += v.text;
      v.edits.forEach((ed) => edits.push(edit(ranges[ri].b, ed.start, ed.end, ed.text)));
    });
    return { tone: v0.tone, text, changes, edits };
  });
  const pieces = results.flatMap((r, ri) =>
    r.units.map((u) => {
      const options: PieceOption[] = u.options.map((o) => ({ text: o.text, register: o.register, flags: o.flags, ...(o.note ? { note: o.note } : {}), base: o.base, edit: edit(ranges[ri].b, u.start, o.to ?? u.end, o.text) }));
      return { original: u.original, label: u.label, sections: rank(options, new Map()) };
    }),
  );
  const first = ranges[0];
  const last = ranges[ranges.length - 1];
  return { from: docSpan(first.b, first.s, first.e).from, to: docSpan(last.b, last.s, last.e).to, original: results.map((r) => r.original).join('\n'), versions, pieces };
}

/** Applica modifiche al documento (dall'ultima, cosi' le posizioni restano buone): un solo Ctrl+Z. */
function applyEdits(edits: DocEdit[]) {
  const ed = getEditor();
  if (!ed) return;
  const tr = ed.state.tr;
  for (const e of [...edits].sort((a, b) => b.from - a.from)) {
    if (e.text) tr.insertText(e.text, e.from, e.to);
    else tr.delete(e.from, e.to);
  }
  ed.view.dispatch(tr.scrollIntoView());
}

/** Il tratto riscritto e' ancora com'era? (se nel frattempo si e' scritto, le posizioni non valgono) */
function stillThere(v: RewriteView): boolean {
  const ed = getEditor();
  return !!ed && v.to <= ed.state.doc.content.size && ed.state.doc.textBetween(v.from, v.to, '\n') === v.original;
}

/** Sceglie una versione intera (1, 2, 3 nel pannello). */
export function applyVersion(i: number) {
  const v = usePicus.getState().rewrite;
  const version = v?.versions[i];
  if (!v || !version) return;
  if (stillThere(v)) applyEdits(version.edits);
  closeRewrite();
}

/** Cambia un pezzo solo e rifa' le riscritture del tratto aggiornato. */
export async function applyPiece(o: PieceOption) {
  const v = usePicus.getState().rewrite;
  const ed = getEditor();
  if (!v || !ed || !stillThere(v)) return closeRewrite();
  applyEdits([o.edit]);
  const delta = o.text.length - (o.edit.to - o.edit.from);
  ed.commands.setTextSelection({ from: v.from, to: v.to + delta });
  await ask(false);
}

export function closeRewrite(refocus = true) {
  usePicus.setState({ rewrite: null });
  if (refocus) getEditor()?.commands.focus();
}

/** Revisione di tutta la pergamena: giri di parole e ripetizioni sottolineati, con le alternative. */
async function review(engine: Engine) {
  const ed = getEditor()!;
  const { analyze, usage } = await import('./engine');
  const blocks = textBlocks(ed.state.doc);
  const sel = { from: 0, to: 0, empty: true };
  const opts = { lastUse: usage(engine, blocks.map((b) => b.text)) };
  const items = pickBlocks(blocks, sel, true).flatMap((b) => placeFindings(b, analyze(engine, b.text, opts), sel, true));
  // parole ripetute: i loro sinonimi
  const th = thesaurusLang(getWritingLang());
  if (th) {
    const { synonymsAt } = await import('./synonyms');
    const lookup = (key: string) => platform.thesaurus(th, key).catch(() => null);
    const blockOf = (pos: number) => blocks.find((b) => pos >= b.from && pos <= b.to);
    const withSynonyms = (l: Live, f: Finding): Live => ({ ...l, f: { ...l.f, senses: f.senses, source: 'thesaurus' } });
    await Promise.all(
      items.slice(0, 60).map(async (l, i) => {
        if (l.f.kind !== 'repetition' || l.f.senses.length) return;
        const b = blockOf(l.from);
        const f = b && (await synonymsAt(engine, b.text, th, lookup, l.f.start, l.f.end));
        if (f) items[i] = withSynonyms(l, f);
      }),
    );
  }
  const current = items.length ? 0 : -1;
  ed.view.dispatch(ed.state.tr.setMeta(picusKey, { items, current }));
  usePicus.setState({ open: items.length > 0, rewrite: null, focus: usePicus.getState().focus + 1, bubble: items.length ? { kind: 'result', n: items.length } : { kind: 'quiet' } });
  if (current >= 0) reveal(items[current]);
}

function reveal(l: Live) {
  const ed = getEditor();
  if (!ed) return;
  const { node } = ed.view.domAtPos(l.from);
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/** Va al rilievo i (o al successivo/precedente con `delta`) e ne apre il pannello. */
export function goTo(i: number, focus = true) {
  const ed = getEditor();
  const { items, focus: f } = usePicus.getState();
  if (!ed || !items.length) return;
  const current = (i + items.length) % items.length;
  ed.view.dispatch(ed.state.tr.setMeta(picusKey, { current }));
  usePicus.setState({ open: true, focus: focus ? f + 1 : f });
  reveal(items[current]);
}

export const step = (delta: number) => goTo(usePicus.getState().current + delta);

export function close(refocus = true) {
  usePicus.setState({ open: false });
  if (refocus) getEditor()?.commands.focus();
}

/** Sceglie un'alternativa di un rilievo: sostituisce il tratto (stessi stili, si annulla con Ctrl+Z). */
export function apply(l: Live, s: Suggestion, alt = false) {
  const ed = getEditor();
  if (!ed) return;
  // il testo potrebbe essere cambiato: si sostituisce solo se c'e' ancora
  if (ed.state.doc.textBetween(l.from, l.to, ' ') !== l.f.original) return;
  // l'alternativa puo' inghiottire l'articolo che segue ("di" + "l'" -> "dell'")
  const end = l.to + (s.to !== undefined ? s.to - l.f.end : 0);
  ed.view.dispatch(ed.state.tr.insertText(alt && s.alt ? s.alt : s.text, l.from, end));
  const { items, current } = usePicus.getState();
  if (items.length && current >= 0) reveal(items[current]);
}

/** Toglie sottolineature e pannelli. */
export function clear() {
  const ed = getEditor();
  ed?.view.dispatch(ed.state.tr.setMeta(picusKey, { items: [], current: -1 }));
  usePicus.setState({ open: false, rewrite: null, bubble: null });
}

export function registerPicus() {
  picusHooks.click = (i) => goTo(i, false);
  onEditor((e) => e && warm());
  onWritingLang(() => {
    clear();
    if (getEditor()) warm();
  });
  const ws = () => useWorkspace.getState();
  const hasItems = () => usePicus.getState().items.length > 0;
  registerCommands([
    { id: 'picus.ask', label: 'cmd.picus.ask', hint: 'cmd.picus.askHint', icon: Bird, shortcut: 'F7', category: 'edit', views: ['editor'], run: () => void ask(false) },
    { id: 'picus.askDoc', label: 'cmd.picus.askDoc', hint: 'cmd.picus.askDocHint', icon: ScanText, shortcut: 'Mod+F7', category: 'edit', views: ['editor'], run: () => void ask(true) },
    { id: 'picus.next', label: 'cmd.picus.next', icon: ArrowDownToLine, shortcut: 'Alt+F7', category: 'edit', views: ['editor'], isEnabled: hasItems, run: () => step(1) },
    {
      id: 'picus.toggle',
      label: 'cmd.picus.toggle',
      hint: 'cmd.picus.toggleHint',
      icon: EyeOff,
      category: 'view',
      views: ['editor'],
      isActive: () => ws().app.prefs.picusShown,
      run: () => {
        const shown = !ws().app.prefs.picusShown;
        ws().setPrefs({ picusShown: shown });
        if (!shown) clear();
      },
    },
  ]);
}
