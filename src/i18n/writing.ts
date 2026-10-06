// Lingua di scrittura: quella del testo, per Compendium, separata dalla lingua dell'interfaccia.
// Decide controllo ortografico e sillabazione nell'editor, lingua dell'export (Typst, LaTeX,
// HTML, Word), lingua delle citazioni delle pergamene nuove e i testi che finiscono nel documento.
import { useSyncExternalStore } from 'react';

export type WritingLang = 'it' | 'en' | 'de' | 'fr' | 'es';

/** Nomi nella lingua stessa: si riconoscono qualunque sia la lingua dell'interfaccia. */
export const WRITING_LANGS: { id: WritingLang; name: string }[] = [
  { id: 'it', name: 'Italiano' },
  { id: 'en', name: 'English' },
  { id: 'de', name: 'Deutsch' },
  { id: 'fr', name: 'Français' },
  { id: 'es', name: 'Español' },
];

export function isWritingLang(x: unknown): x is WritingLang {
  return WRITING_LANGS.some((l) => l.id === x);
}

/** Lingua del Compendium; se non e' ancora stata scelta, quella dell'interfaccia. */
export function writingLangOf(configured: unknown, ui: string): WritingLang {
  if (isWritingLang(configured)) return configured;
  return isWritingLang(ui) ? ui : 'en';
}

/** Locale CSL delle citazioni (i file stanno in public/csl/). */
export const CITATION_LOCALE: Record<WritingLang, string> = { it: 'it-IT', en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES' };

/** Locale CSL disponibili nel pacchetto, con il loro nome. */
export const CITATION_LOCALES: { id: string; name: string }[] = [
  { id: 'it-IT', name: 'Italiano' },
  { id: 'en-US', name: 'English (US)' },
  { id: 'en-GB', name: 'English (UK)' },
  { id: 'de-DE', name: 'Deutsch' },
  { id: 'fr-FR', name: 'Français' },
  { id: 'es-ES', name: 'Español' },
];

/** Lingua del testo per una locale CSL (es. 'en-GB' -> 'en'), per i documenti senza Compendium. */
export function writingLangOfLocale(locale: string): WritingLang | null {
  const l = locale.slice(0, 2).toLowerCase();
  return isWritingLang(l) ? l : null;
}

/** Nome della lingua per babel (LaTeX). */
export const BABEL: Record<WritingLang, string> = { it: 'italian', en: 'english', de: 'ngerman', fr: 'french', es: 'spanish' };

export interface DocTexts {
  /** titolo dell'indice dei contenuti stampato nel documento */
  toc: string;
  /** titolo predefinito della bibliografia generata */
  bibliography: string;
  /** bibliografia generata senza fonti */
  bibEmpty: string;
  /** intestazione dei riquadri evidenziati senza titolo, per tipo */
  callouts: { note: string; tip: string; important: string; warning: string; caution: string };
}

const DOC_TEXTS: Record<WritingLang, DocTexts> = {
  it: {
    toc: 'Indice',
    bibliography: 'Bibliografia',
    bibEmpty: 'Nessuna fonte citata.',
    callouts: { note: 'Nota', tip: 'Suggerimento', important: 'Importante', warning: 'Attenzione', caution: 'Pericolo' },
  },
  en: {
    toc: 'Contents',
    bibliography: 'References',
    bibEmpty: 'No sources cited.',
    callouts: { note: 'Note', tip: 'Tip', important: 'Important', warning: 'Warning', caution: 'Caution' },
  },
  de: {
    toc: 'Inhaltsverzeichnis',
    bibliography: 'Literaturverzeichnis',
    bibEmpty: 'Keine Quellen zitiert.',
    callouts: { note: 'Hinweis', tip: 'Tipp', important: 'Wichtig', warning: 'Achtung', caution: 'Vorsicht' },
  },
  fr: {
    toc: 'Table des matières',
    bibliography: 'Bibliographie',
    bibEmpty: 'Aucune source citée.',
    callouts: { note: 'Note', tip: 'Conseil', important: 'Important', warning: 'Attention', caution: 'Danger' },
  },
  es: {
    toc: 'Índice',
    bibliography: 'Bibliografía',
    bibEmpty: 'No se citan fuentes.',
    callouts: { note: 'Nota', tip: 'Consejo', important: 'Importante', warning: 'Atención', caution: 'Peligro' },
  },
};

/** Testi che finiscono dentro il documento, nella lingua di scrittura. */
export function docTexts(lang: WritingLang): DocTexts {
  return DOC_TEXTS[lang];
}

/** Testi di partenza dei modelli (Diario, template): esistono in italiano e inglese. */
export function starterLang(lang: WritingLang): 'it' | 'en' {
  return lang === 'it' ? 'it' : 'en';
}

// ----- lingua di scrittura del Compendium aperto (la imposta il workspace)

let currentWriting: WritingLang = 'it';
const writingListeners = new Set<() => void>();

export function setWritingLang(lang: WritingLang) {
  if (lang === currentWriting) return;
  currentWriting = lang;
  writingListeners.forEach((l) => l());
}

export function getWritingLang(): WritingLang {
  return currentWriting;
}

export function onWritingLang(cb: () => void): () => void {
  writingListeners.add(cb);
  return () => writingListeners.delete(cb);
}

export function useWritingLang(): WritingLang {
  return useSyncExternalStore(onWritingLang, getWritingLang);
}
