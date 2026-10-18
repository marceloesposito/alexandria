import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { createEngine } from './analyze';
import { probes, synonymFinding, entryOf } from './synonyms';
import { tokenize } from './tokens';
import { findBlock } from '../thesaurus/model';

const res = (p: string) => join(__dirname, '../../src-tauri/resources', p);
const thes = { it: gunzipSync(readFileSync(res('thesaurus/th_it.dat.gz'))).toString('utf8'), en: gunzipSync(readFileSync(res('thesaurus/th_en.dat.gz'))).toString('utf8') };
const engines = { it: createEngine(readFileSync(res('picus/it.picus'), 'utf8')), en: createEngine(readFileSync(join(__dirname, 'packs/en.picus'), 'utf8')) };

/** come fara' l'app: la sequenza piu' lunga attorno alla parola che il thesaurus conosce */
function ask(lang: 'it' | 'en', text: string, word: string) {
  const e = engines[lang];
  const tokens = tokenize(text, e.pack.elision);
  const at = tokens.findIndex((t) => t.w === word);
  for (const p of probes(e, tokens, at, lang)) {
    for (const k of p.keys) {
      const entry = entryOf(findBlock(thes[lang], k.key));
      if (!entry) continue;
      const f = synonymFinding(e, text, tokens[p.start].start, tokens[p.end - 1].end, k.key, entry, k.lemma, lang);
      if (f) return { original: f.original, key: k.key, items: f.senses.flatMap((s) => s.sections[0].items.map((i) => i.text)), senses: f.senses.map((s) => s.sense) };
    }
  }
  return null;
}

describe('sinonimi dal thesaurus', () => {
  it('parola inglese flessa come nel testo', () => {
    const r = ask('en', 'She looked tired.', 'looked')!;
    expect(r.key).toBe('look');
    expect(r.senses.every((s) => /verb/.test(s))).toBe(true);
    expect(r.items).toEqual(expect.arrayContaining(['appeared', 'seemed']));
  });

  it('locuzione inglese intera, con il verbo alla forma base', () => {
    const r = ask('en', 'We carried out the plan.', 'carried')!;
    expect(r.original).toBe('carried out');
    expect(r.key).toBe('carry out');
    expect(r.items).toEqual(expect.arrayContaining(['executed', 'implemented', 'accomplished']));
    const k = ask('en', 'It is the keystone of the theory.', 'keystone')!;
    expect(k.items).toEqual(expect.arrayContaining(['linchpin', 'mainstay']));
  });

  it('plurali e maiuscole', () => {
    const r = ask('en', 'Cities grow.', 'cities')!;
    expect(r.items).toContain('Metropolises');
  });

  it('italiano: nome, aggettivo accordato, verbo flesso', () => {
    expect(ask('it', 'È il cardine del sistema.', 'cardine')!.items).toEqual(expect.arrayContaining(['fulcro', 'perno']));
    const bella = ask('it', 'Una casa bella.', 'bella')!;
    expect(bella.key).toBe('bello');
    expect(bella.items.some((x) => x.endsWith('a'))).toBe(true);
    const r = ask('it', 'Cerchiamo una soluzione.', 'cerchiamo')!;
    expect(r.key).toBe('cercare');
    // stessa persona del testo, anche per i riflessivi
    expect(r.items.every((x) => /mo$/.test(x))).toBe(true);
    expect(r.items).toContain('Ci aspettiamo');
  });
});
