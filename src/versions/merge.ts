// Merge a tre vie: testo per paragrafi (una riga = un paragrafo nel Markdown),
// file JSON accanto (commenti, layer, risorse) uniti per id.
import { diff3Merge } from 'node-diff3';

export type Choice = 'ours' | 'theirs' | 'both' | 'custom';

export type MergeChunk =
  | { kind: 'ok'; lines: string[] }
  | { kind: 'conflict'; ours: string[]; base: string[]; theirs: string[]; choice: Choice | null; custom: string };

function splitLines(s: string): string[] {
  if (!s) return [];
  const lines = s.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export function mergeText(base: string | null, ours: string | null, theirs: string | null): MergeChunk[] {
  const regions = diff3Merge(splitLines(ours ?? ''), splitLines(base ?? ''), splitLines(theirs ?? ''), {
    excludeFalseConflicts: true,
  });
  const out: MergeChunk[] = [];
  for (const r of regions) {
    if (r.ok) {
      const last = out[out.length - 1];
      if (last?.kind === 'ok') last.lines.push(...r.ok);
      else out.push({ kind: 'ok', lines: [...r.ok] });
    } else if (r.conflict) {
      out.push({
        kind: 'conflict',
        ours: r.conflict.a,
        base: r.conflict.o,
        theirs: r.conflict.b,
        choice: null,
        custom: r.conflict.a.join('\n'),
      });
    }
  }
  return out;
}

export function conflictsLeft(chunks: MergeChunk[]): number {
  return chunks.filter((c) => c.kind === 'conflict' && c.choice === null).length;
}

/** Testo finale, oppure null se restano conflitti senza scelta. */
export function resolveText(chunks: MergeChunk[]): string | null {
  const lines: string[] = [];
  for (const c of chunks) {
    if (c.kind === 'ok') lines.push(...c.lines);
    else if (c.choice === null) return null;
    else if (c.choice === 'ours') lines.push(...c.ours);
    else if (c.choice === 'theirs') lines.push(...c.theirs);
    else if (c.choice === 'both') lines.push(...c.ours, ...(c.ours.length && c.theirs.length ? [''] : []), ...c.theirs);
    else lines.push(...splitLines(c.custom));
  }
  return lines.length ? lines.join('\n') + '\n' : '';
}

/** Testo con i marcatori di conflitto (per i file di testo che non sono documenti). */
export function withMarkers(chunks: MergeChunk[]): string {
  const lines: string[] = [];
  for (const c of chunks) {
    if (c.kind === 'ok') lines.push(...c.lines);
    else lines.push('<<<<<<< mio', ...c.ours, '=======', ...c.theirs, '>>>>>>> loro');
  }
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------- JSON

type Json = unknown;

function isObj(x: Json): x is Record<string, Json> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

function byId(arr: Json[]): Map<string, Json> | null {
  const m = new Map<string, Json>();
  for (const x of arr) {
    if (!isObj(x) || typeof x.id !== 'string') return null;
    m.set(x.id, x);
  }
  return m;
}

function eq(a: Json, b: Json): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Unione a tre vie di valori JSON: gli array di oggetti con id si uniscono elemento per elemento
 * (aggiunte di entrambi, rimozioni rispettate), gli oggetti campo per campo; in caso di modifica
 * contemporanea dello stesso valore prevale "ours".
 */
export function mergeJson(base: Json, ours: Json, theirs: Json): Json {
  if (eq(ours, theirs)) return ours;
  if (eq(base, ours)) return theirs;
  if (eq(base, theirs)) return ours;
  if (Array.isArray(ours) && Array.isArray(theirs)) {
    const o = byId(ours);
    const t = byId(theirs);
    const b = Array.isArray(base) ? byId(base) : new Map<string, Json>();
    if (o && t && b) {
      const out: Json[] = [];
      const seen = new Set<string>();
      for (const [id, ov] of o) {
        seen.add(id);
        const tv = t.get(id);
        const bv = b.get(id);
        if (tv === undefined) {
          // tolto da loro: resta solo se l'abbiamo cambiato noi
          if (bv === undefined || !eq(bv, ov)) out.push(ov);
        } else out.push(mergeJson(bv ?? null, ov, tv));
      }
      for (const [id, tv] of t) {
        if (seen.has(id)) continue;
        const bv = b.get(id);
        if (bv === undefined || !eq(bv, tv)) out.push(tv);
      }
      return out;
    }
    return ours;
  }
  if (isObj(ours) && isObj(theirs)) {
    const b = isObj(base) ? base : {};
    const out: Record<string, Json> = {};
    for (const k of new Set([...Object.keys(ours), ...Object.keys(theirs)])) {
      if (!(k in theirs)) {
        if (!(k in b) || !eq(b[k], ours[k])) out[k] = ours[k];
      } else if (!(k in ours)) {
        if (!(k in b) || !eq(b[k], theirs[k])) out[k] = theirs[k];
      } else out[k] = mergeJson(b[k] ?? null, ours[k], theirs[k]);
    }
    return out;
  }
  return ours;
}

export function mergeJsonText(base: string | null, ours: string | null, theirs: string | null): string | null {
  try {
    const parse = (s: string | null) => (s ? JSON.parse(s) : null);
    return JSON.stringify(mergeJson(parse(base), parse(ours), parse(theirs)), null, 2) + '\n';
  } catch {
    return null;
  }
}
