// "Apri Compendium remoto": sceglie una repository dall'account (o da un indirizzo), la scarica in
// Documenti/Alexandria e la apre. Login e token come in "Account e repository remota".
import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FolderOpen, Lock, Globe, Search } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useWorkspace } from '../state/workspace';
import { platform, joinPath } from '../platform';
import type { ForgeAccount, ForgeKind, RemoteRepo } from '../platform/types';
import { defaultHost, tokenPage, repoSlug } from './forge';
import { fuzzyFilter } from '../lib/fuzzy';
import { t, useLang } from '../i18n';

const toast = (m: string, k: 'ok' | 'error' | 'info' = 'info') => useWorkspace.getState().toast(m, k);

/** Cartella libera sotto Documenti/Alexandria: "nome", "nome 2", ... */
async function freeFolder(name: string): Promise<string> {
  const base = joinPath(await platform.documentsDir(), 'Alexandria');
  let p = joinPath(base, name);
  for (let n = 2; await platform.exists(p); n++) p = joinPath(base, `${name} ${n}`);
  return p;
}

const nameFromUrl = (u: string) => repoSlug(u.replace(/\.git\/?$/, '').split(/[/:]/).filter(Boolean).pop() ?? '') || 'Compendium';

export function OpenRemoteDialog() {
  useLang();
  const close = () => useWorkspace.getState().closeDialog();
  const [kind, setKind] = useState<ForgeKind>('github');
  const [host, setHost] = useState(defaultHost('github'));
  const [account, setAccount] = useState<ForgeAccount | null>(null);
  const [token, setToken] = useState('');
  const [repos, setRepos] = useState<RemoteRepo[] | null>(null);
  const [q, setQ] = useState('');
  const [url, setUrl] = useState('');
  const [dest, setDest] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);

  useEffect(() => {
    let alive = true;
    setRepos(null);
    void platform.forgeAccount(host.trim()).then((a) => alive && setAccount(a));
    return () => {
      alive = false;
    };
  }, [host]);

  useEffect(() => {
    if (!account) return;
    let alive = true;
    platform
      .forgeListRepos(account.host)
      .then((r) => alive && setRepos(r))
      .catch((e) => {
        if (alive) setRepos([]);
        toast(String(e), 'error');
      });
    return () => {
      alive = false;
    };
  }, [account]);

  // la cartella di destinazione segue la repository scelta (finché non la si cambia a mano)
  const [destTouched, setDestTouched] = useState(false);
  useEffect(() => {
    if (destTouched || !url.trim()) return;
    void freeFolder(nameFromUrl(url.trim())).then(setDest);
  }, [url, destTouched]);

  const shown = useMemo(() => fuzzyFilter(repos ?? [], q, (r) => `${r.full_name} ${r.description}`, 100), [repos, q]);

  const connect = async () => {
    setBusy(true);
    try {
      const login = await platform.forgeSetToken(kind, host.trim(), token);
      setAccount({ kind, host: host.trim(), login });
      setToken('');
    } catch (e) {
      toast(String(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
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
        <h4>{t('forge.server')}</h4>
        <div className="forge__row">
          <select
            className="select"
            value={kind}
            onChange={(e) => {
              const k = e.target.value as ForgeKind;
              setKind(k);
              setHost(defaultHost(k));
            }}
          >
            <option value="github">GitHub</option>
            <option value="gitlab">GitLab</option>
            <option value="gitea">Gitea / Forgejo</option>
          </select>
          <input className="input" value={host} onChange={(e) => setHost(e.target.value)} aria-label={t('forge.host')} />
        </div>
        {account ? (
          <p className="hint">{t('forge.connectedAs', { login: account.login || '—', host: account.host })}</p>
        ) : (
          <>
            <label className="field-label">{t('forge.token')}</label>
            <div className="forge__row">
              <input className="input" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
              <button className="btn" disabled={busy || !token.trim()} onClick={() => void connect()}>
                {t('forge.useToken')}
              </button>
            </div>
            <p className="hint">
              {t('remote.tokenHint')}{' '}
              <button className="link-btn" onClick={() => void platform.openExternal(tokenPage(kind, host.trim()))}>
                <ExternalLink size={11} /> {t('forge.tokenCreate')}
              </button>
            </p>
          </>
        )}
      </section>

      {account && (
        <section className="forge__section">
          <h4>{t('remote.repos')}</h4>
          <label className="search-field">
            <Search size={13} />
            <input className="input" value={q} placeholder={t('remote.search')} onChange={(e) => setQ(e.target.value)} />
          </label>
          <ul className="remote-list">
            {repos === null && <li className="hint">{t('common.loading')}</li>}
            {repos !== null && !shown.length && <li className="hint">{t('remote.none')}</li>}
            {shown.map((r) => (
              <li key={r.clone_url} className={url === r.clone_url ? 'is-active' : ''} onClick={() => setUrl(r.clone_url)}>
                {r.private ? <Lock size={12} /> : <Globe size={12} />}
                <span className="remote-list__name">{r.full_name}</span>
                {r.updated && <span className="hint">{new Date(r.updated).toLocaleDateString()}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="forge__section">
        <label className="field-label">{t('remote.url')}</label>
        <input className="input" value={url} placeholder="https://github.com/utente/tesi.git" onChange={(e) => setUrl(e.target.value)} />
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
