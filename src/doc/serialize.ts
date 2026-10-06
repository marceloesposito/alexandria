// Albero del documento -> Markdown (Pandoc/GFM). Deve fare il giro completo con parse.ts:
// parse(serialize(doc)) == doc per ogni documento prodotto dall'editor.
import { markColor } from './colors';
import type { PMNode, PMMark, MarkType, CitationItem } from './types';
import { MARK_ORDER } from './types';
import { formatCitation } from './citeSyntax';

interface State {
  notes: string[];
}

export function serializeMarkdown(doc: PMNode): string {
  const st: State = { notes: [] };
  let body = blocks(doc.content ?? [], st, false).replace(/\n{3,}/g, '\n\n').trim();
  if (st.notes.length) {
    body += '\n\n' + st.notes.map((n, i) => `[^${i + 1}]: ${indentRest(n, '    ')}`).join('\n');
  }
  return body ? body + '\n' : '';
}

function indentRest(s: string, pad: string): string {
  return s
    .split('\n')
    .map((l, i) => (i === 0 || !l ? l : pad + l))
    .join('\n');
}

function blocks(nodes: PMNode[], st: State, tight: boolean): string {
  return nodes.map((n) => block(n, st)).filter((s) => s !== null).join(tight ? '\n' : '\n\n');
}

function alignSuffix(n: PMNode): string {
  const a = n.attrs?.textAlign;
  return a && a !== 'left' ? ` <!-- align:${a} -->` : '';
}

