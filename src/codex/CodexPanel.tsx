// Pannello Codex nella colonna sinistra dello Scriptorium: ogni catena di pergamene collegate, con
// riordino a trascinamento, lettura continua, impostazioni ed export.
import { useRef, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Plus, X, Settings2, FileOutput, GripVertical } from 'lucide-react';
import { useWorkspace } from '../state/workspace';
import { useCodices, useCodexStore, reorderCodex, dropFromCodex, appendToCodex, prepareCodex } from './store';
import { DocPicker } from '../resources/ui/DocPicker';
import { Popover } from '../components/Popover';
import { openContextMenu } from '../components/ContextMenu';
import { useSidePane } from '../editor/paneStore';
import { exportTo, renderPdf, type ExportFormat } from '../export/run';
import { platform, joinPath } from '../platform';
import { useResources } from '../resources/store';
import { docNodeId } from '../resources/docLinks';
import { t, useLang } from '../i18n';
import type { CodexSettings } from './model';

const MIME = 'application/x-alexandria-codex';

/** Menu di export di un Codex (anche dal lettore). */
export function openCodexExportMenu(e: React.MouseEvent, root: string) {
  const formats: [ExportFormat, string][] = [
    ['pdf', 'PDF'],
    ['docx', 'Word (.docx)'],
    ['html', 'HTML'],
    ['md', 'Markdown'],
    ['txt', t('codex.format.txt')],
    ['tex', 'LaTeX'],
  ];
  openContextMenu(e, [
    { label: t('codex.previewPdf'), onClick: () => void previewCodex(root) },
    ...formats.map(([f, label]) => ({
      label,
      onClick: async () => {
        const p = await prepareCodex(root);
        if (p) await exportTo(f, undefined, p);
      },
    })),
  ]);
}

async function previewCodex(root: string) {
  const ws = useWorkspace.getState();
  if (!ws.vaultRoot) return;
  try {
    const p = await prepareCodex(root);
    if (!p) return;
    const path = joinPath(ws.vaultRoot, '.alexandria-cache', 'print', `${p.ctx.title}.pdf`);
    await platform.writeBytes(path, await renderPdf(p));
    await platform.openPath(path);
  } catch (err) {
    ws.toast(t('export.error', { error: String(err instanceof Error ? err.message : err) }), 'error');
  }
}

export function CodexPanel() {
  useLang();
  const codices = useCodices();
  const [creating, setCreating] = useState(false);
  return (
    <section className="side-section codex-panel">
      <header className="side-section__head">
        <span>{t('codex.title')}</span>
        <button className="icon-btn" title={t('codex.new')} onClick={() => setCreating(true)}>
          <Plus size={14} />
        </button>
      </header>
      {!codices.length && <p className="hint codex-panel__hint">{t('codex.empty')}</p>}
      {codices.map((c) => (
        <CodexItem key={c.root} root={c.root} members={c.members} />
      ))}
      {creating && (
        <DocPicker
          title={t('codex.newTitle')}
          action={t('codex.newAction')}
          onPick={(rels) => {
            if (rels.length < 2) return useWorkspace.getState().toast(t('codex.needTwo'), 'info');
            const st = useResources.getState();
            const w = st.whiteboard;
            const have = new Set(w.docs ?? []);
            st.setWhiteboard({ ...w, docs: [...(w.docs ?? []), ...rels.filter((r) => !have.has(r))] });
            for (let i = 0; i + 1 < rels.length; i++) st.addLink(docNodeId(rels[i]), docNodeId(rels[i + 1]));
          }}
          onClose={() => setCreating(false)}
        />
      )}
    </section>
  );
}

