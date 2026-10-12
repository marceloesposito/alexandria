// Collegamenti fra risorse e pergamene e Tabula (whiteboard): solo i tipi, senza I/O.
// Li usano la Tabula, il grafo, il Codex e il nucleo condiviso.

export interface Link {
  id: string;
  from: string; // id risorsa, "doc:<rel>" o id di nota
  to: string;
  label?: string;
}

export interface WbNote {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color?: string;
}

export interface WbFrame {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
}

export interface Whiteboard {
  version: 1;
  nodes: Record<string, { x: number; y: number; w?: number }>;
  notes: WbNote[];
  frames: WbFrame[];
  /** pergamene messe sulla Tabula come nodi (percorsi relativi al Compendium) */
  docs?: string[];
  viewport?: { x: number; y: number; zoom: number };
}
