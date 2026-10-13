// OpenDocument (.odt di LibreOffice e .fodt "piatto") -> albero del documento: titoli, stili dei
// caratteri, elenchi numerati o puntati, tabelle, note, link, immagini, indice.
import { DOMParser, type Element as XmlElement, type Node as XmlNode } from '@xmldom/xmldom';
import type { PMMark, PMNode } from 'logos/doc/types';
import { doc, footnote, heading, noteText, paragraph, table, text, withMark } from './build';

export interface OdtOptions {
  /** figura per un'immagine del pacchetto (es. "Pictures/1.png"), null per lasciarla fuori */
  image?: (href: string, title: string) => { src: string; caption?: string } | null;
}

type El = XmlElement;

interface TextStyle {
  parent?: string;
  marks: PMMark[];
  /** stile di paragrafo: livello di titolo, citazione */
  heading?: number;
  quote?: boolean;
}

interface Ctx {
  styles: Map<string, TextStyle>;
  /** stile di elenco -> per ogni livello (1..10) se e' numerato */
  lists: Map<string, Map<number, boolean>>;
  opts: OdtOptions;
  figures: PMNode[];
}

const children = (el: El | XmlNode): El[] => {
  const out: El[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1) out.push(n as El);
  return out;
};
const qn = (el: El) => el.nodeName;
const at = (el: El, name: string) => el.getAttribute(name) ?? '';

function textProps(el: El): PMMark[] {
  let m: PMMark[] = [];
  const tp = children(el).find((c) => qn(c) === 'style:text-properties');
  if (!tp) return m;
  const w = at(tp, 'fo:font-weight');
  if (w === 'bold' || Number(w) >= 600) m = withMark(m, { type: 'bold' });
  if (/italic|oblique/.test(at(tp, 'fo:font-style'))) m = withMark(m, { type: 'italic' });
  const ul = at(tp, 'style:text-underline-style');
  if (ul && ul !== 'none') m = withMark(m, { type: 'underline' });
  const lt = at(tp, 'style:text-line-through-style');
  if (lt && lt !== 'none') m = withMark(m, { type: 'strike' });
  const pos = at(tp, 'style:text-position');
  if (/^super|^\d/.test(pos) && !/^0/.test(pos)) m = withMark(m, { type: 'superscript' });
  else if (/^sub|^-/.test(pos)) m = withMark(m, { type: 'subscript' });
  return m;
}

const HEADING_NAME = /^(heading|titolo|überschrift|titre|t[ií]tulo)[_ ](?:_20_)?(\d)$/i;

function readStyles(roots: El[], ctx: Ctx) {
  for (const root of roots) {
    const walk = (el: El) => {
      for (const c of children(el)) {
        if (qn(c) === 'style:style') {
          const name = at(c, 'style:name');
          const display = (at(c, 'style:display-name') || name).replace(/_20_/g, ' ');
          const st: TextStyle = { parent: at(c, 'style:parent-style-name') || undefined, marks: textProps(c) };
          const lvl = Number(at(c, 'style:default-outline-level'));
          const m = HEADING_NAME.exec(display.replace(/ /g, '_')) ?? HEADING_NAME.exec(name);
          if (lvl) st.heading = lvl;
          else if (m) st.heading = Number(m[2]);
          else if (/^(title|titolo)$/i.test(display)) st.heading = 1;
          else if (/^(subtitle|sottotitolo)$/i.test(display)) st.heading = 2;
          if (/^(quotations|quote|citazione|citazioni)$/i.test(display)) st.quote = true;
          ctx.styles.set(name, st);
        } else if (qn(c) === 'text:list-style') {
          const levels = new Map<number, boolean>();
          for (const l of children(c)) {
            const n = Number(at(l, 'text:level')) || 1;
            if (qn(l) === 'text:list-level-style-number') levels.set(n, !!at(l, 'style:num-format'));
            else if (qn(l) === 'text:list-level-style-bullet') levels.set(n, false);
          }
          ctx.lists.set(at(c, 'style:name'), levels);
        } else if (['office:automatic-styles', 'office:styles', 'office:master-styles'].includes(qn(c))) walk(c);
      }
    };
    walk(root);
  }
}

