import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { defaultDocSettings, retargetLanguage } from '../layout/model';
import { WRITING_LANGS, writingLangOf, writingLangOfLocale, CITATION_LOCALE, CITATION_LOCALES, docTexts, BABEL, starterLang } from './writing';

describe('lingua di scrittura', () => {
  it('quella del Compendium vince su quella dell\'interfaccia', () => {
    expect(writingLangOf('de', 'it')).toBe('de');
    expect(writingLangOf(undefined, 'it')).toBe('it'); // Compendium vecchio: come prima
    expect(writingLangOf('xx', 'en')).toBe('en');
    expect(writingLangOf(undefined, 'pt')).toBe('en');
  });

  it('ogni lingua ha locale CSL nel pacchetto, testi del documento e babel', () => {
    for (const { id } of WRITING_LANGS) {
      expect(existsSync(`public/csl/locales-${CITATION_LOCALE[id]}.xml`)).toBe(true);
      expect(docTexts(id).toc).toBeTruthy();
      expect(docTexts(id).bibliography).toBeTruthy();
      expect(BABEL[id]).toBeTruthy();
    }
    for (const { id } of CITATION_LOCALES) expect(existsSync(`public/csl/locales-${id}.xml`)).toBe(true);
  });

  it('cambio di lingua: seguono solo i valori rimasti ai predefiniti', () => {
    const it_ = defaultDocSettings('it');
    const de = retargetLanguage(it_, 'it', 'de');
    expect(de.citationLocale).toBe('de-DE');
    expect(de.bibliographyTitle).toBe('Literaturverzeichnis');
    const scelti = { ...it_, citationLocale: 'en-GB', bibliographyTitle: 'Opere citate' };
    expect(retargetLanguage(scelti, 'it', 'de')).toEqual(scelti);
  });

  it('locale delle citazioni -> lingua del testo, testi di partenza', () => {
    expect(writingLangOfLocale('en-GB')).toBe('en');
    expect(writingLangOfLocale('fr-FR')).toBe('fr');
    expect(writingLangOfLocale('pt-BR')).toBe(null);
    expect(starterLang('it')).toBe('it');
    expect(starterLang('de')).toBe('en');
  });
});
