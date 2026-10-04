// Vista sorgente: il Markdown com'e' sul disco, con i numeri delle righe del file.
import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { useDoc, sourceChanged } from './session';
import { useWorkspace } from '../state/workspace';

let sourceView: EditorView | null = null;
export function getSourceView(): EditorView | null {
  return sourceView;
}

export function SourceView() {
  const host = useRef<HTMLDivElement>(null);
  const showNumbers = useWorkspace((s) => s.app.prefs.lineNumbers);

  useEffect(() => {
    if (!host.current) return;
    const state = EditorState.create({
      doc: useDoc.getState().sourceText,
      extensions: [
        showNumbers ? lineNumbers() : [],
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        markdown(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        highlightSelectionMatches(),
        EditorView.lineWrapping,
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) sourceChanged(u.state.doc.toString());
        }),
      ],
    });
    const view = new EditorView({ state, parent: host.current });
    sourceView = view;
    view.focus();
    return () => {
      sourceView = null;
      view.destroy();
    };
  }, [showNumbers]);

  return <div ref={host} className="source-view" />;
}
