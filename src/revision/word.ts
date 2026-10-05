// Import della revisione fatta in Word: le revisioni tracciate del .docx diventano revisioni della
// pergamena (da accettare o rifiutare) e i commenti diventano Marginalia con provenienza "Word".
import JSZip from 'jszip';
import { platform } from '../platform';
import { getEditor } from '../state/editorRef';
import { useWorkspace } from '../state/workspace';
import { useComments } from '../comments/store';
import { flatText } from '../comments/plugin';
import { makeAnchor, newCommentId, statusFields, type Comment } from '../comments/model';
import { parseWordReview, planReview, type WordReview } from '../comments/word';
import { checkpoint } from '../versions/actions';
import { t } from '../i18n';

export async function readWordReview(data: Uint8Array): Promise<WordReview> {
  const zip = await JSZip.loadAsync(data);
  const docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) throw new Error(t('word.notDocx'));
  const commentsXml = await zip.file('word/comments.xml')?.async('string');
  return parseWordReview(docXml, commentsXml ?? null);
}

const iso = (d: string) => (d ? `${d}T12:00:00.000Z` : new Date().toISOString());

/** Applica la revisione alla pergamena aperta; restituisce quante revisioni e commenti sono entrati. */
export async function applyWordReview(review: WordReview): Promise<{ changes: number; comments: number; missed: number }> {
  const editor = getEditor();
  if (!editor) return { changes: 0, comments: 0, missed: 0 };
  // prima una versione di sicurezza: l'import si può sempre annullare dal Palimpsestus
  await checkpoint(t('word.checkpoint'));
  const flat = flatText(editor.state.doc);
  const plan = planReview(flat.text, review);
  const { schema } = editor.state;
  const tr = editor.state.tr;
  const pos = (i: number) => flat.map[i] ?? (flat.map.length ? flat.map[flat.map.length - 1] + 1 : 0);
  for (const c of plan.changes) {
    const attrs = { author: c.author, date: c.date || null };
    if (c.kind === 'deletion') tr.addMark(pos(c.at[0]), pos(c.at[1] - 1) + 1, schema.marks.deletion.create(attrs));
    else {
      const at = pos(c.at[0]);
      tr.insertText(c.text, at);
      tr.addMark(at, at + c.text.length, schema.marks.insertion.create(attrs));
    }
  }
  if (plan.changes.length) editor.view.dispatch(tr);

  // commenti: si ancorano sul testo già aggiornato
  const after = flatText(editor.state.doc);
  const plan2 = planReview(after.text, review);
  const made: Comment[] = [];
  const base = () => ({ offsetX: null, offsetY: null, commits: [] as string[], replies: [], ...statusFields('open') });
  for (const pc of plan2.comments) {
    const anchor = pc.at ? makeAnchor(after, after.map[pc.at[0]], after.map[pc.at[1] - 1] + 1, 'text') : null;
    made.push({ ...base(), id: newCommentId(), author: pc.comment.author || 'Word', body: pc.comment.text, created: iso(pc.comment.date), anchor, origin: { kind: 'word', name: pc.comment.author || undefined } });
  }
  for (const m of plan.missed) {
    const what = m.kind === 'insertion' ? t('word.missedIns', { text: m.text, context: m.context }) : t('word.missedDel', { text: m.text, context: m.context });
    made.push({ ...base(), id: newCommentId(), author: m.author, body: what, created: new Date().toISOString(), anchor: null, origin: { kind: 'word', name: m.author } });
  }
  useComments.getState().addMany(made);
  return { changes: plan.changes.length, comments: plan2.comments.length, missed: plan.missed.length };
}

/** Comando: sceglie il .docx del relatore e lo applica alla pergamena aperta. */
export async function importWordReview() {
  const ws = useWorkspace.getState();
  if (!ws.activeDoc) return;
  const [path] = await platform.pickFiles(t('word.pick'));
  if (!path) return;
  try {
    const review = await readWordReview(await platform.readBytes(path));
    const r = await applyWordReview(review);
    ws.toast(t('word.done', { changes: r.changes, comments: r.comments, missed: r.missed }), r.missed ? 'info' : 'ok');
  } catch (e) {
    ws.toast(String(e instanceof Error ? e.message : e), 'error');
  }
}
