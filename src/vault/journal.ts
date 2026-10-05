// Voce di diario di oggi: la apre se c'è, altrimenti la crea (tipo "Voce di diario", data di oggi)
// e la collega in coda alla voce precedente, così il diario si legge di seguito come un Codex.
import { useWorkspace } from '../state/workspace';
import { defaultDocSettings } from '../layout/model';
import { isoDay, journalFolder, journalEntryMarkdown, journalObject } from './compendiumTemplates';
import { appendToCodex, membersOf } from '../codex/store';
import { codexRoot } from '../codex/model';
import { useResources } from '../resources/store';
import { flushSave } from '../editor/session';
import { getEditor } from '../state/editorRef';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function journalSettings(lang: 'it' | 'en', day: string) {
  const s = defaultDocSettings(lang);
  return { ...s, object: journalObject(day), header: { ...s.header, paged: true } };
}

export async function openTodayEntry(today = new Date()): Promise<string | null> {
  const ws = useWorkspace.getState();
  if (!ws.vaultRoot) return null;
  await flushSave(getEditor());
  const lang = ws.app.prefs.lang;
  const day = isoDay(today);
  const folder = journalFolder(lang);
  const entries = ws.docs.filter((d) => d.folder === folder && DAY.test(d.title));
  const existing = entries.find((d) => d.title === day);
  if (existing) {
    ws.openDoc(existing.rel);
    ws.setView('editor');
    return existing.rel;
  }
  const previous = entries.filter((d) => d.title < day).sort((a, b) => a.title.localeCompare(b.title)).pop();
  const rel = await ws.newDoc(day, folder, { markdown: journalEntryMarkdown(lang), settings: journalSettings(lang, day) });
  if (rel && previous) appendToCodex(membersOf(codexRoot(useResources.getState().links, previous.rel)), rel);
  useWorkspace.getState().setView('editor');
  return rel;
}
