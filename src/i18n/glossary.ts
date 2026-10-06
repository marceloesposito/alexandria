// Identita' di Alexandria: i nomi degli ambienti e degli oggetti sono nomi propri, uguali in tutte
// le lingue (mai tradotti). Una nuova lingua li riprende cosi' come sono; un test lo controlla.
// Unica eccezione voluta dal committente: in italiano lo Scroll si chiama pergamena.

export interface GlossaryTerm {
  /** forma del nome (singolare e plurale ammessi), maiuscola come in interfaccia */
  pattern: RegExp;
  /** traduzioni o nomi vecchi da evitare in qualunque lingua */
  avoid: RegExp[];
  /** lingue con un nome proprio diverso: li' si usa questo e il nome inglese e' da evitare */
  local?: Partial<Record<string, RegExp>>;
}

export const GLOSSARY: Record<string, GlossaryTerm> = {
  Compendium: { pattern: /\bCompendi(um|a)\b/, avoid: [/\bvault\b/i] },
  Scroll: { pattern: /\bScrolls?\b/, avoid: [/pergamen/i, /\bscrolls?\b/], local: { it: /\bpergamen[ae]\b/i } },
  Armarium: { pattern: /\bArmari(um|a)\b/, avoid: [/\bbookshelf\b/i, /\bscaffal/i, /gestore risorse/i] },
  Scriptorium: { pattern: /\bScriptorium\b/, avoid: [] },
  Palimpsestus: { pattern: /\bPalimpsestus\b/, avoid: [/\bstoria\b/i, /\bcronologia\b/i, /\bhistory\b/] },
  Marginalia: { pattern: /\bMarginalia\b/, avoid: [] },
  Tabula: { pattern: /\bTabula\b/, avoid: [/\blavagn/i, /whiteboard/i, /\bboard\b/] },
  Indices: { pattern: /\bInd(ex|ices)\b/, avoid: [/bookmark/i, /segnalibr/i] },
  Strata: { pattern: /\bStrata\b/, avoid: [] },
  Bibliotheca: { pattern: /\bBibliotheca\b/, avoid: [/\blibreria\b/i, /\bbiblioteca\b/i] },
  Codex: { pattern: /\bCodex\b/, avoid: [/\bLibrum\b/] },
};

/** Chiavi in cui `text` (nella lingua `lang`) non rispetta il glossario rispetto all'inglese `ref`. */
export function glossaryViolations(ref: Record<string, string>, text: Record<string, string>, lang = 'en'): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(text)) {
    const base = ref[key];
    if (base === undefined) continue;
    for (const [name, term] of Object.entries(GLOSSARY)) {
      const local = term.local?.[lang];
      if (term.pattern.test(base) && !(local ?? term.pattern).test(value)) out.push(`${key}: manca ${name}`);
      const avoid = local ? [term.pattern] : term.avoid;
      for (const bad of avoid) if (bad.test(value)) out.push(`${key}: ${name} tradotto (${bad.source})`);
    }
  }
  return out;
}
