// Codex del Compendium aperto: elenco (dai legami fra pergamene), impostazioni salvate in
// .alexandria/codices/<radice>.json, riordino e unione delle pergamene per lettura ed export.
import { create } from 'zustand';
import { useResources } from '../resources/store';
import { useWorkspace } from '../state/workspace';
import { readDocument, readJson, writeJson } from '../vault/vault';
import { abs, docKey, docSettingsFile, META_DIR } from '../vault/paths';
import { joinPath } from '../platform';
import { normalizePath } from '../vault/resolve';
import { parseMarkdown } from '../doc/parse';
import { embedsToLinks, type PMNode } from '../doc/types';
import { normalizeDocSettings } from '../layout/model';
import { getLang } from '../i18n';
import { allCodices, codexOrder, relinkAsChain, removeFromCodex, normalizeCodexSettings, type CodexSettings, type CodexInfo } from './model';
import { prepareDoc, keysOfDoc, VAULT_SRC, type Prepared } from '../export/run';

const codexFile = (root: string) => `${META_DIR}/codices/${docKey(root)}.json`;
const newId = () => `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Codex esistenti, solo fra le pergamene che ci sono davvero. */
export function useCodices(): CodexInfo[] {
  const links = useResources((s) => s.links);
  const docs = useWorkspace((s) => s.docs);
  return allCodices(links, new Set(docs.map((d) => d.rel)));
}

interface S {
  settings: Record<string, CodexSettings>;
  /** radice del Codex in lettura continua nello Scriptorium (null = editor normale) */
  reading: string | null;
  load(root: string): Promise<CodexSettings>;
  save(root: string, s: CodexSettings): Promise<void>;
  read(root: string | null): void;
}

export const useCodexStore = create<S>((set, get) => ({
  settings: {},
  reading: null,
  async load(root) {
    const vault = useWorkspace.getState().vaultRoot;
    const title = useWorkspace.getState().docs.find((d) => d.rel === root)?.title ?? 'Codex';
    const s = normalizeCodexSettings(vault ? await readJson<unknown>(abs(vault, codexFile(root)), null) : null, title);
    set({ settings: { ...get().settings, [root]: s } });
    return s;
  },
  async save(root, s) {
    set({ settings: { ...get().settings, [root]: s } });
    const vault = useWorkspace.getState().vaultRoot;
    if (vault) await writeJson(abs(vault, codexFile(root)), s);
  },
  read(root) {
    set({ reading: root });
  },
}));

/** Nuovo ordine del Codex: i legami interni diventano una catena. */
export function reorderCodex(order: string[]) {
  const st = useResources.getState();
  st.replaceRefs(relinkAsChain(st.links, order, newId), st.whiteboard);
}

export function dropFromCodex(order: string[], rel: string) {
  const st = useResources.getState();
  st.replaceRefs(removeFromCodex(st.links, order, rel, newId), st.whiteboard);
}

/** Aggiunge una pergamena in coda al Codex (legame dall'ultima). */
export function appendToCodex(order: string[], rel: string) {
  const last = order[order.length - 1];
  if (!last || order.includes(rel)) return;
  const st = useResources.getState();
  const w = st.whiteboard;
  const have = new Set(w.docs ?? []);
  st.setWhiteboard({ ...w, docs: [...(w.docs ?? []), ...[last, rel].filter((r) => !have.has(r))] });
  st.addLink(`doc:${last}`, `doc:${rel}`);
}

/** Pergamene del Codex nell'ordine di lettura (solo quelle esistenti). */
export function membersOf(root: string): string[] {
  const docs = new Set(useWorkspace.getState().docs.map((d) => d.rel));
  return codexOrder(useResources.getState().links, root).filter((r) => docs.has(r));
}

/** Le immagini relative di una pergamena diventano percorsi dalla radice del vault. */
function anchorImages(n: PMNode, rel: string): PMNode {
  if (n.type === 'figure' && typeof n.attrs?.src === 'string' && !/^(https?:|data:|blob:|asset:|vault:)/i.test(n.attrs.src)) {
    const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
    return { ...n, attrs: { ...n.attrs, src: VAULT_SRC + normalizePath(joinPath(dir, decodeURI(n.attrs.src))) } };
  }
  return n.content ? { ...n, content: n.content.map((c) => anchorImages(c, rel)) } : n;
}

/** Il Codex come un unico documento: pergamene in ordine, con separatore e titoli a scelta. */
export async function codexDoc(root: string, s: CodexSettings): Promise<PMNode> {
  const vault = useWorkspace.getState().vaultRoot!;
  const docs = useWorkspace.getState().docs;
  const content: PMNode[] = [];
  const members = membersOf(root);
  for (const [i, rel] of members.entries()) {
    const part = anchorImages(embedsToLinks(parseMarkdown(await readDocument(vault, rel))), rel);
    if (i > 0 && s.separator === 'pagebreak') content.push({ type: 'pageBreak' });
    if (s.titlesAsHeadings) content.push({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: docs.find((d) => d.rel === rel)?.title ?? rel }] });
    content.push(...(part.content ?? []));
  }
  return { type: 'doc', content };
}

/** Prepara il Codex per l'export: impaginazione e citazioni della pergamena radice. */
export async function prepareCodex(root: string): Promise<Prepared | null> {
  const vault = useWorkspace.getState().vaultRoot;
  if (!vault) return null;
  const s = await useCodexStore.getState().load(root);
  const doc = await codexDoc(root, s);
  const settings = normalizeDocSettings(await readJson<unknown>(abs(vault, docSettingsFile(root)), null), getLang());
  return prepareDoc(doc, settings, s.name, vault, root, keysOfDoc(doc));
}
