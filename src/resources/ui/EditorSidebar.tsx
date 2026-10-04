// Colonna sinistra dell'editor: albero sintetico delle risorse (per layer) e sezione Pinned.
// Trascinando nel testo: fonti e pin diventano citazioni, immagini diventano figure, pagine web link.
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, Pin as PinIcon, Quote, Search } from 'lucide-react';
import { useResources } from '../store';
import { useWorkspace } from '../../state/workspace';
import { KindIcon } from './common';
import { CITE_MIME } from '../../editor/extensions/drop';
import { FIGURE_MIME, LINK_MIME } from '../../editor/extensions/drop';
import { relativeFromDoc } from '../../vault/resolve';
import { displayAuthorYear, type Resource, type Layer } from '../model';
import { t, useLang } from '../../i18n';
import { ensureCiteKey } from '../citeKeys';

function setDragData(e: React.DragEvent, r: Resource, locator?: string, pinId?: string) {
  const docRel = useWorkspace.getState().activeDoc;
  if (r.kind === 'image' && r.file && !locator && !r.library && docRel) {
    e.dataTransfer.setData(FIGURE_MIME, JSON.stringify({ src: relativeFromDoc(docRel, `resources/${r.id}/${r.file}`), caption: r.title }));
  } else if (r.kind === 'web' && !r.isSource && !locator && r.url) {
    e.dataTransfer.setData(LINK_MIME, JSON.stringify({ href: r.url, text: r.title }));
  }
  const key = ensureCiteKey(r);
  e.dataTransfer.setData(CITE_MIME, JSON.stringify({ key, locator, pinId }));
  e.dataTransfer.setData('text/plain', `[@${key}${locator ? ', ' + locator : ''}]`);
  e.dataTransfer.effectAllowed = 'copy';
}

function ResItem({ r }: { r: Resource }) {
  return (
    <li
      className="tree__item"
      draggable
      onDragStart={(e) => setDragData(e, r)}
      onDoubleClick={() => useResources.getState().openViewer(r.id)}
      title={`${r.title}\n${displayAuthorYear(r)}${r.citeKey ? `\n@${r.citeKey}` : ''}`}
    >
      <KindIcon kind={r.kind} size={13} />
      <span className="tree__label">{r.title}</span>
      {r.isSource && <Quote size={11} className="tree__meta" />}
    </li>
  );
}

export function ResourceTreeSection() {
  useLang();
  const resources = useResources((s) => s.resources);
  const layers = useResources((s) => s.layers);
  const [open, setOpen] = useState<Set<string>>(new Set(['__root']));
  const [q, setQ] = useState('');
  const filter = (r: Resource) => !q || `${r.title} ${r.citeKey ?? ''} ${displayAuthorYear(r)}`.toLowerCase().includes(q.toLowerCase());

  const groups = layers.filter((l) => l.kind === 'group');
  const toggle = (id: string) => {
    const n = new Set(open);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setOpen(n);
  };

  const groupNode = (l: Layer, depth: number): React.ReactNode => {
    const kids = groups.filter((g) => g.parent === l.id);
    const items = resources.filter((r) => r.layers.includes(l.id) && filter(r));
    if (q && !items.length && !kids.length) return null;
    const isOpen = open.has(l.id) || !!q;
    return (
      <li key={l.id}>
        <div className="tree__item tree__folder" style={{ paddingLeft: 6 + depth * 12 }} onClick={() => toggle(l.id)}>
          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Folder size={13} style={{ color: l.color }} />
          <span className="tree__label">{l.name}</span>
          <span className="tree__meta">{items.length}</span>
        </div>
        {isOpen && (
          <ul className="tree" style={{ paddingLeft: 12 + depth * 12 }}>
            {kids.map((k) => groupNode(k, depth + 1))}
            {items.map((r) => (
              <ResItem key={r.id} r={r} />
            ))}
          </ul>
        )}
      </li>
    );
  };

  const loose = resources.filter((r) => !r.layers.some((id) => groups.some((g) => g.id === id)) && filter(r));

  return (
    <section className="side-section">
      <header className="side-section__head">
        <span>{t('side.resources')}</span>
        <button className="icon-btn" title={t('cmd.view.resources')} onClick={() => useWorkspace.getState().setView('resources')}>
          <Folder size={13} />
        </button>
      </header>
      {resources.length > 6 && (
        <div className="side-search">
          <Search size={12} />
          <input className="input" placeholder={t('side.filter')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}
      {!resources.length && <p className="hint side-empty">{t('side.noResources')}</p>}
      <ul className="tree" role="tree">
        {groups.filter((g) => !g.parent).map((g) => groupNode(g, 0))}
        {loose.map((r) => (
          <ResItem key={r.id} r={r} />
        ))}
      </ul>
    </section>
  );
}

export function PinnedSection() {
  useLang();
  const resources = useResources((s) => s.resources);
  const pinned = useMemo(() => resources.filter((r) => r.pins.length), [resources]);
  return (
    <section className="side-section">
      <header className="side-section__head">
        <PinIcon size={12} />
        <span>{t('side.pinned')}</span>
      </header>
      {!pinned.length && <p className="hint side-empty">{t('side.noPins')}</p>}
      {pinned.map((r) => (
        <div key={r.id} className="pinned-group">
          <div className="pinned-group__title" title={r.title}>
            <KindIcon kind={r.kind} size={12} /> {displayAuthorYear(r) || r.title}
          </div>
          {r.pins.map((p) => (
            <div
              key={p.id}
              className="pinned-item"
              draggable
              onDragStart={(e) => setDragData(e, r, p.locator, p.id)}
              onClick={() => useResources.getState().openViewer(r.id, p.id)}
              title={p.quote ?? p.label}
            >
              <span className="pinned-item__loc">{p.locator ?? '·'}</span>
              <span className="pinned-item__text">{p.quote ? `«${p.quote}»` : p.label}</span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

export function useHasViewer() {
  return useResources((s) => !!s.viewer);
}
