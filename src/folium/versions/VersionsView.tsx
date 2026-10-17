// Palimpsestus di Folium: solo l'albero delle versioni. La piu' recente in alto, un colore per ramo.
// Al passaggio del mouse, dopo un attimo, un'anteprima semitrasparente: il confronto fra le punte dei
// rami su una biforcazione, il testo della versione su ogni altro nodo. Un clic seleziona; i comandi
// stanno solo nella barretta (Salva versione, Riprendi da qui).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Save, Undo2 } from 'lucide-react';
import { docDiff, type DiffRow } from 'logos/versions/docDiff';
import { useFolium } from '../store';
import { useUi } from '../ui';
import { forkDiffTarget, nodeOf, treeLayout, type VNode } from './tree';
import { schemaExtensions } from '../editor/extensions';
import { markdownToDoc } from '../doc';
import { FloatingBar, CmdButton } from '../FloatingBar';
import { t, useLang } from '../../i18n';

const ROW = 46;
const LANE = 34;
const PAD = 28;

function when(at: number): string {
  return new Date(at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function ReadOnly({ md }: { md: string }) {
  const editor = useEditor({ editable: false, extensions: schemaExtensions(), content: markdownToDoc(md) }, [md]);
  return <EditorContent editor={editor} className="fx-prose fx-prose--preview" />;
}

function Diff({ rows }: { rows: DiffRow[] }) {
  const changed = rows.filter((r) => r.kind !== 'same');
  if (!changed.length) return <p className="fx-muted">{t('versions.same')}</p>;
  return (
    <div className="fx-diff">
      {changed.slice(0, 30).map((r, i) => (
        <div key={i} className={`fx-diff__row fx-diff__row--${r.kind}`}>
          {r.before && r.kind !== 'add' && <del>{r.before.text}</del>}
          {r.after && r.kind !== 'del' && <ins>{r.after.text}</ins>}
        </div>
      ))}
    </div>
  );
}

function Preview({ id, at }: { id: string; at: { x: number; y: number } }) {
  const s = useFolium((x) => x.sheet)!;
  const target = forkDiffTarget(s.tree, id);
  const node = nodeOf(s.tree, id)!;
  const body = useMemo(() => {
    if (target.kind === 'fork') {
      const [a, b] = target.tips;
      return { kind: 'fork' as const, rows: docDiff(s.versions[a] ?? '', s.versions[b] ?? '') };
    }
    return { kind: 'preview' as const, md: s.versions[id] ?? '' };
  }, [s, id, target.kind, target.kind === 'fork' ? target.tips.join() : '']);
  return (
    <div className="fx-vpreview" style={{ left: at.x, top: at.y }} role="tooltip">
      <div className="fx-vpreview__head">
        <strong>{node.label || (body.kind === 'fork' ? t('versions.fork') : t('versions.auto'))}</strong>
        <span className="fx-muted">{when(node.at)}</span>
      </div>
      <div className="fx-vpreview__body">{body.kind === 'fork' ? <Diff rows={body.rows} /> : <ReadOnly md={body.md} />}</div>
    </div>
  );
}

export function VersionsView() {
  useLang();
  const s = useFolium((x) => x.sheet);
  const selected = useUi((x) => x.selectedVersion);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  if (!s) return null;
  const { slots, lanes } = treeLayout(s.tree);
  const byId = new Map(slots.map((sl) => [sl.id, sl]));
  const width = PAD * 2 + Math.max(1, lanes) * LANE + 280;
  const height = PAD * 2 + slots.length * ROW;
  const xy = (id: string) => {
    const sl = byId.get(id)!;
    return { x: PAD + sl.lane * LANE, y: PAD + sl.row * ROW };
  };
  const color = (n: VNode) => `var(--series-${(n.branch % 8) + 1})`;

  const enter = (id: string, e: React.MouseEvent) => {
    if (timer.current) clearTimeout(timer.current);
    const r = box.current?.getBoundingClientRect();
    const x = e.clientX - (r?.left ?? 0) + 24;
    const y = e.clientY - (r?.top ?? 0) - 20 + (box.current?.scrollTop ?? 0);
    timer.current = setTimeout(() => setHover({ id, x, y }), 150);
  };
  const leave = () => {
    if (timer.current) clearTimeout(timer.current);
    setHover(null);
  };

  return (
    <div className="fx-versions" ref={box}>
      {!slots.length ? (
        <div className="fx-tabula__empty">{t('versions.empty')}</div>
      ) : (
        <svg className="fx-tree" width={width} height={height} role="tree" aria-label={t('cmd.view.versions')}>
          {s.tree.nodes.map((n) =>
            n.parent && byId.has(n.parent) ? (
              (() => {
                const a = xy(n.parent);
                const b = xy(n.id);
                const d = a.x === b.x ? `M${a.x},${a.y} L${b.x},${b.y}` : `M${a.x},${a.y} C${a.x},${a.y - ROW / 2} ${b.x},${a.y - ROW / 2} ${b.x},${Math.min(b.y + ROW / 2, a.y - ROW / 2)} L${b.x},${b.y}`;
                return <path key={`e${n.id}`} d={d} className="fx-tree__edge" style={{ stroke: color(n) }} />;
              })()
            ) : null,
          )}
          {s.tree.nodes.map((n) => {
            const p = xy(n.id);
            const isHead = s.tree.head === n.id;
            return (
              <g
                key={n.id}
                className={`fx-tree__node ${selected === n.id ? 'is-selected' : ''} ${isHead ? 'is-head' : ''} ${n.label ? 'is-named' : ''}`}
                transform={`translate(${p.x},${p.y})`}
                role="treeitem"
                aria-selected={selected === n.id}
                aria-label={n.label || when(n.at)}
                data-version={n.id}
                onMouseEnter={(e) => enter(n.id, e)}
                onMouseLeave={leave}
                onClick={() => useUi.setState({ selectedVersion: n.id })}
              >
                <circle r={n.label ? 7 : 5} style={{ stroke: color(n), fill: n.label || isHead ? color(n) : 'var(--paper)' }} />
                <circle r={16} className="fx-tree__hit" />
                <text x={(lanes - byId.get(n.id)!.lane) * LANE + 4} y={4} className="fx-tree__label">
                  {n.label || when(n.at)}
                  {isHead ? ` · ${t('versions.current')}` : ''}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover && <Preview id={hover.id} at={{ x: hover.x, y: hover.y }} />}
      <FloatingBar label={t('bar.versions')}>
        <CmdButton id="version.save" className="fx-btn--text">
          <Save size={15} />
          <span className="fx-btn__label">{t('cmd.version.save')}</span>
        </CmdButton>
        <CmdButton id="version.resume" className="fx-btn--text" disabled={!selected || selected === s.tree.head}>
          <Undo2 size={15} />
          <span className="fx-btn__label">{t('cmd.version.resume')}</span>
        </CmdButton>
      </FloatingBar>
    </div>
  );
}
