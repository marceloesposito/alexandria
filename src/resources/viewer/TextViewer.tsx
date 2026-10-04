// Testi, documenti e pagine web archiviate: paragrafi selezionabili, pin con "par. N".
import { useEffect, useRef, useState } from 'react';
import type { Resource, Pin } from '../model';
import type { Block } from '../html';
import { useSelectionIn, PinButton, shortLabel } from './PinBar';
import { t } from '../../i18n';

interface Props {
  r: Resource;
  blocks: Block[];
  focusPin?: Pin;
  onPin: (p: Omit<Pin, 'id' | 'created'>) => void;
}

/** Segmenta un paragrafo evidenziando le citazioni dei pin. */
function highlighted(text: string, quotes: { id: string; q: string }[], focus?: string) {
  const marks: { s: number; e: number; id: string }[] = [];
  for (const { id, q } of quotes) {
    const i = text.indexOf(q);
    if (i >= 0) marks.push({ s: i, e: i + q.length, id });
  }
  if (!marks.length) return text;
  marks.sort((a, b) => a.s - b.s);
  const out: React.ReactNode[] = [];
  let pos = 0;
  for (const m of marks) {
    if (m.s < pos) continue;
    if (m.s > pos) out.push(text.slice(pos, m.s));
    out.push(
      <mark key={m.id} className={`pin-mark ${m.id === focus ? 'is-focus' : ''}`} data-pin={m.id}>
        {text.slice(m.s, m.e)}
      </mark>,
    );
    pos = m.e;
  }
  out.push(text.slice(pos));
  return out;
}

export function TextViewer({ r, blocks, focusPin, onPin }: Props) {
  const root = useRef<HTMLDivElement | null>(null);
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const sel = useSelectionIn(rootEl);

  useEffect(() => {
    if (!focusPin) return;
    const el = root.current?.querySelector(`[data-pin="${focusPin.id}"]`) ?? root.current?.querySelector(`[data-par="${focusPin.locator?.replace(/\D/g, '')}"]`);
    el?.scrollIntoView({ block: 'center' });
  }, [focusPin, blocks]);

  const quotes = r.pins.filter((p) => p.kind === 'text' && p.quote).map((p) => ({ id: p.id, q: p.quote! }));
  let par = 0;

  return (
    <div
      className="text-viewer"
      ref={(el) => {
        root.current = el;
        setRootEl(el);
      }}
    >
      {blocks.length === 0 && <p className="hint">{t('viewer.noText')}</p>}
      {blocks.map((b, i) => {
        const isPar = b.t === 'p' || b.t === 'li' || b.t === 'q';
        if (isPar) par++;
        const n = par;
        const content = highlighted(b.text, quotes, focusPin?.id);
        if (b.t === 'h') return <h3 key={i}>{content}</h3>;
        if (b.t === 'pre') return <pre key={i}>{b.text}</pre>;
        if (b.t === 'q')
          return (
            <blockquote key={i} data-par={n}>
              {content}
            </blockquote>
          );
        return (
          <p key={i} data-par={n} className={b.t === 'li' ? 'is-li' : ''}>
            <span className="text-viewer__n">{n}</span>
            {content}
          </p>
        );
      })}
      <PinButton
        sel={sel}
        onPin={(s) => {
          const el = s.anchor instanceof Element ? s.anchor : s.anchor?.parentElement;
          const p = el?.closest('[data-par]') as HTMLElement | null;
          onPin({ kind: 'text', quote: s.text, locator: p ? `par. ${p.dataset.par}` : undefined, label: shortLabel(s.text) });
          window.getSelection()?.removeAllRanges();
        }}
      />
    </div>
  );
}

/** Testo semplice -> blocchi (paragrafi separati da righe vuote; titoli Markdown riconosciuti). */
export function textToBlocks(text: string): Block[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n|\f/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (/^#{1,6}\s/.test(p) ? { t: 'h' as const, text: p.replace(/^#+\s*/, '') } : { t: 'p' as const, text: p.replace(/\s*\n\s*/g, ' ') }));
}
