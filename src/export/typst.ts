// Documento -> sorgente Typst. Il testo passa sempre come stringa (#"..."), cosi' nessun
// carattere dell'utente puo' essere interpretato come markup; la formattazione e' fatta
// con chiamate esplicite (#strong, #emph, #footnote...). Le impostazioni di pagina, gli stili
// di paragrafo e le pagine mastro vengono dalle impostazioni del documento.
import { calloutHeading, CALLOUT_HEX } from '../doc/callouts';
import { markColor, TEXT_HEX, HIGHLIGHT_HEX, type TextColor, type HighlightColor } from '../doc/colors';
import type { PMNode, PMMark, CitationItem } from '../doc/types';
import { MARK_ORDER } from '../doc/types';
import { parseMarkdown } from '../doc/parse';
import type { ExportContext } from './context';
import type { LayoutSettings, MasterId, MasterPage, ParaStyle } from '../layout/model';
import { TYPST_FONT, styleFont } from '../layout/model';
import { docTexts } from '../i18n/writing';

/** Stringa Typst sicura. */
export function str(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '').replace(/\t/g, '\\t')}"`;
}

const lit = (s: string) => (s ? `#${str(s)}` : '');

function n(x: number): string {
  return String(Math.round(x * 1000) / 1000);
}

// ---------------------------------------------------------------- in linea

function markKey(m: PMMark): string {
  if (m.type === 'highlight' || m.type === 'textColor') return `${m.type}:${markColor(m) ?? ''}`;
  return m.type === 'link' ? `link:${m.attrs?.href}` : m.type;
}

function topMark(node: PMNode, excluded: Set<string>): PMMark | null {
  const ms = (node.marks ?? []).filter((m) => !excluded.has(m.type));
  if (!ms.length) return null;
  ms.sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));
  return ms[0];
}

const WRAP: Partial<Record<string, string>> = {
  bold: 'strong',
  italic: 'emph',
  underline: 'underline',
  strike: 'strike',
  highlight: 'highlight',
  subscript: 'sub',
  superscript: 'super',
};

export function inline(nodes: PMNode[], ctx: ExportContext, excluded: Set<string> = new Set()): string {
  let out = '';
  let i = 0;
  while (i < nodes.length) {
    const node = nodes[i];
    const m = topMark(node, excluded);
    if (!m) {
      out += leaf(node, ctx);
      i++;
      continue;
    }
    if (m.type === 'code') {
      let j = i;
      let code = '';
      while (j < nodes.length && nodes[j].type === 'text' && (nodes[j].marks ?? []).some((x) => x.type === 'code')) {
        code += nodes[j].text ?? '';
        j++;
      }
      out += `#raw(${str(code)})`;
      i = j;
      continue;
    }
    const key = markKey(m);
    let j = i;
    while (j < nodes.length && (nodes[j].marks ?? []).some((x) => markKey(x) === key)) j++;
    const inner = inline(nodes.slice(i, j), ctx, new Set([...excluded, m.type]));
    if (m.type === 'link') out += `#link(${str(String(m.attrs?.href ?? ''))})[${inner}]`;
    else if (m.type === 'insertion') out += `#text(fill: rgb("#3f7d4e"))[#underline[${inner}]]`;
    else if (m.type === 'deletion') out += `#text(fill: rgb("#a83a2c"))[#strike[${inner}]]`;
    else if (m.type === 'textColor') out += markColor(m) ? `#text(fill: rgb("${TEXT_HEX[markColor(m) as TextColor]}"))[${inner}]` : inner;
    else if (m.type === 'highlight' && markColor(m)) out += `#highlight(fill: rgb("${HIGHLIGHT_HEX[markColor(m) as HighlightColor]}"))[${inner}]`;
    else out += `#${WRAP[m.type] ?? 'box'}[${inner}]`;
    i = j;
  }
  return out;
}

let inNote = 0;

function footnoteBody(md: string, ctx: ExportContext): string {
  const doc = parseMarkdown(md);
  inNote++;
  try {
    return (doc.content ?? [])
      .map((b) => (b.content ? inline(b.content, ctx) : ''))
      .filter(Boolean)
      .join(' #parbreak() ');
  } finally {
    inNote--;
  }
}

