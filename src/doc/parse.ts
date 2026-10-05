// Markdown -> albero del documento. Markdown di Pandoc/GFM con le estensioni di Alexandria:
// citazioni [@chiave], [[wikilink]], note [^n], formule $...$, figure ![..](..){attr},
// e commenti HTML per interruzioni di pagina, sezioni, sommario e bibliografia.
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import type * as M from 'mdast';
import type { PMNode, PMMark, MarkType } from './types';
import { CITATION_RE, WIKILINK_RE, parseCitation } from './citeSyntax';
import { serializeMarkdown } from './serialize';

type Defs = Map<string, { url: string; title?: string | null }>;
type Notes = Map<string, M.FootnoteDefinition>;

interface Ctx {
  defs: Defs;
  notes: Notes;
}

const processor = unified().use(remarkParse).use(remarkGfm, { singleTilde: false }).use(remarkMath);

export function parseMarkdown(md: string): PMNode {
  const tree = processor.parse(md.replace(/\r\n?/g, '\n')) as M.Root;
  const ctx: Ctx = { defs: new Map(), notes: new Map() };
  for (const n of tree.children) {
    if (n.type === 'definition') ctx.defs.set(n.identifier, { url: n.url, title: n.title });
    if (n.type === 'footnoteDefinition') ctx.notes.set(n.identifier, n);
  }
  const content = blocks(tree.children, ctx);
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

// ---------------------------------------------------------------- blocchi

const HTML_COMMENT = /^<!--\s*([\s\S]*?)\s*-->$/;

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s}]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
  return out;
}

function blocks(nodes: M.RootContent[], ctx: Ctx): PMNode[] {
  const out: PMNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.type === 'html') {
      const c = HTML_COMMENT.exec(n.value.trim());
      if (c && c[1] === 'bibliography:start') {
        // tutto fino a bibliography:end diventa il blocco bibliografia, modificabile
        const inner: M.RootContent[] = [];
        let j = i + 1;
        for (; j < nodes.length; j++) {
          const e = nodes[j];
          if (e.type === 'html' && HTML_COMMENT.exec(e.value.trim())?.[1] === 'bibliography:end') break;
          inner.push(e);
        }
        i = j;
        const content = blocks(inner, ctx);
        out.push({ type: 'bibliography', content: content.length ? content : [{ type: 'paragraph' }] });
        continue;
      }
    }
    out.push(...block(n, ctx));
  }
  return out;
}

function block(n: M.RootContent, ctx: Ctx): PMNode[] {
  switch (n.type) {
    case 'heading':
      return [withAlign({ type: 'heading', attrs: { level: n.depth }, content: inlines(n.children, ctx) })];
    case 'paragraph':
      return paragraph(n, ctx);
    case 'blockquote':
      return [{ type: 'blockquote', content: nonEmpty(blocks(n.children, ctx)) }];
    case 'list':
      return [list(n, ctx)];
    case 'code':
      return [
        {
          type: 'codeBlock',
          attrs: { language: n.lang ?? null },
          content: n.value ? [{ type: 'text', text: n.value }] : undefined,
        },
      ];
    case 'thematicBreak':
      return [{ type: 'horizontalRule' }];
    case 'math':
      return [{ type: 'mathBlock', attrs: { latex: n.value } }];
    case 'table':
      return [table(n, ctx)];
    case 'html':
      return htmlBlock(n.value);
    case 'definition':
    case 'footnoteDefinition':
      return [];
    default:
      return [];
  }
}

function htmlBlock(value: string): PMNode[] {
  const c = HTML_COMMENT.exec(value.trim());
  if (c) {
    const body = c[1];
    if (body === 'pagebreak') return [{ type: 'pageBreak' }];
    if (body === 'toc') return [{ type: 'toc' }];
    if (body.startsWith('section')) {
      const a = parseAttrs(body.slice(7));
      return [{ type: 'sectionBreak', attrs: { master: a.master ?? 'body', columns: Number(a.columns ?? 1) || 1 } }];
    }
    if (body === 'bibliography:end') return [];
  }
  return [{ type: 'paragraph', content: [{ type: 'text', text: value }] }];
}

function nonEmpty(content: PMNode[]): PMNode[] {
  return content.length ? content : [{ type: 'paragraph' }];
}

function withAlign(node: PMNode): PMNode {
  // un commento <!-- align:center --> in coda al blocco imposta l'allineamento
  const content = node.content ?? [];
  const last = content[content.length - 1];
  if (last && last.type === 'alignMarker') {
    content.pop();
    const prev = content[content.length - 1];
    if (prev?.type === 'text' && prev.text) {
      prev.text = prev.text.replace(/\s+$/, '');
      if (!prev.text) content.pop();
    }
    node.attrs = { ...(node.attrs ?? {}), textAlign: last.attrs?.align };
  }
  // scarta eventuali altri marcatori
  node.content = content.filter((c) => c.type !== 'alignMarker');
  if (!node.content.length) delete node.content;
  return node;
}

