// Autotest dell'app nativa (solo con ALEXANDRIA_EMBED_TEST="<url>|<rapporto.json>"): crea un
// Compendium nella cartella dati di prova, importa il link, inserisce la scheda embed e controlla che
// la foto della pagina sia salvata e si veda davvero. Scrive il rapporto e chiude l'app.
import { invoke } from '@tauri-apps/api/core';
import { platform } from './platform';
import { useWorkspace } from './state/workspace';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until<T>(f: () => T | undefined | null | false, ms: number): Promise<T | null> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = f();
    if (v) return v;
    await wait(100);
  }
  return null;
}

export async function runSelfTest() {
  if (platform.kind !== 'tauri') return;
  const spec = await invoke<string | null>('selftest_spec').catch(() => null);
  if (!spec) return;
  const [url, out] = spec.split('|');
  const report: Record<string, unknown> = { url };
  const step = (k: string, v: unknown) => {
    report[k] = v;
  };
  try {
    await until(() => useWorkspace.getState().ready, 20000);
    const ws = useWorkspace.getState();
    ws.setPrefs({ onboardingDone: true });
    step('compendium', await ws.createDefaultVault());
    await until(() => document.querySelector('.ProseMirror'), 20000);
    const { importUrls } = await import('./resources/importer');
    const { useResources } = await import('./resources/store');
    const { insertResources } = await import('./resources/insertActions');
    // "pdf:<percorso>": import di un file dal disco invece di un link
    if (url.startsWith('pdf:')) {
      const { importPaths } = await import('./resources/importer');
      const errors: string[] = [];
      const unsub = useWorkspace.subscribe((st) => st.toasts.forEach((x) => x.kind === 'error' && !errors.includes(x.text) && errors.push(x.text)));
      const files = await importPaths([url.slice(4)], 'vault');
      unsub();
      const f = files[0];
      step('pdf', f ? { kind: f.kind, title: f.title, pagine: f.meta.pages ?? null, miniatura: f.meta.thumb ?? null } : null);
      step('erroriImport', errors);
      if (f) step('testoEstratto', (await useResources.getState().textOf(f.id)).slice(0, 80));
      await platform.writeText(out, JSON.stringify(report, null, 2));
      await invoke('selftest_exit');
      return;
    }
    const made = await importUrls([url], 'vault');
    const r = made[0] ?? useResources.getState().resources.find((x) => x.url?.startsWith(url));
    step('risorsa', r ? { kind: r.kind, title: r.title, screenshot: r.meta.screenshot ?? null, thumb: r.meta.thumb ?? null } : null);
    if (r?.meta.screenshot) {
      const s = useResources.getState().vault!;
      const { itemDir } = await import('./resources/storage');
      const path = `${itemDir(s, r.id)}/${r.meta.screenshot}`;
      step('fileFoto', { path, esiste: await platform.exists(path), byte: (await platform.readBytes(path)).length });
    }
    if (r) {
      insertResources([r]);
      const img = await until(() => {
        const el = document.querySelector<HTMLImageElement>('.nv-embed__shot img');
        return el && el.complete ? el : null;
      }, 10000);
      step('schedaNelTesto', !!document.querySelector('.nv-embed'));
      step('immagineNellaScheda', img ? { src: img.src.slice(0, 120), larghezza: img.naturalWidth, altezza: img.naturalHeight, caricata: img.naturalWidth > 0 } : null);
    }
  } catch (e) {
    step('errore', String(e instanceof Error ? e.stack ?? e.message : e));
  }
  await platform.writeText(out, JSON.stringify(report, null, 2));
  await invoke('selftest_exit');
}