/** Proprieta' di uno stile con quelle ereditate dai genitori. */
function resolve(name: string, ctx: Ctx): TextStyle {
  let marks: PMMark[] = [];
  let headingLevel: number | undefined;
  let quote: boolean | undefined;
  const seen = new Set<string>();
  for (let cur: string | undefined = name; cur && !seen.has(cur); ) {
    seen.add(cur);
    const s = ctx.styles.get(cur);
    if (!s) break;
    for (const m of s.marks) marks = withMark(marks, m);
    headingLevel ??= s.heading;
    quote ??= s.quote;
    cur = s.parent;
  }
  return { marks, heading: headingLevel, quote };
}

function inline(node: XmlNode, marks: PMMark[], ctx: Ctx): PMNode[] {
  if (node.nodeType === 3) {
    const s = (node.nodeValue ?? '').replace(/[\r\n\t ]+/g, ' ');
    return s ? [text(s, marks)] : [];
  }
  if (node.nodeType !== 1) return [];
  const el = node as El;
  const all = (m: PMMark[]) => {
    const out: PMNode[] = [];
    for (let c = el.firstChild; c; c = c.nextSibling) out.push(...inline(c, m, ctx));
    return out;
  };
  switch (qn(el)) {
    case 'text:span': {
      let m = marks;
      for (const x of resolve(at(el, 'text:style-name'), ctx).marks) m = withMark(m, x);
      return all(m);
    }
    case 'text:a': {
      const href = at(el, 'xlink:href');
      return href && !href.startsWith('#') ? all(withMark(marks, { type: 'link', attrs: { href, title: null } })) : all(marks);
    }
    case 'text:s':
      // spazi in piu': nell'editor non si vedono, ne basta uno
      return [text(' ', marks)];
    case 'text:tab':
      return [text(' ', marks)];
    case 'text:line-break':
      return [{ type: 'hardBreak' }];
    case 'text:note': {
      const body = children(el).find((c) => qn(c) === 'text:note-body');
      if (!body) return [];
      const parts: PMNode[] = [];
      for (const p of children(body)) {
        if (parts.length) parts.push(text(' ', []));
        parts.push(...inline(p, [], { ...ctx, figures: [] }));
      }
      const t = noteText(parts);
      return t ? [footnote(t)] : [];
    }
    case 'draw:frame': {
      const img = children(el).find((c) => qn(c) === 'draw:image');
      const title = children(el).find((c) => qn(c) === 'svg:title' || qn(c) === 'svg:desc')?.textContent ?? '';
      if (img) {
        const fig = ctx.opts.image?.(at(img, 'xlink:href'), title);
        if (fig) ctx.figures.push({ type: 'figure', attrs: { src: fig.src, caption: fig.caption ?? title, title: null, placement: 'inline', width: null } });
      }
      // la cornice di testo (didascalia) resta nel paragrafo
      const box = children(el).find((c) => qn(c) === 'draw:text-box');
      return box ? children(box).flatMap((c) => inline(c, marks, ctx)) : [];
    }
    case 'text:p':
    case 'text:h':
      return all(marks);
    case 'office:annotation':
    case 'office:annotation-end':
    case 'text:bookmark':
    case 'text:bookmark-start':
    case 'text:bookmark-end':
    case 'text:reference-mark':
    case 'text:change':
    case 'text:change-start':
    case 'text:change-end':
    case 'text:soft-page-break':
    case 'text:sequence-decls':
    case 'svg:title':
    case 'svg:desc':
      return [];
    default:
      return all(marks);
  }
}

