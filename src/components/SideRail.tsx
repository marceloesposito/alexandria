// Colonna richiusa: una striscia sul bordo con le linguette verticali (come le palette di AutoCAD);
// un clic su una linguetta riapre la colonna su quella scheda.
import type { LucideIcon } from 'lucide-react';

export interface RailTab {
  id: string;
  label: string;
  icon: LucideIcon;
  onOpen: () => void;
}

export function SideRail({ side, tabs }: { side: 'left' | 'right'; tabs: RailTab[] }) {
  return (
    <nav className={`side-rail side-rail--${side}`} aria-label={tabs.map((t) => t.label).join(', ')}>
      {tabs.map((t) => (
        <button key={t.id} className="side-rail__tab" title={t.label} onClick={t.onOpen}>
          <t.icon size={13} className="side-rail__icon" />
          <span className="side-rail__label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
