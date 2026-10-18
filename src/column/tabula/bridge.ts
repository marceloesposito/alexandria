// Ponte fra testo e Tabula: una selezione diventa un estratto (ancorato al punto del testo), un
// blocco rilasciato nel testo diventa paragrafo, immagine o collegamento.
import type { Editor } from '@tiptap/core';
import { makeAnchor, reanchor, type Anchor } from 'logos/comments/model';
import { flatText } from '../comments/anchors';
import type { Block } from './model';

export interface ExcerptData {
  text: string;
  anchor: Anchor;
}

export function excerptFromSelection(editor: Editor): ExcerptData | null {
  const { from, to, empty } = editor.state.selection;
  if (empty) return null;
  const text = editor.state.doc.textBetween(from, to, '\n', ' ').trim();
  if (!text) return null;
  return { text, anchor: makeAnchor(flatText(editor.state.doc), from, to, 'text') };
}

/** Dove sta oggi nel testo il punto da cui viene un estratto (null se il testo non c'e' piu'). */
export function excerptRange(editor: Editor, anchor: Anchor): { from: number; to: number } | null {
  return reanchor(flatText(editor.state.doc), anchor);
}

export function scrollToExcerpt(editor: Editor, anchor: Anchor): boolean {
  const r = excerptRange(editor, anchor);
  if (!r) return false;
  editor.chain().focus().setTextSelection(r).scrollIntoView().run();
  return true;
}

export function dropBlockInText(editor: Editor, json: string, pos?: number) {
  let b: Block;
  try {
    b = JSON.parse(json) as Block;
  } catch {
    return;
  }
  const at = pos ?? editor.state.selection.to;
  const chain = editor.chain().focus();
  if (b.kind === 'image' && b.src) chain.insertContentAt(at, { type: 'figure', attrs: { src: b.src, caption: b.text } }).run();
  else if (b.kind === 'link' && b.url) chain.insertContentAt(at, { type: 'text', text: b.text || b.url, marks: [{ type: 'link', attrs: { href: b.url } }] }).run();
  else if (b.text.trim()) {
    const paras = b.text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] }));
    chain.insertContentAt(at, paras).run();
  }
}

/** Blocchi ancorati al paragrafo dove sta il cursore (per illuminarli nella vista Entrambi). */
export function blocksAtCursor(editor: Editor, blocks: Block[]): Set<string> {
  const $pos = editor.state.selection.$from;
  const start = $pos.start($pos.depth);
  const end = $pos.end($pos.depth);
  const out = new Set<string>();
  const flat = flatText(editor.state.doc);
  for (const b of blocks) {
    if (b.kind !== 'excerpt' || !b.anchor) continue;
    const r = reanchor(flat, b.anchor);
    if (r && r.from <= end && r.to >= start) out.add(b.id);
  }
  return out;
}
