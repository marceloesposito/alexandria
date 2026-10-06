// Sovrapposizioni dei commenti: banda sulla riga sotto il puntatore (nella pagina)
// e connettori fra bolle e testo collegato (sopra tutta la vista Editor).
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCommentUi } from './ui';
import { useComments } from './store';
import { getEditor } from '../state/editorRef';
import type { PageProps } from '../editor/slots';
import { pageZoom } from '../editor/lines';

export function LineHighlight(_props: PageProps) {
  const line = useCommentUi((s) => s.hoverLine);
  const draft = useComments((s) => s.draft);
  const top = draft ? draft.y : line?.top;
  const height = draft ? (line && line.top === draft.y ? line.bottom - line.top : 24) : line ? line.bottom - line.top : 0;
  if (top === undefined) return null;
  // dentro la pagina (con lo zoom) le misure dello schermo si dividono per lo zoom
  const z = pageZoom();
  return <div className={`line-hover ${draft ? 'is-draft' : ''}`} style={{ top: top / z, height: height / z }} />;
}

interface Path {
  id: string;
  d: string;
  active: boolean;
}

/** Curva morbida da (x1,y1) a (x2,y2). */
function curve(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(30, Math.abs(x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 - dx} ${y1}, ${x2 + dx} ${y2}, ${x2} ${y2}`;
}

/** Dalla bolla al margine destro della pagina con una curva, poi in orizzontale fino al testo. */
function marginRoute(bx: number, by: number, mx: number, wx: number, wy: number): string {
  return `${curve(bx, by, mx, wy)} L ${wx} ${wy}`;
}

export function Connectors() {
  const tick = useCommentUi((s) => s.tick);
  const linking = useCommentUi((s) => s.linking);
  const comments = useComments((s) => s.comments);
  const active = useComments((s) => s.active);
  const hovered = useComments((s) => s.hovered);
  const [paths, setPaths] = useState<Path[]>([]);
  const [clip, setClip] = useState<DOMRect | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const e = getEditor();
      const view = document.querySelector('.editor-view');
      const viewport = document.querySelector('.comments__viewport');
      if (!e || !view || !viewport) {
        setPaths([]);
        return;
      }
      setClip(viewport.getBoundingClientRect().height ? view.getBoundingClientRect() : null);
      const out: Path[] = [];
      for (const c of comments) {
        if (!c.anchor || c.anchor.kind !== 'text') continue;
        const el = document.querySelector(`[data-bubble="${c.id}"]`) as HTMLElement | null;
        if (!el) continue;
        let end;
        try {
          end = e.view.coordsAtPos(Math.min(c.anchor.to, e.state.doc.content.size));
        } catch {
          continue;
        }
        const b = el.getBoundingClientRect();
        const page = document.querySelector('.editor-center .page')?.getBoundingClientRect();
        // il tratto orizzontale corre nell'interlinea, sotto la riga, per non barrare il testo
        const wy = end.bottom + 2;
        const margin = page ? page.right - 8 : end.right + 20;
        out.push({
          id: c.id,
          d: marginRoute(b.left, b.top + 16, Math.max(margin, end.right + 4), end.right + 2, wy),
          active: c.id === active || c.id === hovered,
        });
      }
      setPaths(out);
    });
    return () => cancelAnimationFrame(raf);
  }, [tick, comments, active, hovered]);

  const vr = clip;
  return createPortal(
    <svg className="connectors" aria-hidden>
      {vr && (
        <defs>
          <clipPath id="connectors-clip">
            <rect x={vr.left} y={vr.top} width={vr.width} height={vr.height} />
          </clipPath>
        </defs>
      )}
      <g clipPath={vr ? 'url(#connectors-clip)' : undefined}>
        {paths.map((p) => (
          <path key={p.id} d={p.d} className={`connector ${p.active ? 'is-active' : ''}`} />
        ))}
        {linking && <path d={curve(linking.x0, linking.y0, linking.x, linking.y)} className="connector is-linking" />}
        {linking && <circle cx={linking.x} cy={linking.y} r={4} className="connector-end" />}
      </g>
    </svg>,
    document.body,
  );
}
