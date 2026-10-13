// Titolo della pergamena dal suo primo blocco: se e' un titolo di livello 1 (H1), il suo testo.
import type { PMNode } from 'logos/doc/types';

function plainText(n: PMNode): string {
  if (n.type === 'text') return n.text ?? '';
  // le note e le citazioni non fanno parte del titolo
  if (n.type === 'footnote' || n.type === 'citation') return '';
  if (n.type === 'hardBreak') return ' ';
  return (n.content ?? []).map(plainText).join('');
}

export function headingTitle(doc: PMNode): string | null {
  const first = doc.content?.[0];
  if (!first || first.type !== 'heading' || Number(first.attrs?.level ?? 1) !== 1) return null;
  const s = plainText(first).replace(/\s+/g, ' ').trim();
  return s || null;
}
