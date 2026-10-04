// Importazione: file trascinati (anche in blocco), link, video, DOI, bibliografie.
// Riconosce il formato, estrae testo e metadati, crea una scheda uniforme per ogni risorsa.
import { platform, baseName } from '../platform';
import { sha256Hex } from '../lib/bytes';
import { useResources } from './store';
import { useWorkspace } from '../state/workspace';
import { detectFile, detectUrl, extOf, MIME_OF } from './detect';
import { extract } from './extract';
import { parsePage, blocksToText } from './html';
import { writeItemFile, writeText, writeArchive, indexResource, type Scope } from './storage';
import { newResourceId, type Resource, type CslItem } from './model';
import { parseBibliography } from '../citations/bib';
import { makeCiteKey } from '../doc/citeSyntax';
import { safeFileName } from '../vault/paths';
import { t } from '../i18n';

export interface InFile {
  name: string;
  data: Uint8Array;
  mime?: string;
}

const toast = (s: string, k: 'info' | 'ok' | 'error' = 'info') => useWorkspace.getState().toast(s, k);

function scope(target: 'vault' | 'library'): Scope | null {
  const st = useResources.getState();
  return target === 'vault' ? st.vault : st.library;
}

function existingBySha(sha: string, target: 'vault' | 'library'): Resource | undefined {
  const st = useResources.getState();
  return (target === 'vault' ? st.resources : st.libraryItems).find((r) => r.meta.sha256 === sha);
}

function blank(kind: Resource['kind'], title: string): Resource {
  return {
    id: newResourceId(),
    kind,
    title,
    csl: null,
    citeKey: null,
    isSource: false,
    tags: [],
    layers: [],
    created: new Date().toISOString(),
    meta: {},
    pins: [],
  };
}

function takenKeys(): Set<string> {
  const st = useResources.getState();
  return new Set([...st.resources, ...st.libraryItems].map((r) => r.citeKey).filter(Boolean) as string[]);
}

/** Risorse "voce bibliografica" da BibTeX/RIS/CSL-JSON: sono fonti per definizione. */
export async function importBibliography(text: string, target: 'vault' | 'library' = 'vault'): Promise<Resource[]> {
  let items: CslItem[];
  try {
    items = parseBibliography(text);
  } catch (e) {
    toast(t('import.bibError', { error: String(e) }), 'error');
    return [];
  }
  const out: Resource[] = [];
  const taken = takenKeys();
  const st = useResources.getState();
  for (const csl of items) {
    const r = blank('reference', csl.title ?? t('import.untitled'));
    const orig = typeof csl['citation-key'] === 'string' ? (csl['citation-key'] as string) : null;
    const fam = csl.author?.[0]?.family ?? csl.author?.[0]?.literal ?? 'anon';
    const year = csl.issued?.['date-parts']?.[0]?.[0];
    r.citeKey = orig && !taken.has(orig) ? orig : makeCiteKey(fam, year as number | undefined, taken);
    taken.add(r.citeKey);
    r.csl = { ...csl };
    delete r.csl['citation-key'];
    delete (r.csl as Record<string, unknown>).id;
    r.isSource = true;
    if (csl.URL) r.url = csl.URL;
    await st.upsert(r, target);
    const s = scope(target);
    if (s) await indexResource(s, r, [csl.title, csl.abstract].filter(Boolean).join('\n'));
    out.push(r);
  }
  return out;
}

export async function importFiles(files: InFile[], target: 'vault' | 'library' = 'vault'): Promise<Resource[]> {
  const st = useResources.getState();
  const s = scope(target);
  if (!s) return [];
  const out: Resource[] = [];
  let skipped = 0;
  const ocrQueue: Resource[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    st.setBusy({ label: f.name, done: i, total: files.length });
    try {
      const kind = detectFile(f.name, f.mime ?? '', f.data.subarray(0, 4096));
      if (kind === 'reference' || (extOf(f.name) === 'json' && /"type"\s*:/.test(new TextDecoder().decode(f.data.subarray(0, 2000))))) {
        out.push(...(await importBibliography(new TextDecoder().decode(f.data), target)));
        continue;
      }
      const sha = await sha256Hex(f.data);
      if (existingBySha(sha, target)) {
        skipped++;
        continue;
      }
      const ex = await extract(kind, f.data, f.name, f.mime ?? MIME_OF[extOf(f.name)] ?? '');
      const r = blank(kind, ex.title ?? f.name);
      const ext = extOf(f.name);
      const fileName = `source${ext ? '.' + ext : ''}`;
      await writeItemFile(s, r.id, fileName, f.data);
      r.file = fileName;
      r.csl = ex.csl;
      r.meta = {
        mime: f.mime || MIME_OF[ext],
        size: f.data.length,
        sha256: sha,
        pages: ex.pages?.length,
      };
      if (ex.thumb) {
        await writeItemFile(s, r.id, 'thumb.webp', ex.thumb);
        r.meta.thumb = 'thumb.webp';
      }
      if (ex.blocks) await writeArchive(s, r.id, ex.blocks);
      await writeText(s, r.id, ex.text);
      await st.upsert(r, target);
      await indexResource(s, r, ex.text);
      if (ex.needsOcr && (kind === 'image' || kind === 'pdf')) ocrQueue.push(r);
      out.push(r);
    } catch (e) {
      toast(t('import.fileError', { name: f.name, error: String(e instanceof Error ? e.message : e) }), 'error');
    }
  }
  st.setBusy(null);
  if (skipped) toast(t('import.duplicates', { n: skipped }), 'info');
  if (out.length) toast(t('import.done', { n: out.length }), 'ok');
  if (ocrQueue.length) void runOcr(ocrQueue, target);
  return out;
}