function paragraph(n: M.Paragraph, ctx: Ctx): PMNode[] {
  // Embed: link da solo nel paragrafo seguito da {embed attributi} (scheda con anteprima)
  const kids = n.children;
  if (kids.length === 2 && kids[0].type === 'link' && kids[1].type === 'text') {
    const m = /^\{embed(\s[^}]*)?\}$/.exec(kids[1].value.trim());
    if (m) {
      const a = parseAttrs(m[1] ?? '');
      return [{ type: 'embed', attrs: { url: kids[0].url, title: plain(kids[0].children), resource: a.resource ?? null, image: a.image ?? null } }];
    }
  }
  // Figure: immagine da sola nel paragrafo, eventualmente seguita da {attributi}
  const imgIdx = kids.findIndex((k) => k.type === 'image');
  if (imgIdx >= 0) {
    const img = kids[imgIdx] as M.Image;
    const rest = kids.filter((_, i) => i !== imgIdx);
    const attrText = rest.length === 1 && rest[0].type === 'text' ? rest[0].value.trim() : null;
    const isFigure = rest.length === 0 || (attrText !== null && /^\{[^}]*\}$/.test(attrText) && imgIdx === 0);
    if (isFigure) {
      const a = attrText ? parseAttrs(attrText.slice(1, -1)) : {};
      return [
        {
          type: 'figure',
          attrs: {
            src: img.url,
            caption: img.alt ?? '',
            title: img.title ?? null,
            placement: a.placement ?? 'inline',
            width: a.width ?? null,
          },
        },
      ];
    }
    // immagine in mezzo al testo: si spezza il paragrafo
    const before = kids.slice(0, imgIdx);
    const after = kids.slice(imgIdx + 1);
    const out: PMNode[] = [];
    if (before.length) out.push(...paragraph({ ...n, children: before }, ctx));
    out.push({ type: 'figure', attrs: { src: img.url, caption: img.alt ?? '', title: img.title ?? null, placement: 'inline', width: null } });
    if (after.length) out.push(...paragraph({ ...n, children: after }, ctx));
    return out;
  }
  return [withAlign({ type: 'paragraph', content: inlines(kids, ctx) })];
}

function list(n: M.List, ctx: Ctx): PMNode {
  const isTask = n.children.some((li) => typeof li.checked === 'boolean');
  if (isTask) {
    return {
      type: 'taskList',
      content: n.children.map((li) => ({
        type: 'taskItem',
        attrs: { checked: !!li.checked },
        content: listItemContent(li, ctx),
      })),
    };
  }
  const items = n.children.map((li) => ({ type: 'listItem', content: listItemContent(li, ctx) }));
  return n.ordered
    ? { type: 'orderedList', attrs: { start: n.start ?? 1 }, content: items }
    : { type: 'bulletList', content: items };
}

function listItemContent(li: M.ListItem, ctx: Ctx): PMNode[] {
  const content = blocks(li.children, ctx);
  if (!content.length || content[0].type !== 'paragraph') content.unshift({ type: 'paragraph' });
  return content;
}

function table(n: M.Table, ctx: Ctx): PMNode {
  return {
    type: 'table',
    attrs: { align: (n.align ?? []).map((a) => a ?? null) },
    content: n.children.map((row, r) => ({
      type: 'tableRow',
      content: row.children.map((cell) => ({
        type: r === 0 ? 'tableHeader' : 'tableCell',
        content: [{ type: 'paragraph', content: inlinesOrUndefined(cell.children, ctx) }],
      })),
    })),
  };
}

// ---------------------------------------------------------------- in linea

function inlinesOrUndefined(nodes: M.PhrasingContent[], ctx: Ctx): PMNode[] | undefined {
  const r = inlines(nodes, ctx);
  return r.length ? r : undefined;
}

const HTML_MARKS: Record<string, MarkType> = { u: 'underline', mark: 'highlight', sub: 'subscript', sup: 'superscript' };

