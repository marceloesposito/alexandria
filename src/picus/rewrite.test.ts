import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { createEngine } from './analyze';
import { rewrite, sentenceAt } from './rewrite';
import { findBlock } from '../thesaurus/model';

const res = (p: string) => join(__dirname, '../../src-tauri/resources', p);
const thes = { it: gunzipSync(readFileSync(res('thesaurus/th_it.dat.gz'))).toString('utf8'), en: gunzipSync(readFileSync(res('thesaurus/th_en.dat.gz'))).toString('utf8') };
const engines = { it: createEngine(readFileSync(res('picus/it.picus'), 'utf8')), en: createEngine(readFileSync(join(__dirname, 'packs/en.picus'), 'utf8')) };

async function run(lang: 'it' | 'en', text: string, from = 0, to = text.length) {
  const r = await rewrite(engines[lang], text, from, to, lang, async (keys) => new Map(keys.map((k) => [k, findBlock(thes[lang], k)])));
  const v = Object.fromEntries(r.versions.map((x) => [x.tone, x.text]));
  return { ...r, v };
}

describe('riscritture per tono', () => {
  it('inglese: contrazioni, riempitivi, giri di parole, registro', async () => {
    const r = await run('en', "Basically, we don't have enough money to buy a new car, so we got rid of the old one.");
    expect(r.v.formal).toBe('We do not have sufficient money to purchase a new car, so we eliminated the old one.');
    expect(r.v.neutral).toBe('We do not have enough money to buy a new car, so we removed the old one.');
    expect(r.v.casual).toBe(r.original);
    const s = await run('en', 'In order to understand the results, we carried out a lot of tests.');
    expect(s.v.formal).toBe('To comprehend the results, we performed numerous tests.');
    expect(s.v.neutral).toBe('To understand the results, we carried out many tests.');
  });

  it('italiano: locuzioni flesse con l\'ausiliare, quantita\', connettivi', async () => {
    const r = await run('it', 'Cioè, abbiamo tirato fuori un sacco di soldi per sistemare la casa vecchia.');
    expect(r.v.formal).toBe('Ossia, abbiamo estratto una notevole quantità di soldi per sistemare la casa vecchia.');
    expect(r.v.casual).toContain('mettere a posto');
    const s = await run('it', 'Il problema è che la gente non capisce la situazione e quindi si arrabbia.');
    expect(s.v.formal).toBe('Il problema è che la gente non comprende la situazione e pertanto si arrabbia.');
  });

  it('un giro di parole seguito da un modificatore resta una proposta', async () => {
    const r = await run('it', 'Al fine di vincere abbiamo preso una decisione rapida.');
    expect(r.v.neutral).toBe('Per vincere abbiamo preso una decisione rapida.');
    const u = r.units.find((x) => x.original === 'abbiamo preso una decisione')!;
    expect(u.options[0]).toMatchObject({ text: 'abbiamo deciso', sure: false });
  });

  it('nomi italiani: articolo e plurale si accordano all\'alternativa', async () => {
    const r = await run('it', 'Il problema è serio.');
    expect(r.units[0].original).toBe('Il problema');
    expect(r.units[0].options.map((o) => o.text)).toEqual(expect.arrayContaining(['La grana', 'Il dilemma']));
    const p = await run('it', 'I problemi sono seri.');
    expect(p.units[0].options.map((o) => o.text)).toEqual(expect.arrayContaining(['Le grane', 'I dilemmi']));
  });

  it('le modifiche applicate al testo danno la versione mostrata', async () => {
    const text = "Basically, we don't have enough money, so we got rid of the old car.";
    const r = await run('en', text);
    for (const v of r.versions) {
      let out = text;
      for (const ed of [...v.edits].sort((a, b) => b.start - a.start)) out = out.slice(0, ed.start) + ed.text + out.slice(ed.end);
      expect(out, v.tone).toBe(v.text);
    }
  });

  it('la frase del cursore', () => {
    const text = 'Prima frase. Seconda frase, con una virgola! Terza?';
    expect(text.slice(...sentenceAt(text, 15))).toBe('Seconda frase, con una virgola!');
    expect(text.slice(...sentenceAt(text, 2))).toBe('Prima frase.');
    expect(text.slice(...sentenceAt(text, text.length))).toBe('Terza?');
  });

  it('solo il tratto chiesto, e sempre la stessa uscita', async () => {
    const text = 'The kids found out the truth. We got rid of it.';
    const a = await run('en', text, 0, 29);
    expect(a.original).toBe('The kids found out the truth.');
    expect(a.v.neutral).toBe('The children discovered the truth.');
    const b = await run('en', text, 0, 29);
    expect(b.versions).toEqual(a.versions);
  });
});
