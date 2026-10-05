import { describe, it, expect } from 'vitest';
import { isoDay, journalTemplate, journalFolder, journalObject } from './compendiumTemplates';

describe('modello Diario', () => {
  it('data locale AAAA-MM-GG', () => {
    expect(isoDay(new Date(2026, 9, 5))).toBe('2026-10-05');
    expect(isoDay(new Date(2026, 0, 9))).toBe('2026-01-09');
  });
  it('contiene la guida e la voce di oggi nella cartella del diario, con tipo e data', () => {
    const tpl = journalTemplate('it', new Date(2026, 9, 5));
    expect(tpl.folderName).toBe('Diario');
    const entry = tpl.docs.find((d) => d.title === '2026-10-05')!;
    expect(entry.folder).toBe(journalFolder('it'));
    expect(entry.object).toEqual(journalObject('2026-10-05'));
    expect(journalTemplate('en').docs[0].markdown).toContain('Codex');
  });
});
