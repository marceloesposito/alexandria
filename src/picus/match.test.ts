import { describe, it, expect } from 'vitest';
import { parsePack } from './pack';
import { buildMorph } from './inflect';
import { buildLexicon, findMatches } from './match';
import { tokenize } from './tokens';

const SRC = `@meta
lang en
@paradigm
slots base 3sg past pp ing
base base
irregular base past pp
rule 3sg *>+s
rule past e>+d *>+ed
rule pp past
rule ing e>-1+ing *>+ing
verbs look
@irregular
take took taken
@sense consequence
as a result 0
therefore +1
@sense cause
as a result of 0
because of 0
@sense resemblance
look like 0
@sense take it into account
take * into account 0
consider * 0
`;

const pack = parsePack(SRC);
const lex = buildLexicon(pack, buildMorph(pack));
const find = (text: string) =>
  findMatches(lex, tokenize(text)).map((m) => {
    const toks = tokenize(text);
    return text.slice(toks[m.start].start, toks[m.end - 1].end);
  });

describe('trie delle locuzioni', () => {
  it('leftmost-longest e a parole intere', () => {
    expect(find('As a result of the storm, and as a result, therefore.')).toEqual(['As a result of', 'as a result', 'therefore']);
    expect(find('thereforeX asa result')).toEqual([]);
  });

  it('le forme flesse del verbo iniziale', () => {
    expect(find('She looks like him; they looked like us; looking like it')).toEqual(['looks like', 'looked like', 'looking like']);
    const m = findMatches(lex, tokenize('It looked like rain'))[0];
    expect(m.hits.map((h) => h.slot)).toEqual(['past', 'pp']);
  });

  it('non attraversano la punteggiatura o il paragrafo', () => {
    expect(find('look, like this')).toEqual([]);
    expect(find('look\n\nlike')).toEqual([]);
    expect(find('look\nlike')).toEqual(['look\nlike']);
  });

  it('il vuoto "*" prende da una a tre parole, e "consider *" non si cerca', () => {
    expect(find('we took the risk into account')).toEqual(['took the risk into account']);
    expect(find('we took it into account')).toEqual(['took it into account']);
    expect(find('take all of the risks into account')).toEqual([]);
    expect(find('take, risk into account')).toEqual([]);
    expect(find('consider the risk')).toEqual([]);
    const m = findMatches(lex, tokenize('we took the risk into account'))[0];
    expect(m.gap).toEqual([2, 4]);
  });
});

describe('preposizioni articolate', () => {
  const p = parsePack(`@meta\nlang it\nelision on\n@prep\ndi del:il della:la dell':l'\n@sense considerare\ntenere conto di 0\n`);
  const l = buildLexicon(p, buildMorph(p));
  it('"tenere conto di" vale anche per del, della, dell\'', () => {
    for (const [text, art] of [
      ['tenere conto di questo', ''],
      ['tenere conto della data', 'la'],
      ["tenere conto dell'anno", "l'"],
    ]) {
      const m = findMatches(l, tokenize(text, true))[0];
      expect(m.hits[0].article, text).toBe(art);
    }
  });
});
