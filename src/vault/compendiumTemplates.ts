// Modelli di Compendium: pergamene di partenza con tipo, proprietà e legami (Codex). Il primo è il
// Diario: voci quotidiane del tipo "Voce di diario", lette di seguito come un Codex.
import { createDocument, ensureVault, writeJson } from './vault';
import { abs, docSettingsFile, LINKS_FILE } from './paths';
import { joinPath, platform } from '../platform';
import { defaultDocSettings } from '../layout/model';
import type { ObjectData } from '../types/model';
import type { Link } from '../resources/storage';
import { docNodeId } from '../resources/docLinks';

export interface TemplateDoc {
  title: string;
  folder?: string;
  markdown: string;
  object?: ObjectData;
  /** header visibile anche nella vista pagina */
  headerInPage?: boolean;
}

export interface CompendiumTemplate {
  id: string;
  /** nome della cartella del nuovo Compendium */
  folderName: string;
  docs: TemplateDoc[];
  /** legami fra pergamene (indici in docs): formano i Codex */
  links: [number, number][];
}

/** Data locale in forma AAAA-MM-GG. */
export function isoDay(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Cartella delle voci di diario dentro documents/. */
export function journalFolder(lang: 'it' | 'en'): string {
  return lang === 'it' ? 'Diario' : 'Journal';
}

/** Testo di una voce di diario nuova. */
export function journalEntryMarkdown(lang: 'it' | 'en'): string {
  return lang === 'it'
    ? '## Com\'è andata\n\n\n\n## Cosa ho notato\n\n\n\n## Domani\n\n'
    : '## How it went\n\n\n\n## What I noticed\n\n\n\n## Tomorrow\n\n';
}

export function journalObject(day: string): ObjectData {
  return { type: 'journal', props: { date: day } };
}

export function journalTemplate(lang: 'it' | 'en', today = new Date()): CompendiumTemplate {
  const it = lang === 'it';
  const day = isoDay(today);
  return {
    id: 'journal',
    folderName: it ? 'Diario' : 'Journal',
    docs: [
      {
        title: it ? 'Come usare il diario' : 'How to use the journal',
        markdown: it
          ? [
              '# Il tuo diario',
              '',
              'Ogni giorno una pergamena nuova: **Voce di oggi** (menu File o Ctrl/Cmd+Alt+J) la crea nella cartella Diario, con la data, e la collega alla voce precedente.',
              '',
              'Le voci collegate formano un **Codex**: nella colonna a sinistra, sotto Codex, puoi leggerle di seguito come un libro, riordinarle o esportarle in PDF.',
              '',
              "Nell'header di ogni voce trovi le proprietà del tipo *Voce di diario*: data, umore, luogo e tag. Nell'Armarium, la vista Strata le mostra in tabella, raggruppate per umore o per tag.",
              '',
              'Puoi cambiare le proprietà da Preferenze > Tipi e proprietà.',
            ].join('\n')
          : [
              '# Your journal',
              '',
              'One new scroll a day: **Today\'s entry** (File menu or Ctrl/Cmd+Alt+J) creates it in the Journal folder, dated, and links it to the previous entry.',
              '',
              'Linked entries form a **Codex**: in the left column, under Codices, you can read them in sequence like a book, reorder them or export them to PDF.',
              '',
              'The header of each entry shows the properties of the *Journal entry* type: date, mood, place and tags. In the Armarium, the Strata view shows them as a table, grouped by mood or tag.',
              '',
              'You can change the properties in Preferences > Types and properties.',
            ].join('\n'),
      },
      { title: day, folder: journalFolder(lang), markdown: journalEntryMarkdown(lang), object: journalObject(day), headerInPage: true },
    ],
    links: [],
  };
}

/** Scrive il modello in una cartella (nuova o vuota) e la rende un Compendium. */
export async function applyCompendiumTemplate(root: string, tpl: CompendiumTemplate, lang: 'it' | 'en'): Promise<string[]> {
  const cfg = await ensureVault(root, tpl.folderName);
  void cfg;
  const rels: string[] = [];
  for (const d of tpl.docs) {
    const rel = await createDocument(root, [], d.title, d.folder ?? '', d.markdown);
    rels.push(rel);
    if (d.object) {
      const s = defaultDocSettings(lang);
      await writeJson(abs(root, docSettingsFile(rel)), { ...s, object: d.object, header: { ...s.header, paged: !!d.headerInPage } });
    }
  }
  if (tpl.links.length) {
    const links: Link[] = tpl.links.map(([a, b], i) => ({ id: `t${i}`, from: docNodeId(rels[a]), to: docNodeId(rels[b]) }));
    await writeJson(joinPath(root, LINKS_FILE), { version: 1, links });
  }
  try {
    await platform.gitCommit(root, tpl.folderName);
  } catch {
    /* il commit e' un di piu': il Compendium resta valido */
  }
  return rels;
}