function block(n: PMNode, st: State): string {
  switch (n.type) {
    case 'paragraph': {
      const s = inline(n.content ?? [], st);
      return escapeLineStarts(s) + alignSuffix(n);
    }
    case 'heading': {
      const level = Number(n.attrs?.level ?? 1);
      const s = inline(n.content ?? [], st).replace(/\n/g, ' ');
      return '#'.repeat(level) + ' ' + s + alignSuffix(n);
    }
    case 'blockquote':
      return blocks(n.content ?? [], st, false)
        .split('\n')
        .map((l) => (l ? '> ' + l : '>'))
        .join('\n');
    case 'bulletList':
      return listItems(n, st, () => '- ');
    case 'orderedList': {
      const start = Number(n.attrs?.start ?? 1);
      return listItems(n, st, (i) => `${start + i}. `);
    }
    case 'taskList':
      return listItems(n, st, (_, item) => (item.attrs?.checked ? '- [x] ' : '- [ ] '));
    case 'codeBlock': {
      const code = (n.content ?? []).map((c) => c.text ?? '').join('');
      const runs = code.match(/`+/g) ?? [];
      const longest = runs.reduce((m, r) => Math.max(m, r.length), 0);
      const fence = '`'.repeat(Math.max(3, longest + 1));
      return `${fence}${n.attrs?.language ?? ''}\n${code}\n${fence}`;
    }
    case 'horizontalRule':
      return '---';
    case 'figure': {
      const a = n.attrs ?? {};
      const title = a.title ? ` "${String(a.title).replace(/"/g, '\\"')}"` : '';
      const extra: string[] = [];
      if (a.placement && a.placement !== 'inline') extra.push(`placement=${a.placement}`);
      if (a.width) extra.push(`width=${a.width}`);
      const caption = escapeText(String(a.caption ?? '')).replace(/\n/g, ' ');
      return `![${caption}](${encodeUrl(String(a.src ?? ''))}${title})${extra.length ? `{${extra.join(' ')}}` : ''}`;
    }
    case 'embed': {
      const a = n.attrs ?? {};
      const extra = ['embed'];
      if (a.resource) extra.push(`resource=${a.resource}`);
      if (a.image) extra.push(`image="${String(a.image).replace(/"/g, '%22')}"`);
      const url = String(a.url ?? '');
      const title = escapeText(String(a.title || url)).replace(/\n/g, ' ');
      return `[${title}](${encodeUrl(url)}){${extra.join(' ')}}`;
    }
    case 'mathBlock':
      return `$$\n${String(n.attrs?.latex ?? '').trim()}\n$$`;
    case 'table':
      return table(n, st);
    case 'pageBreak':
      return '<!-- pagebreak -->';
    case 'toc':
      return '<!-- toc -->';
    case 'sectionBreak': {
      const a = n.attrs ?? {};
      return `<!-- section master="${a.master ?? 'body'}" columns="${a.columns ?? 1}" -->`;
    }
    case 'bibliography':
      return `<!-- bibliography:start -->\n\n${blocks(n.content ?? [], st, false)}\n\n<!-- bibliography:end -->`;
    default:
      return n.content ? blocks(n.content, st, false) : '';
  }
}

function listItems(n: PMNode, st: State, marker: (i: number, item: PMNode) => string): string {
  const items = n.content ?? [];
  // lista "stretta" se ogni voce e' un solo paragrafo (o paragrafo + sottolista)
  const tight = items.every((it) => {
    const c = it.content ?? [];
    return c.length === 1 || (c.length === 2 && /List$/.test(c[1].type));
  });
  return items
    .map((it, i) => {
      const m = marker(i, it);
      const inner = blocks(it.content ?? [], st, tight);
      const pad = ' '.repeat(m.length);
      return m + indentRest(inner, pad);
    })
    .join(tight ? '\n' : '\n\n');
}

function table(n: PMNode, st: State): string {
  const rows = (n.content ?? []).map((row) =>
    (row.content ?? []).map((cell) =>
      (cell.content ?? [])
        .map((p) => inline(p.content ?? [], st))
        .join('<br>')
        .replace(/\n/g, '<br>')
        .replace(/\|/g, '\\|'),
    ),
  );
  if (!rows.length) return '';
  const cols = Math.max(...rows.map((r) => r.length));
  const align = (n.attrs?.align as (string | null)[] | undefined) ?? [];
  const fmt = (r: string[]) => '| ' + Array.from({ length: cols }, (_, i) => r[i] ?? '').join(' | ') + ' |';
  const sep =
    '| ' +
    Array.from({ length: cols }, (_, i) => {
      const a = align[i];
      return a === 'center' ? ':---:' : a === 'right' ? '---:' : a === 'left' ? ':---' : '---';
    }).join(' | ') +
    ' |';
  return [fmt(rows[0]), sep, ...rows.slice(1).map(fmt)].join('\n');
}

// ---------------------------------------------------------------- in linea

function markKey(m: PMMark): string {
  if (m.type === 'insertion' || m.type === 'deletion') return `${m.type}:${m.attrs?.author ?? ''}:${m.attrs?.date ?? ''}`;
  if (m.type === 'highlight' || m.type === 'textColor') return `${m.type}:${markColor(m) ?? ''}`;
  return m.type === 'link' ? `link:${m.attrs?.href}:${m.attrs?.title ?? ''}` : m.type;
}

const attr = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Revisione tracciata in HTML: <ins data-author="..." data-date="...">...</ins> (anche gli spazi restano dentro). */
function trackTag(m: PMMark, inner: string): string {
  const tag = m.type === 'insertion' ? 'ins' : 'del';
  const a = m.attrs?.author ? ` data-author="${attr(m.attrs.author)}"` : '';
  const d = m.attrs?.date ? ` data-date="${attr(m.attrs.date)}"` : '';
  return `<${tag}${a}${d}>${inner}</${tag}>`;
}

function topMark(n: PMNode, excluded: Set<string>): PMMark | null {
  const ms = (n.marks ?? []).filter((m) => !excluded.has(m.type));
  if (!ms.length) return null;
  ms.sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));
  return ms[0];
}

export function inline(nodes: PMNode[], st: State, excluded: Set<string> = new Set()): string {
  let out = '';
  let i = 0;
  while (i < nodes.length) {
    const n = nodes[i];
    const m = topMark(n, excluded);
    if (!m) {
      out += leaf(n, st, excluded);
      i++;
      continue;
    }
    if (m.type === 'code') {
      // il codice e' sempre il piu' interno: unisce i nodi di testo consecutivi
      let j = i;
      let code = '';
      while (j < nodes.length && nodes[j].type === 'text' && (nodes[j].marks ?? []).some((x) => x.type === 'code')) {
        code += nodes[j].text ?? '';
        j++;
      }
      out += codeSpan(code);
      i = j;
      continue;
    }
    const key = markKey(m);
    let j = i;
    while (j < nodes.length && (nodes[j].marks ?? []).some((x) => markKey(x) === key)) j++;
    const inner = inline(nodes.slice(i, j), st, new Set([...excluded, m.type]));
    out += wrap(m, inner);
    i = j;
  }
  return out;
}

