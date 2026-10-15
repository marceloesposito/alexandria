// Remoto del Compendium: una cartella su chiavetta, NAS o cartella sincronizzata (Nextcloud,
// Syncthing). Alla prima scelta la cartella diventa un repository git "bare" e riceve il primo invio.
import { useEffect, useState } from 'react';
import { FolderOpen, Link2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useWorkspace } from '../state/workspace';
import { platform, joinPath } from '../platform';
import { push } from './actions';
import { copyFolderName, remoteAllowed } from './remote';
import { t } from '../i18n';

const close = () => useWorkspace.getState().closeDialog();
const toast = (m: string, k: 'ok' | 'error' | 'info' = 'info') => useWorkspace.getState().toast(m, k);

export function RemoteDialog() {
  const root = useWorkspace((s) => s.vaultRoot);
  const vaultName = useWorkspace((s) => s.vault?.name ?? '');
  const [remote, setRemote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (root) void platform.gitRemote(root).then((u) => {
      setRemote(u);
      setUrl(u ?? '');
    });
  }, [root]);

  const link = async (target: string) => {
    if (!root) return;
    if (!remoteAllowed(target)) return toast(t('vc.remote.onlyFolders'), 'error');
    setBusy(true);
    try {
      await platform.gitSetRemote(root, target);
      setRemote(target);
      setUrl(target);
      toast(t('vc.remote.saved'), 'ok');
      await push();
    } catch (e) {
      toast(String(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const choose = async () => {
    const dir = await platform.pickDirectory(t('vc.remote.pick'));
    if (dir) await link(joinPath(dir, copyFolderName(vaultName)));
  };

  return (
    <Modal
      title={t('cmd.vc.remote')}
      onClose={close}
      size="medium"
      footer={
        <button className="btn" onClick={close}>
          {t('common.close')}
        </button>
      }
    >
      <p className="hint">{t('vc.remote.intro')}</p>

      <section className="forge__section">
        {remote && <p className="hint">{t('vc.remote.current', { url: remote })}</p>}
        <div className="forge__row">
          <button className="btn btn--primary" disabled={busy} onClick={() => void choose()}>
            <FolderOpen size={14} /> {t('vc.remote.choose')}
          </button>
        </div>
        <label className="field-label">{t('vc.remote.path')}</label>
        <div className="forge__row">
          <input className="input" placeholder="/Volumes/USB/Tesi.git" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className="btn" disabled={busy || !url.trim() || url.trim() === remote} onClick={() => void link(url.trim())}>
            <Link2 size={13} /> {t('vc.remote.link')}
          </button>
        </div>
      </section>
    </Modal>
  );
}
