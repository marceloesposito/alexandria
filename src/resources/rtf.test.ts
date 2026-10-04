import { describe, it, expect } from 'vitest';
import { rtfToText } from './rtf';

// costruito con join per evitare che il trasformatore interpreti \u nelle stringhe
const B = String.fromCharCode(92);

describe('RTF', () => {
  it('testo, a capo, accenti e unicode', () => {
    const rtf = [
      `{${B}rtf1${B}ansi${B}deff0{${B}fonttbl{${B}f0 Times;}}{${B}colortbl;${B}red0${B}green0${B}blue0;}`,
      `{${B}*${B}generator Word;}${B}f0${B}fs24 Citt${B}'e0 e {${B}b memoria}${B}par`,
      `Seconda riga con ${B}u8220?virgolette${B}u8221? e ${B}{graffe${B}}.${B}par}`,
    ].join('\n');
    expect(rtfToText(rtf)).toBe('Città e memoria\nSeconda riga con “virgolette” e {graffe}.');
  });
});