function leaf(node: PMNode, ctx: ExportContext): string {
  switch (node.type) {
    case 'text':
      return lit(node.text ?? '');
    case 'hardBreak':
      return '#linebreak()';
    case 'footnote':
      return `#footnote[${footnoteBody(String(node.attrs?.text ?? ''), ctx)}]`;
    case 'citation': {
      const c = ctx.cite((node.attrs?.items as CitationItem[]) ?? [], inNote > 0);
      return c.note ? `#footnote[${lit(c.text)}]` : lit(c.text);
    }
    case 'wikilink':
      return lit(String(node.attrs?.alias || node.attrs?.target || ''));
    case 'mathInline': {
      const a = ctx.math(String(node.attrs?.latex ?? ''), false);
      if (!a) return lit(`$${node.attrs?.latex}$`);
      return `#box(baseline: ${n(a.depthEm)}em, image(${str(a.path)}, height: ${n(a.heightEm)}em))`;
    }
    default:
      return lit(node.text ?? '');
  }
}

// ---------------------------------------------------------------- blocchi

interface State {
  section: number;
  master: MasterId;
  columns: number;
}

function alignName(a: unknown): string | null {
  return a === 'center' ? 'center' : a === 'right' ? 'right' : a === 'justify' ? null : a === 'left' ? 'left' : null;
}

function blocks(nodes: PMNode[], ctx: ExportContext, st: State): string {
  return nodes.map((b) => block(b, ctx, st)).filter((s) => s !== '').join('\n\n');
}

function listItems(items: PMNode[], ctx: ExportContext, st: State, task = false): string {
  return items
    .map((it) => {
      let body = blocks(it.content ?? [], ctx, st);
      if (task) {
        const box = it.attrs?.checked
          ? '#box(width: 0.75em, height: 0.75em, stroke: 0.5pt, inset: 0.05em, align(center + horizon, text(size: 0.7em, sym.checkmark)))'
          : '#box(width: 0.75em, height: 0.75em, stroke: 0.5pt)';
        body = `${box} ${body}`;
      }
      return `[${body}]`;
    })
    .join(', ');
}

