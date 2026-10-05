// PDF con pdf.js: pagine disegnate su canvas con il livello di testo selezionabile.
// Pin da selezione (citazione + pagina) o da ritaglio rettangolare.
import { useEffect, useRef, useState } from 'react';
import { TextLayer, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import 'pdfjs-dist/web/pdf_viewer.css';
import { openPdf } from '../extract';
import { platform } from '../../platform';
import type { Resource, Pin, PinRect } from '../model';
import { useSelectionIn, PinButton, shortLabel } from './PinBar';
import { t } from '../../i18n';

interface Props {
  r: Resource;
  path: string;
  focusPin?: Pin;
  cropMode: boolean;
  onPin: (p: Omit<Pin, 'id' | 'created'>) => void;
}

export function PdfViewer({ r, path, focusPin, cropMode, onPin }: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [labels, setLabels] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const sel = useSelectionIn(rootEl);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const bytes = await platform.readBytes(path);
        const d = await openPdf(bytes);
        if (cancelled) return;
        setDoc(d);
        setLabels((await d.getPageLabels().catch(() => null)) ?? null);
      } catch (e) {
        setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  useEffect(() => {
    if (!doc || !focusPin?.page) return;
    const el = root.current?.querySelector(`[data-page="${focusPin.page}"]`);
    el?.scrollIntoView({ block: 'start' });
  }, [doc, focusPin]);

  const label = (n: number) => labels?.[n - 1] || String(n);

  const pageOf = (node: Node | null): number | null => {
    const el = node instanceof Element ? node : node?.parentElement;
    const p = el?.closest('[data-page]') as HTMLElement | null;
    return p ? Number(p.dataset.page) : null;
  };

  if (error) return <div className="viewer__error">{error}</div>;
  if (!doc) return <div className="viewer__loading">{t('viewer.loading')}</div>;

  return (
    <div
      className={`pdf ${cropMode ? 'is-crop' : ''}`}
      ref={(el) => {
        root.current = el;
        setRootEl(el);
      }}
    >
      {Array.from({ length: doc.numPages }, (_, i) => (
        <PdfPage
          key={i}
          doc={doc}
          n={i + 1}
          pins={r.pins.filter((p) => p.page === i + 1)}
          focus={focusPin?.page === i + 1 ? focusPin : undefined}
          cropMode={cropMode}
          onCrop={(rect) => onPin({ kind: 'rect', page: i + 1, rect, locator: `p. ${label(i + 1)}`, label: t('viewer.cropLabel', { page: label(i + 1) }) })}
        />
      ))}
      <PinButton
        sel={cropMode ? null : sel}
        onPin={(s) => {
          const page = pageOf(s.anchor);
          onPin({ kind: 'text', quote: s.text, page: page ?? undefined, locator: page ? `p. ${label(page)}` : undefined, label: shortLabel(s.text) });
          window.getSelection()?.removeAllRanges();
        }}
      />
    </div>
  );
}

function PdfPage({
  doc,
  n,
  pins,
  focus,
  cropMode,
  onCrop,
}: {
  doc: PDFDocumentProxy;
  n: number;
  pins: Pin[];
  focus?: Pin;
  cropMode: boolean;
  onCrop: (r: PinRect) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(n <= 2);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x: number; y: number } | null>(null);

  // le pagine si disegnano quando entrano nella vista
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !wrap.current) return;
    let cancelled = false;
    void (async () => {
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale: 1.4 });
      if (cancelled || !wrap.current) return;
      setSize({ w: vp.width, h: vp.height });
      const canvas = wrap.current.querySelector('canvas')!;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(vp.width * ratio);
      canvas.height = Math.floor(vp.height * ratio);
      canvas.style.width = `${vp.width}px`;
      canvas.style.height = `${vp.height}px`;
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
      const layer = wrap.current.querySelector('.textLayer') as HTMLDivElement;
      layer.replaceChildren();
      layer.style.setProperty('--scale-factor', String(vp.scale));
      await new TextLayer({ textContentSource: page.streamTextContent(), container: layer, viewport: vp }).render();
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, doc, n]);

  const rel = (e: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  return (
    <div
      className={`pdf__page ${focus ? 'is-focus' : ''}`}
      data-page={n}
      ref={wrap}
      style={size ? { width: size.w, height: size.h } : { width: 840, height: 1180 }}
      onPointerDown={(e) => {
        if (!cropMode) return;
        e.preventDefault();
        const p = rel(e);
        setDrag({ x0: p.x, y0: p.y, x: p.x, y: p.y });
        (e.target as Element).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag) return;
        const p = rel(e);
        setDrag({ ...drag, x: p.x, y: p.y });
      }}
      onPointerUp={() => {
        if (!drag) return;
        const rect = { x: Math.min(drag.x0, drag.x), y: Math.min(drag.y0, drag.y), w: Math.abs(drag.x - drag.x0), h: Math.abs(drag.y - drag.y0) };
        setDrag(null);
        if (rect.w > 0.02 && rect.h > 0.01) onCrop(rect);
      }}
    >
      <canvas />
      <div className="textLayer" />
      {pins
        .filter((p) => p.rect)
        .map((p) => (
          <div
            key={p.id}
            className={`pin-rect ${focus?.id === p.id ? 'is-focus' : ''}`}
            style={{ left: `${p.rect!.x * 100}%`, top: `${p.rect!.y * 100}%`, width: `${p.rect!.w * 100}%`, height: `${p.rect!.h * 100}%` }}
            title={p.label}
          />
        ))}
      {drag && (
        <div
          className="pin-rect is-drawing"
          style={{
            left: `${Math.min(drag.x0, drag.x) * 100}%`,
            top: `${Math.min(drag.y0, drag.y) * 100}%`,
            width: `${Math.abs(drag.x - drag.x0) * 100}%`,
            height: `${Math.abs(drag.y - drag.y0) * 100}%`,
          }}
        />
      )}
      <div className="pdf__num">{n}</div>
    </div>
  );
}
