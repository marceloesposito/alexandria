import { describe, it, expect } from 'vitest';
import { splitCited } from './BibliographySection';

describe('bibliografia nella colonna', () => {
  it('separa le citazioni con una fonte da quelle senza', () => {
    expect(splitCited(['eco1962', 'halb1925', 'nessuno'], new Set(['eco1962', 'halb1925']))).toEqual({ found: 2, missing: 1 });
    expect(splitCited([], new Set(['eco1962']))).toEqual({ found: 0, missing: 0 });
  });
});
