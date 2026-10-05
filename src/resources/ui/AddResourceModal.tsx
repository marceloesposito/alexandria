// Finestra "Aggiungi risorse": area di rilascio per file (anche molti insieme) e campo per i link.
import { useRef, useState } from 'react';
import { Upload, Link2, FolderOpen, BookMarked, SquareCode } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useWorkspace } from '../../state/workspace';
import { useResources } from '../store';
import { importFiles, importUrls, importPaths, importBibliography, createSnippet, SNIPPET_LANGUAGES } from '../importer';
import { splitLinks } from '../detect';
import { platform } from '../../platform';
import { t } from '../../i18n';

type Tab = 'files' | 'links' | 'bib' | 'snippet';

export function AddResourceModal() {
  const close = () => useWorkspace.getState().closeDialog();
  const scope = useResources((s) => s.scope);
  const busy = useResources((s) => s.busy);
  const [over, setOver] = useState(false);
  const [links, setLinks] = useState('');
  const [bib, setBib] = useState('');
  const arg = useWorkspace((s) => s.dialogArg) as { tab?: Tab } | null;
  const [tab, setTab] = useState<Tab>(arg?.tab ?? 'files');
  const [snip, setSnip] = useState({ title: '', language: 'ts', code: '' });
  const input = useRef<HTMLInputElement>(null);
  const found = splitLinks(links);

  const onFiles = async (list: FileList | File[]) => {
    const files = await Promise.all(
      Array.from(list).map(async (f) => ({ name: f.name, mime: f.type, data: new Uint8Array(await f.arrayBuffer()) })),
    );
    if (files.length) {
      close();
      await importFiles(files, scope);
    }
  };

  return (
    <Modal title={scope === 'library' ? t('add.titleLibrary') : t('add.title')} onClose={close} size="medium">
      <div className="tabs-row add__tabs" role="tablist">
        {(['files', 'links', 'bib', 'snippet'] as const).map((x) => (
          <button key={x} role="tab" aria-selected={tab === x} className={`seg ${tab === x ? 'is-active' : ''}`} onClick={() => setTab(x)}>
            {t(`add.tab.${x}`)}
          </button>
        ))}
      </div>
      {tab === 'files' && (
        <div
          className={`dropzone ${over ? 'is-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
            if (e.dataTransfer.files.length) void onFiles(e.dataTransfer.files);
            else if (text) {
              close();
              void importUrls(splitLinks(text), scope);
            }
          }}
          onClick={async () => {
            if (platform.kind === 'tauri') {
              const paths = await platform.pickFiles(t('add.pick'));
              if (paths.length) {
                close();
                await importPaths(paths, scope);
              }
            } else input.current?.click();
          }}
        >
          <Upload size={34} strokeWidth={1.4} />
          <div className="dropzone__title">{t('add.drop')}</div>
          <div className="hint">{t('add.formats')}</div>
          <span className="btn small">
            <FolderOpen size={13} /> {t('add.browse')}
          </span>
          <input ref={input} type="file" multiple hidden onChange={(e) => e.target.files && void onFiles(e.target.files)} />
        </div>
      )}
      {tab === 'links' && (
        <div className="add__links">
          <label className="field-label">
            <Link2 size={12} /> {t('add.linksLabel')}
          </label>
          <textarea
            className="input"
            rows={5}
            autoFocus
            placeholder={'https://www.youtube.com/watch?v=…\nhttps://rivista.org/articolo\n10.1093/…'}
            value={links}
            onChange={(e) => setLinks(e.target.value)}
          />
          <p className="hint">{t('add.linksHint')}</p>
          <div className="modal__actions modal__actions--inline">
            <span className="hint">{t('add.linksFound', { n: found.length })}</span>
            <span className="grow" />
            <button
              className="btn btn--primary"
              disabled={!found.length || !!busy}
              onClick={async () => {
                close();
                await importUrls(found, scope);
              }}
            >
              {t('add.import')}
            </button>
          </div>
        </div>
      )}
      {tab === 'snippet' && (
        <div className="add__links">
          <div className="add__snippet-row">
            <label className="field-label">
              <SquareCode size={12} /> {t('snippet.title')}
            </label>
            <input className="input" autoFocus value={snip.title} placeholder={t('snippet.untitled')} onChange={(e) => setSnip({ ...snip, title: e.target.value })} />
            <select className="select" value={snip.language} aria-label={t('snippet.language')} onChange={(e) => setSnip({ ...snip, language: e.target.value })}>
              {SNIPPET_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="input mono"
            rows={12}
            spellCheck={false}
            aria-label={t('snippet.code')}
            value={snip.code}
            onChange={(e) => setSnip({ ...snip, code: e.target.value })}
          />
          <p className="hint">{t('snippet.hint')}</p>
          <div className="modal__actions modal__actions--inline">
            <span className="grow" />
            <button
              className="btn btn--primary"
              disabled={!snip.code.trim()}
              onClick={async () => {
                close();
                const r = await createSnippet(snip.title, snip.language, snip.code, scope);
                if (r) useWorkspace.getState().toast(t('snippet.saved'), 'ok');
              }}
            >
              {t('snippet.create')}
            </button>
          </div>
        </div>
      )}
      {tab === 'bib' && (
        <div className="add__links">
          <label className="field-label">
            <BookMarked size={12} /> {t('add.bibLabel')}
          </label>
          <textarea className="input mono" rows={8} autoFocus value={bib} placeholder="@book{eco1962, ...}" onChange={(e) => setBib(e.target.value)} />
          <p className="hint">{t('add.bibHint')}</p>
          <div className="modal__actions modal__actions--inline">
            <span className="grow" />
            <button
              className="btn btn--primary"
              disabled={!bib.trim()}
              onClick={async () => {
                close();
                const made = await importBibliography(bib, scope);
                if (made.length) useWorkspace.getState().toast(t('import.done', { n: made.length }), 'ok');
              }}
            >
              {t('add.import')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
