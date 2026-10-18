// Picus: parole del testo con gli offset nel testo originale. La forma normalizzata (minuscole,
// apostrofo dritto) serve al confronto; start/end restano quelli del testo com'e' scritto.

export interface Token {
  /** forma normalizzata */
  w: string;
  start: number;
  end: number;
  /** prima della parola c'e' punteggiatura (o e' la prima): le locuzioni non la attraversano */
  brk: boolean;
  /** prima della parola finisce una frase (. ! ? o inizio del testo) */
  sent: boolean;
  /** prima della parola c'e' un a capo doppio: la finestra delle ripetizioni riparte */
  para: boolean;
}

// lettere e cifre, con apostrofi e trattini interni ("don't", "well-known"); l'apostrofo finale
// resta attaccato ("po'", "dell'" dopo la divisione)
const WORD = /[\p{L}\p{N}]+(?:[-'’ʼ][\p{L}\p{N}]+)*['’ʼ]?/gu;

export function normalize(s: string): string {
  return s.toLowerCase().replace(/[’‘ʼ]/g, "'");
}

/**
 * Parole del testo. Con `elision` (italiano) "dell'analisi" diventa "dell'" + "analisi" e
 * "l'altro" diventa "l'" + "altro"; in inglese "don't" e "John's" restano interi.
 */
export function tokenize(text: string, elision = false): Token[] {
  const out: Token[] = [];
  let last = 0;
  WORD.lastIndex = 0;
  for (let m = WORD.exec(text); m; m = WORD.exec(text)) {
    const gap = text.slice(last, m.index);
    const first = !out.length;
    const para = !first && /\n\s*\n/.test(gap);
    const brk = first || para || /[^\s"'“”‘’«»()\[\]]/u.test(gap);
    const sent = first || /[.!?…:;]/.test(gap) || /\n/.test(gap);
    last = m.index + m[0].length;
    const pieces: [string, number][] = [];
    if (elision) {
      const re = /['’ʼ](?=[\p{L}\p{N}])/gu;
      let from = 0;
      for (let e = re.exec(m[0]); e; e = re.exec(m[0])) {
        pieces.push([m[0].slice(from, e.index + 1), from]);
        from = e.index + 1;
      }
      pieces.push([m[0].slice(from), from]);
    } else pieces.push([m[0], 0]);
    pieces.forEach(([p, off], i) => {
      const start = m!.index + off;
      out.push({ w: normalize(p), start, end: start + p.length, brk: i === 0 && brk, sent: i === 0 && sent, para: i === 0 && para });
    });
  }
  return out;
}
