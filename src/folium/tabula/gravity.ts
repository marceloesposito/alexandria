// Fisica della Tabula: ogni blocco e' attratto verso il suo posto d'equilibrio (flowLayout) con
// attrito, e i rettangoli non si sovrappongono (si fanno spazio). Durante il trascinamento il blocco
// tenuto segue il mouse e gli altri si scansano; al rilascio cade morbidamente verso il nuovo posto.
import { forceSimulation, forceX, forceY, type Simulation, type SimulationNodeDatum } from 'd3-force';

export interface Body extends SimulationNodeDatum {
  id: string;
  w: number;
  h: number;
  /** posto d'equilibrio (angolo in alto a sinistra) */
  tx: number;
  ty: number;
  x: number;
  y: number;
}

/**
 * Collisione fra rettangoli: le coppie che si sovrappongono si allontanano lungo l'asse della
 * sovrapposizione minore. I blocchi tenuti fermi (fx/fy) non si muovono, spingono solo gli altri.
 */
export function forceRectCollide(padding = 12, strength = 0.7) {
  let nodes: Body[] = [];
  function force(alpha: number) {
    const k = strength * Math.max(alpha, 0.3);
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const aFixed = a.fx != null;
        const bFixed = b.fx != null;
        if (aFixed && bFixed) continue;
        // due blocchi con posti d'equilibrio separati possono incrociarsi in volo: urtarsi li
        // incastrerebbe. Si scansano solo dal blocco tenuto col mouse.
        if (!aFixed && !bFixed) continue;
        const ox = Math.min(a.x + a.w, b.x + b.w) + padding - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) + padding - Math.max(a.y, b.y);
        if (ox <= 0 || oy <= 0) continue;
        const share = aFixed ? 0 : bFixed ? 1 : 0.5;
        if (ox < oy) {
          const dir = a.x + a.w / 2 < b.x + b.w / 2 ? -1 : 1;
          if (!aFixed) a.x += dir * ox * share * k;
          if (!bFixed) b.x -= dir * ox * (1 - share) * k;
        } else {
          const dir = a.y + a.h / 2 < b.y + b.h / 2 ? -1 : 1;
          if (!aFixed) a.y += dir * oy * share * k;
          if (!bFixed) b.y -= dir * oy * (1 - share) * k;
        }
      }
    }
  }
  force.initialize = (n: Body[]) => {
    nodes = n;
  };
  return force;
}

export function createGravity(bodies: Body[], opts: { pull?: number; friction?: number } = {}): Simulation<Body, undefined> {
  const pull = opts.pull ?? 0.12;
  return forceSimulation<Body>(bodies)
    .velocityDecay(opts.friction ?? 0.45)
    .alphaDecay(0.035)
    .force('x', forceX<Body>((d) => d.tx).strength(pull))
    .force('y', forceY<Body>((d) => d.ty).strength(pull))
    .force('collide', forceRectCollide())
    .stop();
}

/** Aggiorna i posti d'equilibrio dei corpi (dopo un collegamento o un riordino). */
export function retarget(sim: Simulation<Body, undefined>, targets: Map<string, { x: number; y: number }>) {
  for (const b of sim.nodes()) {
    const t = targets.get(b.id);
    if (t) {
      b.tx = t.x;
      b.ty = t.y;
    }
  }
  // le forze x/y leggono tx/ty a ogni inizializzazione
  sim.force('x', forceX<Body>((d) => d.tx).strength(0.12)).force('y', forceY<Body>((d) => d.ty).strength(0.12));
}

/** Porta la simulazione a riposo senza animazione (riapertura, movimento ridotto, test). */
export function settle(sim: Simulation<Body, undefined>, maxTicks = 1500): Body[] {
  // forze sempre accese finche' tutti non sono arrivati (un raffreddamento troppo rapido li
  // fermerebbe a meta' strada)
  sim.alpha(1).alphaTarget(0.2);
  const far = () => sim.nodes().some((b) => Math.abs(b.x - b.tx) > 0.5 || Math.abs(b.y - b.ty) > 0.5);
  for (let i = 0; i < maxTicks && far(); i++) sim.tick();
  sim.alphaTarget(0);
  // ultimo passo: chi e' ormai vicinissimo al suo posto ci si ferma esattamente
  for (const b of sim.nodes()) {
    if (Math.abs(b.x - b.tx) < 0.5 && Math.abs(b.y - b.ty) < 0.5) {
      b.x = b.tx;
      b.y = b.ty;
    }
  }
  return sim.nodes();
}
