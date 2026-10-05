// Andata e ritorno con Word: revisioni e commenti esportati in .docx si rileggono uguali.
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { parseMarkdown } from '../doc/parse';
import { toDocx } from '../export/docx';
import { injectCommentMarks } from '../export/comments';
import { parseWordReview, planReview } from '../comments/word';
import { defaultDocSettings } from '../layout/model';
import type { ExportContext } from '../export/context';

describe('andata e ritorno .docx', () => {
  it('revisioni tracciate e commenti sopravvivono a Word', async () => {
    const doc = parseMarkdown('La memoria è <del data-author="Rossi" data-date="2026-10-05">sempre</del><ins data-author="Rossi" data-date="2026-10-05">spesso</ins> sociale.');
    // "La memoria è " = 13 caratteri, testo da 1: commento su "memoria" (4..11)
    const comments = [{ id: 1, from: 4, to: 11, author: 'Rossi', date: '2026-10-05', text: 'Definire', replies: [] }];
    const ctx: ExportContext = {
      settings: defaultDocSettings('it'),
      title: 'Prova',
      lang: 'it',
      cite: () => ({ text: '', note: false }),
      image: () => null,
      math: () => null,
      comments,
    };
    const bytes = await toDocx(injectCommentMarks(doc, comments), ctx);
    const zip = await JSZip.loadAsync(bytes);
    const review = parseWordReview(await zip.file('word/document.xml')!.async('string'), await zip.file('word/comments.xml')?.async('string'));
    const runs = review.paragraphs.flat();
    expect(runs.find((r) => r.kind === 'del')).toMatchObject({ text: 'sempre', author: 'Rossi' });
    expect(runs.find((r) => r.kind === 'ins')).toMatchObject({ text: 'spesso', author: 'Rossi' });
    expect(review.comments[0]).toMatchObject({ author: 'Rossi', text: 'Definire' });
    const text = 'La memoria è sempre sociale.';
    const plan = planReview(text, review);
    expect(text.slice(...plan.comments[0].at!)).toBe('memoria');
  });
});
