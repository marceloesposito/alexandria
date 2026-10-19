import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePack } from './pack';
import { buildMorph } from './inflect';

const pack = (p: string) => parsePack(readFileSync(join(__dirname, p), 'utf8'));
const EN = pack('packs/en.picus');
const IT = pack('../../src-tauri/resources/picus/it.picus');
const en = buildMorph(EN);
const it_ = buildMorph(IT);

// paradigma inglese con qualche verbo regolare in piu', per le regole di grafia
const extra = buildMorph(
  parsePack(
    readFileSync(join(__dirname, 'packs/en.picus'), 'utf8').replace('@irregular', 'verbs stop visit play fix agree die see free panic open admit\n@irregular'),
  ),
);

const form = (m: ReturnType<typeof buildMorph>, verb: string, slot: string) => m.forms(verb)?.[m.slots.indexOf(slot)];

describe('flessione inglese', () => {
  it('regolari e regole di grafia', () => {
    expect(en.forms('look')).toEqual(['look', 'looks', 'looked', 'looked', 'looking']);
    expect(en.forms('try')).toEqual(['try', 'tries', 'tried', 'tried', 'trying']);
    expect(extra.forms('stop')).toEqual(['stop', 'stops', 'stopped', 'stopped', 'stopping']);
    expect(en.forms('make')?.[4]).toBe('making');
    expect(extra.forms('visit')?.[2]).toBe('visited');
    expect(extra.forms('play')).toEqual(['play', 'plays', 'played', 'played', 'playing']);
    expect(extra.forms('fix')?.[1]).toBe('fixes');
    expect(extra.forms('agree')?.[4]).toBe('agreeing');
    expect(extra.forms('die')?.[4]).toBe('dying');
    expect(extra.forms('open')?.[2]).toBe('opened');
    // polisillabi con l'accento in fondo
    expect(extra.forms('admit')?.[2]).toBe('admitted');
    expect(en.forms('control')).toBeNull();
  });

  it('irregolari e composti', () => {
    expect(en.forms('bear')).toEqual(['bear', 'bears', 'bore', 'borne', 'bearing']);
    expect(en.forms('take')).toEqual(['take', 'takes', 'took', 'taken', 'taking']);
    expect(en.forms('have')).toEqual(['have', 'has', 'had', 'had', 'having']);
    expect(en.forms('go')?.[1]).toBe('goes');
    expect(en.forms('run')?.[4]).toBe('running');
    expect(en.forms('begin')?.[4]).toBe('beginning');
    expect(en.forms('undertake')).toEqual(['undertake', 'undertakes', 'undertook', 'undertaken', 'undertaking']);
    expect(en.forms('understand')?.[2]).toBe('understood');
  });

  it('"be" si accorda con la parola che precede', () => {
    expect(en.agree('be', 'base', 'they')).toBe('are');
    expect(en.agree('be', 'base', 'i')).toBe('am');
    expect(en.agree('be', 'base', 'to')).toBe('be');
    expect(en.agree('be', 'base', "doesn't")).toBe('be');
    expect(en.agree('be', 'past', 'we')).toBe('were');
    expect(en.agree('be', 'past', 'she')).toBe('was');
    expect(en.agree('be', '3sg', 'she')).toBeNull();
    expect(en.agree('look', 'base', 'they')).toBeNull();
  });

  it('slot di una forma', () => {
    expect(en.slotsOf('look', 'looked')).toEqual(['past', 'pp']);
    expect(en.slotsOf('take', 'taken')).toEqual(['pp']);
  });
});

