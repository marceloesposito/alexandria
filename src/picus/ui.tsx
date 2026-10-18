// Picus nello Scriptorium: il compagno flottante (sempre a schermo, trascinabile, parla solo se
// interrogato), il pannello delle riscritture (tre versioni del tratto, 1/2/3 le applicano) e il
// pannello di un rilievo o di una parola (alternative per tono, 1-9 scelgono, Tab scorre, Esc chiude).
// La grafica del picchio verra' dopo: per ora un segnaposto, conta la logica.
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Bird, ChevronLeft, ChevronRight, Ellipsis, X } from 'lucide-react';
import { useWorkspace } from '../state/workspace';
import { openContextMenu } from '../components/ContextMenu';
import { t, useLang } from '../i18n';
import { usePicus, type Bubble } from './store';
import { ask, step, clear } from './index';

function bubbleText(b: Bubble): string {
  switch (b.kind) {
    case 'result':
      return t(b.n === 1 ? 'picus.found.one' : 'picus.found.other', { n: b.n });
    case 'quiet':
      return t('picus.quiet');
    case 'done':
      return t('picus.done');
    case 'nopack':
      return t('picus.noPack', { lang: b.lang.toUpperCase() });
    case 'error':
      return b.text;
  }
}

function companionMenu(e: { clientX: number; clientY: number; preventDefault?: () => void }) {
  const ws = useWorkspace.getState();
  openContextMenu(e, [
    { label: t('cmd.picus.ask'), hint: 'F7', onClick: () => void ask(false) },
    { label: t('cmd.picus.askDoc'), hint: 'Ctrl+F7', onClick: () => void ask(true) },
    { label: t('picus.clear'), disabled: !usePicus.getState().items.length, onClick: clear },
    { sep: true, label: '' },
    { label: t('picus.languages'), onClick: () => ws.openDialog('preferences', 'picus') },
    { label: t('picus.hide'), onClick: () => ws.setPrefs({ picusShown: false }) },
  ]);
}

const SIZE = 44;
const clampPos = (x: number, y: number) => ({ x: Math.max(4, Math.min(x, window.innerWidth - SIZE - 4)), y: Math.max(4, Math.min(y, window.innerHeight - SIZE - 4)) });

/** Il compagno: un clic lo interroga (Maiusc+clic: tutta la pergamena), si trascina dove si vuole. */
export function PicusCompanion() {
  useLang();
  const shown = useWorkspace((s) => s.app.prefs.picusShown);
  const saved = useWorkspace((s) => s.app.prefs.picusPos);
  const bubble = usePicus((s) => s.bubble);
  const items = usePicus((s) => s.items);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number; x0: number; y0: number; moved: boolean } | null>(null);
  const [, resize] = useState(0);

  useEffect(() => {
    const on = () => resize((n) => n + 1);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  // i messaggi brevi se ne vanno da soli
  useEffect(() => {
    if (bubble?.kind !== 'quiet' && bubble?.kind !== 'done') return;
    const id = setTimeout(() => usePicus.getState().bubble === bubble && usePicus.setState({ bubble: null }), 2500);
    return () => clearTimeout(id);
  }, [bubble]);

  if (!shown) return null;
  const at = pos ?? (saved ? clampPos(saved.x, saved.y) : null);
  const style = at ? { left: at.x, top: at.y } : undefined;
  // il fumetto si apre dove c'e' spazio: sotto se il picchio sta in alto, verso destra se sta a sinistra
  const below = at ? at.y < 160 : false;
  const left = at ? at.x < 320 : false;

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) return;
    d.moved = true;
    setPos(clampPos(e.clientX - d.dx, e.clientY - d.dy));
  };
  const up = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved && pos) useWorkspace.getState().setPrefs({ picusPos: pos });
    else void ask(e.shiftKey);
    setPos(null);
  };

  return (
    <div className={`picus ${at ? 'is-placed' : ''} ${below ? 'is-below' : ''} ${left ? 'is-left' : ''}`} style={style}>
      {bubble && (
        <div className={`picus__bubble is-${bubble.kind}`} role="status">
          <span>{bubbleText(bubble)}</span>
          {bubble.kind === 'result' && items.length > 0 && (
            <span className="picus__nav">
              <button className="icon-btn tiny" onClick={() => step(-1)} title={t('picus.prev')}>
                <ChevronLeft size={13} />
              </button>
              <button className="icon-btn tiny" onClick={() => step(1)} title={t('picus.next')}>
                <ChevronRight size={13} />
              </button>
            </span>
          )}
          {bubble.kind === 'nopack' && (
            <button className="btn small" onClick={() => useWorkspace.getState().openDialog('preferences', 'picus')}>
              {t('picus.addLanguage')}
            </button>
          )}
          <button className="icon-btn tiny" onClick={() => (bubble.kind === 'result' ? clear() : usePicus.setState({ bubble: null }))} title={t('common.close')}>
            <X size={12} />
          </button>
        </div>
      )}
      <button
        className="picus__bird"
        aria-label={t('picus.name')}
        title={t('picus.tip')}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onKeyDown={(e) => e.key === 'Enter' && void ask(e.shiftKey)}
        onContextMenu={(e) => companionMenu(e)}
      >
        <Bird size={22} />
      </button>
      <button className="picus__more icon-btn tiny" aria-label={t('picus.menu')} onClick={(e) => companionMenu(e)}>
        <Ellipsis size={12} />
      </button>
    </div>
  );
}
