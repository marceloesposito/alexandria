// HTML di citeproc (corsivi, maiuscoletto, apici, link) -> nodi in linea dell'editor.
import type { PMNode, PMMark } from '../doc/types';

export function cslHtmlToInline(html: string): PMNode[] {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const out: PMNode[] = [];
  const walk = (node: Node, marks: PMMark[]) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ');
      if (text) out.push(marks.length ? { type: 'text', text, marks: [...marks] } : { type: 'text', text });
      return;
    }
    if (!(node instanceof Element)) return;
    const tag = node.tagName.toLowerCase();
    const style = node.getAttribute('style') ?? '';
    const next = [...marks];
    if (tag === 'i' || tag === 'em' || /font-style:\s*italic/.test(style)) next.push({ type: 'italic' });
    if (tag === 'b' || tag === 'strong' || /font-weight:\s*bold/.test(style)) next.push({ type: 'bold' });
    if (tag === 'sup') next.push({ type: 'superscript' });
    if (tag === 'sub') next.push({ type: 'subscript' });
    if (tag === 'a' && node.getAttribute('href')) next.push({ type: 'link', attrs: { href: node.getAttribute('href') } });
    const before = out.length;
    node.childNodes.forEach((c) => walk(c, next));
    // il numero a margine degli stili numerici ([1]) e il testo sono due div: uno spazio fra i due
    if (node.classList.contains('csl-left-margin') && out.length > before) out.push({ type: 'text', text: ' ' });
  };
  doc.body.firstChild?.childNodes.forEach((c) => walk(c, []));
  // unione dei testi adiacenti con le stesse marcature, spazi ai bordi tolti
  const merged: PMNode[] = [];
  for (const n of out) {
    const prev = merged[merged.length - 1];
    if (prev && JSON.stringify(prev.marks ?? []) === JSON.stringify(n.marks ?? [])) prev.text = (prev.text ?? '') + (n.text ?? '');
    else merged.push({ ...n });
  }
  if (merged.length) {
    merged[0].text = (merged[0].text ?? '').replace(/^\s+/, '');
    const last = merged[merged.length - 1];
    last.text = (last.text ?? '').replace(/\s+$/, '');
  }
  return merged.filter((n) => n.text);
}
