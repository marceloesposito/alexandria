// Scheda embed nel testo, stile Notion: foto della pagina in alto, titolo e dominio sotto.
// Gli snippet mostrano le prime righe del codice. Doppio clic apre la risorsa nell'app.
import { useEffect, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { ExternalLink, RefreshCw, Maximize2 } from 'lucide-react';
import { useResources } from '../store';
import { useWorkspace } from '../../state/workspace';
import { assetUrl } from '../../vault/resolve';
import { refreshScreenshot } from '../importer';
import { embedAttrsFor } from '../insert';
import { KindIcon, thumbUrl, kindLabel } from './common';
import { platform } from '../../platform';
import { t } from '../../i18n';

const PREVIEW_LINES = 12;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function EmbedView(props: NodeViewProps) {
  const a = props.node.attrs as { url: string; title: string; resource: string | null; image: string | null };
  const vaultRoot = useWorkspace((s) => s.vaultRoot);
  const activeDoc = useWorkspace((s) => s.activeDoc);
  const r = useResources((s) => (a.resource ? s.get(a.resource) : undefined));
  const [code, setCode] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const isSnippet = r?.kind === 'snippet';
  useEffect(() => {
    if (!isSnippet || !r) return;
    void useResources
      .getState()
      .textOf(r.id)
      .then((txt) => setCode(txt.split('\n').slice(0, PREVIEW_LINES).join('\n')));
  }, [isSnippet, r, r?.meta.size]);

  const image = a.image ? assetUrl(a.image, vaultRoot, activeDoc) : r ? thumbUrl(r) : null;
  const external = /^https?:\/\//.test(a.url);
  const site = external ? hostOf(a.url) : r ? kindLabel(r.kind) : '';

  const open = () => {
    if (r) useResources.getState().openViewer(r.id);
    else if (external) void platform.openExternal(a.url);
  };

  return (
    <NodeViewWrapper
      className={`nv-embed ${props.selected ? 'is-selected' : ''} ${isSnippet ? 'is-snippet' : ''} ${!r && a.resource ? 'is-missing' : ''}`}
      data-drag-handle
      onDoubleClick={open}
    >
      {isSnippet ? (
        <pre className="nv-embed__code" data-language={r?.meta.language}>
          <code>{code ?? ''}</code>
        </pre>
      ) : (
        image && (
          <div className="nv-embed__shot">
            <img src={image} alt="" draggable={false} loading="lazy" />
          </div>
        )
      )}
      <div className="nv-embed__body">
        {r ? <KindIcon kind={r.kind} size={14} /> : <ExternalLink size={14} />}
        <div className="nv-embed__text">
          <strong className="nv-embed__title">{a.title || a.url}</strong>
          <span className="nv-embed__site">
            {isSnippet ? r?.meta.language : site}
            {!r && a.resource ? ` · ${t('embed.missing')}` : ''}
          </span>
        </div>
        {props.selected && (
          <div className="nv-embed__tools" contentEditable={false}>
            {r && (
              <button className="btn small" onClick={open}>
                <Maximize2 size={12} /> {t('embed.open')}
              </button>
            )}
            {external && (
              <button className="btn small" onClick={() => void platform.openExternal(a.url)}>
                <ExternalLink size={12} /> {t('embed.openLink')}
              </button>
            )}
            {r && r.kind === 'web' && (
              <button
                className="btn small"
                disabled={working}
                onClick={async () => {
                  setWorking(true);
                  const ok = await refreshScreenshot(r.id);
                  setWorking(false);
                  const fresh = useResources.getState().get(r.id);
                  if (ok && fresh && activeDoc) props.updateAttributes({ image: embedAttrsFor(fresh, activeDoc).image });
                  else useWorkspace.getState().toast(t('embed.refreshFailed'), 'error');
                }}
              >
                <RefreshCw size={12} className={working ? 'spin' : ''} /> {t('embed.refresh')}
              </button>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
