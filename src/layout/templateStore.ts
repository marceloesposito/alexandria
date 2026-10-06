// Template disponibili: i predefiniti piu' quelli dell'utente (<appData>/templates/*.json).
import { create } from 'zustand';
import { platform, joinPath } from '../platform';
import { getLang, t } from '../i18n';
import { useWorkspace } from '../state/workspace';
import { getWritingLang } from '../i18n/writing';
import { builtInTemplates, instantiate, parseTemplate, templateFromDoc, type Template } from './templates';
import { useDocSettings } from './docSettings';
import { currentMarkdown } from '../editor/session';
import { getEditor } from '../state/editorRef';

interface S {
  user: Template[];
  loaded: boolean;
  load(): Promise<void>;
  all(): Template[];
  save(tpl: Template): Promise<void>;
  remove(id: string): Promise<void>;
}

async function dir(): Promise<string> {
  const d = joinPath(await platform.appDataDir(), 'templates');
  if (!(await platform.exists(d))) await platform.mkdir(d);
  return d;
}

export const useTemplates = create<S>((set, get) => ({
  user: [],
  loaded: false,
  async load() {
    const d = await dir();
    const out: Template[] = [];
    for (const e of await platform.list(d)) {
      if (e.isDir || !e.name.endsWith('.json')) continue;
      try {
        const tpl = parseTemplate(JSON.parse(await platform.readText(e.path)), getLang());
        if (tpl) out.push(tpl);
      } catch {
        /* file illeggibile: lo si ignora */
      }
    }
    set({ user: out.sort((a, b) => a.name.localeCompare(b.name)), loaded: true });
  },
  all() {
    return [...builtInTemplates(getLang()), ...get().user];
  },
  async save(tpl) {
    await platform.writeText(joinPath(await dir(), `${tpl.id}.json`), JSON.stringify(tpl, null, 2));
    await get().load();
  },
  async remove(id) {
    const p = joinPath(await dir(), `${id}.json`);
    if (await platform.exists(p)) await platform.remove(p);
    await get().load();
  },
}));

/** Nuova pergamena dal template: testo e impaginazione pronti, poi si apre nello Scriptorium. */
export async function newDocFromTemplate(tpl: Template, title?: string): Promise<string | null> {
  const ws = useWorkspace.getState();
  const name = title?.trim() || (tpl.id === 'blank' ? t('doc.untitled') : tpl.name);
  const { markdown, settings } = instantiate(tpl, name, getWritingLang());
  const rel = await ws.newDoc(name, '', { markdown, settings });
  if (rel) ws.setView('editor');
  return rel;
}

/** La pergamena aperta diventa un template dell'utente. */
export async function saveCurrentAsTemplate(name: string, description: string): Promise<Template | null> {
  const editor = getEditor();
  if (!editor) return null;
  const id = `u${Date.now().toString(36)}`;
  const tpl = templateFromDoc(id, name, description, currentMarkdown(editor), useDocSettings.getState().settings);
  await useTemplates.getState().save(tpl);
  return tpl;
}

/** Impaginazione del template sulla pergamena aperta (il testo non si tocca). */
export function applyTemplateLayout(tpl: Template) {
  const cur = useDocSettings.getState().settings;
  useDocSettings.getState().replace({ ...cur, layout: tpl.settings.layout, citationStyle: tpl.settings.citationStyle, citationLocale: tpl.settings.citationLocale, bibliographyTitle: tpl.settings.bibliographyTitle });
}
