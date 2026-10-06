// Lingua di scrittura del Compendium: sezione della barra dello Scriptorium e finestra dalla
// tavolozza dei comandi. La lingua dell'interfaccia resta nelle Preferenze.
import { Languages } from 'lucide-react';
import { useWorkspace } from '../state/workspace';
import { t, useLang } from '../i18n';
import { WRITING_LANGS, getWritingLang, useWritingLang, type WritingLang } from '../i18n/writing';
import { retargetDocsLanguage } from '../layout/docSettings';
import { Modal } from '../components/Modal';
import { registerWidget } from './RibbonWidgets';
import { registerDialog } from './DialogHost';
import type { RibbonSize } from '../state/prefs';

async function choose(lang: WritingLang) {
  const from = getWritingLang();
  await useWorkspace.getState().setWritingLanguage(lang);
  await retargetDocsLanguage(from, lang);
}

function WritingLangWidget({ size }: { size: RibbonSize }) {
  useLang();
  const lang = useWritingLang();
  const open = useWorkspace((s) => !!s.vaultRoot);
  return (
    <label className={`ribbon__widget ribbon__widget--${size}`}>
      <select
        className="select"
        value={lang}
        disabled={!open}
        title={t('cmd.doc.writingLangHint')}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => void choose(e.target.value as WritingLang)}
      >
        {WRITING_LANGS.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      {size === 'large' && <span className="ribbon__btn-label">{t('cmd.doc.writingLang')}</span>}
    </label>
  );
}

function WritingLangDialog() {
  useLang();
  const lang = useWritingLang();
  const close = () => useWorkspace.getState().closeDialog();
  return (
    <Modal title={t('cmd.doc.writingLang')} onClose={close} size="small">
      <p className="hint">{t('cmd.doc.writingLangHint')}</p>
      <div className="writing-langs">
        {WRITING_LANGS.map((l) => (
          <button
            key={l.id}
            className={`btn ${l.id === lang ? 'btn--primary' : ''}`}
            onClick={() => {
              void choose(l.id);
              close();
            }}
          >
            <Languages size={14} /> {l.name}
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function registerWritingLang() {
  registerWidget('writingLang', WritingLangWidget);
  registerDialog('writingLang', WritingLangDialog);
}
