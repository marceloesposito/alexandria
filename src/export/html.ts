// Documento -> pagina HTML autonoma (stili inclusi, immagini e formule incorporate, note in fondo).
// Si scrive in un file: tutto il testo dell'utente passa da escapeHtml.
import type { PMNode, PMMark, CitationItem } from '../doc/types';
import { MARK_ORDER } from '../doc/types';
import { parseMarkdown } from '../doc/parse';
import { bytesToBase64 } from '../lib/bytes';
import type { ExportContext } from './context';

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const TAGS: Partial<Record<string, string>> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strike: 's',
  highlight: 'mark',
  subscript: 'sub',
  superscript: 'sup',
  code: 'code',
  insertion: 'ins',
  deletion: 'del',
};

function safeHref(u: string): string {
  return /^(https?:|mailto:|#)/i.test(u) ? u : '#';
}

/** Header con tipo e proprietà, se incluso nell'export. */
function headerHtml(ctx: ExportContext): string {
  const h = ctx.header;
  if (!h || !h.rows.length) return '';
  const style = `margin: 0 0 1.6em; text-align: ${h.align}; font-size: .92em;`;
  if (h.layout === 'table')
    return `<table class="doc-header" style="${style} border: 0;">${h.rows.map((r) => `<tr><th style="border: 0; text-align: left; padding: 1px 1em 1px 0;">${escapeHtml(r.label)}</th><td style="border: 0; padding: 1px 0;">${escapeHtml(r.value)}</td></tr>`).join('')}</table>
`;
  if (h.layout === 'block')
    return `<div class="doc-header" style="${style}">${h.rows.map((r) => `<p><small>${escapeHtml(r.label)}</small><br>${escapeHtml(r.value)}</p>`).join('')}</div>
`;
  return `<p class="doc-header" style="${style}">${h.rows.map((r) => `<strong>${escapeHtml(r.label)}:</strong> ${escapeHtml(r.value)}`).join(' &emsp; ')}</p>
`;
}

export function toHtml(doc: PMNode, ctx: ExportContext): string {
  const notes: string[] = [];
  const L = ctx.settings.layout;

  const inline = (nodes: PMNode[] = [], excluded = new Set<string>()): string => {
    let out = '';
    let i = 0;
    while (i < nodes.length) {
      const n = nodes[i];
      const ms = (n.marks ?? []).filter((m) => !excluded.has(m.type)).sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));
      const m: PMMark | undefined = ms[0];
      if (!m) {
        out += leaf(n);
        i++;
        continue;
      }
      const key = m.type === 'link' ? `link:${m.attrs?.href}` : m.type;
      let j = i;
      while (j < nodes.length && (nodes[j].marks ?? []).some((x) => (x.type === 'link' ? `link:${x.attrs?.href}` : x.type) === key)) j++;
      const inner = inline(nodes.slice(i, j), new Set([...excluded, m.type]));
      out +=
        m.type === 'link'
          ? `<a href="${escapeHtml(safeHref(String(m.attrs?.href ?? '')))}" rel="noreferrer">${inner}</a>`
          : `<${TAGS[m.type]}>${inner}</${TAGS[m.type]}>`;
      i = j;
    }
    return out;
  };

  const note = (html: string) => {
    notes.push(html);
    const k = notes.length;
    return `<sup class="fnref"><a href="#fn${k}" id="fnref${k}">${k}</a></sup>`;
  };

  const leaf = (n: PMNode): string => {
    switch (n.type) {
      case 'text':
        return escapeHtml(n.text ?? '');
      case 'hardBreak':
        return '<br>';
      case 'citation': {
        const c = ctx.cite((n.attrs?.items as CitationItem[]) ?? []);
        return c.note ? note(escapeHtml(c.text)) : `<span class="cite">${escapeHtml(c.text)}</span>`;
      }
      case 'footnote': {
        const d = parseMarkdown(String(n.attrs?.text ?? ''));
        return note((d.content ?? []).map((p) => inline(p.content)).join(' '));
      }
      case 'wikilink':
        return escapeHtml(String(n.attrs?.alias || n.attrs?.target || ''));
      case 'mathInline': {
        const a = ctx.math(String(n.attrs?.latex ?? ''), false);
        return a ? `<span class="math">${a.svg}</span>` : escapeHtml(String(n.attrs?.latex ?? ''));
      }
      default:
        return escapeHtml(n.text ?? '');
    }
  };

  const align = (b: PMNode) => (b.attrs?.textAlign && b.attrs.textAlign !== 'left' ? ` style="text-align:${b.attrs.textAlign}"` : '');

  const block = (b: PMNode): string => {
    switch (b.type) {
      case 'paragraph':
        return `<p${align(b)}>${inline(b.content)}</p>`;
      case 'heading': {
        const l = Math.min(6, Number(b.attrs?.level ?? 1));
        return `<h${l}${align(b)}>${inline(b.content)}</h${l}>`;
      }
      case 'blockquote':
        return `<blockquote>${blocks(b.content)}</blockquote>`;
      case 'bulletList':
        return `<ul>${(b.content ?? []).map((i) => `<li>${blocks(i.content)}</li>`).join('')}</ul>`;
      case 'orderedList':
        return `<ol start="${Number(b.attrs?.start ?? 1)}">${(b.content ?? []).map((i) => `<li>${blocks(i.content)}</li>`).join('')}</ol>`;
      case 'taskList':
        return `<ul class="tasks">${(b.content ?? []).map((i) => `<li><input type="checkbox" disabled${i.attrs?.checked ? ' checked' : ''}> ${blocks(i.content)}</li>`).join('')}</ul>`;
      case 'codeBlock':
        return `<pre><code>${escapeHtml((b.content ?? []).map((c) => c.text ?? '').join(''))}</code></pre>`;
      case 'horizontalRule':
        return '<hr>';
      case 'figure': {
        const img = ctx.image(String(b.attrs?.src ?? ''));
        const src = img ? `data:${img.mime};base64,${bytesToBase64(img.data)}` : '';
        const w = b.attrs?.width ? ` style="width:${escapeHtml(String(b.attrs.width))}"` : '';
        return `<figure><img src="${src}" alt="${escapeHtml(String(b.attrs?.caption ?? ''))}"${w}>${b.attrs?.caption ? `<figcaption>${escapeHtml(String(b.attrs.caption))}</figcaption>` : ''}</figure>`;
      }
      case 'mathBlock': {
        const a = ctx.math(String(b.attrs?.latex ?? ''), true);
        return `<div class="math-block">${a ? a.svg : escapeHtml(String(b.attrs?.latex ?? ''))}</div>`;
      }
      case 'table': {
        const rows = b.content ?? [];
        const cell = (c: PMNode, tag: string) => `<${tag}>${(c.content ?? []).map((p) => inline(p.content)).join('<br>')}</${tag}>`;
        return `<table><thead><tr>${(rows[0]?.content ?? []).map((c) => cell(c, 'th')).join('')}</tr></thead><tbody>${rows
          .slice(1)
          .map((r) => `<tr>${(r.content ?? []).map((c) => cell(c, 'td')).join('')}</tr>`)
          .join('')}</tbody></table>`;
      }
      case 'pageBreak':
        return '<div class="pagebreak"></div>';
      case 'toc': {
        const items: string[] = [];
        (doc.content ?? []).forEach((h) => {
          if (h.type === 'heading') items.push(`<li class="l${h.attrs?.level}">${inline(h.content)}</li>`);
        });
        return `<nav class="toc"><ul>${items.join('')}</ul></nav>`;
      }
      case 'bibliography':
        return `<section class="bibliography">${blocks(b.content)}</section>`;
      case 'sectionBreak':
        return '';
      default:
        return blocks(b.content);
    }
  };

  function blocks(nodes: PMNode[] = []): string {
    return nodes.map(block).join('\n');
  }

  const body = blocks(doc.content);
  const fn = notes.length
    ? `<section class="footnotes"><hr><ol>${notes.map((n, i) => `<li id="fn${i + 1}">${n} <a href="#fnref${i + 1}">↩</a></li>`).join('')}</ol></section>`
    : '';
  const font = L.font === 'sans' ? 'system-ui, sans-serif' : "'Libertinus Serif', Georgia, 'Times New Roman', serif";
  return `<!doctype html>
<html lang="${ctx.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Alexandria">
<title>${escapeHtml(ctx.title)}</title>
<style>
body { font-family: ${font}; font-size: ${L.fontSizePt}pt; line-height: ${L.leading}; max-width: ${Math.round(L.widthMm - L.marginInnerMm - L.marginOuterMm)}mm; margin: 2em auto; padding: 0 1em; color: #1f1c17; background: #fffdf8; ${L.justify ? 'text-align: justify; hyphens: auto;' : ''} }
h1, h2, h3 { line-height: 1.25; text-align: left; }
blockquote { margin: 1em 0; padding-left: 1.2em; border-left: 2px solid #c4bba9; color: #4a453c; }
figure { margin: 1.5em 0; text-align: center; } figure img { max-width: 100%; } figcaption { font-style: italic; font-size: .9em; }
table { border-collapse: collapse; margin: 1em 0; } th, td { border: 1px solid #c4bba9; padding: .3em .6em; }
pre { background: #f3f0e8; padding: .8em; overflow-x: auto; } code { font-size: .9em; }
.math-block { text-align: center; margin: 1em 0; } .math svg { vertical-align: middle; }
.bibliography p { padding-left: 2em; text-indent: -2em; text-align: left; }
.footnotes { font-size: .9em; } .pagebreak { break-after: page; }
.toc ul { list-style: none; padding: 0; } .toc .l2 { padding-left: 1em; } .toc .l3 { padding-left: 2em; }
mark { background: #f3dc8a; } .tasks { list-style: none; padding-left: .2em; }
@media print { body { max-width: none; margin: 0; } }
</style>
</head>
<body>
${headerHtml(ctx)}${body}
${fn}
</body>
</html>
`;
}