describe('flessione italiana', () => {
  it('prima coniugazione con le giunture ortografiche', () => {
    expect(form(it_, 'cercare', 'pres2')).toBe('cerchi');
    expect(form(it_, 'cercare', 'fut1')).toBe('cercherò');
    expect(form(it_, 'pagare', 'pres4')).toBe('paghiamo');
    expect(form(it_, 'mangiare', 'fut1')).toBe('mangerò');
    expect(form(it_, 'mangiare', 'pres2')).toBe('mangi');
    expect(form(it_, 'lasciare', 'cond3')).toBe('lascerebbe');
    expect(form(it_, 'studiare', 'pres4')).toBe('studiamo');
    expect(form(it_, 'considerare', 'pp2')).toBe('considerata');
    expect(form(it_, 'considerare', 'ger')).toBe('considerando');
  });

  it('seconda e terza, con -isc-', () => {
    expect(form(it_, 'temere', 'impf3')).toBe('temeva');
    expect(form(it_, 'dormire', 'pres3')).toBe('dorme');
    expect(form(it_, 'capire', 'pres1')).toBe('capisco');
    expect(form(it_, 'capire', 'pres4')).toBe('capiamo');
    expect(form(it_, 'capire', 'cong6')).toBe('capiscano');
    expect(form(it_, 'capire', 'pp1')).toBe('capito');
  });

  it('irregolari, temi per tempo e composti', () => {
    expect(it_.forms('essere')?.slice(6, 12)).toEqual(['sono', 'sei', 'è', 'siamo', 'siete', 'sono']);
    expect(form(it_, 'essere', 'fut1')).toBe('sarò');
    expect(form(it_, 'essere', 'pp4')).toBe('state');
    expect(form(it_, 'avere', 'cond3')).toBe('avrebbe');
    expect(form(it_, 'avere', 'pr3')).toBe('ebbe');
    expect(form(it_, 'avere', 'pr2')).toBe('avesti');
    expect(form(it_, 'fare', 'impf1')).toBe('facevo');
    expect(form(it_, 'fare', 'ger')).toBe('facendo');
    expect(form(it_, 'fare', 'pr6')).toBe('fecero');
    expect(form(it_, 'fare', 'pp1')).toBe('fatto');
    expect(form(it_, 'prendere', 'pr1')).toBe('presi');
    expect(form(it_, 'prendere', 'pr2')).toBe('prendesti');
    expect(form(it_, 'comprendere', 'pp3')).toBe('compresi');
    expect(form(it_, 'proporre', 'pres1')).toBe('propongo');
    expect(form(it_, 'proporre', 'fut1')).toBe('proporrò');
    expect(form(it_, 'proporre', 'impf1')).toBe('proponevo');
    expect(form(it_, 'tradurre', 'pr1')).toBe('tradussi');
    expect(form(it_, 'tradurre', 'pp1')).toBe('tradotto');
    expect(form(it_, 'aprire', 'pp1')).toBe('aperto');
    expect(form(it_, 'riuscire', 'pres1')).toBe('riesco');
    expect(form(it_, 'ottenere', 'fut1')).toBe('otterrò');
  });

  it('clitici e ausiliari', () => {
    expect(it_.splitClitic('rendersi')).toEqual({ verb: 'rendere', clitic: 'si' });
    expect(it_.splitClitic('ridursi')).toEqual({ verb: 'ridurre', clitic: 'si' });
    expect(it_.splitClitic('rendersene')).toEqual({ verb: 'rendere', clitic: 'sene' });
    expect(it_.splitClitic('tenerne')).toEqual({ verb: 'tenere', clitic: 'ne' });
    expect(it_.splitClitic('considerazione')).toBeNull();
    expect(it_.attach('rendere', 'inf', 'mi')).toBe('rendermi');
    expect(it_.attach('porre', 'inf', 'si')).toBe('porsi');
    expect(it_.attach('rendendo', 'ger', 'si')).toBe('rendendosi');
    expect(it_.auxOf('capire', '')).toBe('avere');
    expect(it_.auxOf('rendere', 'si')).toBe('essere');
    expect(it_.auxOf('andare', '')).toBe('essere');
    expect(it_.auxOf('giungere', '')).toBe('essere');
    // l'ausiliare non si eredita dal verbo base
    expect(it_.auxOf('raggiungere', '')).toBe('avere');
    expect(en.auxOf('look', '')).toBe('have');
  });
});
