// Documento -> DOCX (Word) con la libreria docx: stili, note, immagini, tabelle, elenchi,
// formato pagina e margini dalle impostazioni, intestazione e numeri di pagina.
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  FootnoteReferenceRun,
  ExternalHyperlink,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  TableOfContents,
  LevelFormat,
  type IRunOptions,
  type ParagraphChild,
} from 'docx';
import type { PMNode, CitationItem } from '../doc/types';
import { parseMarkdown } from '../doc/parse';
import type { ExportContext } from './context';

const MM = 56.6929; // twip per millimetro

interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  superScript?: boolean;
  subScript?: boolean;
  highlight?: boolean;
  code?: boolean;
}

async function svgToPng(svg: string, heightPx: number): Promise<{ data: Uint8Array; w: number; h: number } | null> {
  try {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('svg'));
      img.src = url;
    });
    const scale = 3;
    const ratio = img.width && img.height ? img.width / img.height : 2;
    const h = Math.max(8, heightPx);
    const w = Math.max(8, Math.round(h * ratio));
    const c = document.createElement('canvas');
    c.width = w * scale;
    c.height = h * scale;
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, 'image/png'));
    return blob ? { data: new Uint8Array(await blob.arrayBuffer()), w, h } : null;
  } catch {
    return null;
  }
}

async function imageSize(data: Uint8Array, mime: string): Promise<{ w: number; h: number }> {
  try {
    const bmp = await createImageBitmap(new Blob([data as BlobPart], { type: mime }));
    return { w: bmp.width, h: bmp.height };
  } catch {
    return { w: 400, h: 300 };
  }
}

function imgType(mime: string): 'png' | 'jpg' | 'gif' | 'bmp' {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('bmp')) return 'bmp';
  return 'png';
}