function CodexItem({ root, members }: { root: string; members: string[] }) {
  const docs = useWorkspace((s) => s.docs);
  const active = useWorkspace((s) => s.activeDoc);
  const settings = useCodexStore((s) => s.settings[root]);
  const [open, setOpen] = useState(true);
  const [dropBefore, setDropBefore] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const gear = useRef<HTMLButtonElement>(null);
  if (!settings) void useCodexStore.getState().load(root);
  const title = (rel: string) => docs.find((d) => d.rel === rel)?.title ?? rel;
  const name = settings?.name ?? title(root);

  return (
    <div className="codex">
      <div className="codex__head">
        <button className="icon-btn tiny" onClick={() => setOpen(!open)} aria-label={name}>
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <BookOpen size={13} className="codex__icon" />
        <span className="codex__name" title={name} onDoubleClick={() => setEditing(true)}>
          {name}
        </span>
        <span className="codex__count">{members.length}</span>
        <button
          className="icon-btn tiny"
          title={t('codex.read')}
          onClick={() => useCodexStore.getState().read(root)}
          onContextMenu={(e) => openContextMenu(e, [{ label: t('pane.openAside'), onClick: () => useSidePane.getState().open({ kind: 'codex', root }) }])}
        >
          <BookOpen size={12} />
        </button>
        <button className="icon-btn tiny" title={t('codex.export')} onClick={(e) => openCodexExportMenu(e, root)}>
          <FileOutput size={12} />
        </button>
        <button ref={gear} className="icon-btn tiny" title={t('codex.settings')} onClick={() => setEditing(!editing)}>
          <Settings2 size={12} />
        </button>
      </div>
      {settings && (
        <Popover anchor={gear.current} open={editing} onClose={() => setEditing(false)}>
          <CodexSettingsForm root={root} s={settings} />
        </Popover>
      )}
      {open && (
        <ol className="codex__list">
          {members.map((rel) => (
            <li
              key={rel}
              className={`codex__item ${rel === active ? 'is-active' : ''} ${dropBefore === rel ? 'drop-before' : ''}`}
              draggable
              onDragStart={(e) => e.dataTransfer.setData(MIME, rel)}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(MIME)) return;
                e.preventDefault();
                setDropBefore(rel);
              }}
              onDragLeave={() => setDropBefore(null)}
              onDrop={(e) => {
                const from = e.dataTransfer.getData(MIME);
                setDropBefore(null);
                if (!from || from === rel || !members.includes(from)) return;
                const order = members.filter((r) => r !== from);
                order.splice(order.indexOf(rel), 0, from);
                reorderCodex(order);
              }}
              onClick={() => {
                useCodexStore.getState().read(null);
                useWorkspace.getState().openDoc(rel);
              }}
            >
              <GripVertical size={11} className="codex__grip" />
              <span className="codex__label">{title(rel)}</span>
              <button
                className="icon-btn tiny codex__remove"
                title={t('codex.remove')}
                onClick={(e) => {
                  e.stopPropagation();
                  dropFromCodex(members, rel);
                }}
              >
                <X size={11} />
              </button>
            </li>
          ))}
          <li className="codex__add" onClick={() => setPicking(true)}>
            <Plus size={11} /> {t('codex.add')}
          </li>
        </ol>
      )}
      {picking && (
        <DocPicker
          title={t('codex.addTitle', { name })}
          action={t('codex.addAction')}
          exclude={members}
          onPick={(rels) => {
            let order = members;
            for (const r of rels) {
              appendToCodex(order, r);
              order = [...order, r];
            }
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

function CodexSettingsForm({ root, s }: { root: string; s: CodexSettings }) {
  const save = (patch: Partial<CodexSettings>) => void useCodexStore.getState().save(root, { ...s, ...patch });
  const [name, setName] = useState(s.name);
  return (
    <div className="popover__form header-settings">
      <label className="field-label">{t('codex.name')}</label>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && save({ name: name.trim() })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
      <span className="field-label">{t('codex.separator')}</span>
      <select className="select" value={s.separator} onChange={(e) => save({ separator: e.target.value as CodexSettings['separator'] })}>
        <option value="pagebreak">{t('codex.separator.pagebreak')}</option>
        <option value="none">{t('codex.separator.none')}</option>
      </select>
      <label className="check">
        <input type="checkbox" checked={s.titlesAsHeadings} onChange={(e) => save({ titlesAsHeadings: e.target.checked })} /> {t('codex.titlesAsHeadings')}
      </label>
      <p className="hint">{t('codex.settingsHint')}</p>
    </div>
  );
}
