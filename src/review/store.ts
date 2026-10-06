// Round di revisione del Compendium: .alexandria/reviews/<id>.json. Raccolta dei punti dai
// Marginalia, export della lettera di risposta e della versione con le modifiche evidenziate.
import { create } from 'zustand';
import { platform, joinPath } from '../platform';
import { useWorkspace } from '../state/workspace';
import { readJson, writeJson, readDocument } from '../vault/vault';
import { abs, commentsFile, META_DIR } from '../vault/paths';
import { normalizeCommentsFile } from '../comments/model';
import { useVersions } from '../versions/store';
import { docDiff } from '../versions/docDiff';
import { parseMarkdown } from '../doc/parse';
import { normalizeDocSettings } from '../layout/model';
import { docSettingsFile } from '../vault/paths';
import { prepareDoc, keysOfDoc, exportTo, type ExportFormat } from '../export/run';
import { flushSave } from '../editor/session';
import { getEditor } from '../state/editorRef';
import { checkpoint } from '../versions/actions';
import { normalizeRound, newItemId, changesMarkdown, responseLetter, splitLetter, type ReviewRound, type ReviewItem } from './model';
import { t } from '../i18n';
import { getWritingLang } from '../i18n/writing';

const DIR = `${META_DIR}/reviews`;

interface S {
  rounds: ReviewRound[];
  load(): Promise<void>;
  save(r: ReviewRound): Promise<void>;
  remove(id: string): Promise<void>;
}

export const useRounds = create<S>((set, get) => ({
  rounds: [],
  async load() {
    const root = useWorkspace.getState().vaultRoot;
    if (!root) return set({ rounds: [] });
    const dir = joinPath(root, DIR);
    const list = (await platform.exists(dir)) ? await platform.list(dir) : [];
    const rounds: ReviewRound[] = [];
    for (const e of list) if (!e.isDir && e.name.endsWith('.json')) {
      const r = normalizeRound(await readJson<unknown>(e.path, null));
      if (r) rounds.push(r);
    }
    set({ rounds: rounds.sort((a, b) => b.created.localeCompare(a.created)) });
  },
  async save(r) {
    const root = useWorkspace.getState().vaultRoot;
    if (!root) return;
    await writeJson(joinPath(root, DIR, `${r.id}.json`), r);
    const rest = get().rounds.filter((x) => x.id !== r.id);
    set({ rounds: [r, ...rest].sort((a, b) => b.created.localeCompare(a.created)) });
  },
  async remove(id) {
    const root = useWorkspace.getState().vaultRoot;
    if (!root) return;
    await platform.remove(joinPath(root, DIR, `${id}.json`));
    set({ rounds: get().rounds.filter((x) => x.id !== id) });
  },
}));

/** Nuovo round: parte dalla versione attuale (salvata come checkpoint). */
export async function newRound(name: string): Promise<ReviewRound> {
  await flushSave(getEditor());
  await checkpoint(t('review.checkpoint', { name }));
  await useVersions.getState().refresh();
  const r: ReviewRound = { version: 1, id: `r${Date.now().toString(36)}`, name, created: new Date().toISOString(), baseSha: useVersions.getState().log?.head ?? null, items: [] };
  await useRounds.getState().save(r);
  return r;
}

/** Punti dai commenti dei revisori (copia per revisione o Word) di tutte le pergamene, senza doppioni. */
export async function itemsFromMarginalia(round: ReviewRound): Promise<ReviewItem[]> {
  const ws = useWorkspace.getState();
  if (!ws.vaultRoot) return [];
  const have = new Set(round.items.map((i) => i.source?.commentId).filter(Boolean));
  const out: ReviewItem[] = [];
  for (const d of ws.docs) {
    const file = normalizeCommentsFile(await readJson<unknown>(abs(ws.vaultRoot, commentsFile(d.rel)), null));
    for (const c of file.comments) {
      if (!c.origin || c.origin.kind === 'author' || have.has(c.id)) continue;
      const quote = c.anchor?.quote ? `«${c.anchor.quote}» — ` : '';
      out.push({ id: newItemId(), reviewer: c.origin.name ?? c.author, text: `${quote}${c.body}`, response: '', status: 'todo', source: { rel: d.rel, commentId: c.id }, commits: [...c.commits] });
    }
  }
  return out;
}

export function itemsFromLetter(letter: string): ReviewItem[] {
  return splitLetter(letter, t('review.reviewerN', { n: 1 })).map((x) => ({ id: newItemId(), reviewer: x.reviewer, text: x.text, response: '', status: 'todo', commits: [] }));
}

async function settingsOf(rel: string | null) {
  const root = useWorkspace.getState().vaultRoot!;
  return normalizeDocSettings(rel ? await readJson<unknown>(abs(root, docSettingsFile(rel)), null) : null, getWritingLang());
}

/** Esporta la lettera di risposta (impaginazione della pergamena aperta). */
export async function exportLetter(round: ReviewRound, format: ExportFormat) {
  const ws = useWorkspace.getState();
  if (!ws.vaultRoot) return;
  const log = useVersions.getState().log;
  const label = (sha: string) => log?.commits.find((c) => c.sha === sha)?.message.split('\n')[0] ?? sha.slice(0, 7);
  const md = responseLetter(round, { title: t('review.letterTitle', { name: round.name }), response: t('review.response'), changes: t('review.changes'), declined: t('review.declinedText') }, label);
  const doc = parseMarkdown(md);
  const rel = ws.activeDoc ?? ws.docs[0]?.rel ?? '';
  const p = await prepareDoc(doc, await settingsOf(ws.activeDoc), t('review.letterTitle', { name: round.name }), ws.vaultRoot, rel, keysOfDoc(doc));
  await exportTo(format, undefined, p);
}

/** Esporta la versione con le modifiche evidenziate: le pergamene cambiate dalla versione di partenza. */
export async function exportChanges(round: ReviewRound, format: ExportFormat) {
  const ws = useWorkspace.getState();
  const root = ws.vaultRoot;
  if (!root || !round.baseSha) return;
  await flushSave(getEditor());
  const author = ws.app.prefs.authorName || t('comments.me');
  const date = new Date().toISOString().slice(0, 10);
  const parts: string[] = [];
  for (const d of ws.docs) {
    const before = (await platform.gitReadAt(root, round.baseSha, d.rel)) ?? '';
    const after = await readDocument(root, d.rel);
    if (before === after) continue;
    parts.push(`# ${d.title}\n\n${changesMarkdown(docDiff(before, after), author, date)}`);
  }
  if (!parts.length) {
    ws.toast(t('review.noChanges'), 'info');
    return;
  }
  const doc = parseMarkdown(parts.join('\n\n<!-- pagebreak -->\n\n'));
  const rel = ws.activeDoc ?? ws.docs[0].rel;
  const p = await prepareDoc(doc, await settingsOf(ws.activeDoc), t('review.changesTitle', { name: round.name }), root, rel, keysOfDoc(doc), { revisions: 'marked' });
  await exportTo(format, undefined, p);
}

// segue il Compendium aperto
useWorkspace.subscribe((s, p) => {
  if (s.vaultRoot !== p.vaultRoot) void useRounds.getState().load();
});
