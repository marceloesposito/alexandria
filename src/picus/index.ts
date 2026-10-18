// Picus, il consigliere di scrittura: comandi e azioni. Parla solo se interrogato (F7 il paragrafo o
// la selezione, Ctrl+F7 tutta la pergamena); mentre si scrive non analizza nulla. Il motore e i
// pacchetti si caricano in modo pigro, in un momento di calma dopo l'apertura dell'editor.
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
import { usePicus, saveDocFile, type Bubble } from './store';
import type { Finding, Suggestion } from './analyze';
import type { Tone } from './rank';

const say = (bubble: Bubble | null) => usePicus.setState({ bubble });

/** Motore pronto prima della prima domanda (in idle: non rallenta l'apertura). */
function warm() {
  const go = () => {
    void import('./packs').then((m) => m.loadEngine(getWritingLang())).catch(() => {});
    void import('./synonyms').catch(() => {});
    // il thesaurus si decomprime e si indicizza alla prima richiesta: meglio adesso che al primo clic
    const th = thesaurusLang(getWritingLang());
    if (th) void platform.thesaurus(th, 'a').catch(() => null);
  };
  const idle = (window as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback;
  if (idle) idle(go);
  else setTimeout(go, 500);
}

/** Interroga Picus: la selezione o il paragrafo del cursore; con `whole` tutta la pergamena. */
export async function ask(whole = false) {
  const ed = getEditor();
  if (!ed) return;
  const lang = getWritingLang();
  const [{ loadEngine }, { analyze, usage }] = await Promise.all([import('./packs'), import('./engine')]);
  let engine;
  try {
    engine = await loadEngine(lang);
  } catch (e) {
    return say({ kind: 'error', text: String(e instanceof Error ? e.message : e) });
  }
  if (!engine) return say({ kind: 'nopack', lang });
  const st = usePicus.getState();
  const { from, to, empty } = ed.state.selection;
  const sel = { from, to, empty };
  const blocks = textBlocks(ed.state.doc);
  const opts = {
    tone: st.tone,
    ignore: new Set(st.ignored),
    off: new Set(useWorkspace.getState().app.prefs.picusOff),
    lastUse: usage(engine, blocks.map((b) => b.text)),
    variations: !whole,
  };
  const items = pickBlocks(blocks, sel, whole).flatMap((b) => placeFindings(b, analyze(engine, b.text, opts), sel, whole));
  let current = -1;

  // sinonimi dal thesaurus (italiano e inglese): per il punto chiesto e per le parole ripetute
  const th = thesaurusLang(lang);
  if (th) {
    const { synonymsAt } = await import('./synonyms');
    const lookup = (key: string) => platform.thesaurus(th, key).catch(() => null);
    const blockOf = (pos: number) => blocks.find((b) => pos >= b.from && pos <= b.to);
    const offset = (b: Block, pos: number) => {
      const i = b.map.findIndex((p) => p >= pos);
      return i < 0 ? b.text.length : i;
    };
    const withSynonyms = (l: Live, f: Finding): Live => ({ ...l, f: { ...l.f, senses: f.senses, source: 'thesaurus' } });
    // il punto chiesto: se il dizionario di Picus ha gia' alternative vincono loro (locuzioni)
    if (!whole) {
      const here = items.findIndex((l) => (empty ? from >= l.from && from <= l.to : l.from <= from && l.to >= to));
      if (here >= 0 && items[here].f.senses.length) current = here;
      else {
        const b = blockOf(from);
        const f = b && (await synonymsAt(engine, b.text, th, lookup, offset(b, from), empty ? null : offset(b, to)));
        if (b && f) {
          let live: Live = { from: b.map[f.start], to: b.map[f.end - 1] + 1, f };
          // stesso tratto di una ripetizione: la ripetizione prende i sinonimi
          if (here >= 0 && items[here].from === live.from && items[here].to === live.to) live = items[here] = withSynonyms(items[here], f);
          else {
            items.push(live);
            items.sort((a, c) => a.from - c.from || a.to - c.to);
          }
          current = items.indexOf(live);
        }
      }
    }
    // parole ripetute: i loro sinonimi al posto di "cerca sinonimi"
    await Promise.all(
      items.slice(0, 60).map(async (l, i) => {
        if (l.f.kind !== 'repetition' || l.f.senses.length) return;
        const b = blockOf(l.from);
        const f = b && (await synonymsAt(engine, b.text, th, lookup, l.f.start, l.f.end));
        if (f) items[i] = withSynonyms(l, f);
      }),
    );
  }
  // altrimenti il primo rilievo dal cursore in poi
  if (current < 0 && items.length) current = Math.max(0, items.findIndex((l) => l.to >= from));
  ed.view.dispatch(ed.state.tr.setMeta(picusKey, { items, current }));
  usePicus.setState({ open: items.length > 0, focus: st.focus + 1, bubble: items.length ? { kind: 'result', n: items.length } : { kind: 'quiet' } });
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

/** Sceglie un'alternativa: sostituisce il tratto (stessi stili, si annulla con Ctrl+Z). */
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

/** "Ignora": questo rilievo non torna piu' in questa pergamena. */
export function ignore(l: Live) {
  const ed = getEditor();
  saveDocFile({ ignored: [...new Set([...usePicus.getState().ignored, l.f.key])] });
  ed?.view.dispatch(ed.state.tr.setMeta(picusKey, { drop: (x: Live) => x.f.key === l.f.key }));
}

/** "Disattiva questa categoria": in tutte le pergamene, finche' non la si riaccende in Preferenze. */
export function disable(l: Live) {
  const ed = getEditor();
  const prefs = useWorkspace.getState().app.prefs;
  useWorkspace.getState().setPrefs({ picusOff: [...new Set([...prefs.picusOff, l.f.category])] });
  ed?.view.dispatch(ed.state.tr.setMeta(picusKey, { drop: (x: Live) => x.f.category === l.f.category }));
}

export function setTone(tone: Tone | null) {
  saveDocFile({ tone });
}

/** Toglie tutte le sottolineature. */
export function clear() {
  const ed = getEditor();
  ed?.view.dispatch(ed.state.tr.setMeta(picusKey, { items: [], current: -1 }));
  usePicus.setState({ open: false, bubble: null });
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
