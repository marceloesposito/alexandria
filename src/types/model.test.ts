import { describe, it, expect } from 'vitest';
import {
  builtInTypes,
  normalizeTypes,
  normalizeObject,
  formatProp,
  parsePropInput,
  sortValue,
  matchProp,
  propKey,
  headerRows,
  defaultHeader,
  normalizeHeader,
  type PropDef,
} from './model';

const status: PropDef = { key: 'status', label: 'Stato', kind: 'select', options: ['Idea', 'Bozza', 'Finale'] };
const words: PropDef = { key: 'target', label: 'Parole', kind: 'number' };
const tags: PropDef = { key: 'tags', label: 'Tag', kind: 'multi', options: [] };

describe('tipi di oggetto', () => {
  it('senza file valgono i tipi di partenza, con id stabili', () => {
    const t = normalizeTypes(null, 'en');
    expect(t.map((x) => x.id)).toContain('journal');
    expect(t.find((x) => x.id === 'chapter')?.name).toBe('Chapter');
    expect(normalizeTypes({ types: [] })).toEqual([]);
  });
  it('scarta proprietà di tipo sconosciuto e completa i campi mancanti', () => {
    const t = normalizeTypes({ types: [{ id: 'x', name: 'X', properties: [{ key: 'a', kind: 'boh' }, { key: 'b', kind: 'text' }] }] });
    expect(t[0]).toMatchObject({ icon: 'file', appliesTo: ['doc'], properties: [{ key: 'b', label: 'b', kind: 'text' }] });
  });
  it('normalizza i dati di un oggetto', () => {
    expect(normalizeObject({ type: 'scene', props: { a: 1, b: ['x', 2], c: { no: 1 } } })).toEqual({ type: 'scene', props: { a: 1, b: ['x', '2'] } });
    expect(normalizeObject(undefined)).toEqual({ type: null, props: {} });
  });
  it('chiavi uniche dalle etichette', () => {
    expect(propKey('Punto di vista', [])).toBe('punto-di-vista');
    expect(propKey('Età', ['eta'])).toBe('eta-2');
  });
  it('tutti i tipi predefiniti esistono in entrambe le lingue con le stesse proprietà', () => {
    const a = builtInTypes('it').map((t) => t.properties.map((p) => p.key).join());
    const b = builtInTypes('en').map((t) => t.properties.map((p) => p.key).join());
    expect(a).toEqual(b);
  });
});

describe('proprietà', () => {
  it('formatta e legge i valori', () => {
    expect(formatProp(tags, ['a', 'b'])).toBe('a, b');
    expect(formatProp({ key: 'd', label: 'D', kind: 'date' }, '2026-10-05', 'it')).toBe('5 ottobre 2026');
    expect(formatProp({ key: 'c', label: 'C', kind: 'checkbox' }, true, 'it')).toBe('Sì');
    expect(parsePropInput(words, '1,5')).toBe(1.5);
    expect(parsePropInput(tags, 'a, b,,c')).toEqual(['a', 'b', 'c']);
    expect(parsePropInput(words, '  ')).toBeNull();
  });
  it('ordina le select nell\'ordine delle opzioni, i numeri come numeri', () => {
    expect(sortValue(status, 'Finale')).toBe(2);
    expect(sortValue(words, 1200)).toBe(1200);
    expect(sortValue(status, null)).toBe('');
  });
  it('filtri sulle proprietà', () => {
    expect(matchProp(status, 'Bozza', 'is', 'bozza')).toBe(true);
    expect(matchProp(status, 'Bozza', 'not', 'bozza')).toBe(false);
    expect(matchProp(tags, ['viaggio', 'mare'], 'contains', 'mar')).toBe(true);
    expect(matchProp(words, 900, 'gte', '1000')).toBe(false);
    expect(matchProp(words, 1500, 'gte', '1000')).toBe(true);
    expect(matchProp(status, null, 'is', '')).toBe(true);
  });
});

describe('header del documento', () => {
  const type = builtInTypes('it').find((t) => t.id === 'journal')!;
  const labels = { type: 'Tipo', author: 'Autore', date: 'Data' };
  it('senza campi scelti mostra il tipo e le proprietà non vuote', () => {
    const rows = headerRows({ type: 'journal', props: { date: '2026-10-05', mood: 'Sereno', place: '' } }, type, defaultHeader(), { author: '', date: '' }, labels, 'it');
    expect(rows.map((r) => `${r.label}=${r.value}`)).toEqual(['Tipo=Voce di diario', 'Data=5 ottobre 2026', 'Umore=Sereno']);
  });
  it('rispetta i campi e l\'ordine scelti', () => {
    const h = { ...defaultHeader(), fields: ['mood', '@author'] };
    const rows = headerRows({ type: 'journal', props: { mood: 'Stanco' } }, type, h, { author: 'M. E.', date: '' }, labels, 'it');
    expect(rows.map((r) => r.value)).toEqual(['Stanco', 'M. E.']);
  });
  it('impostazioni salvate male tornano ai valori predefiniti', () => {
    expect(normalizeHeader({ layout: 'boh', fields: [1, 'mood'], paged: true })).toMatchObject({ layout: 'line', fields: ['mood'], paged: true, borderless: true });
  });
});
