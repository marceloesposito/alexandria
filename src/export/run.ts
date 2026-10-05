// Esportazione: prepara il contesto (citazioni formattate, immagini lette dal vault, formule
// in SVG) e produce PDF, anteprima, DOCX, HTML, Markdown, testo, LaTeX + BibTeX.
import { platform, joinPath, stripExt, baseName, dirName } from '../platform';
import { useWorkspace } from '../state/workspace';
import { getEditor } from '../state/editorRef';
import { flushSave, currentMarkdown } from '../editor/session';
import { parseMarkdown } from '../doc/parse';
import { serializeMarkdown } from '../doc/serialize';
import type { PMNode, CitationItem } from '../doc/types';
import { useDocSettings } from '../layout/docSettings';
import { useCitations, keysInDoc } from '../citations/store';
import { useResources } from '../resources/store';
import { toBibtex } from '../citations/bib';
import { resolveDocPath } from '../vault/resolve';
import { collectAssets, mathKey, type ExportContext, type ImageAsset, type MathAsset } from './context';
import { toTypst } from './typst';
import { toPlainText } from './plain';
import { toHtml } from './html';
import { toLatex } from './latex';
import { toUtf8 } from '../lib/bytes';
import { getLang, t } from '../i18n';

export type ExportFormat = 'pdf' | 'docx' | 'html' | 'md' | 'txt' | 'tex';

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
const EX_TO_EM = 0.44;

export interface Prepared {
  doc: PMNode;
  ctx: ExportContext;
  images: ImageAsset[];
  math: MathAsset[];
}

export async function prepare(): Promise<Prepared | null> {
  const ws = useWorkspace.getState();
  const editor = getEditor();
  if (!ws.vaultRoot || !ws.activeDoc || !editor) return null;
  await flushSave(editor);
  const doc = parseMarkdown(currentMarkdown(editor));
  const settings = useDocSettings.getState().settings;
  const title = settings.title || ws.docs.find((d) => d.rel === ws.activeDoc)?.title || t('doc.untitled');

  // immagini
  const assets = collectAssets(doc, parseMarkdown);
  const images = new Map<string, ImageAsset>();
  let i = 0;
  for (const src of assets.images) {
    try {
      let data: Uint8Array;
      let ext = (src.split('?')[0].match(/\.(\w+)$/)?.[1] ?? 'png').toLowerCase();
      if (/^https?:/.test(src)) {
        const r = await platform.fetchUrl(src);
        data = r.body;
        ext = r.contentType.split('/')[1]?.replace('jpeg', 'jpg').replace('svg+xml', 'svg') || ext;
      } else data = await platform.readBytes(resolveDocPath(src, ws.vaultRoot, ws.activeDoc));
      images.set(src, { path: `img/${i++}.${ext}`, data, mime: MIME[ext] ?? 'image/png' });
    } catch {
      /* immagine mancante: segnaposto nel PDF */
    }
  }

  // formule
  const math = new Map<string, MathAsset>();
  if (assets.math.length) {
    const { texToSvg } = await import('./math');
    let k = 0;
    for (const m of assets.math) {
      const s = await texToSvg(m.latex, m.display);
      math.set(mathKey(m.latex, m.display), {
        path: `math/${k++}.svg`,
        svg: s.svg,
        widthEm: s.widthEx * EX_TO_EM,
        heightEm: (s.heightEx - s.depthEx) * EX_TO_EM,
        depthEm: s.depthEx * EX_TO_EM,
      });
    }
  }

  // citazioni: motore CSL con l'ordine di comparsa del documento
  let cite = useCitations.getState().engine;
  if (!cite) {
    await useCitations.getState().rebuild();
    cite = useCitations.getState().engine;
  }
  cite?.setOrder(keysInDoc(editor));
  const ctx: ExportContext = {
    settings,
    title,
    lang: settings.citationLocale.startsWith('it') ? 'it' : getLang(),
    cite: (items: CitationItem[]) =>
      cite
        ? { text: cite.cluster(items), note: cite.isNote }
        : { text: `(${items.map((x) => x.key + (x.locator ? ', ' + x.locator : '')).join('; ')})`, note: false },
    image: (src) => images.get(src) ?? null,
    math: (latex, display) => math.get(mathKey(latex, display)) ?? null,
  };
  return { doc, ctx, images: [...images.values()], math: [...math.values()] };
}

