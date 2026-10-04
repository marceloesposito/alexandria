// Gruppi e filtri suggeriti: regole deterministiche sui metadati e parole chiave (TF-IDF).
// Ogni suggerimento ha una motivazione leggibile e l'utente decide se accettarlo.
import { authorsOf, yearOf, domainOf, type Resource, type FilterRule } from './model';

export interface Suggestion {
  key: string; // stabile, per ricordare quelli scartati
  name: string;
  reason: { code: string; vars: Record<string, string | number> };
  rule: FilterRule;
  members: string[];
}

const STOP = new Set(
  (
    'il lo la i gli le un uno una di a da in con su per tra fra e o ma che chi cui non si come piu anche del dello della dei degli delle al allo alla ai agli alle dal dallo dalla dai dagli dalle nel nello nella nei negli nelle sul sullo sulla sui sugli sulle questo questa questi queste quello quella sono essere stato era erano ha hanno ho abbiamo the of and to in a is that for on with as by it be are this was from or an at which not have has but their its they were been these can more also into than other such may all one two its our we you he she his her them there when what about only some would could should'
  ).split(' '),
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').match(/\p{L}{4,}/gu) ?? []).filter((w) => !STOP.has(w));
}

/** Parole piu' caratteristiche di ogni documento (TF-IDF), le prime k. */
export function topTerms(texts: Map<string, string>, k = 5): Map<string, string[]> {
  const df = new Map<string, number>();
  const tfs = new Map<string, Map<string, number>>();
  for (const [id, text] of texts) {
    const tf = new Map<string, number>();
    for (const w of tokenize(text)) tf.set(w, (tf.get(w) ?? 0) + 1);
    tfs.set(id, tf);
    for (const w of tf.keys()) df.set(w, (df.get(w) ?? 0) + 1);
  }
  const n = texts.size;
  const out = new Map<string, string[]>();
  for (const [id, tf] of tfs) {
    const total = [...tf.values()].reduce((a, b) => a + b, 0) || 1;
    const scored = [...tf.entries()]
      .filter(([w]) => (df.get(w) ?? 0) < n || n === 1)
      .map(([w, c]) => [w, (c / total) * Math.log(1 + n / (df.get(w) ?? 1))] as const)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    out.set(
      id,
      scored.slice(0, k).map(([w]) => w),
    );
  }
  return out;
}

function group<K>(items: Resource[], key: (r: Resource) => K[] | K | null): Map<K, Resource[]> {
  const m = new Map<K, Resource[]>();
  for (const r of items) {
    const ks = key(r);
    const list = ks === null ? [] : Array.isArray(ks) ? ks : [ks];
    for (const k of list) m.set(k, [...(m.get(k) ?? []), r]);
  }
  return m;
}

export function suggestGroups(resources: Resource[], texts: Map<string, string>, dismissed: Set<string> = new Set()): Suggestion[] {
  const out: Suggestion[] = [];
  const add = (s: Suggestion) => {
    if (!dismissed.has(s.key) && s.members.length >= 2 && s.members.length < resources.length) out.push(s);
  };

  // stesso autore
  for (const [author, rs] of group(resources, (r) => authorsOf(r).map((a) => a.split(',')[0].trim()))) {
    if (!author || rs.length < 2) continue;
    add({
      key: `author:${author.toLowerCase()}`,
      name: author,
      reason: { code: 'suggest.reason.author', vars: { author, n: rs.length } },
      rule: { match: 'all', conditions: [{ field: 'author', op: 'is', value: author }] },
      members: rs.map((r) => r.id),
    });
  }
  // stesso decennio
  for (const [decade, rs] of group(resources, (r) => {
    const y = yearOf(r);
    return y === null ? null : Math.floor(y / 10) * 10;
  })) {
    if (rs.length < 3) continue;
    add({
      key: `decade:${decade}`,
      name: `${decade}–${decade + 9}`,
      reason: { code: 'suggest.reason.decade', vars: { decade, n: rs.length } },
      rule: {
        match: 'all',
        conditions: [
          { field: 'year', op: 'gte', value: String(decade) },
          { field: 'year', op: 'lte', value: String(decade + 9) },
        ],
      },
      members: rs.map((r) => r.id),
    });
  }
  // stesso tipo
  for (const [kind, rs] of group(resources, (r) => r.kind)) {
    if (rs.length < 3) continue;
    add({
      key: `kind:${kind}`,
      name: kind,
      reason: { code: 'suggest.reason.kind', vars: { kind, n: rs.length } },
      rule: { match: 'all', conditions: [{ field: 'kind', op: 'is', value: kind }] },
      members: rs.map((r) => r.id),
    });
  }
  // stesso sito
  for (const [domain, rs] of group(resources, (r) => domainOf(r))) {
    if (!domain || rs.length < 2) continue;
    add({
      key: `domain:${domain}`,
      name: domain,
      reason: { code: 'suggest.reason.domain', vars: { domain, n: rs.length } },
      rule: { match: 'all', conditions: [{ field: 'domain', op: 'is', value: domain }] },
      members: rs.map((r) => r.id),
    });
  }
  // stessa etichetta
  for (const [tag, rs] of group(resources, (r) => r.tags.map((x) => x.toLowerCase()))) {
    if (rs.length < 2) continue;
    add({
      key: `tag:${tag}`,
      name: `#${tag}`,
      reason: { code: 'suggest.reason.tag', vars: { tag, n: rs.length } },
      rule: { match: 'all', conditions: [{ field: 'tag', op: 'is', value: tag }] },
      members: rs.map((r) => r.id),
    });
  }
  // parole chiave condivise nel testo
  const terms = topTerms(texts, 6);
  const byTerm = new Map<string, string[]>();
  for (const [id, ws] of terms) for (const w of ws) byTerm.set(w, [...(byTerm.get(w) ?? []), id]);
  const usedSets = new Set<string>();
  [...byTerm.entries()]
    .filter(([, ids]) => ids.length >= 2)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .forEach(([term, ids]) => {
      const sig = [...ids].sort().join(',');
      if (usedSets.has(sig)) return;
      usedSets.add(sig);
      add({
        key: `term:${term}`,
        name: term,
        reason: { code: 'suggest.reason.term', vars: { term, n: ids.length } },
        rule: { match: 'all', conditions: [{ field: 'text', op: 'contains', value: term }] },
        members: ids,
      });
    });

  return out.sort((a, b) => b.members.length - a.members.length || a.key.localeCompare(b.key)).slice(0, 12);
}
