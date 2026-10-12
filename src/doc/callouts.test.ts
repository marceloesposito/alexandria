import { describe, expect, it } from 'vitest';
import {
  parseCalloutMarker,
  calloutMarker,
  resolveCallout,
  calloutTypeId,
  normalizeCalloutTypes,
  calloutHex,
  CALLOUT_OFFERED,
  type CalloutType,
} from './callouts';
import { parseMarkdown } from './parse';
import { serializeMarkdown } from './serialize';

const labels = { note: 'Nota', tip: 'Suggerimento', important: 'Importante', warning: 'Attenzione', caution: 'Pericolo' };
const def: CalloutType = { id: 'definizione', label: 'Definizione', color: 'series-6', icon: 'book-open' };

describe('sintassi dei riquadri', () => {
  it('colore e icona nei metadati alla Obsidian', () => {
    expect(parseCalloutMarker('[!NOTE|color=series-3 icon=book-open] Titolo')).toEqual({ kind: 'note', title: 'Titolo', color: 'series-3', icon: 'book-open' });
    expect(calloutMarker('note', 'Titolo', 'series-3', 'book-open')).toBe('[!NOTE|color=series-3 icon=book-open] Titolo');
  });
  it('metadati sconosciuti ignorati, tipi propri in minuscolo', () => {
    expect(parseCalloutMarker('[!definizione|color=rosso size=2]')).toEqual({ kind: 'definizione', title: '', color: '', icon: '' });
    expect(calloutMarker('definizione', '')).toBe('[!definizione]');
  });
  it('andata e ritorno Markdown con tipo proprio, colore e icona', () => {
    const md = '> [!definizione|color=series-6 icon=key] Entropia\n>\n> Misura del disordine.\n\n> [!WARNING]\n>\n> Vecchio tipo ancora letto.\n';
    const a = parseMarkdown(md);
    expect(a.content![0]).toMatchObject({ type: 'callout', attrs: { kind: 'definizione', title: 'Entropia', color: 'series-6', icon: 'key' } });
    expect(a.content![1]).toMatchObject({ type: 'callout', attrs: { kind: 'warning' } });
    expect(parseMarkdown(serializeMarkdown(a))).toEqual(a);
  });
});

describe('aspetto dei riquadri', () => {
  it('scelta del riquadro > tipo proprio > predefinito', () => {
    expect(resolveCallout({ kind: 'definizione' }, [def], labels)).toMatchObject({ label: 'Definizione', heading: 'Definizione', color: 'series-6', icon: 'book-open' });
    expect(resolveCallout({ kind: 'definizione', color: 'series-1', title: 'X' }, [def], labels)).toMatchObject({ heading: 'X', color: 'series-1', icon: 'book-open' });
    expect(resolveCallout({ kind: 'important' }, [], labels)).toMatchObject({ label: 'Importante', color: 'series-4', icon: 'star' });
  });
  it('tipo sconosciuto: aspetto della nota, nome dall\'id', () => {
    expect(resolveCallout({ kind: 'quote-lunga' }, [], labels)).toMatchObject({ label: 'Quote lunga', color: 'series-2', icon: 'info' });
    expect(resolveCallout({ kind: '<script>' }, [], labels).kind).toBe('note');
  });
  it('si propongono solo nota, importante e pericolo', () => {
    expect(CALLOUT_OFFERED).toEqual(['note', 'important', 'caution']);
  });
  it('colori di stampa: bordo e fondo chiaro', () => {
    expect(calloutHex('series-2')).toEqual({ stroke: '#3a6ea5', fill: '#f1f5fa' });
  });
});

describe('tipi propri', () => {
  it('id dal nome: senza accenti, unico, mai un predefinito', () => {
    expect(calloutTypeId('Definizione', [])).toBe('definizione');
    expect(calloutTypeId('Perché no?', [])).toBe('perche-no');
    expect(calloutTypeId('Definizione', ['definizione'])).toBe('definizione-2');
    expect(calloutTypeId('Note', [])).toBe('note-2');
    expect(calloutTypeId('!!!', [])).toBe('riquadro');
  });
  it('file letto con prudenza', () => {
    expect(normalizeCalloutTypes(null)).toEqual([]);
    expect(
      normalizeCalloutTypes({ types: [def, { ...def }, { id: 'note', label: 'x' }, { id: 'Bad Id' }, { id: 'esempio', label: '', color: 'verde', icon: 'nope' }] }),
    ).toEqual([def, { id: 'esempio', label: 'esempio', color: 'series-2', icon: 'info' }]);
  });
});
