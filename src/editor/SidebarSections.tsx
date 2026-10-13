// Sezioni della scheda Armarium nella colonna sinistra dello Scriptorium, nell'ordine scelto
// dall'utente, e il pannello per riordinarle (trascinando o con le frecce) e nasconderle.
import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, SlidersHorizontal } from 'lucide-react';
import { leftPanelSections, type LeftSection } from './slots';
import { DocumentsTree } from './DocumentsTree';
import { CodexPanel } from '../codex/CodexPanel';
import { useWorkspace } from '../state/workspace';
import { Popover } from '../components/Popover';
import { orderedSections, visibleSections, moveSection, toggleSection } from './leftSections';
import { t, useLang } from '../i18n';

const BUILT_IN: LeftSection[] = [
  { id: 'scrolls', label: 'side.documents', component: DocumentsTree },
  { id: 'codex', label: 'codex.title', component: CodexPanel },
];

function sections(): LeftSection[] {
  return [...BUILT_IN, ...leftPanelSections.all()];
}

export function LeftSections() {
  useLang();
  const saved = useWorkspace((s) => s.app.prefs.leftSections);
  const all = sections();
  const byId = new Map(all.map((s) => [s.id, s]));
  const ids = visibleSections(
    all.map((s) => s.id),
    saved,
  );
  if (!ids.length) {
    return <p className="hint side-empty">{t('sections.allHidden')}</p>;
  }
  return (
    <>
      {ids.map((id) => {
        const S = byId.get(id)!.component;
        return <S key={id} />;
      })}
    </>
  );
}

export function SectionsButton() {
  useLang();
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const saved = useWorkspace((s) => s.app.prefs.leftSections);
  const all = sections();
  const avail = all.map((s) => s.id);
  const label = new Map(all.map((s) => [s.id, t(s.label)]));
  const order = orderedSections(avail, saved);
  const hidden = new Set(saved?.hidden ?? []);
  const set = (leftSections: typeof saved) => useWorkspace.getState().setPrefs({ leftSections });
  return (
    <>
      <button ref={btn} className="icon-btn side-tabs__more" title={t('sections.customize')} aria-label={t('sections.customize')} aria-expanded={open} onClick={() => setOpen(!open)}>
        <SlidersHorizontal size={13} />
      </button>
      <Popover anchor={btn.current} open={open} onClose={() => setOpen(false)} className="sections-pop">
        <div className="sections-pop__title">{t('sections.title')}</div>
        <ul className="sections-pop__list">
          {order.map((id, i) => (
            <li
              key={id}
              className={`sections-pop__row ${hidden.has(id) ? 'is-hidden' : ''} ${dragging === id ? 'is-dragging' : ''}`}
              draggable
              onDragStart={(e) => {
                setDragging(id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', id);
              }}
              onDragEnd={() => setDragging(null)}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                if (dragging !== id) set(moveSection(avail, saved, dragging, i));
              }}
            >
              <GripVertical size={13} className="sections-pop__grip" />
              <span className="sections-pop__label">{label.get(id)}</span>
              <button className="icon-btn" disabled={i === 0} title={t('sections.up')} aria-label={t('sections.up')} onClick={() => set(moveSection(avail, saved, id, i - 1))}>
                <ArrowUp size={13} />
              </button>
              <button className="icon-btn" disabled={i === order.length - 1} title={t('sections.down')} aria-label={t('sections.down')} onClick={() => set(moveSection(avail, saved, id, i + 1))}>
                <ArrowDown size={13} />
              </button>
              <button
                className="icon-btn"
                title={hidden.has(id) ? t('sections.show') : t('sections.hide')}
                aria-label={hidden.has(id) ? t('sections.show') : t('sections.hide')}
                aria-pressed={!hidden.has(id)}
                onClick={() => set(toggleSection(saved, id))}
              >
                {hidden.has(id) ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </li>
          ))}
        </ul>
        <button className="btn sections-pop__reset" onClick={() => set({ order: [], hidden: [] })}>
          {t('sections.reset')}
        </button>
      </Popover>
    </>
  );
}
