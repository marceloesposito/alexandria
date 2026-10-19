import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePack, PackError, FLAGS, phraseTokens } from './pack';

const read = (p: string) => readFileSync(join(__dirname, p), 'utf8');
const EN = read('packs/en.picus');
const IT = read('../../src-tauri/resources/picus/it.picus');

const err = (src: string): PackError => {
  try {
    parsePack(src);
  } catch (e) {
    if (e instanceof PackError) return e;
    throw e;
  }
  throw new Error('nessun errore');
};

describe('formato .picus', () => {
  it('i pacchetti inglese e italiano si leggono', () => {
    const en = parsePack(EN);
    expect(en.lang).toBe('en');
    expect(en.senses.length).toBeGreaterThanOrEqual(40);
    expect(en.replaces.length).toBeGreaterThan(40);
    expect(en.irregular.length).toBeGreaterThan(130);
    const it = parsePack(IT);
    expect(it.lang).toBe('it');
    expect(it.elision).toBe(true);
    expect(it.senses.length).toBeGreaterThan(30);
    expect(it.paradigm.slots).toHaveLength(48);
    expect(it.clitic?.person).toEqual(['mi', 'ti', 'si', 'ci', 'vi', 'si']);
  });

  it('varianti: registro, flag, nota', () => {
    const p = parsePack(`@meta\nlang en\n@sense resemblance\nlook like  0\nbe a dead ringer for -2 figurative\ntake after -1 note:only between relatives\n`);
    const [a, b, c] = p.senses[0].variants;
    expect(a).toMatchObject({ text: 'look like', tokens: ['look', 'like'], register: 0, flags: 0 });
    expect(b.register).toBe(-2);
    expect(b.flags).toBe(1 << FLAGS.indexOf('figurative'));
    expect(c.note).toBe('only between relatives');
  });

  it('@replace: piu\' destinazioni, registri e motivo', () => {
    const p = parsePack(`@meta\nlang en\n@replace\nprior to +1 -> before | ahead of -1  reason:pompous\n`);
    expect(p.replaces[0].from).toMatchObject({ text: 'prior to', register: 1 });
    expect(p.replaces[0].to.map((t) => [t.text, t.register])).toEqual([
      ['before', 0],
      ['ahead of', -1],
    ]);
    expect(p.replaces[0].reason).toBe('pompous');
  });

  it('i commenti si tolgono, "#CVK" nelle regole resta', () => {
    const p = parsePack(`# commento\n@meta\nlang en # la lingua\n@paradigm\nslots base past\nbase base\nrule past #CVK>++ed *>+ed\n`);
    expect(p.lang).toBe('en');
    expect(p.paradigm.rules.get('past')).toHaveLength(2);
  });

  it("con l'elisione le locuzioni si dividono come il testo", () => {
    expect(phraseTokens("porre l'accento su", true)).toEqual(['porre', "l'", 'accento', 'su']);
    expect(phraseTokens("don't", false)).toEqual(["don't"]);
  });

  it('errori chiari con il numero di riga', () => {
    expect(err(`@meta\nlang en\n@sense x\nlook like\n`)).toMatchObject({ line: 4, section: 'sense' });
    expect(err(`@meta\nlang en\n@sense x\nlook like\n`).message).toContain('registro mancante');
    expect(err(`@meta\nlang en\n@sense x\nlook like 0 shiny\n`).message).toContain('flag sconosciuto "shiny"');
    expect(err(`@meta\nlang en\n@colori\n`)).toMatchObject({ line: 3 });
    expect(err(`@meta\nlang en\n@stem\ning - v\n`).message).toContain('prima di "step"');
    expect(err(`@meta\nlang en\n@replace\nin order to -> to\n`).message).toContain('reason');
    expect(err(`@meta\nlang it\n@paradigm\nslots inf pres*6\nbase inf\nclass are\npres o i a\n`)).toMatchObject({ line: 7 });
    expect(err(`@meta\nlang en\n@sense\n`).message).toContain('senza nome');
    expect(err(`@meta\nname English\n`).message).toContain('lang');
    expect(err(`ciao\n`).message).toContain('fuori da una sezione');
  });
});
