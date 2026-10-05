// Schermata Editor: tre colonne (risorse e pin | pagina | commenti), piu' l'anteprima opzionale.
import { useRef } from 'react';
import { EditorPane } from './EditorPane';
import { DocumentsTree } from './DocumentsTree';
import { useWorkspace } from '../state/workspace';
import { FindReplace } from '../shell/dialogs/FindReplace';
import { Splitter } from '../components/Splitter';
import { leftPanelSections, rightPanel, centerOverlay, previewPanel } from './slots';
import { OutlinePanel } from './OutlinePanel';
import { CountsBadge } from '../shell/CountsBadge';
import { useZen } from '../state/zen';
import { borderlessFooter } from './slots';
import { useDoc } from './session';
import { Library, ListTree } from 'lucide-react';
import { t, useLang } from '../i18n';

export function EditorView() {
  useLang();
  const prefs = useWorkspace((s) => s.app.prefs);
  const dialog = useWorkspace((s) => s.dialog);
  const pageRef = useRef<HTMLDivElement>(null);
  const zen = useZen((s) => s.on);
  const bare = prefs.focusMode || zen;
  const sourceMode = useDoc((s) => s.sourceMode);
  // pergamene collegate: solo nella vista senza bordi (non in Pagina, scrittura minimale, sorgente)
  const Footer = prefs.editorLayout === 'borderless' && !zen && !sourceMode ? borderlessFooter.get() : null;
  const Right = rightPanel.get();
  const Overlay = centerOverlay.get();
  const Preview = previewPanel.get();
  const set = useWorkspace.getState().setPrefs;

  return (
    <div className={`editor-view ${prefs.focusMode ? 'is-focus' : ''} ${zen ? 'is-zen' : ''}`}>
      {prefs.showLeft && !bare && (
        <>
          <aside className="side side--left" style={{ width: prefs.leftWidth }}>
            <div className="side-tabs" role="tablist">
              {(['resources', 'outline'] as const).map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={prefs.leftTab === tab}
                  className={`seg ${prefs.leftTab === tab ? 'is-active' : ''}`}
                  onClick={() => set({ leftTab: tab })}
                >
                  {tab === 'resources' ? <Library size={13} /> : <ListTree size={13} />} {t(`side.tab.${tab}`)}
                </button>
              ))}
            </div>
            {prefs.leftTab === 'outline' ? (
              <OutlinePanel />
            ) : (
              <>
                <DocumentsTree />
                {leftPanelSections.all().map((S, i) => (
                  <S key={i} />
                ))}
              </>
            )}
          </aside>
          <Splitter onDrag={(dx) => set({ leftWidth: Math.max(200, Math.min(520, useWorkspace.getState().app.prefs.leftWidth + dx)) })} />
        </>
      )}
      <main className={`editor-center ${Footer ? 'has-footer' : ''}`}>
        {dialog === 'findReplace' && <FindReplace />}
        <EditorPane pageRef={pageRef} overlay={Overlay ? <Overlay pageRef={pageRef} /> : null} />
        {Footer && (
          <div className="doc-links-bar">
            <Footer />
          </div>
        )}
        <CountsBadge />
      </main>
      {prefs.showPreview && !zen && Preview && (
        <>
          <Splitter onDrag={(dx) => set({ previewWidth: Math.max(320, Math.min(1000, useWorkspace.getState().app.prefs.previewWidth - dx)) })} />
          <aside className="side side--preview" style={{ width: prefs.previewWidth }}>
            <Preview />
          </aside>
        </>
      )}
      {prefs.showRight && !bare && Right && (
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
