// Colonna centrale: la pagina con l'editor a blocchi, i numeri di riga e la vista sorgente.
// Due aspetti: Pagina (foglio con margini e righelli) o Senza bordi (testo a tutta colonna).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import DragHandle from '@tiptap/extension-drag-handle-react';
import { GripVertical } from 'lucide-react';
import { TextSelection } from '@tiptap/pm/state';
import { buildExtensions } from './extensions';
import { setEditor, getEditor } from '../state/editorRef';
import { useWorkspace } from '../state/workspace';
import { getWritingLang, useWritingLang } from '../i18n/writing';
import { useDoc, loadDocument, scheduleSave, flushSave, updateSelectionCounts, checkExternalChange } from './session';
import { measureLines, setLines } from './lines';
import { LineGutter } from './LineGutter';
import { SourceView } from './SourceView';
import { notifyCommandState } from '../commands/registry';
import { useDocSettings, pageMetrics } from '../layout/docSettings';
import { EDITOR_FONT, styleFont } from '../layout/model';
import { HorizontalRuler, VerticalRuler, RULER_SPACE_PX } from './Rulers';
import { useZen } from '../state/zen';
import { DocHeader } from './DocHeader';

interface Props {
  /** sovrapposizioni allineate alla pagina (evidenziazione righe dei commenti, connettori) */
  overlay?: ReactNode;
  pageRef?: React.RefObject<HTMLDivElement | null>;
}

