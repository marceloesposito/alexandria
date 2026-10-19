// Allineamento del paragrafo (o titolo) dove sta il cursore: a sinistra e' quello di base, che nel
// Markdown non si scrive; centro e destra diventano <!-- align:... --> in coda al blocco.
import type { Editor } from '@tiptap/core';
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';

export type TextAlignValue = 'left' | 'center' | 'right';

export const ALIGNS: { id: TextAlignValue; icon: typeof AlignLeft }[] = [
  { id: 'left', icon: AlignLeft },
  { id: 'center', icon: AlignCenter },
  { id: 'right', icon: AlignRight },
];

export function currentAlign(e: Editor | null): TextAlignValue {
  if (!e) return 'left';
  for (const a of ['center', 'right'] as const) if (e.isActive({ textAlign: a })) return a;
  return 'left';
}

export function applyAlign(e: Editor, a: TextAlignValue) {
  const chain = e.chain().focus();
  (a === 'left' ? chain.unsetTextAlign() : chain.setTextAlign(a)).run();
}
