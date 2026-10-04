// Pannello Trova e sostituisci (non modale: si continua a scrivere).
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, X, CaseSensitive, Regex, WholeWord } from 'lucide-react';
import { getEditor } from '../../state/editorRef';
import { setSearch, clearSearch, gotoMatch, replaceCurrent, replaceAll, searchState } from '../../editor/search';
import { useWorkspace } from '../../state/workspace';
import { t } from '../../i18n';
import { useCommandTick } from '../useCommands';

export function FindReplace() {
  useCommandTick();
  const arg = useWorkspace((s) => s.dialogArg) as { replace?: boolean } | null;
  const [showReplace, setShowReplace] = useState(!!arg?.replace);
  const [query, setQuery] = useState(() => {
    const e = getEditor();
    if (!e || e.state.selection.empty) return '';
    const { from, to } = e.state.selection;
    const s = e.state.doc.textBetween(from, to, ' ');
    return s.length < 80 ? s : '';
  });
  const [repl, setRepl] = useState('');
  const [regex, setRegex] = useState(false);
  const [cs, setCs] = useState(false);
  const [ww, setWw] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.select();
  }, []);
  useEffect(() => setShowReplace(!!arg?.replace), [arg]);

  useEffect(() => {
    const e = getEditor();
    if (e) setSearch(e, { query, regex, caseSensitive: cs, wholeWord: ww });
  }, [query, regex, cs, ww]);

  const close = () => {
    const e = getEditor();
    if (e) {
      clearSearch(e);
      e.commands.focus();
    }
    useWorkspace.getState().closeDialog();
  };

  const e = getEditor();
  const st = e ? searchState(e) : undefined;
  const total = st?.matches.length ?? 0;
  const cur = st && st.current >= 0 ? st.current + 1 : 0;

  return (
    <div
      className="find-panel"
      role="search"
      onKeyDown={(ev) => {
        if (ev.key === 'Escape') close();
      }}
    >
      <div className="find-panel__row">
        <input
          ref={input}
          className="input"
          placeholder={t('find.placeholder')}
          value={query}
          onChange={(ev) => setQuery(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') {
              ev.preventDefault();
              const ed = getEditor();
              if (ed) gotoMatch(ed, ev.shiftKey ? -1 : 1);
            }
          }}
        />
        <button className={`icon-btn ${cs ? 'is-on' : ''}`} title={t('find.caseSensitive')} onClick={() => setCs(!cs)}>
          <CaseSensitive size={15} />
        </button>
        <button className={`icon-btn ${ww ? 'is-on' : ''}`} title={t('find.wholeWord')} onClick={() => setWw(!ww)}>
          <WholeWord size={15} />
        </button>
        <button className={`icon-btn ${regex ? 'is-on' : ''}`} title={t('find.regex')} onClick={() => setRegex(!regex)}>
          <Regex size={15} />
        </button>
        <span className="find-panel__count">{query ? t('find.count', { cur, total }) : ''}</span>
        <button className="icon-btn" title={t('find.prev')} onClick={() => e && gotoMatch(e, -1)} disabled={!total}>
          <ChevronUp size={15} />
        </button>
        <button className="icon-btn" title={t('find.next')} onClick={() => e && gotoMatch(e, 1)} disabled={!total}>
          <ChevronDown size={15} />
        </button>
        <button className="icon-btn" title={t('find.toggleReplace')} onClick={() => setShowReplace(!showReplace)}>
          {showReplace ? '−' : '+'}
        </button>
        <button className="icon-btn" title={t('common.close')} onClick={close}>
          <X size={15} />
        </button>
      </div>
      {showReplace && (
        <div className="find-panel__row">
          <input
            className="input"
            placeholder={regex ? t('find.replaceRegex') : t('find.replacePlaceholder')}
            value={repl}
            onChange={(ev) => setRepl(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' && e) {
                ev.preventDefault();
                replaceCurrent(e, repl);
              }
            }}
          />
          <button className="btn small" disabled={!total} onClick={() => e && replaceCurrent(e, repl)}>
            {t('find.replace')}
          </button>
          <button
            className="btn small"
            disabled={!total}
            onClick={() => {
              if (!e) return;
              const n = replaceAll(e, repl);
              useWorkspace.getState().toast(t('find.replacedAll', { n }), 'ok');
            }}
          >
            {t('find.replaceAll')}
          </button>
        </div>
      )}
    </div>
  );
}
