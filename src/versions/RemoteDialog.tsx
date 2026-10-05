// Account e repository remota: accesso a GitHub (Device Flow o token), GitLab o Gitea/Forgejo
// (token), creazione della repository con un clic e collegamento di una esistente.
import { useEffect, useRef, useState } from 'react';
import { LogIn, LogOut, Plus, Link2, ExternalLink, Copy } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useWorkspace } from '../state/workspace';
import { platform } from '../platform';
import type { ForgeAccount, ForgeKind, DeviceCode } from '../platform/types';
import { push } from './actions';
import { GITHUB_CLIENT_ID, defaultHost, tokenPage, repoSlug } from './forge';
import { t } from '../i18n';

const close = () => useWorkspace.getState().closeDialog();
const toast = (m: string, k: 'ok' | 'error' | 'info' = 'info') => useWorkspace.getState().toast(m, k);

export function RemoteDialog() {
  const root = useWorkspace((s) => s.vaultRoot);
  const vaultName = useWorkspace((s) => s.vault?.name ?? '');
  const [kind, setKind] = useState<ForgeKind>('github');
  const [host, setHost] = useState(defaultHost('github'));
  const [account, setAccount] = useState<ForgeAccount | null>(null);
  const [remote, setRemote] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [device, setDevice] = useState<DeviceCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(repoSlug(vaultName));
  const [priv, setPriv] = useState(true);
  const [url, setUrl] = useState('');
  const polling = useRef(0);

  useEffect(() => {
    if (root) void platform.gitRemote(root).then((u) => {
      setRemote(u);
      setUrl(u ?? '');
    });
  }, [root]);
  useEffect(() => {
    let alive = true;
    void platform.forgeAccount(host.trim()).then((a) => alive && setAccount(a));
    return () => {
      alive = false;
    };
  }, [host]);
  useEffect(() => () => window.clearTimeout(polling.current), []);

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

  const loggedIn = (login: string) => {
    setAccount({ kind, host: host.trim(), login });
    setToken('');
    setDevice(null);
    toast(t('forge.loggedIn', { login }), 'ok');
  };

  const startDevice = () =>
    void run(async () => {
      const d = await platform.forgeDeviceStart(GITHUB_CLIENT_ID);
      setDevice(d);
      void navigator.clipboard?.writeText(d.user_code).catch(() => undefined);
      await platform.openExternal(d.verification_uri);
      let wait = d.interval * 1000;
      const until = Date.now() + d.expires_in * 1000;
      const tick = async () => {
        if (Date.now() > until) return setDevice(null);
        try {
          const r = await platform.forgeDevicePoll(GITHUB_CLIENT_ID, d.device_code);
          if (r.startsWith('ok:')) return loggedIn(r.slice(3));
          if (r === 'slow_down') wait += 5000;
          polling.current = window.setTimeout(() => void tick(), wait);
        } catch (e) {
          setDevice(null);
          toast(String(e), 'error');
        }
      };
      polling.current = window.setTimeout(() => void tick(), wait);
    });

  const createRepo = () =>
    void run(async () => {
      if (!root) return;
      const u = await platform.forgeCreateRepo(host.trim(), name.trim(), priv, vaultName);
      await platform.gitSetRemote(root, u, null);
      setRemote(u);
      setUrl(u);
      toast(t('forge.created', { name: name.trim() }), 'ok');
      await push();
    });

  const linkExisting = () =>
    void run(async () => {
      if (!root) return;
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
        <h4>{t('forge.server')}</h4>
        <div className="forge__row">
          <select
            className="select"
            value={kind}
            onChange={(e) => {
              const k = e.target.value as ForgeKind;
              setKind(k);
              setHost(defaultHost(k));
              setDevice(null);
            }}
          >
            <option value="github">GitHub</option>
            <option value="gitlab">GitLab</option>
            <option value="gitea">Gitea / Forgejo</option>
          </select>
          <input className="input" value={host} placeholder="codeberg.org" onChange={(e) => setHost(e.target.value)} aria-label={t('forge.host')} />
        </div>
      </section>

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
                  await platform.forgeLogout(host.trim());
                  setAccount(null);
                })
              }
            >
              <LogOut size={13} /> {t('forge.logout')}
            </button>
          </div>
        ) : (
          <>
            {kind === 'github' && host.trim() === 'github.com' && GITHUB_CLIENT_ID && (
              <div className="forge__row">
                <button className="btn btn--primary" disabled={busy || !!device} onClick={startDevice}>
                  <LogIn size={14} /> {t('forge.loginGithub')}
                </button>
                {device && (
                  <span className="forge__code">
                    {t('forge.enterCode')} <code>{device.user_code}</code>
                    <button className="icon-btn tiny" title={t('common.copy')} onClick={() => void navigator.clipboard?.writeText(device.user_code)}>
                      <Copy size={12} />
                    </button>
                  </span>
                )}
              </div>
            )}
            <label className="field-label">{t('forge.token')}</label>
            <div className="forge__row">
              <input className="input" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
              <button
                className="btn"
                disabled={busy || !token.trim() || !host.trim()}
                onClick={() => void run(async () => loggedIn(await platform.forgeSetToken(kind, host.trim(), token)))}
              >
                {t('forge.useToken')}
              </button>
            </div>
            <p className="hint">
              {t('forge.tokenHint')}{' '}
              <button className="link-btn" onClick={() => void platform.openExternal(tokenPage(kind, host.trim()))}>
                <ExternalLink size={11} /> {t('forge.tokenCreate')}
              </button>
            </p>
          </>
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
          <input className="input" placeholder="https://github.com/utente/tesi.git" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className="btn" disabled={busy || !url.trim() || url.trim() === remote} onClick={linkExisting}>
            <Link2 size={13} /> {t('forge.link')}
          </button>
        </div>
        <p className="hint">{t('vc.remote.tokenHint')}</p>
      </section>
    </Modal>
  );
}
