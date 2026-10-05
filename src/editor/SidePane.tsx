// Colonna dei riquadri accanto all'editor: una pergamena in lettura ("Modifica qui" la porta
// nell'editor), un Codex di seguito, una risorsa in anteprima (con Bookmark). Si divide in due.
import { useState, type ComponentType } from 'react';
import { X, FileText, BookOpen, Rows2, Pencil, Library } from 'lucide-react';
import { useSidePane, type PaneTab } from './paneStore';
import { useWorkspace } from '../state/workspace';
import { ReadOnlyDoc } from '../codex/ReadOnlyDoc';
import { membersOf, useCodexStore } from '../codex/store';
import { useResources } from '../resources/store';
import { t, useLang } from '../i18n';

/** Contenuto di una risorsa: lo registra il modulo risorse (per non dipendere da lui). */
export const paneResource: { body: ComponentType<{ id: string }> | null; title: (id: string) => string } = {
  body: null,
  title: (id) => id,
};

function tabTitle(tab: PaneTab, docs: { rel: string; title: string }[], codexName: (root: string) => string): string {
  if (tab.kind === 'doc') return docs.find((d) => d.rel === tab.rel)?.title ?? tab.rel;
  if (tab.kind === 'codex') return codexName(tab.root);
  return paneResource.title(tab.id);
}

export function SidePane() {
  useLang();
  const { tabs, active, second } = useSidePane();
  const docs = useWorkspace((s) => s.docs);
  const codex = useCodexStore((s) => s.settings);
  useResources((s) => s.resources);
  const name = (root: string) => codex[root]?.name ?? docs.find((d) => d.rel === root)?.title ?? 'Codex';
  if (!tabs.length) return null;
  const st = useSidePane.getState();
  return (
    <aside className="side-pane">
      <div className="side-pane__tabs" role="tablist">
        {tabs.map((tab, i) => (
          <div
            key={i}
            role="tab"
            aria-selected={i === active}
            className={`side-pane__tab ${i === active ? 'is-active' : ''} ${i === second ? 'is-second' : ''}`}
            onClick={() => st.setActive(i)}
            title={tabTitle(tab, docs, name)}
          >
            {tab.kind === 'doc' ? <FileText size={12} /> : tab.kind === 'codex' ? <BookOpen size={12} /> : <Library size={12} />}
            <span className="side-pane__tab-label">{tabTitle(tab, docs, name)}</span>
            <button
              className="icon-btn tiny"
              aria-label={t('common.close')}
              onClick={(e) => {
                e.stopPropagation();
                st.close(i);
              }}
            >
              <X size={11} />
            </button>
          </div>
        ))}
        <span className="grow" />
        {tabs.length > 1 && (
          <button className={`icon-btn ${second !== null ? 'is-active' : ''}`} title={t('pane.split')} onClick={() => st.toggleSplit()}>
            <Rows2 size={14} />
          </button>
        )}
        <button className="icon-btn" title={t('pane.closeAll')} onClick={() => st.closeAll()}>
          <X size={14} />
        </button>
      </div>
      <div className="side-pane__body">
        {tabs[active] && <PaneContent key={`a${active}`} tab={tabs[active]} />}
        {second !== null && tabs[second] && <PaneContent key={`b${second}`} tab={tabs[second]} />}
      </div>
    </aside>
  );
}

function PaneContent({ tab }: { tab: PaneTab }) {
  const [words, setWords] = useState<number | null>(null);
  if (tab.kind === 'resource') {
    const Body = paneResource.body;
    return <div className="side-pane__content side-pane__content--resource">{Body ? <Body id={tab.id} /> : null}</div>;
  }
  if (tab.kind === 'codex') {
    return (
      <div className="side-pane__content">
        {membersOf(tab.root).map((rel) => (
          <section key={rel} className="side-pane__part">
            <PartHead rel={rel} />
            <ReadOnlyDoc rel={rel} />
          </section>
        ))}
      </div>
    );
  }
  return (
    <div className="side-pane__content">
      <PartHead rel={tab.rel} words={words} />
      <ReadOnlyDoc rel={tab.rel} onLoaded={setWords} />
    </div>
  );
}

function PartHead({ rel, words }: { rel: string; words?: number | null }) {
  const title = useWorkspace((s) => s.docs.find((d) => d.rel === rel)?.title ?? rel);
  return (
    <div className="side-pane__head">
      <span className="side-pane__title">{title}</span>
      {words != null && <span className="hint">{t('pane.words', { n: words })}</span>}
      <span className="grow" />
      <button
        className="btn small"
        title={t('pane.editHere')}
        onClick={() => {
          useCodexStore.getState().read(null);
          useWorkspace.getState().openDoc(rel);
        }}
      >
        <Pencil size={12} /> {t('pane.editHere')}
      </button>
    </div>
  );
}