export async function toDocx(doc: PMNode, ctx: ExportContext): Promise<Uint8Array> {
  const L = ctx.settings.layout;
  const textWidthPx = ((L.widthMm - L.marginInnerMm - L.marginOuterMm) / 25.4) * 96;
  const footnotes: Record<number, { children: Paragraph[] }> = {};
  let fnId = 0;
  const fontSize = Math.round(L.styles.body.sizePt * 2);
  const ptPx = (pt: number) => (pt * 96) / 72;

  // formule: PNG preparati prima (operazione asincrona)
  const mathPng = new Map<string, { data: Uint8Array; w: number; h: number }>();
  const collect = async (n: PMNode) => {
    if (n.type === 'mathInline' || n.type === 'mathBlock') {
      const display = n.type === 'mathBlock';
      const latex = String(n.attrs?.latex ?? '');
      const a = ctx.math(latex, display);
      if (a && !mathPng.has(`${display}${latex}`)) {
        const png = await svgToPng(a.svg, Math.round(ptPx(L.styles.body.sizePt) * (a.heightEm + a.depthEm)));
        if (png) mathPng.set(`${display}${latex}`, png);
      }
    }
    for (const c of n.content ?? []) await collect(c);
  };
  await collect(doc);
  const figSizes = new Map<string, { w: number; h: number }>();
  for (const b of doc.content ?? []) {
    if (b.type === 'figure') {
      const img = ctx.image(String(b.attrs?.src ?? ''));
      if (img) figSizes.set(String(b.attrs?.src), await imageSize(img.data, img.mime));
    }
  }

  const run = (text: string, s: RunStyle): TextRun => {
    const o: IRunOptions = {
      text,
      bold: s.bold,
      italics: s.italics,
      strike: s.strike,
      superScript: s.superScript,
      subScript: s.subScript,
      ...(s.underline ? { underline: {} } : {}),
      ...(s.highlight ? { highlight: 'yellow' } : {}),
      ...(s.code ? { font: 'Consolas' } : {}),
    };
    return new TextRun(o);
  };

  const inline = (nodes: PMNode[] = []): ParagraphChild[] => {
    const out: ParagraphChild[] = [];
    for (const n of nodes) {
      const marks = new Set((n.marks ?? []).map((m) => m.type));
      const s: RunStyle = {
        bold: marks.has('bold'),
        italics: marks.has('italic'),
        underline: marks.has('underline'),
        strike: marks.has('strike'),
        superScript: marks.has('superscript'),
        subScript: marks.has('subscript'),
        highlight: marks.has('highlight'),
        code: marks.has('code'),
      };
      const link = n.marks?.find((m) => m.type === 'link');
      let child: ParagraphChild | null = null;
      switch (n.type) {
        case 'text':
          child = run(n.text ?? '', s);
          break;
        case 'hardBreak':
          child = new TextRun({ break: 1 });
          break;
        case 'citation': {
          const c = ctx.cite((n.attrs?.items as CitationItem[]) ?? []);
          if (c.note) {
            fnId++;
            footnotes[fnId] = { children: [new Paragraph({ children: [new TextRun(c.text)] })] };
            child = new FootnoteReferenceRun(fnId);
          } else child = run(c.text, s);
          break;
        }
        case 'footnote': {
          fnId++;
          const d = parseMarkdown(String(n.attrs?.text ?? ''));
          footnotes[fnId] = { children: (d.content ?? []).map((p) => new Paragraph({ children: inline(p.content) })) };
          child = new FootnoteReferenceRun(fnId);
          break;
        }
        case 'wikilink':
          child = run(String(n.attrs?.alias || n.attrs?.target || ''), s);
          break;
        case 'mathInline': {
          const png = mathPng.get(`false${n.attrs?.latex}`);
          child = png
            ? new ImageRun({ type: 'png', data: png.data, transformation: { width: png.w, height: png.h } })
            : run(String(n.attrs?.latex ?? ''), { italics: true });
          break;
        }
        default:
          child = run(n.text ?? '', s);
      }
      out.push(link ? new ExternalHyperlink({ link: String(link.attrs?.href ?? ''), children: [child as TextRun] }) : child);
    }
    return out;
  };

  const align = (a: unknown) =>
    a === 'center' ? AlignmentType.CENTER : a === 'right' ? AlignmentType.RIGHT : a === 'justify' || (!a && L.justify) ? AlignmentType.JUSTIFIED : undefined;

  const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];

  const blocks = (nodes: PMNode[] = [], level = 0, listRef?: string): (Paragraph | Table | TableOfContents)[] => {
    const out: (Paragraph | Table | TableOfContents)[] = [];
    for (const b of nodes) {
      switch (b.type) {
        case 'paragraph':
          out.push(new Paragraph({ children: inline(b.content), alignment: align(b.attrs?.textAlign), ...(listRef ? { numbering: { reference: listRef, level } } : {}) }));
          break;
        case 'heading':
          out.push(new Paragraph({ heading: HEADINGS[Math.min(5, Number(b.attrs?.level ?? 1) - 1)], children: inline(b.content), alignment: align(b.attrs?.textAlign) }));
          break;
        case 'blockquote':
          for (const c of b.content ?? []) {
            if (c.type === 'paragraph') out.push(new Paragraph({ children: inline(c.content), indent: { left: 720, right: 360 } }));
            else out.push(...blocks([c], level));
          }
          break;
        case 'bulletList':
        case 'orderedList':
        case 'taskList':
          for (const it of b.content ?? []) {
            const [first, ...rest] = it.content ?? [];
            const prefix = b.type === 'taskList' ? [new TextRun(it.attrs?.checked ? '☑ ' : '☐ ')] : [];
            if (first) out.push(new Paragraph({ children: [...prefix, ...inline(first.content)], numbering: { reference: b.type === 'orderedList' ? 'ordered' : 'bullets', level } }));
            for (const r of rest) out.push(...blocks([r], level + 1, b.type === 'orderedList' ? 'ordered' : 'bullets'));
          }
          break;
        case 'codeBlock':
          for (const line of (b.content ?? []).map((c) => c.text ?? '').join('').split('\n')) out.push(new Paragraph({ children: [run(line, { code: true })] }));
          break;
        case 'horizontalRule':
          out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('* * *')] }));
          break;
        case 'figure': {
          const img = ctx.image(String(b.attrs?.src ?? ''));
          const size = figSizes.get(String(b.attrs?.src));
          if (img && size && img.mime !== 'image/svg+xml') {
            const pct = b.attrs?.width && String(b.attrs.width).endsWith('%') ? parseFloat(String(b.attrs.width)) / 100 : 1;
            const w = Math.min(textWidthPx * pct, size.w);
            const h = (w / size.w) * size.h;
            out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: imgType(img.mime), data: img.data, transformation: { width: w, height: h } })] }));
          }
          if (b.attrs?.caption) out.push(new Paragraph({ style: 'Caption', alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(b.attrs.caption), italics: true })] }));
          break;
        }
        case 'mathBlock': {
          const png = mathPng.get(`true${b.attrs?.latex}`);
          out.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [png ? new ImageRun({ type: 'png', data: png.data, transformation: { width: png.w, height: png.h } }) : run(String(b.attrs?.latex ?? ''), { italics: true })],
            }),
          );
          break;
        }
        case 'table': {
          const rows = b.content ?? [];
          out.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: rows.map(
                (r, ri) =>
                  new TableRow({
                    tableHeader: ri === 0,
                    children: (r.content ?? []).map(
                      (c) =>
                        new TableCell({
                          children: (c.content ?? []).map((p) => new Paragraph({ children: ri === 0 ? inline(p.content).map((x) => x) : inline(p.content) })),
                        }),
                    ),
                  }),
              ),
            }),
          );
          break;
        }
        case 'pageBreak':
        case 'sectionBreak':
          out.push(new Paragraph({ children: [new PageBreak()] }));
          break;
        case 'toc':
          out.push(new TableOfContents(ctx.lang === 'it' ? 'Indice' : 'Contents', { hyperlink: true, headingStyleRange: '1-3' }));
          break;
        case 'bibliography':
          for (const c of b.content ?? []) {
            if (c.type === 'heading') out.push(...blocks([c]));
            else out.push(new Paragraph({ children: inline(c.content), indent: { left: 720, hanging: 720 } }));
          }
          break;
        default:
          out.push(...blocks(b.content, level));
      }
    }
    return out;
  };

  const children = blocks(doc.content);
  const m = L.masters.body;
  const headerText = m.header.replace('{title}', ctx.title).replace('{author}', ctx.settings.author).replace('{date}', ctx.settings.date).replace(/\{\w+\}/g, '');
  const pageNumberPara = new Paragraph({
    alignment: m.pageNumbers.includes('center') ? AlignmentType.CENTER : AlignmentType.RIGHT,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18 })],
  });
  const d = new Document({
    creator: ctx.settings.author || 'Alexandria',
    title: ctx.title,
    features: { updateFields: true },
    styles: {
      default: {
        document: { run: { font: L.font === 'sans' ? 'Calibri' : 'Libertinus Serif', size: fontSize }, paragraph: { spacing: { line: Math.round(L.leading * 240), after: Math.round(L.styles.body.spaceAfterPt * 20) } } },
      },
    },
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [0, 1, 2, 3].map((lv) => ({ level: lv, format: LevelFormat.BULLET, text: ['•', '◦', '▪', '–'][lv], alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (lv + 1), hanging: 360 } } } })),
        },
        {
          reference: 'ordered',
          levels: [0, 1, 2, 3].map((lv) => ({ level: lv, format: LevelFormat.DECIMAL, text: `%${lv + 1}.`, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (lv + 1), hanging: 360 } } } })),
        },
      ],
    },
    footnotes,
    sections: [
      {
        properties: {
          page: {
            size: { width: Math.round(L.widthMm * MM), height: Math.round(L.heightMm * MM) },
            margin: { top: Math.round(L.marginTopMm * MM), bottom: Math.round(L.marginBottomMm * MM), left: Math.round(L.marginInnerMm * MM), right: Math.round(L.marginOuterMm * MM) },
          },
          lineNumbers: L.lineNumbersInPdf ? { countBy: 1, restart: 'continuous' as never } : undefined,
        },
        headers: headerText ? { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: headerText, size: 18 })] })] }) } : undefined,
        footers: m.pageNumbers !== 'none' ? { default: new Footer({ children: [pageNumberPara] }) } : undefined,
        children,
      },
    ],
  });
  const blob = await Packer.toBlob(d);
  return new Uint8Array(await blob.arrayBuffer());
}
