// Numeri di riga a margine della pagina.
import { useLines } from './lines';
import { useWorkspace } from '../state/workspace';

export function LineGutter() {
  const lines = useLines();
  const step = useWorkspace((s) => s.app.prefs.lineNumberStep);
  return (
    <div className="line-gutter" aria-hidden>
      {lines.map((l) =>
        l.n % step === 0 || l.n === 1 ? (
          <span key={l.n} className="line-gutter__n" style={{ top: l.top, height: l.bottom - l.top }}>
            {l.n}
          </span>
        ) : null,
      )}
    </div>
  );
}
