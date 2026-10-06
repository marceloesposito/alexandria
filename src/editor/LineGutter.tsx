// Numeri di riga a margine della pagina.
import { useLines, pageZoom } from './lines';
import { useWorkspace } from '../state/workspace';

export function LineGutter() {
  const lines = useLines();
  const step = useWorkspace((s) => s.app.prefs.lineNumberStep);
  // le righe sono misurate sullo schermo, la colonna sta dentro la pagina con lo zoom
  const z = pageZoom();
  return (
    <div className="line-gutter" aria-hidden>
      {lines.map((l) =>
        l.n % step === 0 || l.n === 1 ? (
          <span key={l.n} className="line-gutter__n" style={{ top: l.top / z, height: (l.bottom - l.top) / z }}>
            {l.n}
          </span>
        ) : null,
      )}
    </div>
  );
}
