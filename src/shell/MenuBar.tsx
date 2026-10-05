// Barra dei menu in alto, come nelle app desktop: File, Modifica, Inserisci, ...
import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Check } from 'lucide-react';
import { MENUS, type MenuEntry } from '../commands/defaults';
import { getCommand, runCommand, displayShortcut } from '../commands/registry';
import { useCommandTick } from './useCommands';
import { t, useLang } from '../i18n';
import { useWorkspace } from '../state/workspace';
import { workspaceItems } from './WorkspaceMenu';
import { baseName } from '../platform';
import { flushSave } from '../editor/session';
import { getEditor } from '../state/editorRef';

function Entries({ items, onDone }: { items: MenuEntry[]; onDone: () => void }) {
  useCommandTick();
  const docs = useWorkspace((s) => s.docs);
  const activeDoc = useWorkspace((s) => s.activeDoc);
  const recent = useWorkspace((s) => s.app.recentVaults);
  const vaultRoot = useWorkspace((s) => s.vaultRoot);
  const [sub, setSub] = useState<number | null>(null);

  return (
    <>
      {items.map((it, i) => {
        if ('sep' in it) return <div key={i} className="menu-sep" />;
        if ('dynamic' in it) {
          if (it.dynamic === 'workspaces') {
            return workspaceItems().map((w, k) =>
              w.sep ? (
                <div key={`w${k}`} className="menu-sep" />
              ) : (
                <button
                  key={`w${k}`}
                  className={`menu-item ${w.danger ? 'is-danger' : ''}`}
                  onClick={() => {
                    onDone();
                    w.onClick?.();
                  }}
                >
                  <span className="menu-item__check">{w.checked ? <Check size={14} /> : null}</span>
                  <span className="menu-item__label">{w.label}</span>
                </button>
              ),
            );
          }
          if (it.dynamic === 'documents') {
            return docs.map((d) => (
              <button
                key={d.rel}
                className="menu-item"
                onClick={async () => {
                  onDone();
                  await flushSave(getEditor());
                  useWorkspace.getState().openDoc(d.rel);
                  useWorkspace.getState().setView('editor');
                }}
              >
                <span className="menu-item__check">{d.rel === activeDoc ? <Check size={14} /> : null}</span>
                <span className="menu-item__label">{d.folder ? `${d.folder}/${d.title}` : d.title}</span>
              </button>
            ));
          }
          const list = recent.filter((r) => r !== vaultRoot);
          if (!list.length) return <div key={i} className="menu-item is-empty">{t('menu.none')}</div>;
          return list.map((r) => (
            <button
              key={r}
              className="menu-item"
              title={r}
              onClick={async () => {
                onDone();
                await flushSave(getEditor());
                await useWorkspace.getState().enterVault(r);
              }}
            >
              <span className="menu-item__check" />
              <span className="menu-item__label">{baseName(r)}</span>
            </button>
          ));
        }
        if ('submenu' in it) {
          return (
            <div key={i} className="menu-sub" onMouseEnter={() => setSub(i)} onMouseLeave={() => setSub(null)}>
              <button className="menu-item">
                <span className="menu-item__check" />
                <span className="menu-item__label">{t(it.label)}</span>
                <ChevronRight size={14} className="menu-item__arrow" />
              </button>
              {sub === i && (
                <div className="menu-dropdown menu-dropdown--sub">
                  <Entries items={it.submenu} onDone={onDone} />
                </div>
              )}
            </div>
          );
        }
        const cmd = getCommand(it.cmd);
        if (!cmd) return null;
        const enabled = cmd.isEnabled ? cmd.isEnabled() : true;
        const activeState = cmd.isActive?.();
        return (
          <button
            key={i}
            className="menu-item"
            disabled={!enabled}
            onClick={() => {
              onDone();
              void runCommand(cmd.id);
            }}
          >
            <span className="menu-item__check">{activeState ? <Check size={14} /> : cmd.icon ? <cmd.icon size={14} /> : null}</span>
            <span className="menu-item__label">{t(cmd.label)}</span>
            {cmd.shortcut && <span className="menu-item__hint">{displayShortcut(cmd.shortcut)}</span>}
          </button>
        );
      })}
    </>
  );
}

export function MenuBar() {
  useLang();
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') setOpen(null);
        return;
      }
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    window.addEventListener('mousedown', close, true);
    window.addEventListener('keydown', close, true);
    return () => {
      window.removeEventListener('mousedown', close, true);
      window.removeEventListener('keydown', close, true);
    };
  }, [open]);

  return (
    <div className="menubar" ref={ref} role="menubar">
      <span className="menubar__brand" aria-hidden>
        Alexandria
      </span>
      {MENUS.map((m) => (
        <div key={m.id} className="menubar__menu">
          <button
            className={`menubar__item ${open === m.id ? 'is-open' : ''}`}
            role="menuitem"
            aria-haspopup
            aria-expanded={open === m.id}
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen(open === m.id ? null : m.id);
            }}
            onMouseEnter={() => open && setOpen(m.id)}
          >
            {t(m.label)}
          </button>
          {open === m.id && (
            <div className="menu-dropdown" role="menu">
              <Entries items={m.items} onDone={() => setOpen(null)} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