function wrap(m: PMMark, inner: string): string {
  if (m.type === 'insertion' || m.type === 'deletion') return trackTag(m, inner);
  // colori: <mark data-color="..."> e <span data-color="..."> (HTML standard dentro il Markdown)
  const color = markColor(m);
  if (m.type === 'textColor') return color ? `<span data-color="${color}">${inner}</span>` : inner;
  if (m.type === 'highlight' && color) return `<mark data-color="${color}">${inner}</mark>`;
  // gli spazi ai bordi escono dai delimitatori, altrimenti CommonMark non chiude l'enfasi
  const lead = /^\s*/.exec(inner)![0];
  const trail = /\s*$/.exec(inner.slice(lead.length))![0];
  const core = inner.slice(lead.length, inner.length - trail.length);
  if (!core) return inner;
  const d = DELIMS[m.type];
  if (m.type === 'link') {
    const href = String(m.attrs?.href ?? '');
    const title = m.attrs?.title ? ` "${String(m.attrs.title).replace(/"/g, '\\"')}"` : '';
    if (core === escapeText(href) && !title && /^https?:\/\//.test(href)) return `${lead}<${href}>${trail}`;
    return `${lead}[${core}](${encodeUrl(href)}${title})${trail}`;
  }
  return `${lead}${d[0]}${core}${d[1]}${trail}`;
}

const DELIMS: Record<MarkType, [string, string]> = {
  link: ['', ''],
  bold: ['**', '**'],
  italic: ['*', '*'],
  strike: ['~~', '~~'],
  underline: ['<u>', '</u>'],
  highlight: ['<mark>', '</mark>'],
  textColor: ['', ''],
  subscript: ['<sub>', '</sub>'],
  superscript: ['<sup>', '</sup>'],
  code: ['`', '`'],
  insertion: ['<ins>', '</ins>'],
  deletion: ['<del>', '</del>'],
};

function codeSpan(code: string): string {
  const runs = code.match(/`+/g) ?? [];
  const longest = runs.reduce((m, r) => Math.max(m, r.length), 0);
  const ticks = '`'.repeat(longest + 1);
  const pad = code.startsWith('`') || code.endsWith('`') || (code.startsWith(' ') && code.endsWith(' ') && code.trim()) ? ' ' : '';
  return `${ticks}${pad}${code}${pad}${ticks}`;
}

function leaf(n: PMNode, st: State, _excluded: Set<string>): string {
  switch (n.type) {
    case 'text':
      return escapeText(n.text ?? '');
    case 'hardBreak':
      return '\\\n';
    case 'mathInline':
      return `$${String(n.attrs?.latex ?? '').trim()}$`;
    case 'citation':
      return formatCitation((n.attrs?.items as CitationItem[]) ?? []);
    case 'wikilink': {
      const alias = n.attrs?.alias ? `|${n.attrs.alias}` : '';
      return `[[${n.attrs?.target ?? ''}${alias}]]`;
    }
    case 'footnote': {
      st.notes.push(String(n.attrs?.text ?? '').trim());
      return `[^${st.notes.length}]`;
    }
    default:
      return n.text ?? '';
  }
}

export function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/([*_`$~\[\]])/g, '\\$1')
    .replace(/<(?=[a-zA-Z/!?])/g, '\\<')
    .replace(/&(?=#?\w+;)/g, '\\&');
}

function escapeLineStarts(s: string): string {
  return s
    .split('\n')
    .map((line) =>
      line
        .replace(/^[ \t]+/, '')
        .replace(/^([>+-])(?=\s|$)/, '\\$1')
        .replace(/^(#{1,6})/, '\\$1')
        .replace(/^(\d+)([.)])(?=\s|$)/, '$1\\$2')
        .replace(/^(={3,}|-{3,})\s*$/, '\\$1'),
    )
    .join('\n');
}

function encodeUrl(u: string): string {
  return /[\s()<>]/.test(u) ? `<${u.replace(/[<>]/g, encodeURIComponent)}>` : u;
}
