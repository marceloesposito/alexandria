// Documento -> testo semplice: titoli sottolineati, elenchi con trattini, citazioni come testo,
// note numerate raccolte in fondo.
import { calloutHeading } from '../doc/callouts';
import { docTexts } from '../i18n/writing';
import type { PMNode, CitationItem } from '../doc/types';
import { plainText } from '../doc/counts';
import type { ExportContext } from './context';

export function toPlainText(doc: PMNode, ctx: ExportContext): string {
  const notes: string[] = [];
  const inline = (nodes: PMNode[] = []): string =>
    nodes
      .map((n) => {
        if (n.type === 'text') return n.text ?? '';
        if (n.type === 'hardBreak') return '\n';
        if (n.type === 'citation') {
          const c = ctx.cite((n.attrs?.items as CitationItem[]) ?? []);
          if (!c.note) return c.text;
          notes.push(c.text);
          return `[${notes.length}]`;
        }
        if (n.type === 'footnote') {
          notes.push(String(n.attrs?.text ?? '').replace(/[*_`]/g, ''));
          return `[${notes.length}]`;
        }
        if (n.type === 'mathInline') return String(n.attrs?.latex ?? '');
        return plainText(n);
      })
      .join('');

  const block = (b: PMNode, indent = ''): string => {
    switch (b.type) {
      case 'heading': {
        const t = inline(b.content);
        const lvl = Number(b.attrs?.level ?? 1);
        return lvl <= 2 ? `${t}\n${(lvl === 1 ? '=' : '-').repeat(Math.max(3, t.length))}` : t;
      }
      case 'paragraph':
        return indent + inline(b.content).replace(/\n/g, '\n' + indent);
      case 'blockquote':
        return (b.content ?? []).map((c) => block(c, indent + '    ')).join('\n\n');
      case 'callout': {
        const { heading } = calloutHeading(b.attrs?.kind, b.attrs?.title, docTexts(ctx.lang).callouts);
        return [`${indent}[${heading}]`, ...(b.content ?? []).map((c) => block(c, indent + '    '))].join('\n\n');
      }
      case 'bulletList':
      case 'orderedList':
      case 'taskList':
        return (b.content ?? [])
          .map((it, i) => {
            const marker =
              b.type === 'orderedList' ? `${Number(b.attrs?.start ?? 1) + i}. ` : b.type === 'taskList' ? (it.attrs?.checked ? '[x] ' : '[ ] ') : '- ';
            const inner = (it.content ?? []).map((c) => block(c, indent + '  ')).join('\n').replace(/^\s+/, '');
            return indent + marker + inner;
          })
          .join('\n');
      case 'codeBlock':
        return (b.content ?? []).map((c) => c.text ?? '').join('').replace(/^/gm, indent + '    ');
      case 'horizontalRule':
        return '* * *';
      case 'figure':
        return `[${b.attrs?.caption || b.attrs?.src}]`;
      case 'mathBlock':
        return `    ${b.attrs?.latex ?? ''}`;
      case 'table':
        return (b.content ?? []).map((r) => (r.content ?? []).map((c) => inline(c.content?.[0]?.content)).join('\t')).join('\n');
      case 'pageBreak':
        return '\f';
      case 'sectionBreak':
      case 'toc':
        return '';
      case 'bibliography':
        return (b.content ?? []).map((c) => block(c)).join('\n\n');
      default:
        return (b.content ?? []).map((c) => block(c, indent)).join('\n\n');
    }
  };

  let out = (doc.content ?? [])
    .map((b) => block(b))
    .filter((s) => s !== '')
    .join('\n\n');
  if (notes.length) out += `\n\n${'_'.repeat(20)}\n` + notes.map((t, i) => `[${i + 1}] ${t}`).join('\n');
  return out.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