/** OCR in background: immagini e PDF senza testo diventano cercabili e citabili. */
export async function runOcr(list: Resource[], target: 'vault' | 'library') {
  const s = scope(target);
  if (!s) return;
  const { recognize, ocrPdf } = await import('./ocr');
  for (const r of list) {
    try {
      useResources.getState().setBusy({ label: t('import.ocr', { title: r.title }), done: 0, total: 1 });
      const path = r.file ? `${s.root}/${s.kind === 'vault' ? 'resources' : 'items'}/${r.id}/${r.file}` : null;
      if (!path) continue;
      const bytes = await platform.readBytes(path);
      let text = '';
      if (r.kind === 'pdf') text = (await ocrPdf(bytes)).join('\n\f\n');
      else text = await recognize(new Blob([bytes as BlobPart], { type: r.meta.mime ?? 'image/png' }));
      await writeText(s, r.id, text);
      await indexResource(s, r, text);
      await useResources.getState().update(r.id, { meta: { ...r.meta, ocr: true } });
      const texts = new Map(useResources.getState().texts);
      texts.set(r.id, text);
      useResources.setState({ texts });
    } catch {
      /* OCR non riuscito: la risorsa resta senza testo */
    }
  }
  useResources.getState().setBusy(null);
}

/** File scelti dal disco (finestra di dialogo del sistema). */
export async function importPaths(paths: string[], target: 'vault' | 'library' = 'vault') {
  const files: InFile[] = [];
  for (const p of paths) files.push({ name: baseName(p), data: await platform.readBytes(p) });
  return importFiles(files, target);
}

async function fetchThumb(s: Scope, r: Resource, url: string | undefined) {
  if (!url) return;
  try {
    const res = await platform.fetchUrl(url);
    if (res.status >= 400 || !res.contentType.startsWith('image/')) return;
    const { imageThumb } = await import('./extract');
    const im = await imageThumb(res.body, res.contentType);
    if (im.thumb) {
      await writeItemFile(s, r.id, 'thumb.webp', im.thumb);
      r.meta.thumb = 'thumb.webp';
    }
  } catch {
    /* miniatura facoltativa */
  }
}

/** Metadati CSL di un DOI (negoziazione del contenuto su doi.org). */
export async function lookupDoi(doi: string): Promise<CslItem | null> {
  try {
    const res = await platform.fetchUrl(`https://doi.org/${encodeURI(doi)}`, 'application/vnd.citationstyles.csl+json');
    if (res.status >= 400) return null;
    const j = JSON.parse(new TextDecoder().decode(res.body)) as CslItem;
    delete (j as Record<string, unknown>).id;
    delete (j as Record<string, unknown>).reference;
    return j;
  } catch {
    return null;
  }
}

