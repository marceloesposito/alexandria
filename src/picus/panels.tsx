// Picus: i pannelli vicino al testo. Il pannello delle riscritture mostra tre versioni del tratto
// (Formale, Neutra, Informale: 1/2/3 o un clic le applicano) e, sotto, i pezzi uno per uno. Il
// pannello di un rilievo o di una parola mostra le alternative per tono (1-9 scelgono, Tab scorre i
// rilievi, Esc chiude); per una parola anche i contrari.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Bird, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getEditor } from '../state/editorRef';
import { t, useLang } from '../i18n';
import { usePicus, type PieceOption } from './store';
import { apply, applyPiece, applyVersion, close, closeRewrite, step } from './index';
import { ANTONYMS, flagsOf } from './flags';
import { toneOf, type Tone } from './rank';
import type { Live } from './plugin';
import type { Suggestion } from './analyze';

/** chiave i18n se c'e', altrimenti il testo del pacchetto (motivi nuovi di un pacchetto aggiunto) */
const tOr = (key: string, fallback: string) => {
  const s = t(key);
  return s === key ? fallback : s;
};

/**
 * Posizione di un pannello vicino al testo (sotto il punto `at` del documento, sopra se non c'e'
 * posto); segue lo scorrimento. `onOutside` scatta su un clic fuori dal pannello e dal picchio.
 */
function usePlacement(ref: { current: HTMLDivElement | null }, at: number | null, onOutside: () => void) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [tick, setTick] = useState(0);
  const shown = at !== null;
  useEffect(() => {
    if (!shown) return;
    const on = () => setTick((n) => n + 1);
    const outside = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && !(e.target as Element).closest?.('.picus') && onOutside();
    window.addEventListener('scroll', on, true);
    window.addEventListener('resize', on);
    window.addEventListener('mousedown', outside);
    return () => {
      window.removeEventListener('scroll', on, true);
      window.removeEventListener('resize', on);
      window.removeEventListener('mousedown', outside);
    };
  }, [shown]);
  useLayoutEffect(() => {
    const ed = getEditor();
    if (at === null || !ed || !ref.current) return;
    let a: { left: number; bottom: number; top: number };
    try {
      a = ed.view.coordsAtPos(at);
    } catch {
      return;
    }
    const r = ref.current.getBoundingClientRect();
    const x = Math.max(8, Math.min(a.left, window.innerWidth - r.width - 8));
    const y = a.bottom + r.height + 12 > window.innerHeight ? Math.max(8, a.top - r.height - 8) : a.bottom + 6;
    setPos({ x, y });
  }, [at, tick]);
  return pos;
}

/** Nome di un gruppo di alternative: categoria del thesaurus, contrari, senso del dizionario. */
const senseLabel = (sense: string, thes: boolean, many: boolean): ReactNode => (sense === ANTONYMS ? t('picus.antonyms') : thes ? sense : many ? t('picus.sense', { sense }) : null);

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

/** Pannello del rilievo corrente (o della parola chiesta), vicino al testo. */
export function PicusPanel() {
  useLang();
  const items = usePicus((s) => s.items);
  const current = usePicus((s) => s.current);
  const open = usePicus((s) => s.open);
  const focus = usePicus((s) => s.focus);
  const ref = useRef<HTMLDivElement>(null);
  const l = open ? items[current] : undefined;
  const pos = usePlacement(ref, l ? l.from : null, () => close(false));

  useEffect(() => {
    if (open) ref.current?.focus({ preventScroll: true });
  }, [focus, open]);

  if (!l) return null;
  const f = l.f;
  const numbered: Suggestion[] = f.senses.flatMap((s) => s.sections.flatMap((sec) => sec.items));

  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'Tab') step(e.shiftKey ? -1 : 1);
    else if (/^[1-9]$/.test(e.key) && numbered[Number(e.key) - 1]) apply(l, numbered[Number(e.key) - 1], e.altKey);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const why =
    f.kind === 'style'
      ? tOr(`picus.reason.${f.reason}`, f.reason ?? '')
      : f.kind === 'repetition'
        ? t(f.base ? 'picus.repeatedGroup' : 'picus.repeatedWord')
        : f.kind === 'synonym'
          ? t('picus.synonymsOf', { text: f.base })
          : t('picus.variations');
  const thes = f.source === 'thesaurus';
  let n = 0;

  return createPortal(
    <div className="picus-panel" ref={ref} style={{ left: pos.x, top: pos.y }} role="dialog" tabIndex={-1} aria-label={t('picus.panel', { text: f.original })} onKeyDown={key}>
      <header className="picus-panel__head">
        <Bird size={14} />
        <span className="picus-panel__orig">
          «{f.original}»{f.register !== null && <span className="picus-panel__tone"> · {t(`picus.tone.${toneOf(f.register)}`).toLowerCase()}</span>}
        </span>
        {items.length > 1 && (
          <>
            <span className="picus-panel__count">
              {current + 1}/{items.length}
            </span>
            <button className="icon-btn tiny" onClick={() => step(-1)} title={`${t('picus.prev')} (Shift+Tab)`}>
              <ChevronLeft size={13} />
            </button>
            <button className="icon-btn tiny" onClick={() => step(1)} title={`${t('picus.next')} (Tab)`}>
              <ChevronRight size={13} />
            </button>
          </>
        )}
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
          <section key={si} className={`picus-panel__sense ${s.sense === ANTONYMS ? 'is-antonyms' : ''}`}>
            <div className="picus-panel__sensename">{senseLabel(s.sense, thes, f.senses.length > 1)}</div>
            {s.sections.map((sec) => (
              <div key={sec.tone} className="picus-panel__section">
                <div className="picus-panel__sectionhead">
                  {t(`picus.tone.${sec.tone as Tone}`)} <span className="hint">{sec.items.length}</span>
                </div>
                <div className="picus-panel__items">
                  {sec.items.map((it, j) => {
                    n++;
                    return <SuggestionButton key={j} l={l} s={it} n={n <= 9 ? n : null} />;
                  })}
                </div>
              </div>
            ))}
          </section>
        ))}
        {thes && <p className="picus-panel__source hint">{t('thes.source')}</p>}
      </div>
    </div>,
    document.body,
  );
}

