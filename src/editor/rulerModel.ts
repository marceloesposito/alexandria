// Righelli della vista Pagina: posizioni delle etichette in centimetri e stima dei salti di pagina.
// Tutte le misure in millimetri; lo zero e' l'inizio della colonna di testo (come in Word).

export interface RulerLabel {
  /** distanza dal bordo del righello, in mm */
  at: number;
  /** numero mostrato (centimetri dallo zero, sempre positivo) */
  cm: number;
}

/** Etichette ogni centimetro su un righello lungo `lengthMm`, con lo zero a `zeroMm` dal bordo. */
export function rulerLabels(lengthMm: number, zeroMm: number): RulerLabel[] {
  const out: RulerLabel[] = [];
  const first = Math.ceil(-zeroMm / 10);
  const last = Math.floor((lengthMm - zeroMm) / 10);
  for (let k = first; k <= last; k++) {
    if (k === 0) continue;
    out.push({ at: zeroMm + k * 10, cm: Math.abs(k) });
  }
  return out;
}

/**
 * Salti di pagina stimati sul righello verticale: il testo comincia a `textTopMm`
 * e ogni pagina contiene `textHeightMm` di testo. Restituisce posizione e numero della pagina che inizia.
 */
export function pageStarts(totalMm: number, textTopMm: number, textHeightMm: number): { at: number; page: number }[] {
  if (textHeightMm <= 0) return [];
  const out: { at: number; page: number }[] = [];
  for (let p = 2, at = textTopMm + textHeightMm; at < totalMm; p++, at += textHeightMm) out.push({ at, page: p });
  return out;
}
