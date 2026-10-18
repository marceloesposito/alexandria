import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createEngine, analyze, usage, type Finding } from './analyze';

const EN = createEngine(readFileSync(join(__dirname, 'packs/en.picus'), 'utf8'));
const IT = createEngine(readFileSync(join(__dirname, '../../src-tauri/resources/picus/it.picus'), 'utf8'));

/** testi delle alternative di un rilievo, per senso e sezione */
const alts = (f: Finding | undefined, sense?: string) =>
  (f?.senses.find((s) => sense === undefined || s.sense === sense)?.sections ?? []).flatMap((s) => s.items.map((i) => i.text));
const at = (fs: Finding[], original: string) => fs.find((f) => f.original === original);

describe('sensi', () => {
  const senses = (text: string) => at(analyze(EN, text, { variations: true }), text.match(/\b(?:it |she |he |they )?(look\w* like)/i)![1])?.senses.map((s) => s.sense);
  it('"looks like" + frase = sembra; + nome = somiglia; altrimenti tutti e due', () => {
    expect(senses('It looks like the plan will fail.')).toEqual(['seeming']);
    expect(senses('You look like you need sleep.')).toEqual(['seeming']);
    expect(senses('She looks like her mother.')).toEqual(['resemblance']);
    expect(senses('It looks like rain.')).toEqual(['resemblance', 'seeming']);
  });
});

describe('alternative flesse come l\'originale', () => {
  const v = (text: string, original: string, sense?: string) => alts(at(analyze(EN, text, { variations: true }), original), sense);
  it('tempo, persona e ausiliare', () => {
    expect(v('She looked like her mother.', 'looked like')).toContain('bore a resemblance to');
    expect(v('She has looked like her mother.', 'has looked like')).toEqual(expect.arrayContaining(['has borne a resemblance to', 'has been similar to', 'has resembled']));
    expect(v('They look like their parents.', 'look like')).toContain('are similar to');
    expect(v('I want to look like him.', 'look like')).toContain('be similar to');
    expect(v('She looks like him.', 'looks like')).toContain('is similar to');
    expect(v('We carried out the tests.', 'carried out')).toEqual(['performed', 'conducted', 'executed', 'undertook']);
    expect(v('They are carrying out tests.', 'carrying out')).toContain('conducting');
  });

  it('il vuoto passa nell\'alternativa e le maiuscole restano', () => {
    expect(v('We took the risk into account.', 'took the risk into account')).toEqual(expect.arrayContaining(['considered the risk', 'bore the risk in mind', 'kept the risk in mind']));
    const f = at(analyze(EN, 'In order to win, we trained.'), 'In order to');
    expect(f?.kind).toBe('style');
    expect(f?.reason).toBe('wordy');
    expect(alts(f)).toEqual(['To']);
    expect(alts(at(analyze(EN, 'We made a decision.'), 'made a decision'))).toEqual(['decided']);
  });
});

describe('ripetizioni', () => {
  it('lo stesso gruppo vicino: la seconda e le successive', () => {
    const fs = analyze(EN, 'Therefore we won. Thus we celebrated, and hence we slept.');
    expect(fs.filter((f) => f.kind === 'repetition').map((f) => f.original)).toEqual(['Thus', 'hence']);
    const thus = at(fs, 'Thus')!;
    expect(thus.prev).toEqual([0, 9]);
    // l'alternativa appena usata non si propone
    expect(alts(thus)).not.toContain('Thus');
  });

  it('oltre la finestra o dopo un paragrafo non conta', () => {
    const filler = Array.from({ length: 60 }, (_, i) => `w${i}`).join(' ');
    expect(analyze(EN, `Therefore we won. ${filler}. Thus we celebrated.`).some((f) => f.kind === 'repetition' && f.original === 'Thus')).toBe(false);
    expect(analyze(EN, `Therefore we won. ${filler}. Thus we celebrated.`, { window: 100 }).some((f) => f.original === 'Thus')).toBe(true);
    expect(analyze(EN, 'Therefore we won.\n\nThus we celebrated.').some((f) => f.original === 'Thus')).toBe(false);
  });

  it('parole piene con la stessa radice, non i nomi propri o le parole vuote', () => {
    const fs = analyze(EN, 'They argued all night. Their arguing kept Smith awake, and Smith left. The the the.');
    expect(fs.filter((f) => f.kind === 'repetition').map((f) => f.original)).toEqual(['arguing']);
  });

  it('in italiano non contano gli ausiliari', () => {
    const fs = analyze(IT, 'Abbiamo scritto, abbiamo letto, abbiamo riscritto il testo e poi il testo.');
    expect(fs.filter((f) => f.kind === 'repetition').map((f) => f.original)).toEqual(['testo']);
  });
});

