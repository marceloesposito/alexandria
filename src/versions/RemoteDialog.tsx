// Account e repository remota su Codeberg (unico server git ammesso dall'app): accesso OAuth o token,
// creazione della repository con un clic e collegamento di una esistente (o di una cartella locale).
import { useEffect, useState } from 'react';
import { LogOut, Plus, Link2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useWorkspace } from '../state/workspace';
import { platform } from '../platform';
import type { ForgeAccount } from '../platform/types';
import { push } from './actions';
import { FORGE_HOST, remoteAllowed, repoSlug } from './forge';
import { ForgeLogin } from './ForgeLogin';
import { t } from '../i18n';

const close = () => useWorkspace.getState().closeDialog();
const toast = (m: string, k: 'ok' | 'error' | 'info' = 'info') => useWorkspace.getState().toast(m, k);

export function RemoteDialog() {
  const root = useWorkspace((s) => s.vaultRoot);
  const vaultName = useWorkspace((s) => s.vault?.name ?? '');
  const host = FORGE_HOST;
  const [account, setAccount] = useState<ForgeAccount | null>(null);
  const [remote, setRemote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(repoSlug(vaultName));
  const [priv, setPriv] = useState(true);
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (root) void platform.gitRemote(root).then((u) => {
      setRemote(u);
      setUrl(u ?? '');
    });
  }, [root]);
  useEffect(() => {
    let alive = true;
    void platform.forgeAccount(host).then((a) => alive && setAccount(a));
    return () => {
      alive = false;
    };
  }, [host]);

  const run = async <T,>(f: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    try {
      return await f();
    } catch (e) {
      toast(String(e), 'error');
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const createRepo = () =>
    void run(async () => {
      if (!root) return;
      const u = await platform.forgeCreateRepo(host, name.trim(), priv, vaultName);
      await platform.gitSetRemote(root, u, null);
      setRemote(u);
      setUrl(u);
      toast(t('forge.created', { name: name.trim() }), 'ok');
      await push();
    });

  const linkExisting = () =>
    void run(async () => {
      if (!root) return;
      if (!remoteAllowed(url)) return toast(t('forge.onlyCodeberg'), 'error');
      await platform.gitSetRemote(root, url.trim(), null);
      setRemote(url.trim());
      toast(t('vc.remote.saved'), 'ok');
    });

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
        <h4>{t('forge.account')}</h4>
        {account ? (
          <div className="forge__row">
            <span className="forge__login">{t('forge.connectedAs', { login: account.login || '—', host: account.host })}</span>
            <span className="grow" />
            <button
              className="btn small"
              onClick={() =>
                void run(async () => {
                  await platform.forgeLogout(host);
                  setAccount(null);
                })
              }
            >
              <LogOut size={13} /> {t('forge.logout')}
            </button>
          </div>
        ) : (
          <ForgeLogin host={host} hint={t('forge.tokenHint')} onLogin={setAccount} />
        )}
      </section>

      <section className="forge__section">
        <h4>{t('forge.repo')}</h4>
        {remote && <p className="hint">{t('forge.currentRemote', { url: remote })}</p>}
        {account && (
          <div className="forge__row">
            <input className="input" value={name} onChange={(e) => setName(repoSlug(e.target.value, false))} aria-label={t('forge.repoName')} />
            <label className="check">
              <input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} /> {t('forge.private')}
            </label>
            <button className="btn btn--primary" disabled={busy || !name.trim()} onClick={createRepo}>
              <Plus size={14} /> {t('forge.create')}
            </button>
          </div>
        )}
        <label className="field-label">{t('forge.existing')}</label>
        <div className="forge__row">
          <input className="input" placeholder="https://codeberg.org/utente/tesi.git" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className="btn" disabled={busy || !url.trim() || url.trim() === remote} onClick={linkExisting}>
            <Link2 size={13} /> {t('forge.link')}
          </button>
        </div>
        <p className="hint">{t('vc.remote.tokenHint')}</p>
      </section>
    </Modal>
  );
}
