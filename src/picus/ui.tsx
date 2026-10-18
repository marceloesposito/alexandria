// Picus nello Scriptorium: il compagno flottante (sempre a schermo, trascinabile, parla solo se
// interrogato) e il pannello del rilievo con le alternative per tono. Tutto da tastiera: Tab e
// Maiusc+Tab scorrono i rilievi, 1-9 scelgono, I ignora, D disattiva la categoria, Esc chiude.
// La grafica del picchio verra' dopo: per ora un segnaposto, conta la logica.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Bird, ChevronLeft, ChevronRight, Ellipsis, X } from 'lucide-react';
import { useWorkspace } from '../state/workspace';
import { getEditor } from '../state/editorRef';
import { openContextMenu } from '../components/ContextMenu';
import { t, useLang } from '../i18n';
import { usePicus, type Bubble } from './store';
import { ask, apply, close, disable, ignore, setTone, step, clear } from './index';
import { flagsOf } from './flags';
import { TONES, toneOf, type Tone } from './rank';
import { categoryLabel } from './PicusPrefs';
import type { Live } from './plugin';
import type { Suggestion } from './analyze';

/** chiave i18n se c'e', altrimenti il testo del pacchetto (motivi nuovi di un pacchetto aggiunto) */
const tOr = (key: string, fallback: string) => {
  const s = t(key);
  return s === key ? fallback : s;
};

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
  const tone = usePicus.getState().tone;
  const ws = useWorkspace.getState();
  openContextMenu(e, [
    { label: t('cmd.picus.ask'), hint: 'F7', onClick: () => void ask(false) },
    { label: t('cmd.picus.askDoc'), hint: 'Ctrl+F7', onClick: () => void ask(true) },
    { label: t('picus.clear'), disabled: !usePicus.getState().items.length, onClick: clear },
    { sep: true, label: '' },
    { label: t('picus.docTone'), disabled: true },
    { label: t('picus.tone.none'), checked: tone === null, onClick: () => setTone(null) },
    ...TONES.map((x) => ({ label: t(`picus.tone.${x}`), checked: tone === x, onClick: () => setTone(x) })),
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

function SuggestionButton({ l, s, n }: { l: Live; s: Suggestion; n: number | null }) {
  return (
    <span className="picus-panel__choice">
      <button className={`picus-panel__item ${s.related ? 'is-related' : ''}`} onClick={() => apply(l, s)} title={t(s.related ? 'picus.related' : 'picus.replace', { text: s.text })}>
        {n !== null && <kbd>{n}</kbd>}
        <span className="picus-panel__text">{s.text}</span>
        {flagsOf(s.flags).map((f) => (
          <span key={f} className="picus-panel__flag">
            {t(`picus.flag.${f}`)}
          </span>
        ))}
      </button>
      {s.alt && (
        <button className="picus-panel__item is-alt" onClick={() => apply(l, s, true)} title={t('picus.replace', { text: s.alt })}>
          {s.alt}
        </button>
      )}
      {s.note && <span className="picus-panel__note">{s.note}</span>}
    </span>
  );
}

/** Pannello del rilievo corrente, vicino al testo. */
export function PicusPanel() {
  useLang();
  const items = usePicus((s) => s.items);
  const current = usePicus((s) => s.current);
  const open = usePicus((s) => s.open);
  const focus = usePicus((s) => s.focus);
  const docTone = usePicus((s) => s.tone);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [tick, setTick] = useState(0);
  const l = open ? items[current] : undefined;

  useEffect(() => setToggled({}), [l?.f]);
  useEffect(() => {
    if (open) ref.current?.focus({ preventScroll: true });
  }, [focus, open]);
  useEffect(() => {
    if (!open) return;
    const on = () => setTick((n) => n + 1);
    const outside = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && !(e.target as Element).closest?.('.picus') && close(false);
    window.addEventListener('scroll', on, true);
    window.addEventListener('resize', on);
    window.addEventListener('mousedown', outside);
    return () => {
      window.removeEventListener('scroll', on, true);
      window.removeEventListener('resize', on);
      window.removeEventListener('mousedown', outside);
    };
  }, [open]);

  useLayoutEffect(() => {
    const ed = getEditor();
    if (!l || !ed || !ref.current) return;
    let a: { left: number; bottom: number; top: number };
    try {
      a = ed.view.coordsAtPos(l.from);
    } catch {
      return;
    }
    const r = ref.current.getBoundingClientRect();
    const x = Math.max(8, Math.min(a.left, window.innerWidth - r.width - 8));
    const y = a.bottom + r.height + 12 > window.innerHeight ? Math.max(8, a.top - r.height - 8) : a.bottom + 6;
    setPos({ x, y });
  }, [l, tick]);

  if (!l) return null;
  const f = l.f;

  // alternative numerate (solo le sezioni aperte), per i tasti 1-9
  const numbered: Suggestion[] = [];
  const isOpen = (k: string, d: boolean) => toggled[k] ?? d;
  for (const [si, s] of f.senses.entries()) for (const sec of s.sections) if (isOpen(`${si}:${sec.tone}`, sec.open)) numbered.push(...sec.items);

  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (e.key === 'Escape') close();
    else if (e.key === 'Tab') step(e.shiftKey ? -1 : 1);
    else if (/^[1-9]$/.test(e.key) && numbered[Number(e.key) - 1]) apply(l, numbered[Number(e.key) - 1], e.altKey);
    else if (k === 'i' && !e.ctrlKey && !e.metaKey) ignore(l);
    else if (k === 'd' && !e.ctrlKey && !e.metaKey) disable(l);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const why =
    f.kind === 'style'
      ? tOr(`picus.reason.${f.reason}`, f.reason ?? '')
      : f.kind === 'tone'
        ? t('picus.offTone', { tone: t(`picus.tone.${docTone ?? 'neutral'}`).toLowerCase() })
        : f.kind === 'repetition'
          ? t(f.base ? 'picus.repeatedGroup' : 'picus.repeatedWord')
          : f.kind === 'synonym'
            ? t('picus.synonymsOf', { text: f.base })
            : t('picus.variations');
  // alternative dal thesaurus: per significato, senza sezioni di tono (il thesaurus non ha registri)
  const thes = f.source === 'thesaurus';
  const category = categoryLabel(f.category);
  let n = 0;

  return createPortal(
    <div className="picus-panel" ref={ref} style={{ left: pos.x, top: pos.y }} role="dialog" tabIndex={-1} aria-label={t('picus.panel', { text: f.original })} onKeyDown={key}>
      <header className="picus-panel__head">
        <Bird size={14} />
        <span className="picus-panel__orig">
          «{f.original}»{f.register !== null && <span className="picus-panel__tone"> · {t(`picus.tone.${toneOf(f.register)}`).toLowerCase()}</span>}
        </span>
        <span className="picus-panel__count">
          {current + 1}/{items.length}
        </span>
        <button className="icon-btn tiny" onClick={() => step(-1)} title={`${t('picus.prev')} (Shift+Tab)`}>
          <ChevronLeft size={13} />
        </button>
        <button className="icon-btn tiny" onClick={() => step(1)} title={`${t('picus.next')} (Tab)`}>
          <ChevronRight size={13} />
        </button>
        <button className="icon-btn tiny" onClick={() => close()} title={`${t('common.close')} (Esc)`}>
          <X size={13} />
        </button>
      </header>
      <div className="picus-panel__body">
        <p className="picus-panel__why">
          {f.tags.map((k) => (
            <span key={k} className={`picus-panel__tag is-${k}`}>
              {t(`picus.kind.${k}`)}
            </span>
          ))}
          <span>{why}</span>
        </p>
        {f.note && <p className="picus-panel__note">{f.note}</p>}
        {f.senses.map((s, si) => (
          <section key={si} className="picus-panel__sense">
            {thes ? <div className="picus-panel__sensename">{s.sense}</div> : f.senses.length > 1 && <div className="picus-panel__sensename">{t('picus.sense', { sense: s.sense })}</div>}
            {s.sections.map((sec) => {
              const k = `${si}:${sec.tone}`;
              const shown = thes || isOpen(k, sec.open);
              return (
                <div key={k} className="picus-panel__section">
                  {!thes && (
                    <button className="picus-panel__sectionhead" aria-expanded={shown} onClick={() => setToggled({ ...toggled, [k]: !shown })}>
                      {t(`picus.tone.${sec.tone as Tone}`)} <span className="hint">{sec.items.length}</span>
                    </button>
                  )}
                  {shown && (
                    <div className="picus-panel__items">
                      {sec.items.map((it, j) => {
                        n++;
                        return <SuggestionButton key={j} l={l} s={it} n={n <= 9 ? n : null} />;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))}
        {thes && <p className="picus-panel__source hint">{t('thes.source')}</p>}
      </div>
      <footer className="picus-panel__foot">
        <button className="btn btn--ghost small" onClick={() => ignore(l)} title={t('picus.ignoreHint')}>
          {t('picus.ignore')} <kbd>I</kbd>
        </button>
        <button className="btn btn--ghost small" onClick={() => disable(l)} title={t('picus.disableHint')}>
          {t('picus.disable', { category })} <kbd>D</kbd>
        </button>
      </footer>
    </div>,
    document.body,
  );
}
