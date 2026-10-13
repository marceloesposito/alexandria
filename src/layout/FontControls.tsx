// Carattere e corpo del testo della pergamena: gli stessi controlli in Esporta e in Layout > Testo.
import { TEXT_FONTS, docFontId, type TextFont } from 'logos/layout/model';
import { useDocSettings } from './docSettings';
import { withFont, withFontSize } from './fontChoice';
import { t, useLang } from '../i18n';

const GROUPS: TextFont['group'][] = ['alexandria', 'web', 'generic'];

export function FontSelect() {
  useLang();
  const L = useDocSettings((s) => s.settings.layout);
  return (
    <select className="select" value={docFontId(L)} onChange={(e) => useDocSettings.getState().updateLayout(withFont(e.target.value))}>
      {GROUPS.map((g) => (
        <optgroup key={g} label={t(`font.group.${g}`)}>
          {TEXT_FONTS.filter((f) => f.group === g).map((f) => (
            <option key={f.id} value={f.id} style={{ fontFamily: f.web }}>
              {f.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function FontSizeInput() {
  const L = useDocSettings((s) => s.settings.layout);
  return (
    <span className="num">
      <input
        className="input"
        type="number"
        value={L.fontSizePt}
        step={0.5}
        min={6}
        max={36}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) useDocSettings.getState().updateLayout(withFontSize(L, v));
        }}
      />
      <span className="hint">pt</span>
    </span>
  );
}
