// Schermata Editor: tre colonne (risorse e pin | pagina | commenti), piu' l'anteprima opzionale.
import { useRef } from 'react';
import { EditorPane } from './EditorPane';
import { DocumentsTree } from './DocumentsTree';
import { useWorkspace } from '../state/workspace';
import { FindReplace } from '../shell/dialogs/FindReplace';
import { Splitter } from '../components/Splitter';
import { leftPanelSections, rightPanel, centerOverlay, previewPanel } from './slots';

export function EditorView() {
  const prefs = useWorkspace((s) => s.app.prefs);
  const dialog = useWorkspace((s) => s.dialog);
  const pageRef = useRef<HTMLDivElement>(null);
  const Right = rightPanel.get();
  const Overlay = centerOverlay.get();
  const Preview = previewPanel.get();
  const set = useWorkspace.getState().setPrefs;

  return (
    <div className={`editor-view ${prefs.focusMode ? 'is-focus' : ''}`}>
      {prefs.showLeft && !prefs.focusMode && (
        <>
          <aside className="side side--left" style={{ width: prefs.leftWidth }}>
            <DocumentsTree />
            {leftPanelSections.all().map((S, i) => (
              <S key={i} />
            ))}
          </aside>
          <Splitter onDrag={(dx) => set({ leftWidth: Math.max(200, Math.min(520, useWorkspace.getState().app.prefs.leftWidth + dx)) })} />
        </>
      )}
      <main className="editor-center">
        {dialog === 'findReplace' && <FindReplace />}
        <EditorPane pageRef={pageRef} overlay={Overlay ? <Overlay pageRef={pageRef} /> : null} />
      </main>
      {prefs.showPreview && Preview && (
        <>
          <Splitter onDrag={(dx) => set({ previewWidth: Math.max(320, Math.min(1000, useWorkspace.getState().app.prefs.previewWidth - dx)) })} />
          <aside className="side side--preview" style={{ width: prefs.previewWidth }}>
            <Preview />
          </aside>
        </>
      )}
      {prefs.showRight && !prefs.focusMode && Right && (
        <>
          <Splitter onDrag={(dx) => set({ rightWidth: Math.max(220, Math.min(520, useWorkspace.getState().app.prefs.rightWidth - dx)) })} />
          <aside className="side side--right" style={{ width: prefs.rightWidth }}>
            <Right pageRef={pageRef} />
          </aside>
        </>
      )}
    </div>
  );
}
