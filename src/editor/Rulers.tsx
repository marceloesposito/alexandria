// Righelli della vista Pagina, in centimetri come in Word: quello orizzontale resta in cima
// mentre si scorre, quello verticale accompagna la pagina e segna dove comincia ogni pagina stimata.
import { useEffect, useState } from 'react';
import { rulerLabels, pageStarts } from './rulerModel';
import { t } from '../i18n';

/** margine superiore della pagina nell'editor (padding di .page in editor.css) */
export const PAGE_TOP_MM = 22;
const PX_PER_MM = 96 / 25.4;
/** spazio occupato a sinistra della pagina dal righello verticale (5 mm + 3 mm di distacco) */
export const RULER_SPACE_PX = Math.ceil(8 * PX_PER_MM);

interface HProps {
  textWidthMm: number;
  padXmm: number;
  style: React.CSSProperties;
}

export function HorizontalRuler({ textWidthMm, padXmm, style }: HProps) {
  const total = textWidthMm + 2 * padXmm;
  return (
    <div className="ruler-h-row" style={style} aria-hidden>
      <div className="ruler ruler--h" style={{ width: `${total}mm` }}>
        <div className="ruler__margin" style={{ left: 0, width: `${padXmm}mm` }} />
        <div className="ruler__margin" style={{ right: 0, width: `${padXmm}mm` }} />
        <div className="ruler__ticks" style={{ backgroundPositionX: `${padXmm}mm` }} />
        {rulerLabels(total, padXmm).map((l) => (
          <span key={l.at} className="ruler__label" style={{ left: `${l.at}mm` }}>
            {l.cm}
          </span>
        ))}
      </div>
    </div>
  );
}

interface VProps {
  pageRef: React.RefObject<HTMLDivElement | null>;
  textHeightMm: number;
}

export function VerticalRuler({ pageRef, textHeightMm }: VProps) {
  const [heightMm, setHeightMm] = useState(297);
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    // offsetHeight non risente dello zoom CSS della pagina: misura gia' in millimetri della pagina
    const measure = () => setHeightMm(Math.max(297, Math.ceil(page.offsetHeight / PX_PER_MM)));
    const ro = new ResizeObserver(measure);
    ro.observe(page);
    measure();
    return () => ro.disconnect();
  }, [pageRef]);

  return (
    <div className="ruler ruler--v" aria-hidden>
      <div className="ruler__margin" style={{ top: 0, height: `${PAGE_TOP_MM}mm` }} />
      <div className="ruler__ticks" style={{ backgroundPositionY: `${PAGE_TOP_MM}mm` }} />
      {rulerLabels(heightMm, PAGE_TOP_MM).map((l) => (
        <span key={l.at} className="ruler__label" style={{ top: `${l.at}mm` }}>
          {l.cm}
        </span>
      ))}
      {pageStarts(heightMm, PAGE_TOP_MM, textHeightMm).map((p) => (
        <span key={p.page} className="ruler__page" style={{ top: `${p.at}mm` }} title={t('ruler.pageStart', { n: p.page })}>
          {p.page}
        </span>
      ))}
    </div>
  );
}