function typstFiles(p: Prepared) {
  return [
    ...p.images.map((im) => ({ path: im.path, data: im.data })),
    ...p.math.map((m) => ({ path: m.path, data: toUtf8(m.svg) })),
  ];
}

export async function renderPdf(p: Prepared): Promise<Uint8Array> {
  const out = await platform.typst(toTypst(p.doc, p.ctx), typstFiles(p), 'pdf');
  if (!out.ok || !out.pdf) throw new Error(out.errors.join('\n') || 'Typst');
  return out.pdf;
}

export async function renderPreview(): Promise<{ pages: string[]; errors: string[] }> {
  const p = await prepare();
  if (!p) return { pages: [], errors: [] };
  const out = await platform.typst(toTypst(p.doc, p.ctx), typstFiles(p), 'svg');
  return { pages: out.svgPages ?? [], errors: out.errors };
}

function bibItems(): ({ id: string } & Record<string, unknown>)[] {
  const editor = getEditor();
  const keys = new Set(keysInDoc(editor));
  return useResources
    .getState()
    .resources.filter((r) => r.isSource && r.citeKey && keys.has(r.citeKey))
    .map((r) => ({ ...(r.csl ?? {}), title: r.csl?.title ?? r.title, type: r.csl?.type ?? 'document', id: r.citeKey! }));
}

export const EXTENSIONS: Record<ExportFormat, string> = { pdf: 'pdf', docx: 'docx', html: 'html', md: 'md', txt: 'txt', tex: 'tex' };

/** Esporta nel formato scelto; chiede dove salvare. Restituisce il percorso o null. */
export async function exportTo(format: ExportFormat, target?: string): Promise<string | null> {
  const ws = useWorkspace.getState();
  const p = await prepare();
  if (!p) return null;
  const name = `${p.ctx.title}.${EXTENSIONS[format]}`;
  const path = target ?? (await platform.saveDialog(name, [EXTENSIONS[format]]));
  if (!path) return null;
  try {
    switch (format) {
      case 'pdf':
        await platform.writeBytes(path, await renderPdf(p));
        break;
      case 'docx': {
        const { toDocx } = await import('./docx');
        await platform.writeBytes(path, await toDocx(p.doc, p.ctx));
        break;
      }
      case 'html':
        await platform.writeText(path, toHtml(p.doc, p.ctx));
        break;
      case 'txt':
        await platform.writeText(path, toPlainText(p.doc, p.ctx));
        break;
      case 'md': {
        await platform.writeText(path, serializeMarkdown(p.doc));
        const bib = bibItems();
        if (bib.length) await platform.writeText(`${stripExt(path)}.bib`, toBibtex(bib as never));
        break;
      }
      case 'tex': {
        const bibName = `${stripExt(baseName(path))}.bib`;
        const out = toLatex(p.doc, p.ctx, bibName);
        await platform.writeText(path, out.tex);
        await platform.writeText(joinPath(dirName(path), bibName), toBibtex(bibItems() as never));
        for (const im of out.images) {
          const asset = p.images.find((x) => x === p.ctx.image(im.src));
          if (asset) await platform.writeBytes(joinPath(dirName(path), `${stripExt(bibName)}_files`, im.name), asset.data);
        }
        break;
      }
    }
    ws.toast(t('export.done', { path: baseName(path) }), 'ok');
    return path;
  } catch (e) {
    ws.toast(t('export.error', { error: String(e instanceof Error ? e.message : e) }), 'error');
    return null;
  }
}

/** Stampa: PDF in una cartella temporanea del vault, aperto con il visualizzatore di sistema. */
export async function printDocument() {
  const ws = useWorkspace.getState();
  if (!ws.vaultRoot) return;
  const p = await prepare();
  if (!p) return;
  try {
    const path = joinPath(ws.vaultRoot, '.alexandria-cache', 'print', `${p.ctx.title}.pdf`);
    await platform.writeBytes(path, await renderPdf(p));
    await platform.openPath(path);
  } catch (e) {
    ws.toast(t('export.error', { error: String(e instanceof Error ? e.message : e) }), 'error');
  }
}
