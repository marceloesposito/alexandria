// Lettura continua di un Codex nello Scriptorium: le pergamene una dopo l'altra, in sola lettura.
// Un clic sul titolo (o "Modifica") apre quella pergamena nell'editor.
import { useEffect } from 'react';
import { X, Pencil, FileOutput, BookOpen } from 'lucide-react';
import { useWorkspace } from '../state/workspace';
import { useCodexStore, membersOf } from './store';
import { ReadOnlyDoc } from './ReadOnlyDoc';
import { useResources } from '../resources/store';
import { openCodexExportMenu } from './CodexPanel';
import { t, useLang } from '../i18n';

export function CodexReader({ root }: { root: string }) {
  useLang();
  useResources((s) => s.links);
  const docs = useWorkspace((s) => s.docs);
  // la pergamena aperta resta leggibile; le altre del Codex sono attenuate
  const active = useWorkspace((s) => s.activeDoc);
  const settings = useCodexStore((s) => s.settings[root]);
  const members = membersOf(root);
  const close = () => useCodexStore.getState().read(null);

  useEffect(() => {
    if (!settings) void useCodexStore.getState().load(root);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [root, settings]);

  const edit = (rel: string) => {
    close();
    useWorkspace.getState().openDoc(rel);
  };

  return (
    <div className="codex-reader">
      <header className="codex-reader__bar">
        <BookOpen size={15} />
        <span className="codex-reader__name">{settings?.name ?? ''}</span>
        <span className="hint">{t('codex.parts', { n: members.length })}</span>
        <span className="grow" />
        <button className="btn small" onClick={(e) => openCodexExportMenu(e, root)}>
          <FileOutput size={13} /> {t('codex.export')}
        </button>
        <button className="icon-btn" title={t('codex.closeReading')} onClick={close}>
          <X size={16} />
        </button>
      </header>
      <div className="codex-reader__scroll">
        <article className="codex-reader__page">
          {members.map((rel, i) => (
            <section key={rel} className={`codex-reader__part ${active && rel !== active ? 'is-other' : ''}`}>
              <div className="codex-reader__part-head" onClick={() => edit(rel)} title={t('codex.editPart')}>
                <span className="codex-reader__num">{i + 1}</span>
                <span className="codex-reader__title">{docs.find((d) => d.rel === rel)?.title ?? rel}</span>
                <Pencil size={12} />
              </div>
              <ReadOnlyDoc rel={rel} />
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
