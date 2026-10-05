// Pannelli flottanti: gruppi della barra degli strumenti staccati in finestre libere. Si spostano
// dalla barra del titolo, accettano altri gruppi trascinati dalla barra, si richiudono nella barra.
import { useRef, useState } from 'react';
import { X, ArrowUpToLine, GripHorizontal } from 'lucide-react';
import { useWorkspace } from '../state/workspace';
import { getCommand, type Command } from '../commands/registry';
import { addToPanel, closePanel, dockGroup, movePanel, type FloatingPanel } from '../commands/floatModel';
import { CommandButton, useRibbonConfig, labelOf, GROUP_MIME } from './Ribbon';
import { useCommandTick } from './useCommands';
import { t, useLang } from '../i18n';

function Panel({ p }: { p: FloatingPanel }) {
  const cfg = useRibbonConfig();
  const floating = useWorkspace((s) => s.app.floating);
  const [over, setOver] = useState(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ws = useWorkspace.getState();
  const x = pos?.x ?? p.x;
  const y = pos?.y ?? p.y;

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { dx: e.clientX - x, dy: e.clientY - y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (drag.current) setPos({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy });
  };
  const onUp = () => {
    if (drag.current && pos) ws.setRibbonAndFloating(ws.app.ribbon ?? cfg, movePanel(floating, p.id, pos.x, pos.y));
    drag.current = null;
    setPos(null);
  };

  return (
    <div
      className={`float-panel ${over ? 'is-over' : ''}`}
      style={{ left: x, top: y }}
      role="toolbar"
      aria-label={p.groups.map((g) => labelOf(g.label, g.custom)).join(', ')}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(GROUP_MIME)) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        const id = e.dataTransfer.getData(GROUP_MIME);
        setOver(false);
        if (!id) return;
        e.preventDefault();
        e.stopPropagation();
        const s = addToPanel(cfg, floating, id, p.id);
        ws.setRibbonAndFloating(s.cfg, s.panels);
      }}
    >
      <header className="float-panel__head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} title={t('float.move')}>
        <GripHorizontal size={12} />
        <span className="grow" />
        <button
          className="icon-btn tiny"
          title={t('float.close')}
          onClick={() => {
            const s = closePanel(cfg, floating, p.id);
            ws.setRibbonAndFloating(s.cfg, s.panels);
          }}
        >
          <X size={12} />
        </button>
      </header>
      {p.groups.map((g) => {
        const items = g.items.map((id) => getCommand(id)).filter((c): c is Command => !!c);
        return (
          <section key={g.id} className="float-panel__group">
            <div className="float-panel__label">
              <span>{labelOf(g.label, g.custom)}</span>
              <button
                className="icon-btn tiny"
                title={t('float.dock')}
                onClick={() => {
                  const s = dockGroup(cfg, floating, p.id, g.id);
                  ws.setRibbonAndFloating(s.cfg, s.panels);
                }}
              >
                <ArrowUpToLine size={11} />
              </button>
            </div>
            <div className="float-panel__items">
              {items.map((c) => (
                <CommandButton key={c.id} cmd={c} size="large" />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function FloatingPanels() {
  useLang();
  useCommandTick();
  const floating = useWorkspace((s) => s.app.floating);
  const view = useWorkspace((s) => s.app.view);
  return (
    <>
      {floating
        .filter((p) => p.view === view)
        .map((p) => (
          <Panel key={p.id} p={p} />
        ))}
    </>
  );
}
