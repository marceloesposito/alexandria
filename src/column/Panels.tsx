// Pannelli a sinistra (uno alla volta, 260 px): Fogli in lavorazione e Index (struttura del testo e
// Marginalia, orfani compresi).
import { useEffect, useMemo, useState } from 'react';
import { MoreHorizontal, Plus, FolderOpen, MessageSquare } from 'lucide-react';
import { useColumn } from './store';
import { displayName } from './format';
import { runCommand } from './commands';
import { commandTitle } from './FloatingBar';
import { openContextMenu } from '../components/ContextMenu';
import { useEditorRef, getEditor } from './editor/editorRef';
import { focusComment, reopen } from './comments/store';
import { t, useLang } from '../i18n';

function ago(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  return d.toDateString() === today.toDateString() ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function SheetsPanel() {
  const sheets = useColumn((s) => s.sheets);
  const current = useColumn((s) => s.sheet?.meta.id);
  return (
    <div className="fx-panel__body">
      <div className="fx-panel__actions">
        <button className="fx-btn fx-btn--text" data-cmd="sheet.new" title={commandTitle('sheet.new')} onClick={() => runCommand('sheet.new')}>
          <Plus size={15} /> <span className="fx-btn__label">{t('cmd.sheet.new')}</span>
        </button>
        <button className="fx-btn fx-btn--text" data-cmd="sheet.open" title={commandTitle('sheet.open')} onClick={() => runCommand('sheet.open')}>
          <FolderOpen size={15} /> <span className="fx-btn__label">{t('cmd.sheet.open')}</span>
        </button>
      </div>
      <ul className="fx-list" role="list">
        {sheets.map((s) => (
          <li key={s.id} className={`fx-list__row ${s.id === current ? 'is-active' : ''}`}>
            <button className="fx-list__main" onClick={() => void useColumn.getState().open(s.id)}>
              <span className="fx-list__title">{displayName({ meta: { name: s.name } as never, markdown: s.preview }, t('sheet.untitled'))}</span>
              <span className="fx-list__meta">{ago(s.updated)}</span>
            </button>
            <button
              className="fx-icon fx-list__more"
              title={t('common.more')}
              aria-label={t('common.more')}
              data-cmd="sheet.delete"
              onClick={(e) =>
                openContextMenu(e, [
                  {
                    label: t('cmd.sheet.delete'),
                    danger: true,
                    onClick: () => void import('./actions').then((m) => m.deleteSheet(s.id)),
                  },
                ])
              }
            >
              <MoreHorizontal size={15} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface Heading {
  level: number;
  text: string;
  pos: number;
}

function IndexPanel() {
  const editor = useEditorRef((s) => s.editor);
  const sheet = useColumn((s) => s.sheet);
  const [tab, setTab] = useState<'outline' | 'marginalia'>('outline');
  const [version, bump] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const f = () => bump((n) => n + 1);
    editor.on('update', f);
    return () => {
      editor.off('update', f);
    };
  }, [editor]);
  const headings = useMemo<Heading[]>(() => {
    const out: Heading[] = [];
    editor?.state.doc.descendants((n, pos) => {
      if (n.type.name === 'heading') out.push({ level: n.attrs.level as number, text: n.textContent, pos });
      return n.isBlock && n.type.name !== 'heading';
    });
    return out;
  }, [editor, version]);
  const comments = sheet?.comments.comments ?? [];
  const open = comments.filter((c) => c.status === 'open');
  return (
    <div className="fx-panel__body">
      <div className="fx-seg fx-panel__tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'outline'} className={`fx-seg__btn ${tab === 'outline' ? 'is-active' : ''}`} onClick={() => setTab('outline')}>
          {t('index.outline')}
        </button>
        <button role="tab" aria-selected={tab === 'marginalia'} className={`fx-seg__btn ${tab === 'marginalia' ? 'is-active' : ''}`} onClick={() => setTab('marginalia')}>
          <MessageSquare size={13} /> {t('index.marginalia', { n: open.length })}
        </button>
      </div>
      {tab === 'outline' ? (
        headings.length ? (
          <ul className="fx-outline">
            {headings.map((h, i) => (
              <li key={i} style={{ paddingLeft: (h.level - 1) * 14 }}>
                <button
                  onClick={() => {
                    const e = getEditor();
                    if (!e) return;
                    e.chain().focus().setTextSelection(h.pos + 1).run();
                    e.view.domAtPos(h.pos + 1).node?.parentElement?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                  }}
                >
                  {h.text || t('index.emptyHeading')}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="fx-empty">{t('index.noHeadings')}</p>
        )
      ) : comments.length ? (
        <ul className="fx-marginalia">
          {comments.map((c) => (
            <li key={c.id} className={`fx-marginalia__item ${c.status !== 'open' ? 'is-resolved' : ''} ${!c.anchor ? 'is-orphan' : ''}`}>
              <button onClick={() => (c.status === 'open' ? focusComment(c.id) : reopen(c.id))}>
                {c.anchor?.quote ? <q>{c.anchor.quote}</q> : <span className="fx-muted">{c.anchor ? t('index.point') : t('index.orphan')}</span>}
                <span className="fx-marginalia__body">{c.body}</span>
                <span className="fx-muted">
                  {c.author}
                  {c.status !== 'open' ? ` · ${t('index.resolved')}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="fx-empty">{t('index.noComments')}</p>
      )}
    </div>
  );
}

export function SidePanel() {
  useLang();
  const panel = useColumn((s) => s.app.panel);
  if (!panel) return null;
  return (
    <aside className="fx-panel" aria-label={t(panel === 'sheets' ? 'cmd.panel.sheets' : 'cmd.panel.index')}>
      <div className="fx-panel__head">{t(panel === 'sheets' ? 'panel.sheets' : 'panel.index')}</div>
      {panel === 'sheets' ? <SheetsPanel /> : <IndexPanel />}
    </aside>
  );
}
