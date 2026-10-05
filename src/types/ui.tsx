// Pezzi d'interfaccia dei tipi: icona, scelta del tipo, campo di una proprietà.
import { useEffect, useState } from 'react';
import { FileText, BookOpen, Clapperboard, Newspaper, User, MapPin, Mic, Dices, NotebookPen, Lightbulb, Tag, type LucideIcon } from 'lucide-react';
import { type ObjectType, type PropDef, type PropValue, type TypeTarget, typesFor, parsePropInput, formatProp } from './model';
import { useTypes } from './store';
import { t, getLang } from '../i18n';

const ICONS: Record<string, LucideIcon> = {
  file: FileText,
  book: BookOpen,
  clapperboard: Clapperboard,
  newspaper: Newspaper,
  user: User,
  'map-pin': MapPin,
  mic: Mic,
  dices: Dices,
  notebook: NotebookPen,
  lightbulb: Lightbulb,
  tag: Tag,
};

export function TypeIcon({ icon, size = 13, color }: { icon: string; size?: number; color?: string }) {
  const I = ICONS[icon] ?? FileText;
  return <I size={size} style={color ? { color } : undefined} />;
}

export function TypeSelect({ target, value, onChange, className }: { target: TypeTarget; value: string | null; onChange: (id: string | null) => void; className?: string }) {
  const types = useTypes((s) => s.types);
  const list = typesFor(types, target);
  return (
    <select className={`select small ${className ?? ''}`} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-label={t('types.type')}>
      <option value="">{t('types.none')}</option>
      {list.map((ty) => (
        <option key={ty.id} value={ty.id}>
          {ty.name}
        </option>
      ))}
      {value && !list.some((x) => x.id === value) && <option value={value}>{t('types.missing')}</option>}
    </select>
  );
}

/** Campo di modifica di una proprietà; salva all'uscita dal campo o al cambio di scelta. */
export function PropField({ def, value, onChange, compact }: { def: PropDef; value: PropValue | undefined; onChange: (v: PropValue) => void; compact?: boolean }) {
  const text = value === undefined || value === null ? '' : Array.isArray(value) ? value.join(', ') : String(value);
  const [draft, setDraft] = useState(text);
  useEffect(() => setDraft(text), [text]);
  const cls = `input ${compact ? 'input--compact' : ''}`;
  if (def.kind === 'checkbox')
    return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} aria-label={def.label} />;
  if (def.kind === 'select')
    return (
      <select className={`select ${compact ? 'small' : ''}`} value={text} onChange={(e) => onChange(e.target.value || null)} aria-label={def.label}>
        <option value="">—</option>
        {(def.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        {text && !(def.options ?? []).includes(text) && <option value={text}>{text}</option>}
      </select>
    );
  const type = def.kind === 'number' ? 'number' : def.kind === 'date' ? 'date' : def.kind === 'url' ? 'url' : 'text';
  return (
    <input
      className={cls}
      type={type}
      value={draft}
      placeholder={def.kind === 'multi' ? t('types.multiHint') : def.label}
      aria-label={def.label}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== text && onChange(parsePropInput(def, draft))}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

/** Valore leggibile, per tabelle e anteprime. */
export function propText(def: PropDef, v: PropValue | undefined): string {
  return formatProp(def, v, getLang());
}

export function useType(id: string | null | undefined): ObjectType | null {
  return useTypes((s) => (id ? s.types.find((x) => x.id === id) ?? null : null));
}
