// Schermata Gestore risorse: layer a sinistra, vista (whiteboard, grafo, layer) al centro,
// ispettore a destra. Vuota, mostra solo il grande "+".
import { useEffect, useState } from 'react';
import { Plus, Search, LayoutDashboard, Network, Layers, FolderOpen, X } from 'lucide-react';
import { useResources, type ResView } from '../store';
import { useWorkspace } from '../../state/workspace';
import { LayersPanel } from './LayersPanel';
import { Whiteboard } from './Whiteboard';
import { GraphView } from './GraphView';
import { LayerTable } from './LayerTable';
import { Inspector } from './Inspector';
import { platform } from '../../platform';
import { indexDbPath } from '../storage';
import { importFiles, importUrls } from '../importer';
import { splitLinks } from '../detect';
import { t, useLang } from '../../i18n';

function useSearch(query: string): Set<string> | null {
  const scope = useResources((s) => (s.scope === 'vault' ? s.vault : s.library));
  const resources = useResources((s) => (s.scope === 'vault' ? s.resources : s.libraryItems));
  const [hits, setHits] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!query.trim() || !scope) {
      setHits(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const q = query.toLowerCase();
      // titoli, autori e tag subito; il testo completo dall'indice
      const local = resources.filter((r) => `${r.title} ${r.tags.join(' ')} ${JSON.stringify(r.csl?.author ?? '')}`.toLowerCase().includes(q)).map((r) => r.id);
      let full: string[] = [];
      try {
        full = (await platform.indexSearch(indexDbPath(scope), query, 200)).map((h) => h.id);
      } catch {
        full = [];
      }
      if (!cancelled) setHits(new Set([...local, ...full]));
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, scope, resources]);
  return hits;
}

export function ResourcesView() {
  useLang();
  const view = useResources((s) => s.view);
  const boardUsed = useResources((s) => !!(s.whiteboard.docs?.length || s.whiteboard.notes.length || s.whiteboard.frames.length));
  const scope = useResources((s) => s.scope);
  const resources = useResources((s) => (s.scope === 'vault' ? s.resources : s.libraryItems));
  const inspector = useResources((s) => s.inspector);
  const busy = useResources((s) => s.busy);
  const library = useResources((s) => s.library);
  const [query, setQuery] = useState('');
  const [over, setOver] = useState(false);
  const hits = useSearch(query);
  const st = useResources.getState();

  // la ricerca si applica come selezione temporanea
  useEffect(() => {
    if (hits) st.select([...hits]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hits]);

  const add = () => useWorkspace.getState().openDialog('addResource');

  const views: { id: ResView; icon: typeof Network; label: string }[] = [
    { id: 'whiteboard', icon: LayoutDashboard, label: t('res.view.whiteboard') },
    { id: 'graph', icon: Network, label: t('res.view.graph') },
    { id: 'layers', icon: Layers, label: t('res.view.layers') },
  ];

  const empty = (
    <div className="resources__empty">
      <button className="big-plus" onClick={add} aria-label={t('res.add')}>
        <Plus size={56} strokeWidth={1.2} />
      </button>
      <p>{scope === 'library' ? t('res.emptyLibrary') : t('res.empty')}</p>
      <p className="hint">{t('res.emptyHint')}</p>
    </div>
  );

  return (
    <div
      className={`resources ${over ? 'is-drop' : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('text/uri-list')) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setOver(false);
      }}
      onDrop={async (e) => {
        setOver(false);
        if (!e.dataTransfer.files.length && !e.dataTransfer.getData('text/uri-list')) return;
        e.preventDefault();
        if (e.dataTransfer.files.length) {
          const files = await Promise.all(
            Array.from(e.dataTransfer.files).map(async (f) => ({ name: f.name, mime: f.type, data: new Uint8Array(await f.arrayBuffer()) })),
          );
          await importFiles(files, scope);
        } else await importUrls(splitLinks(e.dataTransfer.getData('text/uri-list')), scope);
      }}
    >
      <aside className="resources__side">
        {scope === 'library' && (
          <div className="resources__libpath hint" title={library?.root}>
            <FolderOpen size={12} /> {library?.root}
          </div>
        )}
        <LayersPanel />
      </aside>
      <main className="resources__main">
        <div className="resources__bar">
          <div className="seg-group" role="tablist">
            {views.map((v) => (
              <button key={v.id} role="tab" aria-selected={view === v.id} className={`seg ${view === v.id ? 'is-active' : ''}`} onClick={() => st.setView(v.id)}>
                <v.icon size={14} /> {v.label}
              </button>
            ))}
          </div>
          <div className="resources__search">
            <Search size={14} />
            <input className="input" placeholder={t('res.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
            {query && (
              <>
                <span className="hint">{t('res.found', { n: hits?.size ?? 0 })}</span>
                <button className="icon-btn tiny" onClick={() => setQuery('')}>
                  <X size={12} />
                </button>
              </>
            )}
          </div>
          <span className="grow" />
          {busy && (
            <span className="resources__busy">
              <span className="spinner" /> {busy.label} {busy.total > 1 ? `(${busy.done + 1}/${busy.total})` : ''}
            </span>
          )}
          <button className="btn btn--primary" onClick={add}>
            <Plus size={15} /> {t('res.add')}
          </button>
        </div>
        <div className="resources__canvas">
          {resources.length === 0 && !(scope === 'vault' && view === 'whiteboard') ? (
            empty
          ) : view === 'whiteboard' ? (
            <>
              {/* nel Compendium la Tabula c'e' sempre: puo' contenere pergamene e note anche senza risorse */}
              <Whiteboard />
              {resources.length === 0 && !boardUsed && <div className="resources__empty is-overlay">{empty}</div>}
            </>
          ) : view === 'graph' ? (
            <GraphView />
          ) : (
            <LayerTable results={hits} />
          )}
        </div>
      </main>
      {inspector && <Inspector id={inspector} />}
    </div>
  );
}
