// Modifiche pure alla Tabula, condivise fra tastiera (onNodesChange) e menu del clic destro.
import type { Link, Whiteboard } from 'logos/resources/boardModel';
import { relOfNode } from 'logos/resources/docLinks';

/**
 * Toglie dalla Tabula le note e le cornici con questi id, insieme ai collegamenti che partono o
 * arrivano li'. Le pergamene sono nodi fissi e restano; gli altri id (risorse) non si toccano.
 */
export function removeBoardItems(wb: Whiteboard, links: Link[], ids: string[]): { whiteboard: Whiteboard; links: Link[] } {
  const gone = new Set(ids.filter((id) => !relOfNode(id) && (wb.notes.some((n) => n.id === id) || wb.frames.some((f) => f.id === id))));
  if (!gone.size) return { whiteboard: wb, links };
  return {
    whiteboard: { ...wb, notes: wb.notes.filter((n) => !gone.has(n.id)), frames: wb.frames.filter((f) => !gone.has(f.id)) },
    links: links.filter((l) => !gone.has(l.from) && !gone.has(l.to)),
  };
}
