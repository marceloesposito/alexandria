// Picus: articoli delle locuzioni nominali, dai dati del pacchetto (@article). "la chiave di volta"
// -> "il cardine", "della chiave di volta" -> "del cardine", "a keystone" -> "an essential element".
import type { ArticleTable, Pack } from './pack';

export type ArticleKind = 'def' | 'ind';

/** l'articolo (o la preposizione articolata) che precede una locuzione nominale */
export interface Det {
  kind: ArticleKind;
  /** preposizione semplice se l'articolo era articolato ("della" -> "di") */
  prep: string | null;
}

function inClass(t: ArticleTable, cls: string, next: string): boolean {
  const c = t.classes.get(cls);
  if (!c) return false;
  const w = next.toLowerCase();
  return c.yes.some((p) => w.startsWith(p)) && !c.no.some((p) => w.startsWith(p));
}

/** Articolo per genere e iniziale della parola che segue; null se il pacchetto non lo prevede. */
export function articleFor(t: ArticleTable, kind: ArticleKind, gender: string, next: string): string | null {
  const rows = t.rows.get(`${kind} ${gender}`) ?? t.rows.get(`${kind} *`);
  if (!rows?.length) return null;
  for (const r of rows) if (r.when && inClass(t, r.when, next)) return r.form;
  return rows.find((r) => !r.when)?.form ?? rows[0].form;
}

/** forme d'articolo del testo -> tipo (anche le preposizioni articolate, con la preposizione) */
export function articleIndex(pack: Pack): Map<string, Det> {
  const out = new Map<string, Det>();
  for (const [key, rows] of pack.article.rows) {
    const kind = key.split(' ')[0] as ArticleKind;
    for (const r of rows) if (!out.has(r.form)) out.set(r.form, { kind, prep: null });
  }
  for (const [prep, table] of pack.prep) for (const form of table.keys()) if (!out.has(form)) out.set(form, { kind: 'def', prep });
  return out;
}

/** Articolo (o preposizione articolata) da mettere davanti all'alternativa. */
export function determiner(pack: Pack, det: Det, gender: string, next: string): string | null {
  const art = articleFor(pack.article, det.kind, gender, next);
  if (art === null) return null;
  if (!det.prep) return art;
  const contracted = [...(pack.prep.get(det.prep) ?? [])].find(([, a]) => a === art)?.[0];
  return contracted ?? `${det.prep} ${art}`;
}

/** "l'" + "elemento" -> "l'elemento"; "il" + "cardine" -> "il cardine" */
export const joinArticle = (art: string, text: string) => (art.endsWith("'") ? art + text : `${art} ${text}`);
