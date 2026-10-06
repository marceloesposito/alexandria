// Colonna sinistra dello Scriptorium: quante fonti cita la pergamena e la bibliografia in un clic.
import { useEffect, useMemo, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { BookMarked } from 'lucide-react';
import { getEditor, onEditor } from '../state/editorRef';
import { runCommand } from '../commands/registry';
import { useResources } from '../resources/store';
import { keysInDoc } from './store';
import { t, tn, useLang } from '../i18n';

export interface BibStatus {
  keys: string[];
  hasBibliography: boolean;
}

/** Chiavi citate (in ordine, senza doppioni) e presenza di una bibliografia nel testo. */
export function bibStatus(editor: Editor | null): BibStatus {
  if (!editor) return { keys: [], hasBibliography: false };
  let hasBibliography = false;
  editor.state.doc.descendants((n) => {
    if (n.type.name === 'bibliography') hasBibliography = true;
    return !hasBibliography;
  });
  return { keys: keysInDoc(editor), hasBibliography };
}

/** Citazioni che trovano una fonte dell'Armarium e citazioni senza fonte. */
export function splitCited(keys: string[], sourceKeys: Set<string>): { found: number; missing: number } {
  const found = keys.filter((k) => sourceKeys.has(k)).length;
  return { found, missing: keys.length - found };
}

export function BibliographySection() {
  useLang();
  const [st, setSt] = useState<BibStatus>(() => bibStatus(getEditor()));
  const resources = useResources((s) => s.resources);
  const sourceKeys = useMemo(() => new Set(resources.filter((r) => r.isSource && r.citeKey).map((r) => r.citeKey!)), [resources]);
  const { found, missing } = splitCited(st.keys, sourceKeys);

  useEffect(() => {
    let editor = getEditor();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setSt(bibStatus(editor)), 300);
    };
    const attach = (e: Editor | null) => {
      editor?.off('update', refresh);
      editor = e;
      e?.on('update', refresh);
      setSt(bibStatus(e));
    };
    attach(editor);
    const off = onEditor(attach);
    return () => {
      off();
      clearTimeout(timer);
      editor?.off('update', refresh);
    };
  }, []);

  return (
    <section className="side-section">
      <header className="side-section__head">
        <BookMarked size={12} />
        <span>{t('side.bibliography')}</span>
      </header>
      <p className="hint side-empty">
        {st.keys.length ? tn('side.bibCited', found) : t('side.bibNoCitations')}
        {missing > 0 && <> · {tn('side.bibMissing', missing)}</>}
      </p>
      <button className="btn side-bib__btn" disabled={!found} title={t('cmd.cite.bibliographyHint')} onClick={() => void runCommand('cite.bibliography')}>
        <BookMarked size={14} /> {st.hasBibliography ? t('side.bibUpdate') : t('cmd.cite.bibliography')}
      </button>
    </section>
  );
}