function list(el: El, ctx: Ctx, styleName: string, level: number): PMNode | null {
  const name = at(el, 'text:style-name') || styleName;
  const ordered = ctx.lists.get(name)?.get(level) ?? false;
  const items: PMNode[] = [];
  for (const li of children(el)) {
    if (qn(li) !== 'text:list-item' && qn(li) !== 'text:list-header') continue;
    const content: PMNode[] = [];
    for (const c of children(li)) {
      if (qn(c) === 'text:list') {
        const sub = list(c, ctx, name, level + 1);
        if (sub) content.push(sub);
      } else content.push(...blocks([c], ctx).filter((b) => b.type !== 'toc'));
    }
    if (!content.length) continue;
    if (content[0].type !== 'paragraph') content.unshift({ type: 'paragraph' });
    items.push({ type: 'listItem', content });
  }
  if (!items.length) return null;
  return ordered ? { type: 'orderedList', attrs: { start: 1 }, content: items } : { type: 'bulletList', content: items };
}

function tableRows(el: El, ctx: Ctx): PMNode[][][] {
  const rows: PMNode[][][] = [];
  const walk = (e: El) => {
    for (const c of children(e)) {
      if (qn(c) === 'table:table-row') {
        rows.push(
          children(c)
            .filter((cell) => qn(cell) === 'table:table-cell' || qn(cell) === 'table:covered-table-cell')
            .map((cell) => {
              const out: PMNode[] = [];
              for (const b of blocks(children(cell), ctx)) {
                const inl = b.type === 'paragraph' || b.type === 'heading' ? b.content ?? [] : [];
                if (out.length && inl.length) out.push({ type: 'hardBreak' });
                out.push(...inl);
              }
              return out;
            }),
        );
      } else if (['table:table-header-rows', 'table:table-rows', 'table:table-row-group'].includes(qn(c))) walk(c);
    }
  };
  walk(el);
  return rows;
}

function blocks(els: El[], ctx: Ctx): PMNode[] {
  const out: PMNode[] = [];
  let quote: PMNode[] = [];
  const closeQuote = () => {
    if (quote.length) out.push({ type: 'blockquote', content: quote });
    quote = [];
  };
  for (const el of els) {
    switch (qn(el)) {
      case 'text:h':
      case 'text:p': {
        const st = resolve(at(el, 'text:style-name'), ctx);
        const lvl = qn(el) === 'text:h' ? Number(at(el, 'text:outline-level')) || st.heading || 1 : st.heading;
        const nodes = inline(el, st.marks.filter(() => !lvl), ctx);
        const figs = ctx.figures.splice(0);
        if (lvl) {
          closeQuote();
          const h = heading(lvl, nodes);
          if (h) out.push(h);
        } else {
          const p = paragraph(nodes);
          if (p && st.quote) quote.push(p);
          else {
            closeQuote();
            if (p) out.push(p);
          }
        }
        out.push(...figs);
        break;
      }
      case 'text:list': {
        closeQuote();
        const l = list(el, ctx, '', 1);
        if (l) out.push(l);
        break;
      }
      case 'table:table': {
        closeQuote();
        const t = table(tableRows(el, ctx));
        if (t) out.push(t);
        break;
      }
      case 'text:table-of-content':
        closeQuote();
        out.push({ type: 'toc' });
        break;
      case 'text:section':
      case 'text:index-body':
        closeQuote();
        out.push(...blocks(children(el), ctx));
        break;
      default:
        break;
    }
  }
  closeQuote();
  return out;
}

/**
 * `content` e' content.xml (o l'intero .fodt); `styles` e' styles.xml, dove stanno gli stili con nome
 * (Titolo 1, Citazioni...) e gli stili degli elenchi.
 */
export function odtToDoc(content: string, styles: string | null, opts: OdtOptions = {}): PMNode {
  const parser = new DOMParser();
  const c = parser.parseFromString(content, 'text/xml');
  const ctx: Ctx = { styles: new Map(), lists: new Map(), opts, figures: [] };
  const roots = [styles ? parser.parseFromString(styles, 'text/xml').documentElement : null, c.documentElement].filter((r): r is El => !!r);
  readStyles(roots, ctx);
  const body = c.getElementsByTagName('office:text')[0];
  if (!body) return doc([]);
  return doc(blocks(children(body), ctx));
}