describe('ordine e tono', () => {
  it('prima le meno usate di recente, poi l\'ordine del dizionario', () => {
    const text = 'We carried out the tests.';
    const doc = ['We conducted a survey.', 'Then we performed the tests.', text];
    const f = at(analyze(EN, text, { variations: true, lastUse: usage(EN, doc) }), 'carried out')!;
    expect(alts(f)).toEqual(['executed', 'undertook', 'conducted', 'performed']);
  });

  it('sezioni per tono, sempre Formale, Neutro, Informale; le vuote non ci sono', () => {
    const f = at(analyze(EN, 'She looks like her mother.', { variations: true }), 'looks like')!;
    expect(f.senses[0].sections.map((s) => [s.tone, s.open])).toEqual([
      ['formal', true],
      ['neutral', true],
      ['casual', true],
    ]);
    expect(at(analyze(EN, 'In order to win.'), 'In order to')!.senses[0].sections.map((s) => s.tone)).toEqual(['neutral']);
  });

  it('nessuna impostazione a priori: giri di parole e ripetizioni ci sono sempre', () => {
    const text = 'In order to win, we trained. Therefore we won; thus we slept.';
    expect(analyze(EN, text).map((f) => f.key)).toEqual(['style:in order to', 'repetition:thus']);
  });
});

describe('italiano', () => {
  const v = (text: string, original: string, sense?: string) => alts(at(analyze(IT, text, { variations: true }), original), sense);
  it('ausiliare e participio, anche quando l\'alternativa vuole l\'altro ausiliare', () => {
    expect(v("Abbiamo preso in considerazione l'ipotesi.", 'Abbiamo preso in considerazione')).toEqual(expect.arrayContaining(['Abbiamo considerato', 'Abbiamo valutato', "Abbiamo tenuto conto dell'"]));
    expect(v('Mi sono reso conto del problema.', 'Mi sono reso conto del')).toEqual(expect.arrayContaining(['Mi sono accorto del', 'Ho capito il']));
    expect(v("Ci siamo resi conto dell'errore.", "Ci siamo resi conto dell'")).toEqual(expect.arrayContaining(["Ci siamo accorti dell'", "Abbiamo capito l'"]));
    const f = at(analyze(IT, 'Ho capito il problema.', { variations: true }), 'Ho capito')!;
    const item = f.senses.find((s) => s.sense === 'rendersi conto di')!.sections.flatMap((s) => s.items).find((i) => i.base === 'rendersi conto di')!;
    expect(item.text).toBe('Mi sono reso conto del');
    expect(item.alt).toBe('Mi sono resa conto del');
  });

  it('clitici, modali, preposizioni articolate', () => {
    expect(v('Devo rendermi conto della situazione.', 'rendermi conto della')).toEqual(expect.arrayContaining(['accorgermi della', 'capire la']));
    expect(v('Tengo conto della questione.', 'Tengo conto della')).toEqual(expect.arrayContaining(['Considero la', 'Prendo in considerazione la']));
    expect(v('Ho capito che era tardi.', 'Ho capito', 'rendersi conto di')).toContain('Mi sono reso conto');
  });

  it('giri di parole', () => {
    const fs = analyze(IT, 'Al fine di vincere, abbiamo effettuato una verifica.');
    expect(fs.map((f) => [f.original, alts(f)])).toEqual([
      ['Al fine di', ['Per']],
      ['abbiamo effettuato una verifica', ['abbiamo verificato']],
    ]);
  });
});

describe('velocità', () => {
  it('un paragrafo in meno di un millisecondo, un documento di 10.000 parole in pochi', () => {
    const para =
      'In order to understand the results, we carried out several tests and took the data into account. It looked like the model would fail; therefore we changed it. Thus the results improved, and the end result was a lot of progress. Moreover, the method seems robust, and it resembles earlier work. ';
    analyze(EN, para);
    const t0 = performance.now();
    const n = 200;
    for (let i = 0; i < n; i++) analyze(EN, para);
    const perPara = (performance.now() - t0) / n;
    const doc = Array.from({ length: 10000 / 50 }, () => para);
    const t1 = performance.now();
    const lastUse = usage(EN, doc);
    for (const p of doc) analyze(EN, p, { lastUse });
    const perDoc = performance.now() - t1;
    console.log(`picus: ${perPara.toFixed(3)} ms per paragrafo (50 parole), ${perDoc.toFixed(1)} ms per 10.000 parole`);
    // soglie larghe per le macchine lente della CI; il valore vero e' nel log
    expect(perPara).toBeLessThan(5);
    expect(perDoc).toBeLessThan(200);
  });

  it('il pacchetto si prepara in pochi millisecondi', () => {
    const src = readFileSync(join(__dirname, '../../src-tauri/resources/picus/it.picus'), 'utf8');
    const t0 = performance.now();
    createEngine(src);
    const ms = performance.now() - t0;
    console.log(`picus: pacchetto italiano pronto in ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(200);
  });
});
