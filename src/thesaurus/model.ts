// Thesaurus: interpretazione dei blocchi MyThes (i dati di LibreOffice), parola da cercare e
// sostituzione che rispetta le maiuscole. Funzioni pure; i file li legge il Rust (src-tauri/src/thesaurus.rs).
import type { WritingLang } from '../i18n/writing';

export interface Meaning {
  /** parte del discorso come la scrive il file: "s.m.", "agg.", "noun", "verb"... */
  pos: string;
  synonyms: string[];
  /** termini piu' generali o simili ("generic term", "similar term", "related term") */
  related: string[];
  antonyms: string[];
}

export interface Entry {
  word: string;
  meanings: Meaning[];
}

/** Lingue del thesaurus: per ora italiano e inglese, quella di scrittura del Compendium. */
export function thesaurusLang(lang: WritingLang): 'it' | 'en' | null {
  return lang === 'it' || lang === 'en' ? lang : null;
}

/** Blocco MyThes: "parola|n" e poi n righe "(categoria)|sinonimo|sinonimo (generic term)|...". */
export function parseEntry(raw: string): Entry | null {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const head = lines.shift();
  const bar = head?.lastIndexOf('|') ?? -1;
  if (!head || bar < 0) return null;
  const word = head.slice(0, bar);
  const meanings: Meaning[] = [];
  for (const line of lines) {
    const [pos, ...terms] = line.split('|');
    const m: Meaning = { pos: pos.replace(/^\(|\)$/g, '').trim(), synonyms: [], related: [], antonyms: [] };
    for (const raw of terms) {
      const tag = /\s*\((antonym|generic term|similar term|related term)\)\s*$/i.exec(raw);
      const term = (tag ? raw.slice(0, tag.index) : raw).trim();
      if (!term || term.toLowerCase() === word.toLowerCase()) continue;
      const list = !tag ? m.synonyms : tag[1].toLowerCase() === 'antonym' ? m.antonyms : m.related;
      if (!list.includes(term)) list.push(term);
    }
    if (m.synonyms.length || m.related.length || m.antonyms.length) meanings.push(m);
  }
  return { word, meanings };
}

/** Parola da cercare dalla selezione: senza spazi, virgolette e punteggiatura ai bordi. */
export function lookupWord(selection: string): string | null {
  const w = selection.trim().replace(/^[\s"'«»“”‘’()[\]{}.,;:!?¿¡…-]+|[\s"'«»“”‘’()[\]{}.,;:!?¿¡…-]+$/gu, '');
  // una parola o un'espressione breve (il thesaurus ne ha qualcuna: "a meno che", "in front of")
  if (!w || w.length > 60 || w.split(/\s+/).length > 4) return null;
  return w;
}

/**
 * Forme base da provare quando la parola non c'e' (il thesaurus ha il maschile singolare e l'infinito):
 * in italiano -a/-i/-e -> -o, -e/-i -> -a/-e; in inglese plurali, -ed, -ing, -er/-est.
 * Nessuna analisi grammaticale: regole semplici, nell'ordine dalla piu' probabile.
 */
export function baseForms(word: string, lang: 'it' | 'en'): string[] {
  const w = word.toLowerCase();
  const out: string[] = [];
  const add = (x: string) => x.length > 1 && x !== w && !out.includes(x) && out.push(x);
  if (lang === 'it') {
    if (/[aie]$/.test(w)) add(w.slice(0, -1) + 'o'); // bella, belli, belle -> bello
    if (/e$/.test(w)) add(w.slice(0, -1) + 'a'); // case -> casa
    if (/i$/.test(w)) {
      add(w.slice(0, -1) + 'e'); // fiori -> fiore
      add(w.slice(0, -1) + 'a'); // poeti -> poeta
    }
    if (/(chi|ghi)$/.test(w)) add(w.slice(0, -2) + 'o'); // bianchi -> bianco
    if (/(che|ghe)$/.test(w)) add(w.slice(0, -2) + 'a'); // amiche -> amica
  } else {
    if (/ies$/.test(w)) add(w.slice(0, -3) + 'y'); // cities -> city
    if (/(s|x|z|ch|sh)es$/.test(w)) add(w.slice(0, -2)); // boxes -> box
    if (/s$/.test(w) && !/ss$/.test(w)) add(w.slice(0, -1)); // houses -> house
    if (/ied$/.test(w)) add(w.slice(0, -3) + 'y'); // carried -> carry
    if (/ed$/.test(w)) {
      add(w.slice(0, -1)); // used -> use
      add(w.slice(0, -2)); // walked -> walk
      if (/(.)\1ed$/.test(w)) add(w.slice(0, -3)); // stopped -> stop
    }
    if (/ing$/.test(w)) {
      add(w.slice(0, -3)); // reading -> read
      add(w.slice(0, -3) + 'e'); // writing -> write
      if (/(.)\1ing$/.test(w)) add(w.slice(0, -4)); // running -> run
    }
    if (/ier$|iest$/.test(w)) add(w.replace(/ier$|iest$/, 'y')); // happier -> happy
    else if (/er$|est$/.test(w)) add(w.replace(/er$|est$/, '')); // faster -> fast
  }
  return out;
}

/**
 * In italiano il sinonimo trovato dalla forma base prende la desinenza della parola nel testo
 * (bella -> bello: "carino" diventa "carina"); solo per il cambio regolare -o -> -a/-i/-e.
 */
export function inflectLike(word: string, base: string, synonym: string, lang: 'it' | 'en'): string {
  if (lang !== 'it' || synonym.includes(' ')) return synonym;
  const w = word.toLowerCase();
  if (!base.endsWith('o') || w.slice(0, -1) !== base.slice(0, -1)) return synonym;
  const end = w.slice(-1);
  if (!/[aie]/.test(end) || !synonym.endsWith('o')) return synonym;
  return synonym.slice(0, -1) + end;
}

/** Il sinonimo prende le maiuscole della parola sostituita (Iniziale, TUTTO MAIUSCOLO). */
export function matchCase(original: string, replacement: string): string {
  const letters = original.replace(/[^\p{L}]/gu, '');
  if (letters.length > 1 && letters === letters.toUpperCase()) return replacement.toUpperCase();
  if (letters && letters[0] === letters[0].toUpperCase() && letters[0] !== letters[0].toLowerCase()) return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  return replacement;
}

/**
 * Blocco di una parola in un file MyThes intero (per la versione nel browser, senza il Rust):
 * cerca la riga d'intestazione "parola|n", senza distinguere le maiuscole.
 */
export function findBlock(text: string, word: string): string | null {
  const w = word.trim().toLowerCase();
  if (!w) return null;
  const lines = text.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const bar = lines[i].lastIndexOf('|');
    if (bar < 0) continue;
    const n = Number(lines[i].slice(bar + 1));
    if (!Number.isInteger(n)) continue;
    if (lines[i].slice(0, bar).toLowerCase() === w) return lines.slice(i, i + 1 + n).join('\n') + '\n';
    i += n;
  }
  return null;
}
