// Interfaccia della copia per revisione: finestra di creazione (autore) e barra del revisore.
import { useState } from 'react';
import { Save, Send, X, MessageSquarePlus, ArrowDownToLine, ScrollText } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useWorkspace } from '../state/workspace';
import { useResources } from '../resources/store';
import { neighbours } from '../codex/model';
import { useCodexStore } from '../codex/store';
import { runCommand } from '../commands/registry';
import { WindowControls, customTitleBar } from '../shell/WindowControls';
import { useReview, createRecensio, saveReview, returnReview, closeReview } from './session';
import { t, useLang } from '../i18n';

export function RecensioDialog() {
  useLang();
  const close = () => useWorkspace.getState().closeDialog();
  const active = useWorkspace((s) => s.activeDoc);
  const docs = useWorkspace((s) => s.docs);
  const links = useResources((s) => s.links);
  const nb = active ? neighbours(links, active) : null;
  const inCodex = !!nb && nb.members.length > 1;
  const codexName = useCodexStore((s) => (nb ? s.settings[nb.root]?.name : undefined));
  const docTitle = docs.find((d) => d.rel === active)?.title ?? '';
  const [scope, setScope] = useState<'doc' | 'codex'>(inCodex ? 'codex' : 'doc');
  const [files, setFiles] = useState(false);
  const [busy, setBusy] = useState(false);
  const rels = scope === 'codex' && nb ? nb.members : active ? [active] : [];
  const title = scope === 'codex' ? codexName ?? docs.find((d) => d.rel === nb?.root)?.title ?? docTitle : docTitle;
  return (
    <Modal
      title={t('recensio.createTitle')}
      onClose={close}
      size="small"
      footer={
        <>
          <button className="btn" onClick={close}>
            {t('common.cancel')}
          </button>
          <button
            className="btn btn--primary"
            disabled={busy || !rels.length}
            onClick={async () => {
              setBusy(true);
              const ok = await createRecensio(rels, title, files);
              setBusy(false);
              if (ok) close();
            }}
          >
            <Send size={13} /> {t('recensio.create')}
          </button>
        </>
      }
    >
      <p className="hint">{t('recensio.intro')}</p>
      <label className="check">
        <input type="radio" checked={scope === 'doc'} onChange={() => setScope('doc')} /> {t('recensio.scopeDoc', { name: docTitle })}
      </label>
      {inCodex && (
        <label className="check">
          <input type="radio" checked={scope === 'codex'} onChange={() => setScope('codex')} /> {t('recensio.scopeCodex', { name: title, n: nb!.members.length })}
        </label>
      )}
      <label className="check" style={{ marginTop: 10 }}>
        <input type="checkbox" checked={files} onChange={(e) => setFiles(e.target.checked)} /> {t('recensio.includeFiles')}
      </label>
      <p className="hint">{t('recensio.includeFilesHint')}</p>
    </Modal>
  );
}

/** Barra in alto nella modalità revisore, al posto di menu, navigazione e ribbon. */
export function ReviewBar() {
  useLang();
  const s = useReview((x) => x.session);
  if (!s) return null;
  return (
    <div className={`review-bar ${customTitleBar ? 'menubar--titlebar' : ''}`} data-tauri-drag-region>
      <ScrollText size={16} className="review-bar__icon" />
      <div className="review-bar__title" data-tauri-drag-region>
        <strong>{s.manifest.title}</strong>
        <span className="hint">
          {t('recensio.bar', { author: s.manifest.author || '—', reviewer: s.manifest.reviewer?.name ?? '' })}
        </span>
      </div>
      <span className="grow" data-tauri-drag-region />
      <button className="btn small" onClick={() => void runCommand('track.next')}>
        <ArrowDownToLine size={13} /> {t('cmd.track.next')}
      </button>
      <button className="btn small" onClick={() => void runCommand('comment.add')}>
        <MessageSquarePlus size={13} /> {t('cmd.comment.add')}
      </button>
      <button className="btn small" onClick={() => void saveReview()}>
        <Save size={13} /> {t('common.save')}
      </button>
      <button className="btn small btn--primary" onClick={() => void returnReview()}>
        <Send size={13} /> {t('recensio.return')}
      </button>
      <button className="icon-btn" title={t('recensio.close')} onClick={() => void closeReview()}>
        <X size={16} />
      </button>
      <WindowControls />
    </div>
  );
}