/** Metadati di un libro da ISBN (Open Library). */
export async function lookupIsbn(isbn: string): Promise<CslItem | null> {
  try {
    const res = await platform.fetchUrl(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    const j = JSON.parse(new TextDecoder().decode(res.body)) as Record<string, { title?: string; authors?: { name: string }[]; publish_date?: string; publishers?: { name: string }[]; number_of_pages?: number }>;
    const b = j[`ISBN:${isbn}`];
    if (!b) return null;
    const { parseName, parseDate } = await import('./html');
    return {
      type: 'book',
      title: b.title,
      author: b.authors?.map((a) => parseName(a.name)),
      issued: parseDate(b.publish_date),
      publisher: b.publishers?.[0]?.name,
      ISBN: isbn,
    };
  } catch {
    return null;
  }
}

export async function importUrls(urls: string[], target: 'vault' | 'library' = 'vault'): Promise<Resource[]> {
  const st = useResources.getState();
  const s = scope(target);
  if (!s) return [];
  const out: Resource[] = [];
  const list = target === 'vault' ? st.resources : st.libraryItems;
  for (let i = 0; i < urls.length; i++) {
    const info = detectUrl(urls[i]);
    if (!info) continue;
    if (list.some((r) => r.url === info.url)) continue;
    st.setBusy({ label: info.url, done: i, total: urls.length });
    try {
      if (/^https:\/\/doi\.org\//.test(info.url)) {
        const doi = info.url.replace('https://doi.org/', '');
        const csl = await lookupDoi(decodeURIComponent(doi));
        if (csl) {
          const r = blank('reference', csl.title ?? doi);
          r.csl = csl;
          r.url = info.url;
          await st.upsert(r, target);
          await st.setSource(r.id, true);
          out.push(r);
          continue;
        }
      }
      if (info.kind === 'youtube') {
        const r = blank('youtube', info.url);
        r.url = info.url;
        r.meta.videoId = info.videoId;
        try {
          const res = await platform.fetchUrl(`https://www.youtube.com/oembed?url=${encodeURIComponent(info.url)}&format=json`);
          const j = JSON.parse(new TextDecoder().decode(res.body)) as { title?: string; author_name?: string; thumbnail_url?: string };
          r.title = j.title ?? r.title;
          r.csl = {
            type: 'motion_picture',
            title: j.title,
            author: j.author_name ? [{ literal: j.author_name }] : undefined,
            URL: info.url,
            'container-title': 'YouTube',
          };
          r.meta.siteName = 'YouTube';
          await fetchThumb(s, r, j.thumbnail_url ?? `https://i.ytimg.com/vi/${info.videoId}/hqdefault.jpg`);
        } catch {
          r.csl = { type: 'motion_picture', URL: info.url, 'container-title': 'YouTube' };
        }
        await st.upsert(r, target);
        out.push(r);
        continue;
      }
      const res = await platform.fetchUrl(info.url);
      if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
      const isHtml = /html/.test(res.contentType) || (info.kind === 'web' && !res.contentType);
      if (!isHtml) {
        // file diretto (pdf, immagine, ...): stesso percorso dei file trascinati
        const name = safeFileName(decodeURIComponent(res.url.split('/').pop() || 'file')) || 'file';
        const made = await importFiles([{ name, data: res.body, mime: res.contentType.split(';')[0] }], target);
        for (const r of made) {
          await st.update(r.id, { url: info.url, csl: { ...(r.csl ?? {}), URL: info.url } });
        }
        out.push(...made);
        continue;
      }
      const page = parsePage(new TextDecoder().decode(res.body), res.url);
      const r = blank('web', page.title);
      r.url = res.url;
      r.csl = page.csl;
      r.meta = { siteName: page.siteName, description: page.description, archived: true, mime: 'text/html' };
      await writeArchive(s, r.id, page.blocks);
      const text = blocksToText(page.blocks);
      await writeText(s, r.id, text);
      await fetchThumb(s, r, page.image);
      await st.upsert(r, target);
      await indexResource(s, r, text);
      out.push(r);
    } catch (e) {
      toast(t('import.urlError', { url: info.url, error: String(e instanceof Error ? e.message : e) }), 'error');
    }
  }
  st.setBusy(null);
  if (out.length) toast(t('import.done', { n: out.length }), 'ok');
  return out;
}

/** Elementi della Library aggiunti al vault: schede leggere che rimandano ai file della Library. */
export async function addFromLibrary(ids: string[], copy = false): Promise<void> {
  const st = useResources.getState();
  const vault = st.vault;
  const lib = st.library;
  if (!vault || !lib) return;
  for (const id of ids) {
    const item = st.libraryItems.find((r) => r.id === id);
    if (!item) continue;
    if (st.resources.some((r) => r.library === id || (r.meta.sha256 && r.meta.sha256 === item.meta.sha256))) continue;
    const r: Resource = { ...item, id: newResourceId(), library: copy ? undefined : id, layers: [], created: new Date().toISOString() };
    if (copy) {
      for (const name of [item.file, item.meta.thumb, 'page.json'].filter(Boolean) as string[]) {
        const src = `${lib.root}/items/${id}/${name}`;
        if (await platform.exists(src)) await platform.copy(src, `${vault.root}/resources/${r.id}/${name}`);
      }
    } else if (item.meta.thumb) {
      await platform.copy(`${lib.root}/items/${id}/${item.meta.thumb}`, `${vault.root}/resources/${r.id}/${item.meta.thumb}`);
    }
    const text = (await platform.exists(`${lib.root}/.text/${id}.txt`)) ? await platform.readText(`${lib.root}/.text/${id}.txt`) : '';
    await writeText(vault, r.id, text);
    await st.upsert(r, 'vault');
    await indexResource(vault, r, text);
  }
}

/** Una risorsa del vault va nella Library (per riusarla in altri progetti). */
export async function sendToLibrary(ids: string[]): Promise<void> {
  const st = useResources.getState();
  const vault = st.vault;
  const lib = st.library;
  if (!vault || !lib) return;
  for (const id of ids) {
    const r = st.resources.find((x) => x.id === id);
    if (!r || r.library) continue;
    if (st.libraryItems.some((x) => x.meta.sha256 && x.meta.sha256 === r.meta.sha256)) continue;
    const item: Resource = { ...r, id: newResourceId(), layers: [], pins: [] };
    for (const name of [r.file, r.meta.thumb, 'page.json'].filter(Boolean) as string[]) {
      const src = `${vault.root}/resources/${r.id}/${name}`;
      if (await platform.exists(src)) await platform.copy(src, `${lib.root}/items/${item.id}/${name}`);
    }
    const text = await st.textOf(r.id);
    await writeText(lib, item.id, text);
    await st.upsert(item, 'library');
    await indexResource(lib, item, text);
  }
  toast(t('library.sent', { n: ids.length }), 'ok');
}