function inlines(nodes: M.PhrasingContent[], ctx: Ctx, marks: PMMark[] = []): PMNode[] {
  const out: PMNode[] = [];
  let active = [...marks];
  for (const n of nodes) {
    switch (n.type) {
      case 'text':
        out.push(...textWithSyntax(n.value, active));
        break;
      case 'emphasis':
        out.push(...inlines(n.children, ctx, addMark(active, { type: 'italic' })));
        break;
      case 'strong':
        out.push(...inlines(n.children, ctx, addMark(active, { type: 'bold' })));
        break;
      case 'delete':
        out.push(...inlines(n.children, ctx, addMark(active, { type: 'strike' })));
        break;
      case 'inlineCode':
        out.push(txt(n.value, addMark(active, { type: 'code' })));
        break;
      case 'link':
        out.push(...inlines(n.children, ctx, addMark(active, { type: 'link', attrs: { href: n.url, title: n.title ?? null } })));
        break;
      case 'linkReference': {
        const d = ctx.defs.get(n.identifier);
        if (d) out.push(...inlines(n.children, ctx, addMark(active, { type: 'link', attrs: { href: d.url, title: d.title ?? null } })));
        else out.push(...textWithSyntax(`[${plain(n.children)}]`, active));
        break;
      }
      case 'imageReference':
        out.push(...textWithSyntax(`![${n.alt ?? ''}]`, active));
        break;
      case 'break':
        out.push({ type: 'hardBreak' });
        break;
      case 'inlineMath':
        out.push({ type: 'mathInline', attrs: { latex: n.value } });
        break;
      case 'footnoteReference': {
        const def = ctx.notes.get(n.identifier);
        const body = def ? serializeMarkdown({ type: 'doc', content: blocks(def.children, ctx) }).trim() : '';
        out.push({ type: 'footnote', attrs: { text: body } });
        break;
      }
      case 'html': {
        const v = n.value.trim();
        const tag = /^<(\/?)(u|mark|sub|sup)>$/i.exec(v);
        const align = /^<!--\s*align:(left|center|right|justify)\s*-->$/.exec(v);
        if (tag) {
          const type = HTML_MARKS[tag[2].toLowerCase()];
          active = tag[1] ? active.filter((m) => m.type !== type) : addMark(active, { type });
        } else if (/^<br\s*\/?>$/i.test(v)) {
          out.push({ type: 'hardBreak' });
        } else if (align) {
          out.push({ type: 'alignMarker', attrs: { align: align[1] } });
        } else {
          out.push(txt(n.value, active));
        }
        break;
      }
      case 'image':
        // gestite da paragraph(); qui solo per immagini dentro link o enfasi
        out.push(txt(`![${n.alt ?? ''}](${n.url})`, active));
        break;
      default:
        break;
    }
  }
  return mergeText(out);
}

function addMark(marks: PMMark[], m: PMMark): PMMark[] {
  return [...marks.filter((x) => x.type !== m.type), m];
}

function txt(t: string, marks: PMMark[]): PMNode {
  return marks.length ? { type: 'text', text: t, marks: [...marks] } : { type: 'text', text: t };
}

function plain(nodes: M.PhrasingContent[]): string {
  return nodes.map((n) => ('value' in n ? n.value : 'children' in n ? plain(n.children as M.PhrasingContent[]) : '')).join('');
}

/** Riconosce citazioni e wikilink dentro il testo semplice (non nel codice). */
function textWithSyntax(value: string, marks: PMMark[]): PMNode[] {
  if (marks.some((m) => m.type === 'code')) return [txt(value, marks)];
  type Hit = { start: number; end: number; node: PMNode };
  const hits: Hit[] = [];
  for (const m of value.matchAll(WIKILINK_RE)) {
    hits.push({
      start: m.index!,
      end: m.index! + m[0].length,
      node: { type: 'wikilink', attrs: { target: m[1].trim(), alias: m[2]?.trim() ?? null } },
    });
  }
  for (const m of value.matchAll(CITATION_RE)) {
    const s = m.index!;
    if (hits.some((h) => s < h.end && s + m[0].length > h.start)) continue;
    const items = parseCitation(m[1]);
    if (items) hits.push({ start: s, end: s + m[0].length, node: { type: 'citation', attrs: { items } } });
  }
  if (!hits.length) return [txt(value, marks)];
  hits.sort((a, b) => a.start - b.start);
  const out: PMNode[] = [];
  let pos = 0;
  for (const h of hits) {
    if (h.start > pos) out.push(txt(value.slice(pos, h.start), marks));
    out.push(h.node);
    pos = h.end;
  }
  if (pos < value.length) out.push(txt(value.slice(pos), marks));
  return out;
}

function sameMarks(a?: PMMark[], b?: PMMark[]): boolean {
  const x = a ?? [];
  const y = b ?? [];
  if (x.length !== y.length) return false;
  return x.every((m) => y.some((n) => n.type === m.type && JSON.stringify(n.attrs ?? null) === JSON.stringify(m.attrs ?? null)));
}

function mergeText(nodes: PMNode[]): PMNode[] {
  const out: PMNode[] = [];
  for (const n of nodes) {
    if (n.type === 'text' && !n.text) continue;
    const prev = out[out.length - 1];
    if (prev && prev.type === 'text' && n.type === 'text' && sameMarks(prev.marks, n.marks)) {
      prev.text += n.text!;
    } else {
      out.push(n.type === 'text' ? { ...n } : n);
    }
  }
  return out;
}
