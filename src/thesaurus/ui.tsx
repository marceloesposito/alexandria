// Thesaurus nello Scriptorium: parola selezionata, tasto destro > "Cerca sinonimi" (o Maiusc+F7).
// Il pannello mostra i significati con i sinonimi; un clic sostituisce la parola nel testo.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { BookA, X } from 'lucide-react';
import { platform } from '../platform';
import { getEditor } from '../state/editorRef';
import { useWorkspace } from '../state/workspace';
import { runCommand } from '../commands/registry';
import { openContextMenu } from '../components/ContextMenu';
import { getWritingLang } from '../i18n/writing';
import { t, useLang } from '../i18n';
import { parseEntry, lookupWord, matchCase, thesaurusLang, baseForms, inflectLike, type Entry } from './model';

interface Open {
  x: number;
  y: number;
  word: string;
  from: number;
  to: number;
  lang: 'it' | 'en';
  entry: Entry | null | 'loading';
  /** forma base cercata quando la parola del testo non c'e' (bella -> bello) */
  base: string | null;
}

const useThesaurus = create<{ open: Open | null }>(() => ({ open: null }));

/** Apre il pannello per la parola selezionata, vicino al punto (x, y). */
export async function lookupSelection(x?: number, y?: number) {
  const e = getEditor();
  if (!e) return;
  const { from, to } = e.state.selection;
  const word = lookupWord(e.state.doc.textBetween(from, to, ' '));
  if (!word) {
    useWorkspace.getState().toast(t('thes.selectWord'), 'info');
    return;
  }
  const lang = thesaurusLang(getWritingLang());
  if (!lang) {
    useWorkspace.getState().toast(t('thes.onlyItEn'), 'info');
    return;
  }
  // la parola senza gli spazi e la punteggiatura che la selezione si e' portata dietro
  const text = e.state.doc.textBetween(from, to, ' ');
  const start = from + text.indexOf(word);
  const at = e.view.coordsAtPos(start);
  const open: Open = { x: x ?? at.left, y: Math.max(y ?? 0, at.bottom), word, from: start, to: start + word.length, lang, entry: 'loading', base: null };
  useThesaurus.setState({ open });
  // la parola com'e', poi le forme base (il thesaurus ha il maschile singolare e l'infinito)
  let raw: string | null = null;
  let base: string | null = null;
  for (const w of [word, ...baseForms(word, lang)]) {
    raw = await platform.thesaurus(lang, w).catch(() => null);
    if (raw) {
      base = w === word ? null : w;
      break;
    }
  }
  const cur = useThesaurus.getState().open;
  if (cur === open) useThesaurus.setState({ open: { ...open, entry: raw ? parseEntry(raw) : null, base } });
}

/** Sostituisce la parola con il sinonimo scelto (stesse maiuscole, stessi stili del testo). */
function replaceWith(o: Open, term: string) {
  const e = getEditor();
  useThesaurus.setState({ open: null });
  if (!e) return;
  // la parola potrebbe essere cambiata mentre il pannello era aperto: si sostituisce solo se c'e' ancora
  if (e.state.doc.textBetween(o.from, o.to, ' ') !== o.word) return;
  const text = matchCase(o.word, o.base ? inflectLike(o.word, o.base, term, o.lang) : term);
  e.view.dispatch(e.state.tr.insertText(text, o.from, o.to).scrollIntoView());
  e.commands.setTextSelection({ from: o.from, to: o.from + text.length });
  e.commands.focus();
}

export function ThesaurusPanel() {
  useLang();
  const open = useThesaurus((s) => s.open);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ x: Math.max(8, Math.min(open.x, window.innerWidth - r.width - 8)), y: open.y + r.height + 12 > window.innerHeight ? Math.max(8, open.y - r.height - 24) : open.y + 6 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && useThesaurus.setState({ open: null });
    const key = (e: KeyboardEvent) => e.key === 'Escape' && useThesaurus.setState({ open: null });
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', key);
    };
  }, [open]);

  if (!open) return null;
  const chip = (term: string, kind: string) => (
    <button
      key={kind + term}
      className={`thes__term is-${kind}`}
      onClick={() => replaceWith(open, term)}
      title={t('thes.replace', { word: matchCase(open.word, open.base ? inflectLike(open.word, open.base, term, open.lang) : term) })}
    >
      {term}
    </button>
  );
  return createPortal(
    <div className="thes" ref={ref} style={{ left: pos.x, top: pos.y }} role="dialog" aria-label={t('thes.title', { word: open.word })}>
      <header className="thes__head">
        <BookA size={14} />
        <span>{t('thes.title', { word: open.word })}</span>
        <span className="thes__lang">{open.lang.toUpperCase()}</span>
        <button className="icon-btn" onClick={() => useThesaurus.setState({ open: null })} title={t('common.close')}>
          <X size={14} />
        </button>
      </header>
      <div className="thes__body">
        {open.base && <p className="hint thes__base">{t('thes.base', { base: open.base })}</p>}
        {open.entry === 'loading' && <p className="hint">{t('thes.loading')}</p>}
        {open.entry === null && <p className="hint">{t('thes.none')}</p>}
        {open.entry && open.entry !== 'loading' && !open.entry.meanings.length && <p className="hint">{t('thes.none')}</p>}
        {open.entry &&
          open.entry !== 'loading' &&
          open.entry.meanings.map((m, i) => (
            <section key={i} className="thes__meaning">
              <div className="thes__pos">{m.pos}</div>
              <div className="thes__terms">
                {m.synonyms.map((s) => chip(s, 'syn'))}
                {m.related.map((s) => chip(s, 'rel'))}
              </div>
              {m.antonyms.length > 0 && (
                <div className="thes__terms">
                  <span className="thes__label">{t('thes.antonyms')}</span>
                  {m.antonyms.map((s) => chip(s, 'ant'))}
                </div>
              )}
            </section>
          ))}
      </div>
      <footer className="thes__foot hint">{t('thes.source')}</footer>
    </div>,
    document.body,
  );
}

/**
 * Tasto destro su una parola gia' selezionata: menu di Alexandria con "Cerca sinonimi". Senza una
 * selezione fatta prima resta il menu del sistema (con i suggerimenti del controllo ortografico).
 */
export const ThesaurusMenu = Extension.create({
  name: 'thesaurusMenu',
  addProseMirrorPlugins() {
    let hadSelection = false;
    return [
      new Plugin({
        key: new PluginKey('thesaurusMenu'),
        props: {
          handleDOMEvents: {
            mousedown: (view, e) => {
              if (e.button === 2) hadSelection = !view.state.selection.empty;
              return false;
            },
            contextmenu: (view, e) => {
              const sel = hadSelection;
              hadSelection = false;
              if (!sel || view.state.selection.empty) return false;
              const word = lookupWord(view.state.doc.textBetween(view.state.selection.from, view.state.selection.to, ' '));
              if (!word || !thesaurusLang(getWritingLang())) return false;
              const { clientX: x, clientY: y } = e;
              openContextMenu(e, [
                { label: t('thes.lookup', { word }), hint: 'Shift+F7', onClick: () => void lookupSelection(x, y) },
                { sep: true, label: '' },
                { label: t('cmd.edit.cut'), onClick: () => void runCommand('edit.cut') },
                { label: t('cmd.edit.copy'), onClick: () => void runCommand('edit.copy') },
                { label: t('cmd.edit.paste'), onClick: () => void runCommand('edit.paste') },
              ]);
              return true;
            },
          },
        },
      }),
    ];
  },
});