/** Testo di una versione con i tratti cambiati evidenziati. */
function Highlighted({ text, changes }: { text: string; changes: { start: number; end: number }[] }) {
  const parts: ReactNode[] = [];
  let at = 0;
  changes.forEach((c, i) => {
    if (c.start > at) parts.push(text.slice(at, c.start));
    parts.push(<mark key={i}>{text.slice(c.start, c.end)}</mark>);
    at = c.end;
  });
  parts.push(text.slice(at));
  return <>{parts}</>;
}

/** Pannello delle riscritture: tre versioni del tratto (1/2/3) e, sotto, i pezzi uno per uno. */
export function RewritePanel() {
  useLang();
  const view = usePicus((s) => s.rewrite);
  const focus = usePicus((s) => s.focus);
  const ref = useRef<HTMLDivElement>(null);
  const [showPieces, setShowPieces] = useState(false);
  const pos = usePlacement(ref, view ? view.from : null, () => closeRewrite(false));

  useEffect(() => {
    if (view) ref.current?.focus({ preventScroll: true });
  }, [focus, !!view]);

  if (!view) return null;
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') closeRewrite();
    else if (/^[1-3]$/.test(e.key) && view.versions[Number(e.key) - 1]?.edits.length) applyVersion(Number(e.key) - 1);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return createPortal(
    <div className="picus-panel picus-rewrite" ref={ref} style={{ left: pos.x, top: pos.y }} role="dialog" tabIndex={-1} aria-label={t('picus.rewrites')} onKeyDown={key}>
      <header className="picus-panel__head">
        <Bird size={14} />
        <span className="picus-panel__orig">{t('picus.rewrites')}</span>
        <button className="icon-btn tiny" onClick={() => closeRewrite()} title={`${t('common.close')} (Esc)`}>
          <X size={13} />
        </button>
      </header>
      <div className="picus-panel__body">
        {view.versions.map((v, i) => (
          <section key={v.tone} className={`picus-rewrite__version is-${v.tone}`}>
            <div className="picus-panel__sectionhead">
              <kbd>{i + 1}</kbd> {t(`picus.tone.${v.tone}`)}
            </div>
            {v.edits.length ? (
              <button className="picus-rewrite__text" onClick={() => applyVersion(i)} title={t('picus.useVersion')}>
                <Highlighted text={v.text} changes={v.changes} />
              </button>
            ) : (
              <p className="picus-rewrite__same hint">{t('picus.alreadyTone', { tone: t(`picus.tone.${v.tone}`).toLowerCase() })}</p>
            )}
          </section>
        ))}
        <button className="picus-panel__sectionhead picus-rewrite__toggle" aria-expanded={showPieces} onClick={() => setShowPieces(!showPieces)}>
          {t('picus.pieces')} <span className="hint">{view.pieces.length}</span>
        </button>
        {showPieces &&
          view.pieces.map((p, pi) => (
            <section key={pi} className="picus-panel__sense">
              <div className="picus-panel__sensename">«{p.original}»</div>
              {p.sections.map((sec) => (
                <div key={sec.tone} className="picus-panel__items">
                  <span className="picus-rewrite__tone hint">{t(`picus.tone.${sec.tone}`)}</span>
                  {sec.items.map((o: PieceOption, j) => (
                    <button key={j} className="picus-panel__item" onClick={() => void applyPiece(o)} title={o.note ?? t('picus.replace', { text: o.text || t('picus.dropWord') })}>
                      {o.text || <em>{t('picus.dropWord')}</em>}
                    </button>
                  ))}
                </div>
              ))}
            </section>
          ))}
      </div>
    </div>,
    document.body,
  );
}
