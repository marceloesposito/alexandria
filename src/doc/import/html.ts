// HTML -> albero del documento. Serve per Word (.docx, via mammoth), le pagine HTML esportate da altre
// app (Google Docs, LibreOffice, Pages) e i capitoli degli EPUB. Funzione pura su un DOM gia' letto:
// usa solo l'interfaccia comune a browser, jsdom e xmldom.
import type { PMMark, PMNode } from 'logos/doc/types';
import { doc, footnote, heading, noteText, paragraph, table, text, withMark } from './build';

export interface HtmlOptions {
  /** figura per un'immagine (src com'e' nell'HTML), null per lasciarla fuori */
  image?: (src: string, alt: string) => { src: string; caption?: string } | null;
}

/** Il minimo di DOM che serve qui (Element di browser, jsdom e xmldom). */
interface El {
  nodeType: number;
  nodeName: string;
  localName?: string | null;
  childNodes: ArrayLike<El>;
  textContent: string | null;
  nodeValue?: string | null;
  parentNode?: El | null;
  getAttribute?(name: string): string | null;
}

const name = (e: El) => (e.localName ?? e.nodeName).toLowerCase();
const attr = (e: El, a: string) => (e.getAttribute ? e.getAttribute(a) : null) ?? '';
const kids = (e: El) => Array.from(e.childNodes);
const isEl = (e: El) => e.nodeType === 1;

const SKIP = new Set(['head', 'script', 'style', 'title', 'meta', 'link', 'noscript', 'template', 'svg', 'math', 'button', 'input', 'select', 'nav']);
const BLOCK = new Set([
  'p', 'div', 'section', 'article', 'main', 'header', 'footer', 'aside', 'body', 'html', 'center',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'blockquote', 'pre', 'hr',
  'table', 'figure', 'figcaption', 'address', 'details', 'summary',
]);

interface Ctx {
  opts: HtmlOptions;
  byId: Map<string, El>;
  /** contenitori delle note (gia' diventate note a pie' di pagina): non si ripetono nel testo */
  consumed: Set<El>;
  /** immagini incontrate dentro un paragrafo: vanno come figure subito dopo */
  figures: PMNode[];
}

/** Marcature dallo stile in linea (Google Docs e LibreOffice formattano con <span style>). */
function styleMarks(e: El, marks: PMMark[]): PMMark[] {
  const st = attr(e, 'style').toLowerCase();
  if (!st) return marks;
  let m = marks;
  const w = /font-weight\s*:\s*(\w+)/.exec(st)?.[1];
  if (w === 'bold' || w === 'bolder' || (w && Number(w) >= 600)) m = withMark(m, { type: 'bold' });
  if (/font-style\s*:\s*(italic|oblique)/.test(st)) m = withMark(m, { type: 'italic' });
  if (/text-decoration[^;]*underline/.test(st)) m = withMark(m, { type: 'underline' });
  if (/text-decoration[^;]*line-through/.test(st)) m = withMark(m, { type: 'strike' });
  if (/vertical-align\s*:\s*super/.test(st)) m = withMark(m, { type: 'superscript' });
  if (/vertical-align\s*:\s*sub/.test(st)) m = withMark(m, { type: 'subscript' });
  return m;
}

/** Testo del link al ritorno dalla nota ("↑", "[1]"): non fa parte della nota. */
function isBackLink(a: El, refIds: Set<string>): boolean {
  const href = attr(a, 'href');
  return href.startsWith('#') && refIds.has(href.slice(1));
}

/**
 * Nota a pie' di pagina dietro un link "#id": il bersaglio (o il suo paragrafo/voce) deve tornare
 * al punto di richiamo con un link. Cosi' si riconoscono le note di mammoth, Google Docs, LibreOffice.
 */
function noteFor(a: El, ctx: Ctx): El | null {
  const href = attr(a, 'href');
  if (!href.startsWith('#') || href.length < 2) return null;
  let target = ctx.byId.get(href.slice(1));
  if (!target) return null;
  // l'id puo' stare sull'ancora dentro il paragrafo della nota: si sale al contenitore
  while (target && !['li', 'p', 'div', 'aside', 'section', 'dd'].includes(name(target))) target = target.parentNode ?? undefined;
  if (!target) return null;
  // id del richiamo: sul link stesso o sul <sup> che lo contiene
  const ids = new Set<string>();
  for (let e: El | null | undefined = a; e && ids.size < 3; e = e.parentNode) {
    const id = attr(e, 'id');
    if (id) ids.add(id);
    if (name(e) !== 'sup' && name(e) !== 'a' && name(e) !== 'span') break;
  }
  if (!ids.size) return null;
  let back = false;
  const walk = (e: El) => {
    if (back) return;
    if (isEl(e) && name(e) === 'a' && isBackLink(e, ids)) back = true;
    kids(e).forEach(walk);
  };
  walk(target);
  return back ? target : null;
}

