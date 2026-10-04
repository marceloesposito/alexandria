// Immagini (pin a ritaglio), video e audio locali e YouTube (pin al minuto).
import { useEffect, useRef, useState } from 'react';
import { Pin as PinIcon, Play } from 'lucide-react';
import type { Resource, Pin, PinRect } from '../model';
import { timeLocator } from '../model';
import { t } from '../../i18n';

export function ImageViewer({ r, url, focusPin, cropMode, onPin }: { r: Resource; url: string; focusPin?: Pin; cropMode: boolean; onPin: (p: Omit<Pin, 'id' | 'created'>) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x: number; y: number } | null>(null);
  const rel = (e: React.PointerEvent) => {
    const b = wrap.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) };
  };
  const box = (d: NonNullable<typeof drag>): PinRect => ({ x: Math.min(d.x0, d.x), y: Math.min(d.y0, d.y), w: Math.abs(d.x - d.x0), h: Math.abs(d.y - d.y0) });
  return (
    <div className="image-viewer">
      <div
        ref={wrap}
        className={`image-viewer__frame ${cropMode ? 'is-crop' : ''}`}
        onPointerDown={(e) => {
          if (!cropMode) return;
          e.preventDefault();
          const p = rel(e);
          setDrag({ x0: p.x, y0: p.y, ...p });
        }}
        onPointerMove={(e) => drag && setDrag({ ...drag, ...rel(e) })}
        onPointerUp={() => {
          if (!drag) return;
          const b = box(drag);
          setDrag(null);
          if (b.w > 0.02 && b.h > 0.02) onPin({ kind: 'rect', rect: b, label: t('viewer.cropImage', { n: r.pins.length + 1 }) });
        }}
      >
        <img src={url} alt={r.title} draggable={false} />
        {r.pins
          .filter((p) => p.rect)
          .map((p) => (
            <div
              key={p.id}
              className={`pin-rect ${focusPin?.id === p.id ? 'is-focus' : ''}`}
              style={{ left: `${p.rect!.x * 100}%`, top: `${p.rect!.y * 100}%`, width: `${p.rect!.w * 100}%`, height: `${p.rect!.h * 100}%` }}
              title={p.label}
            />
          ))}
        {drag && (
          <div
            className="pin-rect is-drawing"
            style={{ left: `${box(drag).x * 100}%`, top: `${box(drag).y * 100}%`, width: `${box(drag).w * 100}%`, height: `${box(drag).h * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

function TimePin({ getTime, onPin }: { getTime: () => number; onPin: (p: Omit<Pin, 'id' | 'created'>) => void }) {
  const [note, setNote] = useState('');
  return (
    <div className="time-pin">
      <input className="input" placeholder={t('viewer.timeNote')} value={note} onChange={(e) => setNote(e.target.value)} />
      <button
        className="btn btn--primary"
        onClick={() => {
          const sec = getTime();
          const loc = timeLocator(sec);
          onPin({ kind: 'time', time: sec, locator: loc, label: note.trim() || t('viewer.atTime', { time: loc }) });
          setNote('');
        }}
      >
        <PinIcon size={14} /> {t('viewer.pinHere')}
      </button>
    </div>
  );
}

export function MediaViewer({ r, url, focusPin, onPin }: { r: Resource; url: string; focusPin?: Pin; onPin: (p: Omit<Pin, 'id' | 'created'>) => void }) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  useEffect(() => {
    if (focusPin?.time !== undefined && ref.current) ref.current.currentTime = focusPin.time;
  }, [focusPin]);
  return (
    <div className="media-viewer">
      {r.kind === 'audio' ? <audio ref={ref} src={url} controls /> : <video ref={ref} src={url} controls />}
      <TimePin getTime={() => ref.current?.currentTime ?? 0} onPin={onPin} />
    </div>
  );
}

/** YouTube: il lettore si carica solo su richiesta (rete); il tempo corrente arriva via postMessage. */
export function YoutubeViewer({ r, thumb, focusPin, onPin }: { r: Resource; thumb: string | null; focusPin?: Pin; onPin: (p: Omit<Pin, 'id' | 'created'>) => void }) {
  const [load, setLoad] = useState(false);
  const [manual, setManual] = useState('');
  const frame = useRef<HTMLIFrameElement>(null);
  const time = useRef(0);
  const start = Math.floor(focusPin?.time ?? 0);

  useEffect(() => {
    if (!load) return;
    const onMsg = (e: MessageEvent) => {
      if (!/youtube-nocookie\.com$/.test(new URL(e.origin).hostname)) return;
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (d?.info && typeof d.info.currentTime === 'number') time.current = d.info.currentTime;
      } catch {
        /* messaggi estranei */
      }
    };
    window.addEventListener('message', onMsg);
    const ping = setInterval(() => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*'), 1000);
    return () => {
      window.removeEventListener('message', onMsg);
      clearInterval(ping);
    };
  }, [load]);

  const parse = (s: string): number | null => {
    const parts = s.split(':').map((x) => parseInt(x, 10));
    if (parts.some((x) => Number.isNaN(x))) return null;
    return parts.reduce((a, b) => a * 60 + b, 0);
  };

  return (
    <div className="media-viewer">
      {load ? (
        <iframe
          ref={frame}
          className="yt-frame"
          src={`https://www.youtube-nocookie.com/embed/${r.meta.videoId}?enablejsapi=1&start=${start}&rel=0`}
          title={r.title}
          allow="encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-presentation"
        />
      ) : (
        <button className="yt-poster" onClick={() => setLoad(true)} style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}>
          <Play size={40} />
          <span>{t('viewer.ytLoad')}</span>
        </button>
      )}
      <div className="time-pin">
        <input className="input mono" style={{ width: 90 }} placeholder="mm:ss" value={manual} onChange={(e) => setManual(e.target.value)} />
        <TimePin
          getTime={() => {
            const m = manual.trim() ? parse(manual.trim()) : null;
            return m ?? time.current;
          }}
          onPin={(p) => {
            onPin(p);
            setManual('');
          }}
        />
      </div>
      <p className="hint">{t('viewer.ytHint')}</p>
    </div>
  );
}
