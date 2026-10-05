// Finestra contestuale "Inserisci una risorsa" (dal menu / dei blocchi): si trascina un file o un
// link da un'altra finestra, lo si incolla o lo si sceglie; oppure si prende una risorsa gia' presente.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Link2, FolderOpen, Search } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useWorkspace } from '../../state/workspace';
import { useResources } from '../store';
import { classifyTransfer, readTransfer } from '../insert';
import { importAndInsert, importPathsAndInsert, insertResources } from '../insertActions';
import { splitLinks } from '../detect';
import { KindIcon, subtitle } from './common';
import { platform } from '../../platform';
import { t } from '../../i18n';

export function InsertResourceDialog() {
  const arg = useWorkspace((s) => s.dialogArg) as { pos?: number; kind?: 'snippet' } | null;
  const resources = useResources((s) => s.resources);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const [q, setQ] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const close = () => useWorkspace.getState().closeDialog();
  const pos = arg?.pos;

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    try {
      await job();
    } finally {
      setBusy(false);
      close();
    }
  };

  const onTransfer = (dt: DataTransfer) => {
    const c = classifyTransfer(readTransfer(dt));
    if (!c) return false;
    const files = Array.from(dt.files ?? []);
    void run(() => importAndInsert(c, files, pos));
    return true;
  };

  // incolla ovunque nella finestra (fuori dal campo del link)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT' || !e.clipboardData) return;
      if (onTransfer(e.clipboardData)) e.preventDefault();
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => {
    const k = q.toLowerCase();
    const list = arg?.kind === 'snippet' ? resources.filter((r) => r.kind === 'snippet') : resources;
    return list.filter((r) => !k || `${r.title} ${r.citeKey ?? ''} ${r.url ?? ''}`.toLowerCase().includes(k)).slice(0, 40);
  }, [resources, q, arg?.kind]);

  const links = splitLinks(link);

  return (
    <Modal title={t('insertRes.title')} onClose={close} size="medium" className="insert-res">
      {busy ? (
        <div className="insert-res__busy">
          <span className="spinner" /> {t('insertRes.working')}
        </div>
      ) : (
        <>
          <div
            className={`dropzone dropzone--compact ${over ? 'is-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              onTransfer(e.dataTransfer);
            }}
          >
            <Upload size={26} strokeWidth={1.4} />
            <div className="dropzone__title">{t('insertRes.drop')}</div>
            <div className="hint">{t('insertRes.dropHint')}</div>
            <button
              className="btn small"
              onClick={async () => {
                if (platform.kind === 'tauri') {
                  const paths = await platform.pickFiles(t('add.pick'));
                  if (paths.length) void run(() => importPathsAndInsert(paths, pos));
                } else input.current?.click();
              }}
            >
              <FolderOpen size={13} /> {t('insertRes.browse')}
            </button>
            <input
              ref={input}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) void run(() => importAndInsert({ kind: 'files' }, files, pos));
              }}
            />
          </div>
          <form
            className="insert-res__link"
            onSubmit={(e) => {
              e.preventDefault();
              if (links.length) void run(() => importAndInsert({ kind: 'links', urls: links }, [], pos));
            }}
          >
            <Link2 size={14} />
            <input className="input" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} aria-label={t('insertRes.link')} />
            <button className="btn btn--primary" disabled={!links.length}>
              {t('insertRes.add')}
            </button>
          </form>
          <div className="insert-res__existing">
            <div className="field-label">{t('insertRes.existing')}</div>
            <label className="search-field">
              <Search size={13} />
              <input className="input" value={q} placeholder={t('insertRes.search')} onChange={(e) => setQ(e.target.value)} autoFocus={arg?.kind === 'snippet'} />
            </label>
            <ul className="insert-res__list">
              {!shown.length && <li className="hint">{t('insertRes.none')}</li>}
              {shown.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => {
                      close();
                      insertResources([r], pos);
                    }}
                  >
                    <KindIcon kind={r.kind} size={14} />
                    <span className="insert-res__name">{r.title}</span>
                    <span className="hint">{subtitle(r)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </Modal>
  );
}