function block(b: PMNode, ctx: ExportContext, st: State): string {
  const L = ctx.settings.layout;
  switch (b.type) {
    case 'paragraph': {
      const body = inline(b.content ?? [], ctx);
      if (!body) return '';
      if (b.attrs?.textStyle === 'caption') {
        // stile "didascalia" del layout (corpo, corsivo, allineamento)
        const cs = ctx.settings.layout.styles.caption;
        const a = alignName(b.attrs?.textAlign) ?? alignName(cs.align) ?? 'center';
        return `#align(${a})[#text(size: ${cs.sizePt}pt${cs.italic ? ', style: "italic"' : ''}${fontArg(cs)})[${body}]]`;
      }
      const a = alignName(b.attrs?.textAlign);
      return a ? `#align(${a})[${body}]` : body;
    }
    case 'heading': {
      const lvl = Number(b.attrs?.level ?? 1);
      const h = `#heading(level: ${lvl})[${inline(b.content ?? [], ctx)}]`;
      const a = alignName(b.attrs?.textAlign);
      return a ? `#align(${a})[${h}]` : h;
    }
    case 'blockquote':
      return `#quote(block: true)[${blocks(b.content ?? [], ctx, st)}]`;
    case 'callout': {
      // riquadro evidenziato: fondo chiaro, bordino, intestazione piccola nel colore del tipo
      const { kind, heading } = calloutHeading(b.attrs?.kind, b.attrs?.title, docTexts(ctx.lang).callouts);
      const c = CALLOUT_HEX[kind];
      const head = `#text(size: 0.78em, weight: "bold", tracking: 0.04em, fill: rgb("${c.stroke}"))[#upper[${lit(heading)}]]`;
      return `#block(width: 100%, inset: (x: 10pt, y: 8pt), radius: 3pt, fill: rgb("${c.fill}"), stroke: 0.6pt + rgb("${c.stroke}"))[${head}\n\n${blocks(b.content ?? [], ctx, st)}]`;
    }
    case 'bulletList':
      return `#list(${listItems(b.content ?? [], ctx, st)})`;
    case 'orderedList':
      return `#enum(start: ${Number(b.attrs?.start ?? 1)}, ${listItems(b.content ?? [], ctx, st)})`;
    case 'taskList':
      return `#list(marker: [], ${listItems(b.content ?? [], ctx, st, true)})`;
    case 'codeBlock': {
      const code = (b.content ?? []).map((c) => c.text ?? '').join('');
      const lang = b.attrs?.language ? `, lang: ${str(String(b.attrs.language))}` : '';
      return `#block(fill: luma(245), inset: 8pt, radius: 2pt, width: 100%)[#raw(block: true${lang}, ${str(code)})]`;
    }
    case 'horizontalRule':
      return '#align(center, line(length: 30%, stroke: 0.5pt))';
    case 'figure': {
      const a = b.attrs ?? {};
      const img = ctx.image(String(a.src ?? ''));
      const width = a.width ? `, width: ${String(a.width).replace(/[^\d.%]/g, '') || '100%'}` : ', width: 100%';
      const body = img ? `image(${str(img.path)}${width})` : `box(stroke: 0.5pt, inset: 12pt)[${lit(String(a.src ?? ''))}]`;
      const placement = a.placement === 'top' ? 'top' : a.placement === 'bottom' ? 'bottom' : a.placement === 'full' && st.columns > 1 ? 'auto' : 'none';
      const scope = a.placement === 'full' && st.columns > 1 ? ', scope: "parent"' : '';
      const caption = a.caption ? `, caption: [${lit(String(a.caption))}]` : '';
      return `#figure(${body}${caption}, placement: ${placement}${scope})`;
    }
    case 'mathBlock': {
      const m = ctx.math(String(b.attrs?.latex ?? ''), true);
      if (!m) return `#align(center)[${lit(String(b.attrs?.latex ?? ''))}]`;
      return `#align(center, block(above: 0.8em, below: 0.8em, image(${str(m.path)}, height: ${n(m.heightEm + m.depthEm)}em)))`;
    }
    case 'table': {
      const rows = b.content ?? [];
      const cols = Math.max(1, ...rows.map((r) => r.content?.length ?? 0));
      const al = (b.attrs?.align as (string | null)[] | undefined) ?? [];
      const align = Array.from({ length: cols }, (_, i) => (al[i] === 'center' ? 'center' : al[i] === 'right' ? 'right' : 'left')).join(', ');
      const cell = (c: PMNode) => `[${(c.content ?? []).map((p) => inline(p.content ?? [], ctx)).join(' #linebreak() ')}]`;
      const head = rows[0] ? `table.header(${(rows[0].content ?? []).map((c) => `[#strong${cell(c)}]`).join(', ')}), ` : '';
      const body = rows
        .slice(1)
        .flatMap((r) => (r.content ?? []).map(cell))
        .join(', ');
      return `#table(columns: ${cols}, align: (${align},), stroke: 0.4pt, inset: 5pt, ${head}${body})`;
    }
    case 'pageBreak':
      return '#pagebreak()';
    case 'sectionBreak': {
      st.section++;
      const master = (b.attrs?.master as MasterId) ?? 'body';
      const columns = Number(b.attrs?.columns ?? L.columns) || 1;
      const reset = master !== st.master;
      st.master = master;
      st.columns = columns;
      return pageSetup(ctx, master, columns, st.section, reset);
    }
    case 'toc':
      return `#outline(title: [${lit(docTexts(ctx.lang).toc)}], indent: auto)`;
    case 'bibliography': {
      const inner = (b.content ?? [])
        .map((c) =>
          c.type === 'heading' ? `#heading(level: ${Number(c.attrs?.level ?? 2)}, numbering: none)[${inline(c.content ?? [], ctx)}]` : block(c, ctx, st),
        )
        .join('\n\n');
      return `#block[\n#set par(hanging-indent: 1.5em, first-line-indent: 0em, justify: false)\n\n${inner}\n]`;
    }
    default:
      return b.content ? blocks(b.content, ctx, st) : '';
  }
}

// ---------------------------------------------------------------- pagina

const NUMBERING: Record<MasterPage['numbering'], string> = { '1': '1', i: 'i', I: 'I', a: 'a' };

function templateText(tpl: string, ctx: ExportContext, numbering: string): string {
  const parts = tpl.split(/(\{\w+\})/);
  return parts
    .map((p) => {
      switch (p) {
        case '{title}':
          return lit(ctx.title);
        case '{author}':
          return lit(ctx.settings.author);
        case '{date}':
          return lit(ctx.settings.date);
        case '{page}':
          return `#counter(page).display(${str(numbering)})`;
        case '{pages}':
          return '#counter(page).final().first()';
        case '{chapter}':
          return '#{ let h = query(heading.where(level: 1).before(here())); if h.len() > 0 { h.last().body } }';
        default:
          return lit(p);
      }
    })
    .join('');
}

function pageSetup(ctx: ExportContext, master: MasterId, columns: number, section: number, resetCounter: boolean): string {
  const L = ctx.settings.layout;
  const m = L.masters[master] ?? L.masters.body;
  const numbering = NUMBERING[m.numbering] ?? '1';
  const num = `#counter(page).display(${str(numbering)})`;
  const facing = L.facingPages;
  const outer = (content: string) =>
    facing ? `#if calc.odd(here().page()) [#h(1fr)${content}] else [${content}#h(1fr)]` : `#h(1fr)${content}`;
  const plain = (body: string) =>
    m.firstPagePlain ? `context { if here().page() == locate(<sec-${section}>).page() { none } else [${body}] }` : `context [${body}]`;

  let header = m.header ? templateText(m.header, ctx, numbering) : '';
  if (m.pageNumbers === 'top-outer') header = header ? `${header}${outer(num)}` : outer(num);
  if (m.pageNumbers === 'top-center') header = `#h(1fr)${num}#h(1fr)`;
  let footer = m.footer ? templateText(m.footer, ctx, numbering) : '';
  if (m.pageNumbers === 'bottom-center') footer = footer ? `${footer}#h(1fr)${num}#h(1fr)` : `#h(1fr)${num}#h(1fr)`;
  if (m.pageNumbers === 'bottom-outer') footer = footer ? `${footer}${outer(num)}` : outer(num);

  const hdr = header ? `text(size: 9pt, ${plain(header)})` : 'none';
  // il pie' di pagina con il numero resta anche sulla prima pagina
  const ftr = footer ? `text(size: 9pt, context [${footer}])` : 'none';
  return [
    `#set page(columns: ${columns}, header: ${hdr}, footer: ${ftr})`,
    resetCounter ? '#counter(page).update(1)' : '',
    `#metadata(${section}) <sec-${section}>`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** ", font: (...)" per uno stile con un carattere suo (vuoto se usa quello del documento). */
function fontArg(s: ParaStyle): string {
  return s.font && s.font !== 'inherit' ? `, font: ${TYPST_FONT[s.font]}` : '';
}

function styleRules(selector: string, s: ParaStyle, L: LayoutSettings): string[] {
  const out: string[] = [];
  const text = [`size: ${n(s.sizePt)}pt`];
  if (s.font && s.font !== 'inherit') text.push(`font: ${TYPST_FONT[s.font]}`);
  if (s.weight === 'bold') text.push('weight: "bold"');
  else text.push('weight: "regular"');
  if (s.italic) text.push('style: "italic"');
  out.push(`#show ${selector}: set text(${text.join(', ')})`);
  out.push(`#show ${selector}: set block(above: ${n(s.spaceBeforePt + 4)}pt, below: ${n(s.spaceAfterPt + 4)}pt)`);
  if (s.align !== 'inherit') out.push(`#show ${selector}: set align(${s.align === 'justify' ? 'left' : s.align})`);
  if (s.smallCaps) out.push(`#show ${selector}: smallcaps`);
  if (s.leading !== null) out.push(`#show ${selector}: set par(leading: ${n(Math.max(0.1, s.leading - 1))}em)`);
  void L;
  return out;
}

export function preamble(ctx: ExportContext, hasLeadingSection: boolean): string {
  const s = ctx.settings;
  const L = s.layout;
  const body = L.styles.body;
  const margin = L.facingPages
    ? `(top: ${n(L.marginTopMm)}mm, bottom: ${n(L.marginBottomMm)}mm, inside: ${n(L.marginInnerMm)}mm, outside: ${n(L.marginOuterMm)}mm)`
    : `(top: ${n(L.marginTopMm)}mm, bottom: ${n(L.marginBottomMm)}mm, left: ${n(L.marginInnerMm)}mm, right: ${n(L.marginOuterMm)}mm)`;
  // carattere del corpo: quello dello stile "corpo" se scelto, altrimenti quello del documento
  const font = TYPST_FONT[styleFont(body, L)];
  const lines = [
    `// Generato da Alexandria`,
    `#set document(title: ${str(ctx.title)}${s.author ? `, author: (${str(s.author)},)` : ''})`,
    `#set page(width: ${n(L.widthMm)}mm, height: ${n(L.heightMm)}mm, margin: ${margin}, columns: ${L.columns})`,
    `#set columns(gutter: ${n(L.columnGapMm)}mm)`,
    // riga alta esattamente un em: l'interlinea si legge come in un programma di impaginazione
    `#set text(font: ${font}, size: ${n(body.sizePt)}pt, lang: ${str(ctx.lang)}, hyphenate: ${L.hyphenate}, top-edge: 0.8em, bottom-edge: -0.2em, costs: (widow: ${L.widowsOrphans ? '100%' : '0%'}, orphan: ${L.widowsOrphans ? '100%' : '0%'}))`,
    `#set par(justify: ${L.justify && body.align === 'inherit' ? 'true' : body.align === 'justify' ? 'true' : 'false'}, leading: ${n(Math.max(0.1, (body.leading ?? L.leading) - 1))}em, spacing: ${n(Math.max(0.1, (body.leading ?? L.leading) - 1))}em + ${n(body.spaceAfterPt)}pt, first-line-indent: ${n(body.indentFirstMm)}mm)`,
    body.align !== 'inherit' && body.align !== 'justify' ? `#set align(${body.align})` : '',
    L.headingNumbers ? '#set heading(numbering: "1.1")' : '',
    L.lineNumbersInPdf ? '#set par.line(numbering: "1", number-clearance: 4mm)' : '',
    ...styleRules('heading.where(level: 1)', L.styles.h1, L),
    ...styleRules('heading.where(level: 2)', L.styles.h2, L),
    ...styleRules('heading.where(level: 3)', L.styles.h3, L),
    ...styleRules('quote.where(block: true)', L.styles.quote, L),
    `#show figure.caption: set text(size: ${n(L.styles.caption.sizePt)}pt${L.styles.caption.italic ? ', style: "italic"' : ''}${fontArg(L.styles.caption)})`,
    `#show footnote.entry: set text(size: ${n(L.styles.footnote.sizePt)}pt${fontArg(L.styles.footnote)})`,
    '#show link: underline',
  ];
  if (!hasLeadingSection) lines.push(pageSetup(ctx, 'body', L.columns, 0, false));
  return lines.filter(Boolean).join('\n');
}

/** Header con tipo e proprietà in testa al documento (solo se l'autore l'ha incluso nell'export). */
export function headerBlock(ctx: ExportContext): string {
  const h = ctx.header;
  if (!h || !h.rows.length) return '';
  const al = h.align === 'center' ? 'center' : 'left';
  let inner: string;
  if (h.layout === 'table') {
    const cells = h.rows.map((r) => `[#strong(${str(r.label)})], [${lit(r.value)}]`).join(', ');
    inner = `#table(columns: 2, stroke: none, inset: (x: 0pt, y: 2pt), column-gutter: 1.2em, align: left, ${cells})`;
  } else if (h.layout === 'block') {
    inner = h.rows.map((r) => `#block(below: 0.6em)[#text(size: 0.8em, fill: luma(90))[${lit(r.label)}] \\ ${lit(r.value)}]`).join('\n');
  } else {
    inner = `#text(size: 0.9em)[${h.rows.map((r) => `#strong(${str(r.label + ':')}) ${lit(r.value)}`).join(' #h(1.2em) ')}]`;
  }
  return `#block(width: 100%, below: 1.6em)[#align(${al})[${inner}]]\n\n`;
}

export function toTypst(doc: PMNode, ctx: ExportContext): string {
  const content = doc.content ?? [];
  const leading = content[0]?.type === 'sectionBreak';
  const st: State = { section: 0, master: 'body', columns: ctx.settings.layout.columns };
  // il primo cambio di mastro non va a pagina nuova se apre il documento
  if (leading) st.master = (content[0].attrs?.master as MasterId) ?? 'body';
  const body = blocks(content, ctx, st);
  return `${preamble(ctx, leading)}\n\n${headerBlock(ctx)}${body}\n`;
}
