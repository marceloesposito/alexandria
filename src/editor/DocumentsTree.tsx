// Elenco dei documenti del vault (colonna sinistra), con riordino per trascinamento.
import { useState } from 'react';
import { FileText, Plus, MoreHorizontal } from 'lucide-react';
import { useWorkspace } from '../state/workspace';
import { t } from '../i18n';
import { flushSave } from './session';
import { getEditor } from '../state/editorRef';
import { openContextMenu } from '../components/ContextMenu';
import { confirmDialog } from '../components/confirm';
import { useDoc } from './session';
import { HoverCard, useHoverCard } from '../components/HoverCard';
import { DocPreview } from '../shell/DocPreview';
import { useTrack } from './extensions/track';
import { useSidePane } from './paneStore';

const MIME = 'application/x-alexandria-doc';

export function DocumentsTree() {
  const docs = useWorkspace((s) => s.docs);
  const active = useWorkspace((s) => s.activeDoc);
  const counts = useDoc((s) => s.counts);
  const [dropBefore, setDropBefore] = useState<string | null>(null);
  const hover = useHoverCard();
  const reviewing = useTrack((s) => s.locked);

  const open = async (rel: string) => {
    if (rel === active) return;
    await flushSave(getEditor());
    useWorkspace.getState().openDoc(rel);
  };

  const menu = (e: React.MouseEvent, rel: string, title: string) => {
    const ws = useWorkspace.getState();
    openContextMenu(e, [
      { label: t('pane.openAside'), onClick: () => useSidePane.getState().open({ kind: 'doc', rel }) },
      { label: t('cmd.file.renameDoc'), onClick: () => ws.openDialog('renameDoc', rel) },
      {
        label: t('cmd.file.duplicateDoc'),
        onClick: async () => {
          await flushSave(getEditor());
          await ws.duplicateDoc(rel);
        },
      },
      { sep: true, label: '' },
      {
        label: t('cmd.file.deleteDoc'),
        danger: true,
        onClick: async () => {
          if (await confirmDialog(t('doc.confirmDelete', { title }), t('doc.confirmDeleteHint'), { danger: true, okLabel: t('common.delete') }))
            await ws.deleteDoc(rel);
        },
      },
    ]);
  };

  return (
    <section className="side-section">
      <header className="side-section__head">
        <span>{t('side.documents')}</span>
        {!reviewing && (
          <button className="icon-btn" title={t('cmd.file.newDoc')} onClick={() => void useWorkspace.getState().newDoc()}>
            <Plus size={14} />
          </button>
        )}
      </header>
      {hover.anchor?.dataset.rel && (
        <HoverCard anchor={hover.anchor} cardProps={hover.cardProps} placement="right">
          <DocPreview rel={hover.anchor.dataset.rel} />
        </HoverCard>
      )}
      <ul className="tree" role="tree">
        {docs.map((d) => (
          <li
            key={d.rel}
            role="treeitem"
            aria-selected={d.rel === active}
            className={`tree__item ${d.rel === active ? 'is-active' : ''} ${dropBefore === d.rel ? 'drop-before' : ''}`}
            draggable
            onDragStart={(e) => {
              hover.close();
              e.dataTransfer.setData(MIME, d.rel);
            }}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(MIME)) return;
              e.preventDefault();
              setDropBefore(d.rel);
            }}
            onDragLeave={() => setDropBefore(null)}
            onDrop={(e) => {
              const from = e.dataTransfer.getData(MIME);
              setDropBefore(null);
              if (!from || from === d.rel) return;
              const order = docs.map((x) => x.rel).filter((r) => r !== from);
              order.splice(order.indexOf(d.rel), 0, from);
              void useWorkspace.getState().reorderDocs(order);
            }}
            onClick={() => {
              hover.close();
              void open(d.rel);
            }}
            onContextMenu={(e) => !reviewing && menu(e, d.rel, d.title)}
            data-rel={d.rel}
            {...(d.rel === active ? {} : hover.triggerProps)}
          >
            <FileText size={14} className="tree__icon" />
            <span className="tree__label">{d.folder ? `${d.folder}/` : ''}{d.title}</span>
            {d.rel === active && counts && <span className="tree__meta">{counts.words.toLocaleString()}</span>}
            <button
              className="icon-btn tiny tree__more"
              onClick={(e) => {
                e.stopPropagation();
                menu(e, d.rel, d.title);
              }}
              aria-label={t('common.more')}
            >
              <MoreHorizontal size={13} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
