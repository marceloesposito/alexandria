// Schermata iniziale (stile VS Code / Adobe Home): si sceglie quale Compendium aprire o se crearne
// uno nuovo. A sinistra le azioni e "riprendi l'ultimo", a destra i Compendium recenti.
import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, FolderPlus, Landmark, ArrowRight, Search, X, CircleAlert, Feather, Settings, Usb, NotebookPen, ScrollText } from 'lucide-react';
import { useWorkspace, getPortableRoot } from '../state/workspace';
import { runCommand } from '../commands/registry';
import { platform, baseName } from '../platform';
import { t, useLang } from '../i18n';

function parentOf(path: string): string {
  const i = path.replace(/\\/g, '/').lastIndexOf('/');
  return i > 0 ? path.slice(0, i) : path;
}

export function StartScreen() {
  useLang();
  const recent = useWorkspace((s) => s.app.recentVaults);
  const last = useWorkspace((s) => s.app.lastVault);
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const ws = useWorkspace.getState();

  // i Compendium spostati o cancellati restano in elenco, segnalati
  useEffect(() => {
    void Promise.all(recent.map(async (r) => [r, await platform.exists(r)] as const)).then((res) => setMissing(new Set(res.filter(([, ok]) => !ok).map(([r]) => r))));
  }, [recent]);

  const open = async (root: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await ws.enterVault(root);
    } finally {
      setBusy(false);
    }
  };

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return recent.filter((r) => !k || r.toLowerCase().includes(k));
  }, [recent, q]);
  const resume = last && recent.includes(last) && !missing.has(last) ? last : null;

  return (
    <div className="start">
      <aside className="start__side">
        <div className="start__brand">
          <Landmark size={34} strokeWidth={1.4} />
          <div>
            <div className="start__name">Alexandria</div>
            <div className="start__tagline">{t('start.tagline')}</div>
          </div>
        </div>
        {getPortableRoot() && (
          <div className="start__portable" title={getPortableRoot() ?? ''}>
            <Usb size={13} /> {t('start.portable')}
          </div>
        )}

        {resume && (
          <button className="start__resume" onClick={() => void open(resume)} disabled={busy} autoFocus>
            <span className="start__resume-kicker">{t('start.resume')}</span>
            <span className="start__resume-name">{baseName(resume)}</span>
            <span className="start__resume-path">{parentOf(resume)}</span>
            <ArrowRight size={18} className="start__resume-go" />
          </button>
        )}

        <nav className="start__actions">
          {!recent.length && (
            <button className="start__action is-primary" onClick={async () => (setBusy(true), await ws.createDefaultVault(), setBusy(false))} disabled={busy}>
              <Feather size={18} />
              <span>
                <strong>{t('start.createFirst')}</strong>
                <small>{t('start.createFirstHint')}</small>
              </span>
            </button>
          )}
          <button className="start__action" onClick={() => void runCommand('file.newVault')} disabled={busy}>
            <FolderPlus size={18} />
            <span>
              <strong>{t('cmd.file.newVault')}</strong>
              <small>{t('start.newHint')}</small>
            </span>
          </button>
          <button className="start__action" onClick={async () => (setBusy(true), await ws.createFromTemplate('journal'), setBusy(false))} disabled={busy}>
            <NotebookPen size={18} />
            <span>
              <strong>{t('start.journal')}</strong>
              <small>{t('start.journalHint')}</small>
            </span>
          </button>
          <button className="start__action" onClick={() => void runCommand('file.recensioOpen')} disabled={busy}>
            <ScrollText size={18} />
            <span>
              <strong>{t('cmd.file.recensioOpen')}</strong>
              <small>{t('start.recensioHint')}</small>
            </span>
          </button>
          <button className="start__action" onClick={() => void runCommand('file.openVault')} disabled={busy}>
            <FolderOpen size={18} />
            <span>
              <strong>{t('cmd.file.openVault')}</strong>
              <small>{t('start.openHint')}</small>
            </span>
          </button>
        </nav>

        <footer className="start__foot">
          <button className="btn btn--ghost small" onClick={() => ws.openDialog('preferences')}>
            <Settings size={13} /> {t('cmd.app.preferences')}
          </button>
          <button className="btn btn--ghost small" onClick={() => ws.setPrefs({ onboardingDone: false })}>
            <Feather size={13} /> {t('cmd.help.onboarding')}
          </button>
        </footer>
      </aside>

      <main className="start__main">
        <header className="start__head">
          <h2>{t('start.recent')}</h2>
          {recent.length > 4 && (
            <label className="start__search">
              <Search size={14} />
              <input className="input" value={q} placeholder={t('start.search')} onChange={(e) => setQ(e.target.value)} />
            </label>
          )}
        </header>
        {!recent.length ? (
          <div className="start__empty">
            <Landmark size={40} strokeWidth={1.2} />
            <p>{t('start.noRecent')}</p>
          </div>
        ) : (
          <ul className="start__list">
            {shown.map((r) => {
              const gone = missing.has(r);
              return (
                <li key={r} className={`start__item ${gone ? 'is-missing' : ''} ${r === resume ? 'is-last' : ''}`}>
                  <button className="start__open" onClick={() => !gone && void open(r)} disabled={busy || gone} title={r}>
                    <span className="start__item-icon">{gone ? <CircleAlert size={18} /> : <Landmark size={18} strokeWidth={1.6} />}</span>
                    <span className="start__item-text">
                      <span className="start__item-name">{baseName(r)}</span>
                      <span className="start__item-path">{gone ? t('start.missing') : parentOf(r)}</span>
                    </span>
                  </button>
                  <button className="icon-btn start__forget" title={t('start.forget')} onClick={() => ws.forgetRecent(r)}>
                    <X size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
