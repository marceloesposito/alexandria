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

/** File scelti dal dialogo di sistema (app desktop). */
export async function importPathsAndInsert(paths: string[], pos?: number) {
  insertResources(await importPaths(paths, 'vault'), pos);
}
