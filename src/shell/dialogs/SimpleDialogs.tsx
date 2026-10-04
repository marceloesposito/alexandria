// Finestre semplici: rinomina documento, vai a riga, informazioni, scorciatoie, guida Markdown.
import { useState } from 'react';
import { TextSelection } from '@tiptap/pm/state';
import { Modal } from '../../components/Modal';
import { useWorkspace } from '../../state/workspace';
import { t, useLang } from '../../i18n';
import { getLines } from '../../editor/lines';
import { getEditor } from '../../state/editorRef';
import { allCommands, displayShortcut } from '../../commands/registry';
import { flushSave } from '../../editor/session';

export function RenameDocDialog() {
  const rel = useWorkspace((s) => s.dialogArg) as string;
  const doc = useWorkspace((s) => s.docs.find((d) => d.rel === rel));
  const [title, setTitle] = useState(doc?.title ?? '');
  const close = () => useWorkspace.getState().closeDialog();
  const submit = async () => {
    if (!title.trim() || !rel) return;
    await flushSave(getEditor());
    await useWorkspace.getState().renameDoc(rel, title.trim());
    close();
  };
  return (
    <Modal
      title={t('doc.rename')}
      onClose={close}
      size="small"
      footer={
        <>
          <button className="btn" onClick={close}>
            {t('common.cancel')}
          </button>
          <button className="btn btn--primary" onClick={submit}>
            {t('common.ok')}
          </button>
        </>
      }
    >
      <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
    </Modal>
  );
}

/** Porta il cursore all'inizio della riga visiva n e la mostra. */
export function goToLine(n: number): boolean {
  const lines = getLines();
  const line = lines.find((l) => l.n === n);
  const e = getEditor();
  const page = document.querySelector('.page') as HTMLElement | null;
  if (!line || !e || !page) return false;
  const r = page.getBoundingClientRect();
  const pm = page.querySelector('.ProseMirror') as HTMLElement;
  const left = pm.getBoundingClientRect().left + 2;
  const hit = e.view.posAtCoords({ left, top: r.top + (line.top + line.bottom) / 2 });
  if (hit) {
    e.view.dispatch(e.state.tr.setSelection(TextSelection.near(e.state.doc.resolve(hit.pos))));
    e.commands.focus();
  }
  const scroller = page.closest('.editor-scroll') as HTMLElement | null;
  if (scroller) scroller.scrollTo({ top: line.top - scroller.clientHeight / 3, behavior: 'smooth' });
  page.querySelectorAll('.line-flash').forEach((x) => x.remove());
  const flash = document.createElement('div');
  flash.className = 'line-flash';
  flash.style.top = `${line.top}px`;
  flash.style.height = `${line.bottom - line.top}px`;
  page.appendChild(flash);
  setTimeout(() => flash.remove(), 1600);
  return true;
}

export function GoToLineDialog() {
  const [value, setValue] = useState('');
  const close = () => useWorkspace.getState().closeDialog();
  const max = getLines().length;
  const submit = () => {
    const n = parseInt(value, 10);
    if (n >= 1 && n <= max) {
      close();
      setTimeout(() => goToLine(n), 0);
    }
  };
  return (
    <Modal title={t('goto.title')} onClose={close} size="small">
      <input
        className="input"
        autoFocus
        inputMode="numeric"
        placeholder={t('goto.placeholder', { max })}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
    </Modal>
  );
}

export function AboutDialog() {
  const close = () => useWorkspace.getState().closeDialog();
  return (
    <Modal title={t('about.title')} onClose={close} size="small">
      <div className="about">
        <div className="about__name">Alexandria</div>
        <div className="hint">{t('about.version', { v: '0.1.0' })}</div>
        <p>{t('about.text')}</p>
        <p className="hint">{t('about.licenses')}</p>
      </div>
    </Modal>
  );
}

export function ShortcutsDialog() {
  useLang();
  const close = () => useWorkspace.getState().closeDialog();
  const list = allCommands()
    .filter((c) => c.shortcut)
    .sort((a, b) => a.category.localeCompare(b.category) || t(a.label).localeCompare(t(b.label)));
  const cats = [...new Set(list.map((c) => c.category))];
  return (
    <Modal title={t('cmd.help.shortcuts')} onClose={close} size="medium">
      <div className="shortcuts">
        {cats.map((cat) => (
          <section key={cat}>
            <h3>{t(`category.${cat}`)}</h3>
            <table className="kv">
              <tbody>
                {list
                  .filter((c) => c.category === cat)
                  .map((c) => (
                    <tr key={c.id}>
                      <td>{t(c.label)}</td>
                      <td>
                        <kbd>{displayShortcut(c.shortcut!)}</kbd>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        ))}
        <section>
          <h3>{t('shortcuts.editor')}</h3>
          <table className="kv">
            <tbody>
              <tr>
                <td>{t('shortcuts.slash')}</td>
                <td>
                  <kbd>/</kbd>
                </td>
              </tr>
              <tr>
                <td>{t('shortcuts.dragBlock')}</td>
                <td>⋮⋮</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </Modal>
  );
}

const MD_ROWS: [string, string][] = [
  ['# Titolo', 'md.h1'],
  ['## Sottotitolo', 'md.h2'],
  ['**grassetto**  *corsivo*  ~~barrato~~', 'md.emphasis'],
  ['- voce / 1. voce / - [ ] attività', 'md.lists'],
  ['> citazione', 'md.quote'],
  ['`codice`  e  ```blocco```', 'md.code'],
  ['[testo](https://…)', 'md.link'],
  ['![didascalia](immagine.png){placement=top width=60%}', 'md.figure'],
  ['$a^2+b^2$   e   $$ … $$', 'md.math'],
  ['testo[^1]   …   [^1]: nota', 'md.footnote'],
  ['[@rossi2020, p. 12]', 'md.citation'],
  ['[[Altro documento]]', 'md.wikilink'],
  ['<!-- pagebreak -->', 'md.pagebreak'],
  ['| A | B |\\n| --- | --- |', 'md.table'],
];

export function MarkdownGuideDialog() {
  const close = () => useWorkspace.getState().closeDialog();
  return (
    <Modal title={t('cmd.help.markdown')} onClose={close} size="medium">
      <p className="hint">{t('md.intro')}</p>
      <table className="kv">
        <tbody>
          {MD_ROWS.map(([code, key]) => (
            <tr key={key}>
              <td>
                <code>{code}</code>
              </td>
              <td>{t(key)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

export function HelpDialog() {
  const close = () => useWorkspace.getState().closeDialog();
  const sections = ['start', 'editor', 'comments', 'versions', 'resources', 'citations', 'export', 'vault'];
  return (
    <Modal title={t('cmd.help.guide')} onClose={close} size="large">
      <div className="help">
        {sections.map((s) => (
          <section key={s}>
            <h3>{t(`help.${s}.title`)}</h3>
            <p>{t(`help.${s}.text`)}</p>
          </section>
        ))}
      </div>
    </Modal>
  );
}
