import { describe, expect, it } from 'vitest';
import { defaultLayout } from 'logos/layout/model';
import { withFont, withFontSize } from './fontChoice';

describe('carattere e corpo del documento', () => {
  it('il carattere scelto aggiorna anche serif/sans', () => {
    expect(withFont('times')).toEqual({ fontFamily: 'times', font: 'serif' });
    expect(withFont('arial')).toEqual({ fontFamily: 'arial', font: 'sans' });
    expect(withFont('boh')).toEqual({});
  });

  it('il corpo vale per il documento e per lo stile del corpo, a mezzi punti', () => {
    const r = withFontSize(defaultLayout(), 11.3);
    expect(r.fontSizePt).toBe(11.5);
    expect(r.styles?.body.sizePt).toBe(11.5);
    expect(withFontSize(defaultLayout(), 2).fontSizePt).toBe(6);
  });
});
