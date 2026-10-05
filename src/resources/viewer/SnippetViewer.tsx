// Snippet di codice nel visualizzatore: si modifica e si salva (anche il linguaggio).
import { useEffect, useState } from 'react';
import { useResources } from '../store';
import { saveSnippet, SNIPPET_LANGUAGES } from '../importer';
import type { Resource } from '../model';
import { useWorkspace } from '../../state/workspace';
import { t } from '../../i18n';

export function SnippetViewer({ r }: { r: Resource }) {
  const [code, setCode] = useState<string | null>(null);
  const [lang, setLang] = useState(r.meta.language ?? 'text');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    void useResources
      .getState()
      .textOf(r.id)
      .then((txt) => setCode(txt));
  }, [r.id]);

  const save = async (next = lang) => {
    if (code === null) return;
    await saveSnippet(r.id, code, next);
    setDirty(false);
    useWorkspace.getState().toast(t('snippet.saved'), 'ok');
  };

  return (
    <div className="snippet-viewer">
      <div className="snippet-viewer__bar">
        <label>
          {t('snippet.language')}{' '}
          <select
            className="select small"
            value={lang}
            onChange={(e) => {
              setLang(e.target.value);
              void save(e.target.value);
            }}
          >
            {SNIPPET_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <span className="grow" />
        <button className="btn small btn--primary" disabled={!dirty} onClick={() => void save()}>
          {t('common.save')}
        </button>
      </div>
      <textarea
        className="snippet-viewer__code mono"
        spellCheck={false}
        value={code ?? ''}
        onChange={(e) => {
          setCode(e.target.value);
          setDirty(true);
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            void save();
          }
          // il tab inserisce due spazi invece di uscire dal campo
          if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            const el = e.currentTarget;
            const { selectionStart: a, selectionEnd: b } = el;
            const next = el.value.slice(0, a) + '  ' + el.value.slice(b);
            setCode(next);
            setDirty(true);
            requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2));
          }
        }}
        onBlur={() => dirty && void save()}
      />
    </div>
  );
}