function noteBody(container: El, ctx: Ctx): string {
  const refIds = new Set<string>();
  // i link di ritorno puntano a un id del testo: si riconoscono perche' il bersaglio non e' nella nota
  const inside = new Set<El>();
  const mark = (e: El) => {
    inside.add(e);
    kids(e).forEach(mark);
  };
  mark(container);
  const collect = (e: El) => {
    if (isEl(e) && name(e) === 'a') {
      const h = attr(e, 'href');
      const t = h.startsWith('#') ? ctx.byId.get(h.slice(1)) : undefined;
      if (t && !inside.has(t)) refIds.add(h.slice(1));
    }
    kids(e).forEach(collect);
  };
  collect(container);
  const local: Ctx = { ...ctx, figures: [] };
  const parts: PMNode[] = [];
  const walk = (e: El, marks: PMMark[]) => {
    for (const c of kids(e)) {
      if (isEl(c) && name(c) === 'a' && isBackLink(c, refIds)) continue;
      if (isEl(c) && BLOCK.has(name(c))) {
        if (parts.length) parts.push(text(' ', []));
        walk(c, marks);
      } else parts.push(...inline(c, marks, local));
    }
  };
  walk(container, []);
  // il numero ripetuto all'inizio ("1.", "[1]") non serve: la numerazione la fa l'app
  const first = parts.find((p) => p.type === 'text' && p.text!.trim());
  if (first) first.text = first.text!.replace(/^\s*\[?\d+[\].)]?\s+/, '');
  return noteText(parts);
}

function inline(e: El, marks: PMMark[], ctx: Ctx): PMNode[] {
  if (e.nodeType === 3) {
    const s = (e.nodeValue ?? '').replace(/[\s​]+/g, (m) => (/[\r\n\t ]/.test(m) ? ' ' : '')).replace(/­/g, '');
    return s ? [text(s, marks)] : [];
  }
  if (!isEl(e)) return [];
  const n = name(e);
  if (SKIP.has(n)) return [];
  const all = (m: PMMark[]) => kids(e).flatMap((c) => inline(c, m, ctx));
  const m = styleMarks(e, marks);
  switch (n) {
    case 'br':
      return [{ type: 'hardBreak' }];
    case 'img': {
      const fig = ctx.opts.image?.(attr(e, 'src'), attr(e, 'alt'));
      if (fig) ctx.figures.push({ type: 'figure', attrs: { src: fig.src, caption: fig.caption ?? attr(e, 'alt'), title: null, placement: 'inline', width: null } });
      return [];
    }
    case 'strong':
    case 'b':
      return all(withMark(m, { type: 'bold' }));
    case 'em':
    case 'i':
    case 'cite':
    case 'dfn':
      return all(withMark(m, { type: 'italic' }));
    case 'u':
    case 'ins':
      return all(withMark(m, { type: 'underline' }));
    case 's':
    case 'strike':
    case 'del':
      return all(withMark(m, { type: 'strike' }));
    case 'sup':
      return all(withMark(m, { type: 'superscript' }));
    case 'sub':
      return all(withMark(m, { type: 'subscript' }));
    case 'mark':
      return all(withMark(m, { type: 'highlight' }));
    case 'code':
    case 'kbd':
    case 'samp':
    case 'tt':
      return [text((e.textContent ?? '').replace(/\s+/g, ' '), withMark(m, { type: 'code' }))];
    case 'a': {
      const note = noteFor(e, ctx);
      if (note) {
        ctx.consumed.add(note);
        const body = noteBody(note, ctx);
        return body ? [footnote(body)] : [];
      }
      const href = attr(e, 'href');
      if (!href || href.startsWith('#') || /^javascript:/i.test(href)) return all(m);
      return all(withMark(m, { type: 'link', attrs: { href, title: attr(e, 'title') || null } }));
    }
    default:
      return all(m);
  }
}

function listItems(e: El, ctx: Ctx): PMNode[] {
  return kids(e)
    .filter((c) => isEl(c) && name(c) === 'li' && !ctx.consumed.has(c))
    .map((li) => {
      const content = blocks(li, ctx).filter((b) => b.type !== 'pageBreak');
      if (!content.length || content[0].type !== 'paragraph') content.unshift({ type: 'paragraph' });
      return { type: 'listItem', content };
    });
}

function rowsOf(t: El): El[] {
  const out: El[] = [];
  for (const c of kids(t)) {
    if (!isEl(c)) continue;
    if (name(c) === 'tr') out.push(c);
    else if (['thead', 'tbody', 'tfoot'].includes(name(c))) out.push(...kids(c).filter((r) => isEl(r) && name(r) === 'tr'));
  }
  return out;
}

/** Contenuto di una cella: i suoi paragrafi diventano righe separate da a capo. */
function cellInline(cell: El, ctx: Ctx): PMNode[] {
  const out: PMNode[] = [];
  const add = (nodes: PMNode[]) => {
    if (!nodes.length) return;
    if (out.length) out.push({ type: 'hardBreak' });
    out.push(...nodes);
  };
  const flatten = (b: PMNode) => {
    if (b.type === 'paragraph' || b.type === 'heading') add(b.content ?? []);
    else (b.content ?? []).forEach(flatten);
  };
  blocks(cell, ctx).forEach(flatten);
  return out;
}

