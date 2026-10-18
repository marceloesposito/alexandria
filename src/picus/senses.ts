// Picus: regole per scegliere il senso di una locuzione ambigua ("looks like" = somiglia o sembra).
// Codice dell'app, non del pacchetto: un pacchetto porta solo dati. Una regola restituisce il nome
// del senso, o null se non sa decidere (allora si propongono tutti i sensi, etichettati).
import type { Token } from './tokens';

export type SenseRule = (tokens: Token[], start: number, end: number) => string | null;

const SUBJECTS = new Set(['i', 'you', 'he', 'she', 'we', 'they', 'it', 'there', 'someone', 'somebody', 'everyone', 'everybody', 'nobody', 'no-one', 'something', 'nothing', 'everything']);
const DETERMINERS = new Set(['the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'some', 'many', 'most', 'all', 'no']);
const FINITE = /^(is|are|was|were|am|will|would|can|could|may|might|must|shall|should|has|have|had|do|does|did|isn't|aren't|wasn't|weren't|won't|wouldn't|can't|couldn't|hasn't|haven't|hadn't|doesn't|don't|didn't)$|^[a-z]+(?:ed)$/;

/**
 * "look like": dopo viene una frase (soggetto + verbo) -> "seeming" ("it looks like we are late");
 * altrimenti un nome -> "resemblance" ("she looks like her mother").
 */
const lookLike: SenseRule = (tokens, _start, end) => {
  const next = tokens[end];
  if (!next || next.brk) return 'resemblance';
  if (SUBJECTS.has(next.w) && next.w !== 'it' && next.w !== 'there') {
    // "you look like you need sleep": pronome soggetto + verbo
    const after = tokens[end + 1];
    return after && !after.brk ? 'seeming' : 'resemblance';
  }
  if (next.w === 'it' || next.w === 'there') {
    const after = tokens[end + 1];
    return after && FINITE.test(after.w) ? 'seeming' : 'resemblance';
  }
  if (DETERMINERS.has(next.w)) {
    // "it looks like the plan will fail": un verbo finito entro quattro parole
    for (let k = end + 1; k < Math.min(end + 5, tokens.length); k++) {
      if (tokens[k].brk) break;
      if (FINITE.test(tokens[k].w)) return 'seeming';
    }
    return 'resemblance';
  }
  return null;
};

/** regole per lingua e per forma base della locuzione */
export const SENSE_RULES: Record<string, Record<string, SenseRule>> = {
  en: { 'look like': lookLike },
};
