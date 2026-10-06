// Documento -> LaTeX con biblatex (le citazioni restano chiavi, la bibliografia va nel .bib).
import type { PMNode, PMMark, CitationItem } from '../doc/types';
import { MARK_ORDER } from '../doc/types';
import { parseMarkdown } from '../doc/parse';
import { parseLocator } from '../citations/engine';
import type { ExportContext } from './context';
import { BABEL } from '../i18n/writing';

export function escapeTex(s: string): string {
  // il backslash passa da un segnaposto, altrimenti le sue graffe verrebbero escapate
  return s
    .replace(/\\/g, '\u0000')
    .replace(/([#$%&_{}])/g, '\\$1')
    .replace(/\u0000/g, '\\textbackslash{}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/</g, '\\textless{}')
    .replace(/>/g, '\\textgreater{}');
}

const STYLE_MAP: Record<string, string> = {
  apa: 'apa',
  'modern-language-association': 'mla',
  'chicago-author-date': 'chicago-authordate',
  'chicago-notes-bibliography': 'chicago-notes',
  'chicago-shortened-notes-bibliography': 'chicago-notes',
  'harvard-cite-them-right': 'authoryear',
  ieee: 'ieee',
  'elsevier-vancouver': 'vancouver',
  'american-medical-association': 'nejm',
  nature: 'nature',
};

const WRAP: Partial<Record<string, [string, string]>> = {
  bold: ['\\textbf{', '}'],
  italic: ['\\emph{', '}'],
  underline: ['\\underline{', '}'],
  strike: ['\\sout{', '}'],
  highlight: ['\\hl{', '}'],
  subscript: ['\\textsubscript{', '}'],
  superscript: ['\\textsuperscript{', '}'],
  code: ['\\texttt{', '}'],
};

export interface LatexOut {
  tex: string;
  images: { src: string; name: string }[];
}

export function toLatex(doc: PMNode, ctx: ExportContext, bibFile: string): LatexOut {
  const images: { src: string; name: string }[] = [];
  const style = STYLE_MAP[ctx.settings.citationStyle] ?? 'authoryear';
  const note = ctx.settings.citationStyle.includes('notes');

  const cite = (items: CitationItem[]) => {
    const one = (it: CitationItem) => {
      const loc = parseLocator(it.locator);
      const post = loc.locator ? `[${loc.label === 'page' ? 'p.~' : ''}${escapeTex(loc.locator)}]` : loc.suffix ? `[${escapeTex(loc.suffix)}]` : '';
      // biblatex: [postnote] da solo, oppure [prenote][postnote]
      if (!it.prefix) return { pre: '', post, key: it.key };
      return { pre: `[${escapeTex(it.prefix)}]`, post: post || '[]', key: it.key };
    };
    if (items.length === 1) {
      const c = one(items[0]);
      const cmd = items[0].suppressAuthor ? '\\autocite*' : note ? '\\autocite' : '\\parencite';
      return `${cmd}${c.pre}${c.post}{${c.key}}`;
    }
    return `${note ? '\\autocites' : '\\parencites'}${items
      .map((it) => {
        const c = one(it);
        return `${c.pre}${c.post}{${c.key}}`;
      })
      .join('')}`;
  };

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
      if (m.type === 'link') out += `\\href{${String(m.attrs?.href ?? '').replace(/([#%{}\\])/g, '\\$1')}}{${inner}}`;
      else {
        const [a, b] = WRAP[m.type] ?? ['', ''];
        out += a + inner + b;
      }
      i = j;
    }
    return out;
  };

  const leaf = (n: PMNode): string => {
    switch (n.type) {
      case 'text':
        return escapeTex(n.text ?? '');
      case 'hardBreak':
        return '\\\\\n';
      case 'citation':
        return cite((n.attrs?.items as CitationItem[]) ?? []);
      case 'footnote': {
        const d = parseMarkdown(String(n.attrs?.text ?? ''));
        return `\\footnote{${(d.content ?? []).map((p) => inline(p.content)).join(' ')}}`;
      }
      case 'mathInline':
        return `$${n.attrs?.latex ?? ''}$`;
      case 'wikilink':
        return escapeTex(String(n.attrs?.alias || n.attrs?.target || ''));
      default:
        return escapeTex(n.text ?? '');
    }
  };

  const block = (b: PMNode): string => {
    switch (b.type) {
      case 'paragraph': {
        const t = inline(b.content);
        if (b.attrs?.textAlign === 'center') return `\\begin{center}\n${t}\n\\end{center}`;
        if (b.attrs?.textAlign === 'right') return `\\begin{flushright}\n${t}\n\\end{flushright}`;
        return t;
      }
      case 'heading': {
        const cmds = ['section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph', 'subparagraph'];
        return `\\${cmds[Math.min(5, Number(b.attrs?.level ?? 1) - 1)]}{${inline(b.content)}}`;
      }
      case 'blockquote':
        return `\\begin{quote}\n${blocks(b.content)}\n\\end{quote}`;
      case 'bulletList':
      case 'taskList':
        return `\\begin{itemize}\n${(b.content ?? []).map((i) => `\\item${b.type === 'taskList' ? (i.attrs?.checked ? '[$\\boxtimes$]' : '[$\\square$]') : ''} ${blocks(i.content)}`).join('\n')}\n\\end{itemize}`;
      case 'orderedList':
        return `\\begin{enumerate}\n\\setcounter{enumi}{${Number(b.attrs?.start ?? 1) - 1}}\n${(b.content ?? []).map((i) => `\\item ${blocks(i.content)}`).join('\n')}\n\\end{enumerate}`;
      case 'codeBlock':
        return `\\begin{verbatim}\n${(b.content ?? []).map((c) => c.text ?? '').join('')}\n\\end{verbatim}`;
      case 'horizontalRule':
        return '\\begin{center}\\rule{0.3\\linewidth}{0.4pt}\\end{center}';
      case 'figure': {
        const src = String(b.attrs?.src ?? '');
        const name = `img${images.length + 1}${(src.match(/\.\w+$/)?.[0] ?? '.png').toLowerCase()}`;
        images.push({ src, name });
        const w = b.attrs?.width && String(b.attrs.width).endsWith('%') ? `${parseFloat(String(b.attrs.width)) / 100}\\linewidth` : '\\linewidth';
        const pos = b.attrs?.placement === 'top' ? 't' : b.attrs?.placement === 'bottom' ? 'b' : 'htbp';
        return `\\begin{figure}[${pos}]\n\\centering\n\\includegraphics[width=${w}]{${ctxName(name)}}\n${b.attrs?.caption ? `\\caption{${escapeTex(String(b.attrs.caption))}}\n` : ''}\\end{figure}`;
      }
      case 'mathBlock':
        return `\\[\n${b.attrs?.latex ?? ''}\n\\]`;
      case 'table': {
        const rows = b.content ?? [];
        const cols = Math.max(1, ...rows.map((r) => r.content?.length ?? 0));
        const al = (b.attrs?.align as (string | null)[] | undefined) ?? [];
        const spec = Array.from({ length: cols }, (_, i) => (al[i] === 'center' ? 'c' : al[i] === 'right' ? 'r' : 'l')).join(' ');
        const row = (r: PMNode) => (r.content ?? []).map((c) => (c.content ?? []).map((p) => inline(p.content)).join(' ')).join(' & ') + ' \\\\';
        return `\\begin{center}\n\\begin{tabular}{${spec}}\n\\toprule\n${rows[0] ? row(rows[0]) + '\n\\midrule\n' : ''}${rows.slice(1).map(row).join('\n')}\n\\bottomrule\n\\end{tabular}\n\\end{center}`;
      }
      case 'pageBreak':
        return '\\clearpage';
      case 'sectionBreak':
        return Number(b.attrs?.columns) > 1 ? `\\twocolumn` : '\\clearpage';
      case 'toc':
        return '\\tableofcontents';
      case 'bibliography':
        // la bibliografia la genera biblatex dal .bib
        return '\\printbibliography';
      default:
        return blocks(b.content);
    }
  };

  function blocks(nodes: PMNode[] = []): string {
    return nodes.map(block).filter(Boolean).join('\n\n');
  }

  const ctxName = (s: string) => `${bibFile.replace(/\.bib$/, '')}_files/${s}`;
  const L = ctx.settings.layout;
  const babel = BABEL[ctx.lang];
  const hasBib = (doc.content ?? []).some((b) => b.type === 'bibliography');
  const tex = `% Generato da Alexandria
\\documentclass[${Math.round(L.fontSizePt)}pt${L.facingPages ? ',twoside' : ''}${L.columns > 1 ? ',twocolumn' : ''}]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[${babel}]{babel}
\\usepackage{libertine}
\\usepackage{csquotes}
\\usepackage[paperwidth=${L.widthMm}mm,paperheight=${L.heightMm}mm,top=${L.marginTopMm}mm,bottom=${L.marginBottomMm}mm,inner=${L.marginInnerMm}mm,outer=${L.marginOuterMm}mm]{geometry}
\\usepackage{graphicx,booktabs,amsmath,amssymb,ulem,soul}
\\usepackage[hidelinks]{hyperref}
${L.lineNumbersInPdf ? '\\usepackage{lineno}\n\\linenumbers' : ''}
\\usepackage[style=${style},backend=biber]{biblatex}
\\addbibresource{${bibFile}}
\\linespread{${L.leading >= 1.4 ? (L.leading >= 1.9 ? '1.6' : '1.3') : '1.0'}}
\\title{${escapeTex(ctx.title)}}
\\author{${escapeTex(ctx.settings.author)}}
\\date{${escapeTex(ctx.settings.date)}}

\\begin{document}

${blocks(doc.content)}
${hasBib ? '' : '\n\\printbibliography'}

\\end{document}
`;
  return { tex, images };
}