/** Blocchi figli di `e`: il testo sparso fra un blocco e l'altro diventa un paragrafo. */
function blocks(e: El, ctx: Ctx): PMNode[] {
  const out: PMNode[] = [];
  let pending: PMNode[] = [];
  const flush = () => {
    const p = paragraph(pending);
    pending = [];
    if (p) out.push(p);
    out.push(...ctx.figures.splice(0));
  };
  for (const c of kids(e)) {
    if (!isEl(c)) {
      pending.push(...inline(c, [], ctx));
      continue;
    }
    const n = name(c);
    if (SKIP.has(n) || ctx.consumed.has(c)) continue;
    if (!BLOCK.has(n) && n !== 'img') {
      pending.push(...inline(c, styleMarks(c, []), ctx));
      continue;
    }
    if (n === 'img') {
      pending.push(...inline(c, [], ctx));
      flush();
      continue;
    }
    flush();
    const style = attr(c, 'style');
    if (/page-break-before\s*:\s*always|break-before\s*:\s*page/i.test(style)) out.push({ type: 'pageBreak' });
    switch (n) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        const h = heading(Number(n[1]), inline(c, [], ctx));
        if (h) out.push(h);
        out.push(...ctx.figures.splice(0));
        break;
      }
      case 'p':
      case 'dt':
      case 'dd':
      case 'figcaption':
      case 'summary':
      case 'address': {
        // un <p> puo' contenere blocchi (HTML scritto male): si tratta come contenitore
        const hasBlocks = kids(c).some((k) => isEl(k) && BLOCK.has(name(k)));
        if (hasBlocks) out.push(...blocks(c, ctx));
        else {
          const p = paragraph(inline(c, styleMarks(c, []), ctx));
          if (p) out.push(p);
          out.push(...ctx.figures.splice(0));
        }
        break;
      }
      case 'ul':
      case 'ol': {
        const items = listItems(c, ctx);
        if (!items.length) break;
        const start = Number(attr(c, 'start')) || 1;
        out.push(n === 'ol' ? { type: 'orderedList', attrs: { start }, content: items } : { type: 'bulletList', content: items });
        break;
      }
      case 'blockquote': {
        const inner = blocks(c, ctx).filter((b) => b.type !== 'pageBreak');
        if (inner.length) out.push({ type: 'blockquote', content: inner });
        break;
      }
      case 'pre': {
        const code = (c.textContent ?? '').replace(/\n$/, '');
        const lang = /language-([\w-]+)/.exec(attr(c, 'class') + ' ' + kids(c).map((k) => attr(k, 'class')).join(' '))?.[1] ?? '';
        if (code.trim()) out.push({ type: 'codeBlock', attrs: { language: lang || null }, content: [{ type: 'text', text: code }] });
        break;
      }
      case 'hr':
        out.push({ type: 'horizontalRule' });
        break;
      case 'table': {
        const t = table(rowsOf(c).map((r) => kids(r).filter((k) => isEl(k) && (name(k) === 'td' || name(k) === 'th')).map((cell) => cellInline(cell, ctx))));
        if (t) out.push(t);
        out.push(...ctx.figures.splice(0));
        break;
      }
      case 'figure': {
        const cap = kids(c).find((k) => isEl(k) && name(k) === 'figcaption');
        const capText = cap ? (cap.textContent ?? '').replace(/\s+/g, ' ').trim() : '';
        const before = ctx.figures.length;
        for (const k of kids(c)) if (k !== cap) inline(k, [], ctx).length;
        const figs = ctx.figures.splice(before);
        if (figs.length && capText) figs[figs.length - 1].attrs = { ...figs[figs.length - 1].attrs, caption: capText };
        out.push(...figs);
        if (!figs.length && capText) out.push({ type: 'paragraph', content: [text(capText, [])] });
        break;
      }
      default:
        // contenitori (div, section, li fuori lista...): si scende
        out.push(...blocks(c, ctx));
    }
  }
  flush();
  return out;
}

/** Corpo HTML (body o un elemento qualsiasi) -> blocchi del documento. */
export function htmlBlocks(root: El, opts: HtmlOptions = {}): PMNode[] {
  const byId = new Map<string, El>();
  const index = (e: El) => {
    if (isEl(e)) {
      const id = attr(e, 'id') || (name(e) === 'a' ? attr(e, 'name') : '');
      if (id && !byId.has(id)) byId.set(id, e);
    }
    kids(e).forEach(index);
  };
  index(root);
  const ctx: Ctx = { opts, byId, consumed: new Set(), figures: [] };
  // prima passata per trovare le note: i loro contenitori non vanno ripetuti nel testo
  blocks(root, { ...ctx, figures: [] });
  const out = blocks(root, { ...ctx, consumed: ctx.consumed, figures: [] });
  // elenchi rimasti vuoti (contenevano solo note) e righe orizzontali in coda (prima delle note)
  while (out[out.length - 1]?.type === 'horizontalRule') out.pop();
  return out;
}

export function htmlToDoc(root: El, opts: HtmlOptions = {}): PMNode {
  return doc(htmlBlocks(root, opts));
}
