// Geometria condivisa fra pagina, colonna dei commenti e connettori.
import { TextSelection } from '@tiptap/pm/state';
import { getEditor } from '../state/editorRef';
import { flatText } from './plugin';
import { indexOfPos, wordAt } from './model';
import type { VisualLine } from '../editor/lines';

export function pageEl(): HTMLElement | null {
  return document.querySelector('.editor-center .page');
}

export function scrollEl(): HTMLElement | null {
  return document.querySelector('.editor-center .editor-scroll');
}

/** y dell'inizio di una posizione del documento, rispetto alla pagina. */
export function posTopInPage(pos: number): number | null {
  const e = getEditor();
  const page = pageEl();
  if (!e || !page) return null;
  try {
    const c = e.view.coordsAtPos(Math.min(pos, e.state.doc.content.size));
    return c.top - page.getBoundingClientRect().top;
  } catch {
    return null;
  }
}

/** Estremi (posizioni del documento) di una riga visiva. */
export function lineRange(line: VisualLine): { from: number; to: number } | null {
  const e = getEditor();
  const page = pageEl();
  const pm = page?.querySelector('.ProseMirror') as HTMLElement | null;
  if (!e || !page || !pm) return null;
  const pr = page.getBoundingClientRect();
  const r = pm.getBoundingClientRect();
  const y = pr.top + (line.top + line.bottom) / 2;
  const a = e.view.posAtCoords({ left: r.left + 1, top: y });
  const b = e.view.posAtCoords({ left: r.right - 1, top: y });
  if (!a || !b) return null;
  const from = Math.min(a.pos, b.pos);
  const to = Math.max(a.pos, b.pos);
  return to > from ? { from, to } : null;
}

/** Destinazione di un collegamento rilasciato in (x, y): la selezione se ci cade dentro, altrimenti la parola. */
export function dropTarget(x: number, y: number): { from: number; to: number } | null {
  const e = getEditor();
  if (!e) return null;
  const el = document.elementFromPoint(x, y);
  if (!el || !el.closest('.ProseMirror')) return null;
  const hit = e.view.posAtCoords({ left: x, top: y });
  if (!hit) return null;
  const sel = e.state.selection;
  if (!sel.empty && hit.pos >= sel.from && hit.pos <= sel.to) return { from: sel.from, to: sel.to };
  const flat = flatText(e.state.doc);
  const i = indexOfPos(flat, hit.pos);
  const w = wordAt(flat.text, Math.min(i, flat.text.length - 1));
  if (!w) return null;
  return { from: flat.map[w.start], to: flat.map[w.end - 1] + 1 };
}

/** Porta il testo collegato a un commento al centro della vista e lo seleziona brevemente. */
export function revealAnchor(from: number, to: number) {
  const e = getEditor();
  const sc = scrollEl();
  const top = posTopInPage(from);
  if (!e || !sc || top === null) return;
  const page = pageEl()!;
  sc.scrollTo({ top: page.offsetTop + top - sc.clientHeight / 3, behavior: 'smooth' });
  e.view.dispatch(e.state.tr.setSelection(TextSelection.create(e.state.doc, from, to)));
}
