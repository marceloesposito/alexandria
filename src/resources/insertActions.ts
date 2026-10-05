// Azioni dell'inserimento di risorse nel testo (import nel vault + nodi nel documento).
import { getEditor } from '../state/editorRef';
import { ws } from '../state/workspace';
import { useResources } from './store';
import { importFiles, importUrls, importPaths } from './importer';
import { detectUrl } from './detect';
import { nodeFor, type Classified } from './insert';
import type { Resource } from './model';

/** Mette nel documento una figura o una scheda per ogni risorsa, come blocchi dopo `pos` (o dopo il cursore). */
export function insertResources(list: Resource[], pos?: number) {
  const e = getEditor();
  const docRel = ws().activeDoc;
  if (!e || !docRel || !list.length) return;
  let at = pos ?? e.state.selection.to;
  for (const r of list) {
    const json = nodeFor(r, docRel);
    const node = e.schema.nodes[json.type].create(json.attrs);
    const $p = e.state.doc.resolve(Math.min(at, e.state.doc.content.size));
    // un paragrafo vuoto (quello del menu /) viene sostituito
    const empty = $p.depth > 0 && $p.parent.isTextblock && $p.parent.content.size === 0;
    const tr = empty ? e.state.tr.replaceWith($p.before(1), $p.after(1), node) : e.state.tr.insert($p.depth > 0 ? $p.after(1) : at, node);
    const start = empty ? $p.before(1) : $p.depth > 0 ? $p.after(1) : at;
    e.view.dispatch(tr.scrollIntoView());
    at = start + node.nodeSize;
  }
  e.commands.focus();
}

async function filesToInput(files: File[]) {
  return Promise.all(files.map(async (f) => ({ name: f.name, mime: f.type, data: new Uint8Array(await f.arrayBuffer()) })));
}

/** Risorse del vault che corrispondono ai link (appena importate o gia' presenti). */
function byUrls(urls: string[]): Resource[] {
  const all = useResources.getState().resources;
  return urls
    .map((u) => detectUrl(u)?.url)
    .map((u) => all.find((r) => r.url === u))
    .filter((r): r is Resource => !!r);
}

/** File o link arrivati da fuori: import nel vault e inserimento nel testo. */
export async function importAndInsert(c: Classified, files: File[], pos?: number) {
  if (!c) return;
  if (c.kind === 'files') {
    const made = await importFiles(await filesToInput(files), 'vault');
    insertResources(made, pos);
  } else {
    await importUrls(c.urls, 'vault');
    insertResources(byUrls(c.urls), pos);
  }
}

/** Paragrafo fatto solo del link `url` (quello appena incollato). */
function findLinkParagraph(url: string): { from: number; to: number } | null {
  const e = getEditor();
  let found: { from: number; to: number } | null = null;
  e?.state.doc.descendants((node, pos) => {
    if (found || node.type.name !== 'paragraph' || node.childCount !== 1) return !found;
    const t = node.firstChild!;
    if (t.isText && t.text === url && t.marks.some((m) => m.type.name === 'link' && m.attrs.href === url)) found = { from: pos, to: pos + node.nodeSize };
    return false;
  });
  return found;
}

/** Il link incollato diventa una scheda embed (import della pagina e foto). */
export async function upgradeLinkToEmbed(url: string): Promise<string | null> {
  await importUrls([url], 'vault');
  const r = byUrls([url])[0];
  const e = getEditor();
  const docRel = ws().activeDoc;
  const at = findLinkParagraph(url);
  if (!r || !e || !docRel || !at) return null;
  const json = nodeFor(r, docRel);
  e.view.dispatch(e.state.tr.replaceWith(at.from, at.to, e.schema.nodes[json.type].create(json.attrs)));
  return r.id;
}

/** Ripensamento: la scheda torna a essere un semplice link. */
export function downgradeEmbedToLink(resourceId: string, url: string) {
  const e = getEditor();
  if (!e) return;
  let at: { from: number; to: number; title: string } | null = null;
  e.state.doc.descendants((node, pos) => {
    if (!at && node.type.name === 'embed' && node.attrs.resource === resourceId) at = { from: pos, to: pos + node.nodeSize, title: url };
    return !at;
  });
  if (!at) return;
  const { from, to } = at;
  const p = e.schema.nodes.paragraph.create(null, e.schema.text(url, [e.schema.marks.link.create({ href: url })]));
  e.view.dispatch(e.state.tr.replaceWith(from, to, p));
}

/** File scelti dal dialogo di sistema (app desktop). */
export async function importPathsAndInsert(paths: string[], pos?: number) {
  insertResources(await importPaths(paths, 'vault'), pos);
}
