// Preferenze > Scorciatoie: ogni comando con la sua scorciatoia, da cambiare, togliere o ripristinare.
import { useEffect, useState } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import { t } from '../../i18n';
import { useWorkspace } from '../../state/workspace';
import { allCommands, displayShortcut, isMac, shortcutOf, type Command } from '../../commands/registry';
import { useCommandTick } from '../useCommands';
import { confirmDialog } from '../../components/confirm';
import {
  assignShortcut,
  conflictsFor,
  resetShortcut,
  shortcutFromEvent,
  validateShortcut,
  type ShortcutProblem,
} from '../../commands/shortcuts';

const MODIFIER_KEYS = ['Control', 'Meta', 'Alt', 'Shift', 'OS', 'CapsLock'];

interface Pending {
  id: string;
  keys: string;
  others: string[];
}

export function ShortcutsPrefs() {
  useCommandTick();
  const overrides = useWorkspace((s) => s.app.shortcuts);
  const save = (o: typeof overrides) => useWorkspace.getState().setShortcuts(o);
  const [query, setQuery] = useState('');
  const [recording, setRecording] = useState<string | null>(null);
  const [problem, setProblem] = useState<ShortcutProblem | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const cmds = allCommands();
  const label = (c: Command) => t(c.label);

  // cattura del tasto: prima di tutti (anche del dialogo e delle scorciatoie globali)
  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (MODIFIER_KEYS.includes(e.key)) return;
      const plain = !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
      if (plain && e.key === 'Escape') {
        setRecording(null);
        setProblem(null);
        return;
      }
      if (plain && (e.key === 'Backspace' || e.key === 'Delete')) {
        save(assignShortcut(overrides, recording, null, cmds, isMac));
        setRecording(null);
        setProblem(null);
        return;
      }
      const keys = shortcutFromEvent(e, isMac);
      const p = validateShortcut(keys, isMac);
      if (p) return setProblem(p);
      setProblem(null);
      setRecording(null);
      const others = conflictsFor(recording, keys, cmds, overrides, isMac);
      if (others.length) setPending({ id: recording, keys, others });
      else save(assignShortcut(overrides, recording, keys, cmds, isMac));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recording, overrides, cmds]);

  const q = query.trim().toLowerCase();
  const list = cmds
    .filter((c) => {
      if (!q) return true;
      const sc = shortcutOf(c);
      return label(c).toLowerCase().includes(q) || c.id.includes(q) || (!!sc && (displayShortcut(sc).toLowerCase().includes(q) || sc.toLowerCase().includes(q)));
    })
    .sort((a, b) => a.category.localeCompare(b.category) || label(a).localeCompare(label(b)));
  const cats = [...new Set(list.map((c) => c.category))];
  const modified = (id: string) => Object.prototype.hasOwnProperty.call(overrides, id);

  return (
    <div className="shortcut-prefs">
      <div className="shortcut-prefs__bar">
        <label className="shortcut-prefs__search">
          <Search size={14} />
          <input className="input" value={query} placeholder={t('shortcuts.search')} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button
          className="btn small"
          disabled={!Object.keys(overrides).length}
          onClick={async () => {
            if (await confirmDialog(t('shortcuts.resetAllConfirm'), undefined, { okLabel: t('shortcuts.resetAll') })) save({});
          }}
        >
          {t('shortcuts.resetAll')}
        </button>
      </div>
      <div className="shortcut-prefs__list">
        {!list.length && <p className="hint">{t('shortcuts.empty')}</p>}
        {cats.map((cat) => (
          <section key={cat}>
            <h3>{t(`category.${cat}`)}</h3>
            {list
              .filter((c) => c.category === cat)
              .map((c) => {
                const sc = shortcutOf(c);
                const isRec = recording === c.id;
                return (
                  <div key={c.id} className={`shortcut-row ${isRec ? 'is-recording' : ''}`}>
                    <span className="shortcut-row__label">{label(c)}</span>
                    <span className="shortcut-row__keys">
                      {isRec ? (
                        <span className="shortcut-row__rec">{problem ? t(`shortcuts.problem.${problem}`) : t('shortcuts.recording')}</span>
                      ) : sc ? (
                        <kbd>{displayShortcut(sc)}</kbd>
                      ) : (
                        <span className="hint">{t('shortcuts.none')}</span>
                      )}
                      {modified(c.id) && !isRec && <span className="shortcut-row__mod">{t('shortcuts.modified')}</span>}
                    </span>
                    <button
                      className={`btn small ${isRec ? 'btn--primary' : ''}`}
                      onClick={() => {
                        setPending(null);
                        setProblem(null);
                        setRecording(isRec ? null : c.id);
                      }}
                    >
                      {isRec ? t('common.cancel') : t('shortcuts.change')}
                    </button>
                    <button
                      className="icon-btn small"
                      title={t('shortcuts.reset')}
                      aria-label={t('shortcuts.reset')}
                      disabled={!modified(c.id)}
                      onClick={() => save(resetShortcut(overrides, c.id, cmds, isMac))}
                    >
                      <RotateCcw size={13} />
                    </button>
                    {pending?.id === c.id && (
                      <div className="shortcut-row__conflict">
                        <span>
                          {t('shortcuts.conflict', {
                            keys: displayShortcut(pending.keys),
                            cmd: pending.others.map((id) => label(cmds.find((x) => x.id === id)!)).join(', '),
                          })}
                        </span>
                        <button
                          className="btn small btn--primary"
                          onClick={() => {
                            save(assignShortcut(overrides, pending.id, pending.keys, cmds, isMac));
                            setPending(null);
                          }}
                        >
                          {t('shortcuts.replace')}
                        </button>
                        <button className="btn small" onClick={() => setPending(null)}>
                          {t('common.cancel')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </section>
        ))}
      </div>
    </div>
  );
}
