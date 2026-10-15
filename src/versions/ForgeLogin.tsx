// Collegamento dell'account Codeberg, comune ad "Account e repository remota" e "Apri Compendium
// remoto": "Accedi con Codeberg" (OAuth nel browser) e, come alternativa, un token personale.
import { useEffect, useRef, useState } from 'react';
import { ExternalLink, LogIn, X } from 'lucide-react';
import { platform } from '../platform';
import type { ForgeAccount } from '../platform/types';
import { useWorkspace } from '../state/workspace';
import { TOKEN_PAGE } from './forge';
import { t } from '../i18n';

const toast = (m: string, k: 'ok' | 'error' | 'info' = 'info') => useWorkspace.getState().toast(m, k);

export function ForgeLogin({ host, hint, onLogin }: { host: string; hint: string; onLogin: (a: ForgeAccount) => void }) {
  const [oauth, setOauth] = useState<boolean | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const waitingRef = useRef(false);

  useEffect(() => {
    let alive = true;
    void platform.forgeOAuthAvailable().then((a) => alive && setOauth(a));
    return () => {
      alive = false;
      // chiudere il dialogo annulla l'accesso in attesa nel browser
      if (waitingRef.current) void platform.forgeOAuthCancel();
    };
  }, []);

  const done = (login: string, viaOAuth: boolean) => {
    onLogin({ kind: 'gitea', host, login, oauth: viaOAuth });
    toast(t('forge.loggedIn', { login }), 'ok');
  };

  const signIn = async () => {
    setWaiting(true);
    waitingRef.current = true;
    try {
      done(await platform.forgeOAuthLogin(host), true);
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      if (!/annullato/i.test(msg)) toast(msg, 'error');
    } finally {
      waitingRef.current = false;
      setWaiting(false);
    }
  };

  const useToken = async () => {
    setBusy(true);
    try {
      done(await platform.forgeSetToken(host, token), false);
      setToken('');
    } catch (e) {
      toast(String(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const tokenForm = (
    <>
      <label className="field-label">{t('forge.token')}</label>
      <div className="forge__row">
        <input className="input" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
        <button className="btn" disabled={busy || waiting || !token.trim()} onClick={() => void useToken()}>
          {t('forge.useToken')}
        </button>
      </div>
      <p className="hint">
        <button className="link-btn" onClick={() => void platform.openExternal(TOKEN_PAGE)}>
          <ExternalLink size={11} /> {t('forge.tokenCreate')}
        </button>
      </p>
    </>
  );

  if (oauth === null) return null;
  return (
    <>
      {oauth && (
        <div className="forge__row">
          {waiting ? (
            <>
              <span className="hint grow">{t('forge.oauthWaiting')}</span>
              <button className="btn small" onClick={() => void platform.forgeOAuthCancel()}>
                <X size={13} /> {t('common.cancel')}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn--primary" onClick={() => void signIn()}>
                <LogIn size={14} /> {t('forge.oauth')}
              </button>
              <span className="grow" />
              {!showToken && (
                <button className="link-btn" onClick={() => setShowToken(true)}>
                  {t('forge.oauthUseToken')}
                </button>
              )}
            </>
          )}
        </div>
      )}
      {(!oauth || showToken) && tokenForm}
      <p className="hint">{hint}</p>
    </>
  );
}
