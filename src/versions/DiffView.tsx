// Confronto fra due versioni di un documento: paragrafi aggiunti, rimossi e modificati,
// con le parole cambiate evidenziate.
import { diffLines, diffWordsWithSpace } from 'diff';
import { t, tn } from '../i18n';

interface Row {
  kind: 'same' | 'add' | 'del' | 'mod';
  before?: string;
  after?: string;
}

export function diffRows(before: string, after: string): Row[] {
  const parts = diffLines(before, after);
  const rows: Row[] = [];
  // le righe vuote separano i paragrafi: non sono contenuto
  const lines = (v: string) => v.split('\n').filter((l) => l.trim() !== '');
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.removed && parts[i + 1]?.added) {
      const r = lines(p.value);
      const a = lines(parts[i + 1].value);
      const n = Math.max(r.length, a.length);
      for (let k = 0; k < n; k++) {
        if (k < r.length && k < a.length) rows.push({ kind: 'mod', before: r[k], after: a[k] });
        else if (k < r.length) rows.push({ kind: 'del', before: r[k] });
        else rows.push({ kind: 'add', after: a[k] });
      }
      i++;
    } else if (p.added) lines(p.value).forEach((l) => rows.push({ kind: 'add', after: l }));
    else if (p.removed) lines(p.value).forEach((l) => rows.push({ kind: 'del', before: l }));
    else lines(p.value).forEach((l) => rows.push({ kind: 'same', before: l, after: l }));
  }
  return rows;
}

function Words({ before, after }: { before: string; after: string }) {
  const parts = diffWordsWithSpace(before, after);
  return (
    <>
      {parts.map((p, i) =>
        p.added ? (
          <ins key={i}>{p.value}</ins>
        ) : p.removed ? (
          <del key={i}>{p.value}</del>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </>
  );
}

export function DiffView({ before, after, context = 2 }: { before: string; after: string; context?: number }) {
  const rows = diffRows(before, after).filter((r) => r.kind !== 'same' || (r.before ?? '').trim());
  // mostra solo le righe cambiate con un po' di contesto
  const keep = new Set<number>();
  rows.forEach((r, i) => {
    if (r.kind !== 'same') for (let k = i - context; k <= i + context; k++) keep.add(k);
  });
  if (!rows.some((r) => r.kind !== 'same')) return <div className="hint diff-empty">{t('vc.diff.same')}</div>;
  const out: React.ReactNode[] = [];
  let skipped = 0;
  rows.forEach((r, i) => {
    if (!keep.has(i)) {
      skipped++;
      return;
    }
    if (skipped) {
      out.push(
        <div key={`s${i}`} className="diff__skip">
          {tn('vc.diff.skipped', skipped)}
        </div>,
      );
      skipped = 0;
    }
    out.push(
      <div key={i} className={`diff__row is-${r.kind}`}>
        <span className="diff__sign">{r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : r.kind === 'mod' ? '~' : ''}</span>
        <span className="diff__text">
          {r.kind === 'mod' ? <Words before={r.before!} after={r.after!} /> : r.kind === 'del' ? r.before : r.after}
        </span>
      </div>,
    );
  });
  if (skipped) out.push(<div key="end" className="diff__skip">{tn('vc.diff.skipped', skipped)}</div>);
  return <div className="diff">{out}</div>;
}
