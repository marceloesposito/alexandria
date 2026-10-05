// Anteprima di una pergamena: titolo e primi paragrafi, in sola lettura.
import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { useWorkspace } from '../state/workspace';
import { readDocument } from '../vault/vault';
import { DocView } from '../versions/DocCompare';
import { t } from '../i18n';

/** Taglia il Markdown ai primi paragrafi interi, per un'anteprima leggera. */
export function excerpt(md: string, max = 1200): string {
  if (md.length <= max) return md;
  const cut = md.lastIndexOf('\n\n', max);
  return md.slice(0, cut > 200 ? cut : max) + '\n\n…';
}

export function DocPreview({ rel }: { rel: string }) {
  const root = useWorkspace((s) => s.vaultRoot);
  const doc = useWorkspace((s) => s.docs.find((d) => d.rel === rel));
  const [md, setMd] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setMd(null);
    if (root) void readDocument(root, rel).then((x) => alive && setMd(x));
    return () => {
      alive = false;
    };
  }, [root, rel]);
  return (
    <div className="preview-doc">
      <div className="preview-doc__title">
        <FileText size={13} /> {doc?.title ?? rel}
      </div>
      <div className="preview-doc__body">{md === null ? <p className="hint">{t('common.loading')}</p> : <DocView markdown={excerpt(md)} />}</div>
    </div>
  );
}