export function EditorPane({ overlay, pageRef: externalPageRef }: Props) {
  const vaultRoot = useWorkspace((s) => s.vaultRoot);
  const activeDoc = useWorkspace((s) => s.activeDoc);
  const reloadToken = useWorkspace((s) => s.reloadToken);
  const prefs = useWorkspace((s) => s.app.prefs);
  const writingLang = useWritingLang();
  const sourceMode = useDoc((s) => s.sourceMode);
  const layout = useDocSettings((s) => s.settings.layout);
  const localPageRef = useRef<HTMLDivElement>(null);
  const pageRef = externalPageRef ?? localPageRef;
  const scrollRef = useRef<HTMLDivElement>(null);
  const measureRaf = useRef(0);
  const [fit, setFit] = useState(1);
  const zen = useZen((s) => s.on);
  // la scrittura minimale e' sempre senza bordi, senza righelli e senza numeri di riga
  const borderless = zen || prefs.editorLayout === 'borderless';
  const lineNumbers = prefs.lineNumbers && !zen;
  const rulers = !borderless && prefs.rulers && !sourceMode;

  const scheduleMeasure = () => {
    cancelAnimationFrame(measureRaf.current);
    measureRaf.current = requestAnimationFrame(() => {
      const page = pageRef.current;
      const pm = page?.querySelector('.ProseMirror') as HTMLElement | null;
      if (page && pm) setLines(measureLines(pm, page));
    });
  };

  const editor = useEditor({
    extensions: buildExtensions(),
    editorProps: {
      attributes: { class: 'doc-body', spellcheck: String(prefs.spellcheck), lang: getWritingLang() },
    },
    onUpdate: ({ editor }) => {
      scheduleSave(editor);
      scheduleMeasure();
      notifyCommandState();
    },
    onSelectionUpdate: ({ editor }) => {
      updateSelectionCounts(editor);
      notifyCommandState();
    },
  });

  // riferimento globale all'editor (con StrictMode la distruzione del primo arriva dopo la creazione del secondo)
  useEffect(() => {
    if (!editor) return;
    setEditor(editor);
    return () => {
      if (getEditor() === editor || getEditor() === null) setEditor(null);
    };
  }, [editor]);

  // carica il documento attivo (e ricarica dopo checkout, merge, ripristino)
  useEffect(() => {
    if (!editor || !vaultRoot || !activeDoc) return;
    let cancelled = false;
    void (async () => {
      await loadDocument(editor, vaultRoot, activeDoc);
      if (cancelled) return;
      const cur = useWorkspace.getState().app.cursors[`${vaultRoot}|${activeDoc}`];
      if (cur) {
        const pos = Math.min(cur.pos, editor.state.doc.content.size);
        try {
          editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(pos))));
        } catch {
          /* posizione non piu' valida */
        }
        requestAnimationFrame(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = cur.scroll;
        });
      }
      editor.commands.focus();
      scheduleMeasure();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, vaultRoot, activeDoc, reloadToken]);

  // ricorda posizione del cursore e scorrimento
  useEffect(() => {
    if (!editor || !activeDoc) return;
    let timer: ReturnType<typeof setTimeout>;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        useWorkspace.getState().setCursor(activeDoc, editor.state.selection.from, scrollRef.current?.scrollTop ?? 0);
      }, 800);
    };
    editor.on('selectionUpdate', save);
    const sc = scrollRef.current;
    sc?.addEventListener('scroll', save);
    return () => {
      clearTimeout(timer);
      editor.off('selectionUpdate', save);
      sc?.removeEventListener('scroll', save);
    };
  }, [editor, activeDoc]);

  // misura le righe quando cambiano dimensioni, zoom o font caricati
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const ro = new ResizeObserver(() => scheduleMeasure());
    ro.observe(page);
    void document.fonts?.ready.then(() => scheduleMeasure());
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, sourceMode]);

  useEffect(() => {
    scheduleMeasure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.zoom, lineNumbers, layout, fit, borderless]);

  // la pagina si riduce per stare nella colonna quando lo spazio non basta
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const ro = new ResizeObserver(() => {
      if (borderless) return setFit(1);
      const mm = 96 / 25.4;
      const pm = pageMetrics(layout);
      const pageW = (pm.textWidthMm + 2 * pm.padXmm) * mm;
      // con i righelli resta spazio a sinistra per quello verticale (e a destra, per centrare)
      const avail = sc.clientWidth - 48 - (rulers ? 2 * RULER_SPACE_PX : 0);
      setFit(Math.min(1, Math.max(0.35, avail / (pageW * prefs.zoom))));
    });
    ro.observe(sc);
    return () => ro.disconnect();
  }, [layout, prefs.zoom, borderless, rulers]);

  // file modificati fuori dall'app
  useEffect(() => {
    const h = () => void checkExternalChange();
    window.addEventListener('focus', h);
    return () => window.removeEventListener('focus', h);
  }, []);

  // salva prima di chiudere la finestra
  useEffect(() => {
    const h = () => void flushSave(editor);
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [editor]);

  useEffect(() => {
    editor?.view.dom.setAttribute('spellcheck', String(prefs.spellcheck));
  }, [editor, prefs.spellcheck]);

  // lingua del testo (controllo ortografico e sillabazione): quella del Compendium, non dell'interfaccia
  useEffect(() => {
    editor?.view.dom.setAttribute('lang', writingLang);
  }, [editor, writingLang]);

  const m = pageMetrics(layout);
  const style = {
    '--page-width': `${m.textWidthMm}mm`,
    '--page-pad-x': borderless ? '17mm' : `${m.padXmm}mm`,
    '--page-font-size': `${layout.fontSizePt}pt`,
    '--page-leading': String(layout.leading),
    // carattere del corpo (stile "corpo", o quello del documento) e degli stili che ne hanno uno loro
    '--page-font': EDITOR_FONT[styleFont(layout.styles.body, layout)],
    ...Object.fromEntries((['h1', 'h2', 'h3', 'quote', 'caption'] as const).map((id) => [`--style-font-${id}`, layout.styles[id].font !== 'inherit' ? EDITOR_FONT[layout.styles[id].font as 'serif'] : 'var(--page-font)'])),
    zoom: prefs.zoom * fit,
  } as React.CSSProperties;

  return (
    <div
      className={`editor-scroll ${prefs.focusMode ? 'is-focus' : ''} ${borderless ? 'is-borderless' : 'is-paged'} ${rulers ? 'has-rulers' : ''}`}
      ref={scrollRef}
    >
      {rulers && <HorizontalRuler textWidthMm={m.textWidthMm} padXmm={m.padXmm} style={{ zoom: style.zoom }} />}
      {sourceMode ? (
        <div className="page page--source" style={style}>
          <SourceView />
        </div>
      ) : (
        <div className={`page ${borderless ? 'page--borderless' : ''}`} ref={pageRef} style={style} data-columns={layout.columns}>
          {rulers && <VerticalRuler pageRef={pageRef} textHeightMm={m.textHeightMm} />}
          {lineNumbers && <LineGutter />}
          {overlay}
          {editor && (
            <DragHandle editor={editor} className="drag-handle">
              <GripVertical size={14} />
            </DragHandle>
          )}
          <DocHeader borderless={borderless} />
          <EditorContent editor={editor} />
        </div>
      )}
    </div>
  );
}
