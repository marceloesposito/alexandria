// La pergamena come documento (non come Markdown) e il confronto affiancato fra due versioni:
// a sinistra quella scelta nella storia, a destra quella attuale, con i paragrafi allineati.
import { diffWordsWithSpace } from 'diff';
import { Image as ImageIcon, Link2 } from 'lucide-react';
import { docBlocks, docDiff, type DocBlock, type DiffRow } from './docDiff';
import { t } from '../i18n';

function Block({ b, other, side }: { b: DocBlock; other?: DocBlock; side?: 'before' | 'after' }) {
  // parole cambiate evidenziate quando il blocco esiste in entrambe le versioni
  const body =
    other && side
      ? diffWordsWithSpace(side === 'before' ? b.text : other.text, side === 'before' ? other.text : b.text).map((p, i) =>
          p.added ? (side === 'after' ? <ins key={i}>{p.value}</ins> : null) : p.removed ? (side === 'before' ? <del key={i}>{p.value}</del> : null) : <span key={i}>{p.value}</span>,
        )
      : b.text;
  switch (b.kind) {
    case 'h1':
      return <h1>{body}</h1>;
    case 'h2':
      return <h2>{body}</h2>;
    case 'h3':
      return <h3>{body}</h3>;
    case 'quote':
      return <blockquote>{body}</blockquote>;
    case 'code':
    case 'math':
      return <pre>{body}</pre>;
    case 'list':
      return <p className="doc-view__list">{body}</p>;
    case 'figure':
      return (
        <p className="doc-view__figure">
          <ImageIcon size={14} /> {body}
        </p>
      );
    case 'embed':
      return (
        <p className="doc-view__figure">
          <Link2 size={14} /> {body}
        </p>
      );
    case 'hr':
      return <hr />;
    default:
      return <p>{body}</p>;
  }
}

/** La pergamena come la si legge, in sola lettura. */
export function DocView({ markdown }: { markdown: string }) {
  const blocks = docBlocks(markdown);
  if (!blocks.length) return <p className="hint doc-view__empty">{t('hist.emptyDoc')}</p>;
  return (
    <article className="doc-view">
      {blocks.map((b, i) => (
        <Block key={i} b={b} />
      ))}
    </article>
  );
}

function Cell({ row, side }: { row: DiffRow; side: 'before' | 'after' }) {
  const b = side === 'before' ? row.before : row.after;
  if (!b) return <div className={`cmp__cell is-gap is-${row.kind}`} />;
  const other = row.kind === 'mod' ? (side === 'before' ? row.after : row.before) : undefined;
  return (
    <div className={`cmp__cell is-${row.kind}`}>
      <Block b={b} other={other} side={other ? side : undefined} />
    </div>
  );
}

/** Due colonne allineate: la versione scelta e quella attuale. */
export function DocCompare({ before, after, beforeMissing }: { before: string; after: string; beforeMissing?: boolean }) {
  const rows = docDiff(before, after);
  return (
    <div className="cmp doc-view">
      {beforeMissing && <div className="cmp__note">{t('hist.notYet')}</div>}
      {rows.map((r, i) => (
        <div key={i} className={`cmp__row is-${r.kind}`}>
          <Cell row={r} side="before" />
          <Cell row={r} side="after" />
        </div>
      ))}
    </div>
  );
}
