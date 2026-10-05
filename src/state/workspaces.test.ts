import { describe, expect, it } from 'vitest';
import { builtInWorkspace, builtInRibbon, captureWorkspace, applyWorkspace, normalizeWorkspace } from './workspaces';
import { detachGroup, addToPanel, dockGroup, closePanel, movePanel, floatingGroupIds } from '../commands/floatModel';
import { reconcile, tabsForView, type RibbonConfig } from '../commands/ribbonModel';
import { DEFAULT_PREFS } from './prefs';

const cfg = (): RibbonConfig => ({
  version: 1,
  tabs: [
    { id: 'home', view: 'editor', label: 'Home', groups: [{ id: 'a', label: 'A', items: ['x'] }, { id: 'b', label: 'B', items: ['y'] }] },
    { id: 'ins', view: 'editor', label: 'Inserisci', groups: [{ id: 'c', label: 'C', items: ['z'] }] },
    { id: 'res', view: 'resources', label: 'Home', groups: [{ id: 'r', label: 'R', items: ['w'] }] },
  ],
});

describe('workspace', () => {
  it('Beginner: una sola scheda essenziale per ambiente, le altre nascoste ma presenti', () => {
    const r = builtInRibbon('beginner', cfg())!;
    expect(tabsForView(r, 'editor').map((t) => t.id)).toEqual(['bg-editor']);
    expect(r.tabs.filter((t) => t.hidden).map((t) => t.id)).toEqual(['home', 'ins', 'res']);
    // la riconciliazione non rimette le schede di default perche' ci sono gia' (nascoste)
    const back = reconcile(r, cfg(), new Set(['x', 'y', 'z', 'w', 'insert.h1', 'res.add']));
    expect(tabsForView(back, 'editor').map((t) => t.id)).toEqual(['bg-editor']);
  });

  it('Beginner nasconde colonne e numeri; Pro mostra tutto con icone piccole; Studio usa la barra di default', () => {
    expect(builtInWorkspace('beginner', cfg()).prefs).toMatchObject({ showLeft: false, showRight: false, lineNumbers: false, editorLayout: 'borderless' });
    expect(builtInWorkspace('pro', cfg()).prefs).toMatchObject({ showPreview: true, ribbonSize: 'small', rulers: true });
    expect(builtInWorkspace('studio', cfg()).ribbon).toBeNull();
  });

  it('salvare e riapplicare un workspace riporta disposizione, barra e pannelli', () => {
    const prefs = { ...DEFAULT_PREFS, showRight: false, lang: 'en' as const };
    const w = captureWorkspace('u1', 'Il mio', prefs, cfg(), []);
    expect(w.prefs.showRight).toBe(false);
    expect('lang' in w.prefs).toBe(false); // lingua e tema restano dell'utente
    const a = applyWorkspace(w);
    expect(a.ribbon).toEqual(cfg());
    expect(normalizeWorkspace(JSON.parse(JSON.stringify(w)))?.prefs.showRight).toBe(false);
    expect(normalizeWorkspace({ name: 'x' })).toBeNull();
  });
});

describe('pannelli flottanti', () => {
  it('staccare, aggiungere, rimettere nella barra', () => {
    let s = detachGroup(cfg(), [], 'b', 100, 200);
    expect(s.cfg.tabs[0].groups.map((g) => g.id)).toEqual(['a']);
    expect(s.panels).toHaveLength(1);
    expect(s.panels[0]).toMatchObject({ view: 'editor', x: 100, y: 200 });
    const pid = s.panels[0].id;
    s = addToPanel(s.cfg, s.panels, 'c', pid);
    expect(s.panels[0].groups.map((g) => g.id)).toEqual(['b', 'c']);
    expect(s.cfg.tabs[1].groups).toEqual([]);
    // un gruppo di un altro ambiente non entra
    expect(addToPanel(s.cfg, s.panels, 'r', pid).panels[0].groups).toHaveLength(2);
    expect(floatingGroupIds(s.panels)).toEqual(new Set(['b', 'c']));
    s = dockGroup(s.cfg, s.panels, pid, 'c');
    expect(s.cfg.tabs[1].groups.map((g) => g.id)).toEqual(['c']);
    s = closePanel(s.cfg, s.panels, pid);
    expect(s.panels).toEqual([]);
    expect(s.cfg.tabs[0].groups.map((g) => g.id)).toEqual(['a', 'b']);
  });

  it('i pannelli non escono dallo schermo in alto a sinistra', () => {
    const s = detachGroup(cfg(), [], 'a', 10, 10);
    expect(movePanel(s.panels, s.panels[0].id, -50, -20)[0]).toMatchObject({ x: 0, y: 0 });
  });
});
