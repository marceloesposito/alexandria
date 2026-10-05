// Indice del documento (H1, H2, H3) nella colonna sinistra: si aggiorna mentre si scrive,
// evidenzia la sezione in cui si trova il cursore e porta al titolo con un clic.
import { useEffect, useState } from 'react';
import { TextSelection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/core';
import { getEditor, onEditor } from '../state/editorRef';
import { t, useLang } from '../i18n';

export interface OutlineItem {
  level: number;
  text: string;
  pos: number;
}

export function outlineOf(editor: Editor | null): OutlineItem[] {
  if (!editor) return [];
  const out: OutlineItem[] = [];
  editor.state.doc.descendants((n, pos) => {
    if (n.type.name === 'heading' && n.attrs.level <= 3) {
      out.push({ level: n.attrs.level, text: n.textContent.trim(), pos });
      return false;
    }
    return n.type.name !== 'paragraph';
  });
  return out;
}

export function OutlinePanel() {
  useLang();
  const [items, setItems] = useState<OutlineItem[]>(() => outlineOf(getEditor()));
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    let editor = getEditor();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setItems(outlineOf(editor)), 150);
    };
    const sel = () => editor && setCursor(editor.state.selection.from);
    const attach = (e: Editor | null) => {
      editor?.off('update', refresh);
      editor?.off('selectionUpdate', sel);
      editor = e;
      e?.on('update', refresh);
      e?.on('selectionUpdate', sel);
      setItems(outlineOf(e));
    };
    attach(editor);
    const off = onEditor(attach);
    return () => {
      off();
      clearTimeout(timer);
      editor?.off('update', refresh);
      editor?.off('selectionUpdate', sel);
    };
  }, []);

  // sezione corrente: l'ultimo titolo prima del cursore
  const current = items.reduce((acc, it, i) => (it.pos <= cursor ? i : acc), -1);

  const go = (it: OutlineItem) => {
    const e = getEditor();
    if (!e) return;
    const pos = Math.min(it.pos + 1, e.state.doc.content.size);
    e.view.dispatch(e.state.tr.setSelection(TextSelection.near(e.state.doc.resolve(pos))));
    e.commands.focus();
    const dom = e.view.nodeDOM(it.pos) as HTMLElement | null;
    dom?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  return (
    <section className="side-section outline">
      {!items.length && <p className="hint side-empty">{t('outline.empty')}</p>}
      <ul className="tree" role="tree">
        {items.map((it, i) => (
          <li
            key={`${it.pos}-${i}`}
            role="treeitem"
            className={`tree__item outline__item level-${it.level} ${i === current ? 'is-active' : ''}`}
            onClick={() => go(it)}
            title={it.text}
          >
            <span className="outline__level">H{it.level}</span>
            <span className="tree__label">{it.text || t('outline.untitled')}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
