// Identita' di Alexandria: i nomi degli ambienti e degli oggetti sono nomi propri, uguali in tutte
// le lingue (mai tradotti). Una nuova lingua li riprende cosi' come sono; un test lo controlla.

export interface GlossaryTerm {
  /** forma del nome (singolare e plurale ammessi), maiuscola come in interfaccia */
  pattern: RegExp;
  /** traduzioni da evitare in qualunque lingua */
  avoid: RegExp[];
}

export const GLOSSARY: Record<string, GlossaryTerm> = {
  Compendium: { pattern: /\bCompendi(um|a)\b/, avoid: [/\bvault\b/i] },
  Scroll: { pattern: /\bScrolls?\b/, avoid: [/pergamen/i] },
  Bookshelf: { pattern: /\bBookshelf\b/, avoid: [/\bscaffal/i, /gestore risorse/i] },
  Scriptorium: { pattern: /\bScriptorium\b/, avoid: [] },
  History: { pattern: /\bHistory\b/, avoid: [/\bstoria\b/i, /\bcronologia\b/i] },
  Marginalia: { pattern: /\bMarginalia\b/, avoid: [] },
  Tabula: { pattern: /\bTabula\b/, avoid: [/\blavagn/i, /whiteboard/i] },
  Bookmarks: { pattern: /\bBookmarks?\b/, avoid: [/segnalibr/i] },
  Strata: { pattern: /\bStrata\b/, avoid: [] },
  Library: { pattern: /\bLibrary\b/, avoid: [/\blibreria\b/i, /\bbiblioteca\b/i] },
};

/** Chiavi in cui `text` non rispetta il glossario rispetto al riferimento inglese `ref`. */
export function glossaryViolations(ref: Record<string, string>, text: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(text)) {
    const base = ref[key];
    if (base === undefined) continue;
    for (const [name, term] of Object.entries(GLOSSARY)) {
      if (term.pattern.test(base) && !term.pattern.test(value)) out.push(`${key}: manca ${name}`);
      for (const bad of term.avoid) if (bad.test(value)) out.push(`${key}: ${name} tradotto (${bad.source})`);
    }
  }
  return out;
}
