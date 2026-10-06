import { describe, expect, it } from 'vitest';
import { builtInTemplates, templateFromDoc, instantiate, parseTemplate } from './templates';
import { addMaster, removeMaster, renameMaster, resolveMaster, defaultLayout, defaultDocSettings, normalizeDocSettings } from './model';

describe('master page', () => {
  it('se ne creano di nuove copiando il corpo, con un nome', () => {
    const { layout, id } = addMaster(defaultLayout(), 'Capitolo');
    expect(id).toBe('m1');
    expect(layout.masters.m1.name).toBe('Capitolo');
    expect(layout.masters.m1.pageNumbers).toBe(layout.masters.body.pageNumbers);
    expect(addMaster(layout, 'Altro').id).toBe('m2');
  });

  it('si rinominano e si eliminano, ma il corpo resta', () => {
    const { layout, id } = addMaster(defaultLayout(), 'Capitolo');
    expect(renameMaster(layout, id, 'Parte').masters[id].name).toBe('Parte');
    expect(removeMaster(layout, id).masters[id]).toBeUndefined();
    expect(removeMaster(layout, 'body').masters.body).toBeDefined();
  });

  it('una sezione con una master eliminata usa il corpo', () => {
    const l = defaultLayout();
    expect(resolveMaster(l, 'sparita')).toBe(l.masters.body);
    expect(resolveMaster(l, 'title')).toBe(l.masters.title);
  });

  it('le master create dall utente sopravvivono al salvataggio', () => {
    const s = defaultDocSettings('it');
    s.layout = addMaster(s.layout, 'Capitolo').layout;
    const back = normalizeDocSettings(JSON.parse(JSON.stringify(s)), 'it');
    expect(back.layout.masters.m1.name).toBe('Capitolo');
    expect(Object.keys(back.layout.masters).sort()).toEqual(['appendix', 'body', 'm1', 'title']);
  });
});

describe('template', () => {
  it('i predefiniti hanno id distinti e il primo e la pergamena vuota', () => {
    const list = builtInTemplates('it');
    expect(list[0].id).toBe('blank');
    expect(list[0].markdown).toBe('');
    expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
    expect(builtInTemplates('en').find((x) => x.id === 'thesis')?.settings.layout.facingPages).toBe(true);
  });

  it('dalla pergamena corrente: impaginazione si, titolo e autore no', () => {
    const s = { ...defaultDocSettings('it'), title: 'Mia tesi', author: 'M. E.' };
    const tpl = templateFromDoc('t1', 'Mio modello', '', '# Capitolo\n', s);
    expect(tpl.settings.title).toBe('');
    expect(tpl.settings.author).toBe('');
    const made = instantiate(tpl, 'Nuova', 'it');
    expect(made.markdown).toBe('# Capitolo\n');
    expect(made.settings.title).toBe('Nuova');
  });

  it('un predefinito segue la lingua di scrittura del Compendium, non quella dell\'interfaccia', () => {
    const tesi = builtInTemplates('it').find((x) => x.id === 'thesis')!;
    const de = instantiate(tesi, 'Arbeit', 'de');
    expect(de.settings.citationLocale).toBe('de-DE');
    expect(de.settings.bibliographyTitle).toBe('Literaturverzeichnis');
    expect(de.markdown).toBe(builtInTemplates('en').find((x) => x.id === 'thesis')!.markdown);
    // quelli dell'utente restano come salvati
    const mine = templateFromDoc('t2', 'Mio', '', 'testo\n', defaultDocSettings('it'));
    expect(instantiate(mine, 'x', 'de').settings.citationLocale).toBe('it-IT');
  });

  it('un file di template rovinato viene scartato', () => {
    expect(parseTemplate({ name: 'x' }, 'it')).toBeNull();
    const ok = parseTemplate({ id: 'a', name: 'A', markdown: '', settings: {} }, 'it');
    expect(ok?.settings.layout.masters.body).toBeDefined();
  });
});
