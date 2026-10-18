// Identita' di Column: i nomi degli ambienti vengono dalla redazione e dall'epoca delle macchine da
// scrivere e sono nomi propri, uguali in tutte le lingue (mai tradotti). Una nuova lingua li riprende
// cosi' come sono; un test lo controlla. Unica eccezione: in italiano il Piece si chiama pezzo.
// Compendium resta: e' il nome di Alexandria per la cartella in cui si porta un pezzo.

export interface GlossaryTerm {
  /** forma del nome (singolare e plurale ammessi), maiuscola come in interfaccia */
  pattern: RegExp;
  /** traduzioni o nomi vecchi da evitare in qualunque lingua */
  avoid: RegExp[];
  /** lingue con un nome proprio diverso: li' si usa questo e il nome inglese e' da evitare */
  local?: Partial<Record<string, RegExp>>;
  /** chiavi in cui la stessa parola e' una parola comune (Copy: copia negli appunti) */
  except?: string[];
}

export const GLOSSARY: Record<string, GlossaryTerm> = {
  Compendium: { pattern: /\bCompendi(um|a)\b/, avoid: [/\bvault\b/i] },
  Piece: { pattern: /\bPieces?\b/, avoid: [/\bfogli\b/i, /\bsheets\b/i], local: { it: /\bpezz[oi]\b/i } },
  Copy: { pattern: /\bCopy\b/, avoid: [/scriptorium/i], except: ['cmd.edit.copy'] },
  Clips: { pattern: /\bClips\b/, avoid: [/tabula/i, /armarium/i, /\blavagn/i, /whiteboard/i] },
  Editions: { pattern: /\bEditions\b/, avoid: [/palimpsest/i, /\bcronologia\b/i, /\bhistory\b/i] },
  Queries: { pattern: /\bQueries\b/, avoid: [/marginalia/i] },
  Rundown: { pattern: /\bRundown\b/, avoid: [/\bindex\b/i, /\bindice\b/i, /\bsommario\b/i, /\boutline\b/i] },
  Typewriter: { pattern: /\bTypewriter\b/, avoid: [/silentium/i, /\bzen\b/i] },
};

/** Chiavi in cui `text` (nella lingua `lang`) non rispetta il glossario rispetto all'inglese `ref`. */
export function glossaryViolations(ref: Record<string, string>, text: Record<string, string>, lang = 'en'): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(text)) {
    const base = ref[key];
    if (base === undefined) continue;
    for (const [name, term] of Object.entries(GLOSSARY)) {
      if (term.except?.includes(key)) continue;
      const local = term.local?.[lang];
      if (term.pattern.test(base) && !(local ?? term.pattern).test(value)) out.push(`${key}: manca ${name}`);
      const avoid = local ? [term.pattern] : term.avoid;
      for (const bad of avoid) if (bad.test(value)) out.push(`${key}: ${name} tradotto (${bad.source})`);
    }
  }
  return out;
}
