import { describe, it, expect } from 'vitest';
import { planAppend, docKeyIn } from './append';
import type { Resource } from '../resources/model';
import { builtInTypes } from '../types/model';

const res = (id: string, citeKey: string | null, sha?: string, type?: string): Resource => ({
  id,
  kind: 'pdf',
  title: id,
  csl: null,
  citeKey,
  isSource: !!citeKey,
  tags: [],
  layers: [],
  created: '',
  meta: sha ? { sha256: sha } : {},
  pins: [],
  ...(type ? { object: { type, props: {} } } : {}),
});

const doc = (rel: string, folder = '') => ({ rel, title: rel.slice(rel.lastIndexOf('/') + 1).replace('.md', ''), folder, mtime: 0 });

const src = {
  name: 'Tesi: triennale',
  dirs: { docs: 'documents', res: 'resources' },
  docs: [doc('documents/Introduzione.md'), doc('documents/Capitolo 1.md'), doc('documents/Note/Appunti.md', 'Note')],
  links: [
    { id: 'l1', from: 'doc:documents/Introduzione.md', to: 'doc:documents/Capitolo 1.md' },
    { id: 'l2', from: 'doc:documents/Capitolo 1.md', to: 'doc:documents/Note/Appunti.md' },
    { id: 'l3', from: 'r1', to: 'doc:documents/Introduzione.md' },
  ],
  types: builtInTypes('it'),
  resources: [res('r1', 'halb', 'aaa'), res('r2', 'nora', 'bbb', 'interview'), res('r3', null)],
};

const target = {
  dirs: { docs: 'Pergamene', res: 'Armarium' },
  docs: [doc('Pergamene/Tesi triennale/Introduzione.md', 'Tesi triennale')],
  resources: [res('x1', 'halb', 'zzz')],
  types: builtInTypes('it').filter((t) => t.id !== 'interview' && t.id !== 'chapter'),
};

let n = 0;
const newId = () => `n${++n}`;

describe('aggiungi da un altro Compendium', () => {
  const plan = planAppend(src, ['documents/Introduzione.md', 'documents/Capitolo 1.md'], target, { folder: true, sources: true }, { 'documents/Introduzione.md': ['halb'], 'documents/Capitolo 1.md': ['nora'] }, newId, { 'documents/Capitolo 1.md': 'chapter' });

  it('nella cartella col nome del Compendium, con nomi liberi', () => {
    expect(plan.docs.map((d) => d.to)).toEqual(['Pergamene/Tesi triennale/Introduzione 2.md', 'Pergamene/Tesi triennale/Capitolo 1.md']);
  });
  it('porta solo le fonti citate che mancano (stessa chiave = gia\' presente)', () => {
    expect(plan.sources.map((s) => s.from.id)).toEqual(['r2']);
    expect(plan.sourcesKnown).toBe(1);
  });
  it('porta i tipi usati che mancano', () => {
    expect(plan.types.map((t) => t.id).sort()).toEqual(['chapter', 'interview']);
  });
  it('i legami fra le pergamene copiate restano (il Codex), gli altri no', () => {
    expect(plan.links).toEqual([{ from: 'Pergamene/Tesi triennale/Introduzione 2.md', to: 'Pergamene/Tesi triennale/Capitolo 1.md' }]);
  });
  it('senza cartella e senza fonti; le sottocartelle restano', () => {
    const p = planAppend(src, ['documents/Note/Appunti.md'], target, { folder: false, sources: false }, {}, newId);
    expect(p.docs[0].to).toBe('Pergamene/Note/Appunti.md');
    expect(p.sources).toEqual([]);
  });
  it('chiavi dei file accanto con le cartelle di ciascun Compendium', () => {
    expect(docKeyIn('documents/Note/Appunti.md', src.dirs)).toBe('Note~Appunti');
    expect(docKeyIn('Pergamene/Tesi/Intro.md', target.dirs)).toBe('Tesi~Intro');
  });
});
