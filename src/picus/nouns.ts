// Picus: genere e plurale dei nomi dai dati del pacchetto (@noun), per accordare l'articolo e il
// numero quando un nome cambia ("il problema" -> "la questione", "i problemi" -> "le questioni").
import type { Pack } from './pack';

/** Genere dalla categoria del thesaurus ("s.m.", "s.f.") o, se manca, dalla desinenza. */
export function genderOf(pack: Pack, word: string, pos?: string): 'm' | 'f' | null {
  if (pos && /^s\.\s*m/.test(pos)) return 'm';
  if (pos && /^s\.\s*f/.test(pos)) return 'f';
  const w = word.toLowerCase();
  return (pack.genders.find((g) => w.endsWith(g.suffix) && w.length > g.suffix.length)?.gender as 'm' | 'f' | undefined) ?? null;
}

/** Plurale di un nome (null se il pacchetto non ha regole). */
export function pluralOf(pack: Pack, word: string, gender: 'm' | 'f' | null): string | null {
  if (!pack.plural.length) return null;
  const words = word.split(' ');
  const head = words[0];
  const r = pack.plural.find((p) => head.toLowerCase().endsWith(p.suffix) && (!p.gender || !gender || p.gender === gender));
  if (!r) return null;
  if (r.repl !== '*') words[0] = head.slice(0, head.length - r.suffix.length) + r.repl;
  return words.join(' ');
}
