// Quick switcher (Ctrl/Cmd+O): apre pergamene e risorse scrivendone una parte del nome; con ">"
// davanti cerca fra i comandi. A destra l'anteprima dell'elemento scelto.
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FileText, ChevronRight, type LucideIcon } from 'lucide-react';
import { useWorkspace } from '../state/workspace';
import { allCommands, runCommand, displayShortcut } from '../commands/registry';
import { fuzzyFilter } from '../lib/fuzzy';
import { flushSave } from '../editor/session';
import { getEditor } from '../state/editorRef';
import { DocPreview } from './DocPreview';
import { t, useLang } from '../i18n';

export interface SwitcherItem {
  id: string;
  label: string;
  sub?: string;
  icon?: LucideIcon | ComponentType<{ size?: number }>;
  hint?: string;
  run(): void | Promise<void>;
  preview?: () => ReactNode;
}

/** Altre fonti di elementi (es. le risorse dell'Armarium): le registrano i moduli. */
const sources: (() => SwitcherItem[])[] = [];
export function addSwitcherSource(f: () => SwitcherItem[]) {
  sources.push(f);
}

function docItems(): SwitcherItem[] {
  const { docs } = useWorkspace.getState();
  return docs.map((d) => ({
    id: `doc:${d.rel}`,
    label: d.title,
    sub: d.folder || undefined,
    icon: FileText,
    run: async () => {
      await flushSave(getEditor());
      useWorkspace.getState().openDoc(d.rel);
      useWorkspace.getState().setView('editor');
    },
    preview: () => <DocPreview rel={d.rel} />,
  }));
}

function commandItems(): SwitcherItem[] {
  const view = useWorkspace.getState().app.view;
  return allCommands()
    .filter((c) => !c.widget && c.id !== 'nav.quickSwitcher' && (!c.views || c.views.includes(view)) && (c.isEnabled ? c.isEnabled() : true))
    .map((c) => ({
      id: `cmd:${c.id}`,
      label: t(c.label),
      sub: t(`category.${c.category}`),
      icon: c.icon,
      hint: c.shortcut ? displayShortcut(c.shortcut) : undefined,
      run: () => void runCommand(c.id),
    }));
}

export function QuickSwitcher() {
  useLang();
  const close = () => useWorkspace.getState().closeDialog();
  const arg = useWorkspace((s) => s.dialogArg) as { query?: string } | null;
  const [q, setQ] = useState(arg?.query ?? '');
  const [sel, setSel] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const commandsMode = q.startsWith('>');
  const query = commandsMode ? q.slice(1) : q;
  const all = useMemo(() => (commandsMode ? commandItems() : [...docItems(), ...sources.flatMap((s) => s())]), [commandsMode]);
  const found = useMemo(() => fuzzyFilter(all, query, (x) => `${x.label} ${x.sub ?? ''}`, 60), [all, query]);
  const current = found[Math.min(sel, found.length - 1)];

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    list.current?.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const choose = (it: SwitcherItem | undefined) => {
    if (!it) return;
    close();
    void it.run();
  };

  return createPortal(
    <div className="switcher-backdrop" onMouseDown={close}>
      <div className="switcher" role="dialog" aria-label={t('switcher.title')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="switcher__main">
          <input
            className="switcher__input"
            autoFocus
            value={q}
            placeholder={t('switcher.placeholder')}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSel((s) => Math.min(found.length - 1, s + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                choose(current);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                close();
              }
            }}
          />
          <div className="switcher__list" ref={list} role="listbox">
            {found.length === 0 && <div className="switcher__empty hint">{t('switcher.none')}</div>}
            {found.map((it, i) => {
              const Icon = it.icon ?? ChevronRight;
              return (
                <div
                  key={it.id}
                  role="option"
                  aria-selected={it === current}
                  className={`switcher__item ${it === current ? 'is-selected' : ''}`}
                  onMouseMove={() => setSel(i)}
                  onClick={() => choose(it)}
                >
                  <Icon size={14} />
                  <span className="switcher__label">{it.label}</span>
                  {it.sub && <span className="switcher__sub">{it.sub}</span>}
                  {it.hint && <span className="switcher__hint">{it.hint}</span>}
                </div>
              );
            })}
          </div>
          <div className="switcher__foot hint">{t('switcher.help')}</div>
        </div>
        {current?.preview && <div className="switcher__preview">{current.preview()}</div>}
      </div>
    </div>,
    document.body,
  );
}
