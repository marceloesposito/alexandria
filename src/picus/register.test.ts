import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePack } from './pack';
import { wordRegister, phraseRegister } from './register';

const EN = parsePack(readFileSync(join(__dirname, 'packs/en.picus'), 'utf8'));
const IT = parsePack(readFileSync(join(__dirname, '../../src-tauri/resources/picus/it.picus'), 'utf8'));

describe('registro stimato', () => {
  it('inglese: parole dotte sopra, comuni e gergali sotto', () => {
    expect(wordRegister(EN, 'utilization')).toBeGreaterThan(wordRegister(EN, 'use'));
    expect(wordRegister(EN, 'commence')).toBeGreaterThan(wordRegister(EN, 'start'));
    expect(wordRegister(EN, 'eliminate')).toBeGreaterThan(phraseRegister(EN, 'get rid of'));
    expect(phraseRegister(EN, 'give up')).toBeLessThan(0);
    expect(wordRegister(EN, 'gonna')).toBe(-2);
    expect(wordRegister(EN, 'therefore')).toBe(1);
  });

  it('italiano', () => {
    expect(wordRegister(IT, 'pertanto')).toBeGreaterThan(wordRegister(IT, 'quindi'));
    expect(wordRegister(IT, 'quindi')).toBeGreaterThan(wordRegister(IT, 'roba'));
    expect(wordRegister(IT, 'realizzazione')).toBeGreaterThan(0);
    expect(phraseRegister(IT, 'tirare fuori')).toBeLessThan(0);
  });

  it('una parola con tanti significati e\' comune: scende verso il neutro', () => {
    expect(wordRegister(EN, 'organization', 1)).toBeGreaterThan(wordRegister(EN, 'organization', 12));
  });

  it('variante vuota, locuzioni fisse e contrari nei dati', () => {
    const filler = EN.senses.find((s) => s.name === 'filler')!;
    expect(filler.variants.map((v) => [v.text, v.tokens.length])).toEqual([
      ['basically', 1],
      ['', 0],
    ]);
    expect(EN.senses.find((s) => s.name === 'do not')!.variants.every((v) => v.fixed)).toBe(true);
    expect(IT.antonyms.get('bello')).toEqual(['brutto']);
    expect(IT.antonyms.get('brutto')).toEqual(['bello']);
    expect(IT.antonyms.get('lungo')).toEqual(['corto', 'breve']);
  });
});
