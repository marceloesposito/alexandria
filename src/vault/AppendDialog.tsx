// "Aggiungi da un altro Compendium": scegli il Compendium, le pergamene e le opzioni; la copia entra
// nel Compendium aperto con Marginalia, impostazioni, fonti citate, tipi e Codex.
import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, FileText, BookOpen, Import } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useWorkspace } from '../state/workspace';
import { platform, joinPath, baseName } from '../platform';
import { readJson } from './vault';
import { readOtherCompendium, planAppend, applyAppend, docKeyIn, type OtherCompendium } from './append';
import { META_DIR, vaultDirs } from './paths';
import { parseMarkdown } from '../doc/parse';
import { keysOfDoc } from '../export/run';
import { allCodices } from '../codex/model';
import { useResources } from '../resources/store';
import { useTypes } from '../types/store';
import { checkpoint } from '../versions/actions';
import { flushSave } from '../editor/session';
import { getEditor } from '../state/editorRef';
import { t, useLang } from '../i18n';

export function AppendDialog() {
  useLang();
  const close = () => useWorkspace.getState().closeDialog();
  const root = useWorkspace((s) => s.vaultRoot);
  const recent = useWorkspace((s) => s.app.recentVaults);
  const [src, setSrc] = useState<OtherCompendium | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [folder, setFolder] = useState(true);
  const [sources, setSources] = useState(true);
  const [keys, setKeys] = useState<Record<string, string[]>>({});
  const [docTypes, setDocTypes] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  const load = async (p: string) => {
    try {
      const c = await readOtherCompendium(p);
      setSrc(c);
      setPicked(new Set(c.docs.map((d) => d.rel)));
      // fonti citate e tipo di ogni pergamena (per sapere cosa portare)
      const k: Record<string, string[]> = {};
      const ty: Record<string, string | null> = {};
      for (const d of c.docs) {
        k[d.rel] = keysOfDoc(parseMarkdown(await platform.readText(joinPath(p, d.rel)).catch(() => '')));
        const s = await readJson<{ object?: { type?: string } } | null>(joinPath(p, `${META_DIR}/doc-settings/${docKeyIn(d.rel, c.dirs)}.json`), null);
        ty[d.rel] = s?.object?.type ?? null;
      }
      setKeys(k);
      setDocTypes(ty);
    } catch {
      useWorkspace.getState().toast(t('append.notCompendium'), 'error');
    }
  };

  const others = recent.filter((r) => r !== root);
  const codices = useMemo(() => (src ? allCodices(src.links, new Set(src.docs.map((d) => d.rel))) : []), [src]);
  const inCodex = new Set(codices.flatMap((c) => c.members));
  const plan = useMemo(() => {
    if (!src) return null;
    const st = useResources.getState();
    return planAppend(src, [...picked], { dirs: vaultDirs(), docs: useWorkspace.getState().docs, resources: st.resources, types: useTypes.getState().types }, { folder, sources }, keys, undefined, docTypes);
  }, [src, picked, folder, sources, keys, docTypes]);

  const toggle = (rels: string[], on: boolean) => {
    const n = new Set(picked);
    rels.forEach((r) => (on ? n.add(r) : n.delete(r)));
    setPicked(n);
  };

  const run = async () => {
    if (!src || !plan || !root) return;
    setBusy(true);
    try {
      await flushSave(getEditor());
      const made = await applyAppend(src, plan, root, vaultDirs(), useTypes.getState().types);
      const ws = useWorkspace.getState();
      await ws.refreshDocs();
      await useResources.getState().load(root);
      await useTypes.getState().load(root);
      await checkpoint(t('append.checkpoint', { name: src.name }));
      close();
      if (made[0]) ws.openDoc(made[0]);
      ws.toast(t('append.done', { n: made.length, s: plan.sources.length }), 'ok');
    } catch (e) {
      useWorkspace.getState().toast(String(e instanceof Error ? e.message : e), 'error');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!src && others.length === 1) void load(others[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const row = (rel: string) => {
    const d = src!.docs.find((x) => x.rel === rel)!;
    return (
      <label key={rel} className="doc-pick__item">
        <input type="checkbox" checked={picked.has(rel)} onChange={(e) => toggle([rel], e.target.checked)} />
        <FileText size={13} /> <span className="doc-pick__title">{d.folder ? `${d.folder}/` : ''}{d.title}</span>
      </label>
    );
  };

  return (
    <Modal
      title={t('append.title')}
      onClose={close}
      size="medium"
      footer={
        <>
          {plan && <span className="hint">{t('append.summary', { n: plan.docs.length, s: plan.sources.length, k: plan.sourcesKnown })}</span>}
          <span className="grow" />
          <button className="btn" onClick={close} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button className="btn btn--primary" disabled={busy || !plan || !plan.docs.length} onClick={() => void run()}>
            <Import size={14} /> {t('append.go')}
          </button>
        </>
      }
    >
      <section className="forge__section">
        <h4>{t('append.from')}</h4>
        <div className="forge__row">
          <select className="select" value={src?.root ?? ''} onChange={(e) => e.target.value && void load(e.target.value)}>
            <option value="">{t('append.pickRecent')}</option>
            {others.map((r) => (
              <option key={r} value={r}>
                {baseName(r)}
              </option>
            ))}
            {src && !others.includes(src.root) && <option value={src.root}>{baseName(src.root)}</option>}
          </select>
          <button
            className="btn"
            onClick={async () => {
              const p = await platform.pickDirectory(t('append.pickFolder'));
              if (p) void load(p);
            }}
          >
            <FolderOpen size={13} /> {t('remote.choose')}
          </button>
        </div>
      </section>

      {src && (
        <>
          <section className="forge__section">
            <div className="forge__row">
              <h4 className="grow">{t('append.scrolls', { n: src.docs.length })}</h4>
              <button className="link-btn" onClick={() => toggle(src.docs.map((d) => d.rel), picked.size !== src.docs.length)}>
                {picked.size === src.docs.length ? t('append.none') : t('append.all')}
              </button>
            </div>
            <div className="doc-pick append-list">
              {codices.map((c) => (
                <div key={c.root} className="append-list__codex">
                  <label className="doc-pick__item">
                    <input type="checkbox" checked={c.members.every((m) => picked.has(m))} onChange={(e) => toggle(c.members, e.target.checked)} />
                    <BookOpen size={13} /> <strong>{src.docs.find((d) => d.rel === c.root)?.title ?? 'Codex'}</strong>
                  </label>
                  <div className="append-list__members">{c.members.map(row)}</div>
                </div>
              ))}
              {src.docs.filter((d) => !inCodex.has(d.rel)).map((d) => row(d.rel))}
            </div>
          </section>
          <section className="forge__section">
            <label className="check">
              <input type="checkbox" checked={folder} onChange={(e) => setFolder(e.target.checked)} /> {t('append.inFolder', { name: src.name })}
            </label>
            <label className="check">
              <input type="checkbox" checked={sources} onChange={(e) => setSources(e.target.checked)} /> {t('append.sources')}
            </label>
            <p className="hint">{t('append.hint')}</p>
          </section>
        </>
      )}
    </Modal>
  );
}
