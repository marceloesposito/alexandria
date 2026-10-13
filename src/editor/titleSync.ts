// Nome della pergamena dal suo H1: se il primo blocco e' un titolo di livello 1, al salvataggio il
// file prende quel nome (preferenza `titleFromHeading`). La pergamena resta aperta com'e':
// cursore, annulla e Marginalia non si perdono. Mentre si scrive dentro il titolo si aspetta
// (niente nomi a meta' parola); con Salva (Cmd/Ctrl+S) si rinomina subito.
import type { PMNode } from 'logos/doc/types';
import { useWorkspace } from '../state/workspace';
import { getEditor } from '../state/editorRef';
import { safeFileName, titleFromRel } from '../vault/paths';
import { useComments, saveNow as saveComments } from '../comments/store';
import { useReview } from '../recensio/session';
import { useDoc, moveOpenDoc, onAfterSave } from './session';
import { headingTitle } from './headingTitle';

let busy = false;
/** ultimo tentativo andato a vuoto (nome gia' preso): non si riprova a ogni salvataggio */
let lastMiss = '';

export async function syncTitleFromHeading(force = false): Promise<void> {
  const ws = useWorkspace.getState();
  if (busy || !ws.app.prefs.titleFromHeading || !ws.vaultRoot) return;
  // nella copia per revisione i nomi delle pergamene sono quelli dell'autore
  if (useReview.getState().session) return;
  const d = useDoc.getState();
  const rel = d.rel;
  const e = getEditor();
  if (!rel || !e || d.sourceMode || ws.activeDoc !== rel) return;
  const first = e.state.doc.firstChild;
  if (!force && first?.type.name === 'heading' && e.state.selection.$from.depth >= 1 && e.state.selection.$from.index(0) === 0) return;
  const want = headingTitle(e.getJSON() as PMNode);
  if (!want || safeFileName(want) === titleFromRel(rel)) return;
  const key = `${rel}|${want}`;
  if (key === lastMiss && !force) return;
  busy = true;
  try {
    await saveComments();
    const comments = useComments.getState().rel === rel;
    if (comments) useComments.setState({ rel: null });
    const to = await moveOpenDoc(rel, async () => {
      await useWorkspace.getState().renameDoc(rel, want);
      return useWorkspace.getState().activeDoc ?? rel;
    });
    if (comments) useComments.setState({ rel: to });
    lastMiss = to === rel || safeFileName(want) !== titleFromRel(to) ? `${to}|${want}` : '';
  } finally {
    busy = false;
  }
}

export function registerTitleSync() {
  onAfterSave(() => void syncTitleFromHeading());
}
