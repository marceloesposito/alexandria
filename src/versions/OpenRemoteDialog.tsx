// "Apri Compendium da una copia": sceglie la copia del Compendium (cartella .git su chiavetta, NAS o
// cartella sincronizzata), la copia in Documenti/Alexandria e la apre.
import { useEffect, useState } from 'react';
import { Download, FolderOpen } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useWorkspace } from '../state/workspace';
import { platform, joinPath } from '../platform';
import { remoteAllowed, repoSlug } from './remote';
import { t, useLang } from '../i18n';

const toast = (m: string, k: 'ok' | 'error' | 'info' = 'info') => useWorkspace.getState().toast(m, k);

/** Cartella libera sotto Documenti/Alexandria: "nome", "nome 2", ... */
async function freeFolder(name: string): Promise<string> {
  const base = joinPath(await platform.documentsDir(), 'Alexandria');
  let p = joinPath(base, name);
  for (let n = 2; await platform.exists(p); n++) p = joinPath(base, `${name} ${n}`);
  return p;
}

const nameFromUrl = (u: string) => repoSlug(u.replace(/\.git[\\/]?$/, '').split(/[/\\:]/).filter(Boolean).pop() ?? '') || 'Compendium';

export function OpenRemoteDialog() {
  useLang();
  const close = () => useWorkspace.getState().closeDialog();
  const [url, setUrl] = useState('');
  const [dest, setDest] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);

  // la cartella di destinazione segue la copia scelta (finché non la si cambia a mano)
  const [destTouched, setDestTouched] = useState(false);
  useEffect(() => {
    if (destTouched || !url.trim()) return;
    void freeFolder(nameFromUrl(url.trim())).then(setDest);
  }, [url, destTouched]);

  const download = async () => {
    if (!remoteAllowed(url)) return toast(t('vc.remote.onlyFolders'), 'error');
    if (!url.trim() || !dest.trim()) return;
    setBusy(true);
    setProgress([0, 0]);
    const off = await platform.onCloneProgress((a, b) => setProgress([a, b]));
    try {
      await platform.gitClone(url.trim(), dest.trim());
      off();
      close();
      if (await useWorkspace.getState().enterVault(dest.trim())) toast(t('remote.opened'), 'ok');
    } catch (e) {
      off();
      toast(t('remote.error', { error: String(e instanceof Error ? e.message : e) }), 'error');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Modal
      title={t('remote.title')}
      onClose={close}
      size="medium"
      footer={
        <>
          {progress && (
            <span className="hint">
              {progress[1] ? t('remote.progress', { a: progress[0], b: progress[1] }) : t('remote.connecting')}
            </span>
          )}
          <span className="grow" />
          <button className="btn" onClick={close} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button className="btn btn--primary" disabled={busy || !url.trim() || !dest.trim()} onClick={() => void download()}>
            <Download size={14} /> {t('remote.download')}
          </button>
        </>
      }
    >
      <p className="hint">{t('remote.intro')}</p>

      <section className="forge__section">
        <label className="field-label">{t('remote.url')}</label>
        <div className="forge__row">
          <input className="input" value={url} placeholder="/Volumes/USB/Tesi.git" onChange={(e) => setUrl(e.target.value)} />
          <button
            className="btn"
            onClick={async () => {
              const dir = await platform.pickDirectory(t('remote.pickSource'));
              if (dir) setUrl(dir);
            }}
          >
            <FolderOpen size={13} /> {t('remote.choose')}
          </button>
        </div>
        <label className="field-label">{t('remote.dest')}</label>
        <div className="forge__row">
          <input
            className="input"
            value={dest}
            onChange={(e) => {
              setDestTouched(true);
              setDest(e.target.value);
            }}
          />
          <button
            className="btn"
            onClick={async () => {
              const dir = await platform.pickDirectory(t('remote.pickDest'));
              if (dir) {
                setDestTouched(true);
                setDest(joinPath(dir, nameFromUrl(url.trim())));
              }
            }}
          >
            <FolderOpen size={13} /> {t('remote.choose')}
          </button>
        </div>
      </section>
    </Modal>
  );
}
