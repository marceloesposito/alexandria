import { describe, expect, it } from 'vitest';
import { orderedSections, visibleSections, moveSection, toggleSection } from './leftSections';

const ALL = ['scrolls', 'codex', 'armarium', 'excerpta', 'bibliography'];

describe('sezioni della colonna sinistra', () => {
  it('senza scelte vale l\'ordine dei moduli', () => {
    expect(visibleSections(ALL, undefined)).toEqual(ALL);
  });

  it('ordine scelto; sezioni nuove in fondo, sconosciute ignorate', () => {
    const saved = { order: ['bibliography', 'vecchia', 'scrolls'], hidden: [] };
    expect(orderedSections(ALL, saved)).toEqual(['bibliography', 'scrolls', 'codex', 'armarium', 'excerpta']);
  });

  it('spostare con le frecce o trascinando', () => {
    let s = moveSection(ALL, undefined, 'excerpta', 0);
    expect(s.order).toEqual(['excerpta', 'scrolls', 'codex', 'armarium', 'bibliography']);
    s = moveSection(ALL, s, 'excerpta', 1);
    expect(s.order.slice(0, 2)).toEqual(['scrolls', 'excerpta']);
    s = moveSection(ALL, s, 'scrolls', 99);
    expect(s.order[s.order.length - 1]).toBe('scrolls');
  });

  it('nascondere e mostrare', () => {
    const s = toggleSection(undefined, 'codex');
    expect(visibleSections(ALL, s)).toEqual(['scrolls', 'armarium', 'excerpta', 'bibliography']);
    expect(visibleSections(ALL, toggleSection(s, 'codex'))).toEqual(ALL);
  });
});
