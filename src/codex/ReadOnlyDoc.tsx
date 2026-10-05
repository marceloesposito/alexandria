// Una pergamena in sola lettura, resa con lo stesso editor (citazioni, formule, figure) ma senza
// salvataggio e senza i plugin dell'editor principale.
import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { buildReadOnlyExtensions } from '../editor/extensions';
import { parseMarkdown } from '../doc/parse';
import { readDocument } from '../vault/vault';
import { useWorkspace } from '../state/workspace';
import { t } from '../i18n';

export function ReadOnlyDoc({ rel, onLoaded }: { rel: string; onLoaded?: (words: number) => void }) {
  const root = useWorkspace((s) => s.vaultRoot);
  const [md, setMd] = useState<string | null>(null);
  const editor = useEditor({ extensions: buildReadOnlyExtensions(), editable: false, content: '' }, []);

  useEffect(() => {
    let alive = true;
    if (root) void readDocument(root, rel).then((x) => alive && setMd(x));
    return () => {
      alive = false;
    };
  }, [root, rel]);

  useEffect(() => {
    if (!editor || md === null) return;
    editor.commands.setContent(parseMarkdown(md) as never, { emitUpdate: false });
    onLoaded?.(md.split(/\s+/).filter(Boolean).length);
  }, [editor, md]); // eslint-disable-line react-hooks/exhaustive-deps

  if (md === null) return <p className="hint">{t('common.loading')}</p>;
  if (!md.trim()) return <p className="hint">{t('hist.emptyDoc')}</p>;
  return <EditorContent editor={editor} className="readonly-doc" />;
}
