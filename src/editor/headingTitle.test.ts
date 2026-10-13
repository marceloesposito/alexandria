import { describe, expect, it } from 'vitest';
import { parseMarkdown } from 'logos/doc/parse';
import { headingTitle } from './headingTitle';

const title = (md: string) => headingTitle(parseMarkdown(md));

describe('titolo dal primo H1', () => {
  it('solo se il primo blocco e\' un H1 con del testo', () => {
    expect(title('# Capitolo *primo*\n\nTesto')).toBe('Capitolo primo');
    expect(title('Testo\n\n# Dopo')).toBeNull();
    expect(title('## Sezione\n\nTesto')).toBeNull();
    expect(title('#  \n\nTesto')).toBeNull();
    expect(title('')).toBeNull();
  });

  it('senza note a pie\' di pagina e con gli spazi normalizzati', () => {
    expect(title('# La   tesi[^1]\n\n[^1]: nota')).toBe('La tesi');
  });
});
