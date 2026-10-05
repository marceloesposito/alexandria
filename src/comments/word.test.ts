import { describe, it, expect } from 'vitest';
import { parseWordReview, planReview, locate } from './word';

const doc = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
const r = (t: string) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`;
const ins = (t: string, a = 'Prof. Rossi') => `<w:ins w:id="1" w:author="${a}" w:date="2026-10-05T10:00:00Z">${r(t)}</w:ins>`;
const del = (t: string, a = 'Prof. Rossi') => `<w:del w:id="2" w:author="${a}" w:date="2026-10-05T10:00:00Z"><w:r><w:delText xml:space="preserve">${t}</w:delText></w:r></w:del>`;
const comments = `<?xml version="1.0"?><w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="7" w:author="Prof. Rossi" w:date="2026-10-05T10:00:00Z"><w:p><w:r><w:t>Citare la fonte</w:t></w:r></w:p></w:comment></w:comments>`;

describe('revisione da Word', () => {
  const xml = doc(
    `<w:p>${r('La memoria collettiva è ')}${del('sempre')}${ins('spesso')}${r(' un fatto sociale.')}</w:p>` +
      `<w:p>${r('Secondo Halbwachs ')}<w:commentRangeStart w:id="7"/>${r('i quadri sociali')}<w:commentRangeEnd w:id="7"/>${r(' contano.')}</w:p>`,
  );
  const review = parseWordReview(xml, comments);

  it('legge paragrafi, revisioni con autore e data, intervalli dei commenti', () => {
    expect(review.paragraphs[0].map((x) => [x.kind, x.text])).toEqual([
      ['normal', 'La memoria collettiva è '],
      ['del', 'sempre'],
      ['ins', 'spesso'],
      ['normal', ' un fatto sociale.'],
    ]);
    expect(review.paragraphs[0][1]).toMatchObject({ author: 'Prof. Rossi', date: '2026-10-05' });
    expect(review.paragraphs[1][1]).toMatchObject({ text: 'i quadri sociali', comments: ['7'] });
    expect(review.comments).toEqual([{ id: '7', author: 'Prof. Rossi', date: '2026-10-05', text: 'Citare la fonte' }]);
  });

  it('ritrova revisioni e commenti nel testo della pergamena', () => {
    const text = 'Titolo\nLa memoria collettiva è sempre un fatto sociale.\nSecondo Halbwachs i quadri sociali contano.';
    const plan = planReview(text, review);
    const del0 = plan.changes.find((c) => c.kind === 'deletion')!;
    expect(text.slice(...del0.at)).toBe('sempre');
    const ins0 = plan.changes.find((c) => c.kind === 'insertion')!;
    expect(ins0.at[0]).toBe(del0.at[1]);
    expect(text.slice(...plan.comments[0].at!)).toBe('i quadri sociali');
    expect(plan.missed).toEqual([]);
  });

  it('quello che non si ritrova finisce fra le revisioni mancate', () => {
    const plan = planReview('Un testo del tutto diverso.', review);
    expect(plan.changes).toEqual([]);
    expect(plan.missed.length).toBe(2);
    expect(plan.comments[0].at).toBeNull();
  });

  it('una parola corta ripetuta senza contesto non si ancora a caso', () => {
    expect(locate('il il il', 'xyz ', 'il', ' abc')).toBeNull();
    expect(locate('alfa beta gamma', 'alfa ', 'beta', ' gamma')).toEqual([5, 9]);
    expect(locate('alfa beta gamma', 'alfa ', '', 'beta gamma')).toEqual([5, 5]);
  });
});
