// Contenuto di una risorsa (PDF, immagine, video, pagina archiviata, snippet...), con evidenziazione e
// Bookmark. Lo usano il visualizzatore a tutto schermo e i riquadri accanto all'editor.
import { useEffect, useState } from 'react';
import { useResources, fileOf } from '../store';
import { readArchive, readText } from '../storage';
import { PdfViewer } from './PdfViewer';
import { TextViewer, textToBlocks } from './TextViewer';
import { ImageViewer, MediaViewer, YoutubeViewer } from './MediaViewers';
import { SnippetViewer } from './SnippetViewer';
import { thumbUrl, subtitle } from '../ui/common';
import { platform } from '../../platform';
import type { Block } from '../html';
import type { Pin, Resource } from '../model';
import { t } from '../../i18n';
import { useWorkspace } from '../../state/workspace';

export function ResourceBody({ r, focus, onFocus, crop = false }: { r: Resource; focus?: string; onFocus?: (pinId: string) => void; crop?: boolean }) {
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const st = useResources.getState();

  useEffect(() => {
    setBlocks(null);
    if (['pdf', 'image', 'video', 'audio', 'youtube', 'reference', 'snippet'].includes(r.kind)) return;
    let alive = true;
    void (async () => {
      const s = r.library ? st.library : st.resources.some((x) => x.id === r.id) ? st.vault : st.library;
      const archived = s ? await readArchive(s, r.library ?? r.id) : null;
      const out = archived?.length ? archived : textToBlocks((s ? await readText(s, r.library ?? r.id) : null) ?? (await st.textOf(r.id)));
      if (alive) setBlocks(out);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.id]);

  const path = fileOf(r);
  const url = path ? platform.fileUrl(path) : null;
  const focusPin = r.pins.find((p) => p.id === focus);
  const pin = async (p: Omit<Pin, 'id' | 'created'>) => {
    const made = await st.addPin(r.id, p);
    if (made) {
      onFocus?.(made.id);
      useWorkspace.getState().toast(t('viewer.pinned'), 'ok');
    }
  };

  if (r.kind === 'pdf' && path) return <PdfViewer r={r} path={path} focusPin={focusPin} cropMode={crop} onPin={pin} />;
  if (r.kind === 'image' && url) return <ImageViewer r={r} url={url} focusPin={focusPin} cropMode={crop} onPin={pin} />;
  if ((r.kind === 'video' || r.kind === 'audio') && url) return <MediaViewer r={r} url={url} focusPin={focusPin} onPin={pin} />;
  if (r.kind === 'snippet') return <SnippetViewer r={r} />;
  if (r.kind === 'youtube') return <YoutubeViewer r={r} thumb={thumbUrl(r)} focusPin={focusPin} onPin={pin} />;
  if (r.kind === 'reference')
    return (
      <div className="text-viewer">
        <h3>{r.title}</h3>
        <p className="hint">{subtitle(r)}</p>
        {r.csl?.abstract && <p>{r.csl.abstract}</p>}
        <p className="hint">{t('viewer.referenceHint')}</p>
      </div>
    );
  return blocks ? <TextViewer r={r} blocks={blocks} focusPin={focusPin} onPin={pin} /> : <div className="viewer__loading">{t('viewer.loading')}</div>;
}
