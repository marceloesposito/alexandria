// Conferme e richieste di testo con una modale dell'app (niente window.confirm/prompt).
import { create } from 'zustand';
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';

interface Ask {
  kind: 'confirm' | 'prompt';
  title: string;
  message?: string;
  value?: string;
  okLabel?: string;
  danger?: boolean;
  resolve: (v: string | boolean | null) => void;
}

const useAsk = create<{ ask: Ask | null }>(() => ({ ask: null }));

export function confirmDialog(title: string, message?: string, opts: { okLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) =>
    useAsk.setState({ ask: { kind: 'confirm', title, message, ...opts, resolve: (v) => resolve(v === true) } }),
  );
}

export function promptDialog(title: string, value = '', message?: string, okLabel?: string): Promise<string | null> {
  return new Promise((resolve) =>
    useAsk.setState({
      ask: { kind: 'prompt', title, message, value, okLabel, resolve: (v) => resolve(typeof v === 'string' ? v : null) },
    }),
  );
}

export function AskHost() {
  const ask = useAsk((s) => s.ask);
  const [value, setValue] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ask?.kind === 'prompt') {
      setValue(ask.value ?? '');
      setTimeout(() => input.current?.select(), 0);
    }
  }, [ask]);
  if (!ask) return null;
  const close = (v: string | boolean | null) => {
    useAsk.setState({ ask: null });
    ask.resolve(v);
  };
  return (
    <div className="modal-backdrop" onMouseDown={() => close(ask.kind === 'confirm' ? false : null)}>
      <div
        className="modal modal--small"
        role="dialog"
        aria-modal
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close(ask.kind === 'confirm' ? false : null);
          if (e.key === 'Enter') close(ask.kind === 'confirm' ? true : value);
        }}
      >
        <h2 className="modal__title">{ask.title}</h2>
        {ask.message && <p className="modal__text">{ask.message}</p>}
        {ask.kind === 'prompt' && (
          <input ref={input} className="input" autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
        )}
        <div className="modal__actions">
          <button className="btn" onClick={() => close(ask.kind === 'confirm' ? false : null)}>
            {t('common.cancel')}
          </button>
          <button
            className={`btn ${ask.danger ? 'btn--danger' : 'btn--primary'}`}
            autoFocus={ask.kind === 'confirm'}
            onClick={() => close(ask.kind === 'confirm' ? true : value)}
          >
            {ask.okLabel ?? t('common.ok')}
          </button>
        </div>
      </div>
    </div>
  );
}
