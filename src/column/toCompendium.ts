// "Porta in un Compendium": piano dei file da scrivere in un Compendium di Alexandria per accogliere
// il foglio. Si porta l'ultima versione del testo (non la storia), le Marginalia, i media come
// risorse dell'Armarium e la Tabula come post-it, risorse e collegamenti della Tabula di Alexandria.
// Niente sovrascritture: la pergamena prende un nome libero, gli id delle risorse sono nuovi.
// Funzione pura: legge e scrive chi la chiama.
import { parseMarkdown } from 'logos/doc/parse';
import { serializeMarkdown } from 'logos/doc/serialize';
import type { PMNode } from 'logos/doc/types';
import type { Comment } from 'logos/comments/model';
import type { Link, Whiteboard, WbNote } from 'logos/resources/boardModel';
import type { Resource } from 'logos/resources/model';
import { FILES, type Sheet } from './format';

/** Quanto serve sapere del Compendium di destinazione (letto da chi chiama). */
export interface CompendiumInfo {
  /** cartelle da .alexandria/vault.json (assenti nei Compendium di prima: documents/ e resources/) */
  dirs?: { docs?: string; res?: string };
  /** nomi dei file gia' presenti nella cartella delle pergamene (radice) */
  docNames: string[];
  /** id delle risorse gia' presenti */
  resourceIds: string[];
  whiteboard: Whiteboard | null;
  links: Link[];
}

export interface CompendiumWrite {
  /** percorso relativo alla radice del Compendium */
  path: string;
  data: string | Uint8Array;
}

export interface CompendiumPlan {
  /** pergamena creata (relativa alla radice) */
  docRel: string;
  writes: CompendiumWrite[];
}

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };

export function safeFileName(title: string): string {
  const s = title
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  const out = s.slice(0, 120) || 'Column';
  return /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(out) ? `_${out}` : out;
}

function uniqueName(base: string, taken: string[], ext: string): string {
  const lower = new Set(taken.map((t) => t.toLowerCase()));
  if (!lower.has((base + ext).toLowerCase())) return base + ext;
  for (let i = 2; ; i++) if (!lower.has(`${base} ${i}${ext}`.toLowerCase())) return `${base} ${i}${ext}`;
}

function relativeFrom(docRel: string, target: string): string {
  const from = docRel.split('/').slice(0, -1);
  const to = target.split('/');
  let i = 0;
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i++;
  return [...Array(from.length - i).fill('..'), ...to.slice(i)].join('/');
}

function mapFigures(n: PMNode, f: (src: string) => string): PMNode {
  const attrs = n.type === 'figure' && typeof n.attrs?.src === 'string' ? { ...n.attrs, src: f(n.attrs.src) } : n.attrs;
  return { ...n, ...(attrs ? { attrs } : {}), ...(n.content ? { content: n.content.map((c) => mapFigures(c, f)) } : {}) };
}

export function planToCompendium(sheet: Sheet, title: string, info: CompendiumInfo, opts: { now: Date; idOf: (i: number) => string }): CompendiumPlan {
  const docs = info.dirs?.docs || 'documents';
  const res = info.dirs?.res || 'resources';
  const name = uniqueName(safeFileName(title), info.docNames, '.md');
  const docRel = `${docs}/${name}`;
  const key = name.replace(/\.md$/i, '');
  const created = opts.now.toISOString();
  const writes: CompendiumWrite[] = [];
  const takenIds = new Set(info.resourceIds);
  let counter = 0;
  const freshId = () => {
    let id = opts.idOf(counter++);
    while (takenIds.has(id)) id = opts.idOf(counter++);
    takenIds.add(id);
    return id;
  };

  // media -> risorse immagine (una per file), ricordando dove sono finite
  const mediaRes = new Map<string, { id: string; path: string }>();
  for (const [file, data] of Object.entries(sheet.media)) {
    const id = freshId();
    const ext = (file.split('.').pop() ?? '').toLowerCase();
    const r: Resource = {
      id,
      kind: 'image',
      title: file.replace(/\.[^.]+$/, ''),
      file,
      csl: null,
      citeKey: null,
      isSource: false,
      tags: [],
      layers: [],
      created,
      meta: { ...(MIME[ext] ? { mime: MIME[ext] } : {}), size: data.length },
      pins: [],
    };
    writes.push({ path: `${res}/${id}/${file}`, data });
    writes.push({ path: `${res}/${id}/meta.json`, data: JSON.stringify(r, null, 2) });
    mediaRes.set(`${FILES.mediaDir}${file}`, { id, path: `${res}/${id}/${file}` });
  }

  // testo: le immagini puntano alle risorse
  let markdown = sheet.markdown;
  if (mediaRes.size) {
    const doc = mapFigures(parseMarkdown(sheet.markdown), (src) => {
      const hit = mediaRes.get(src.replace(/^\.\//, ''));
      return hit ? relativeFrom(docRel, hit.path) : src;
    });
    markdown = serializeMarkdown(doc);
  }
  writes.push({ path: docRel, data: markdown });

  // Marginalia accanto alla pergamena (Alexandria le ritrova dalle citazioni se le posizioni cambiano)
  const comments: Comment[] = sheet.comments.comments;
  if (comments.length) writes.push({ path: `.alexandria/comments/${key}.json`, data: JSON.stringify({ version: 1, comments }, null, 2) });

  // Tabula: note ed estratti -> post-it; immagini e link -> risorse; collegamenti -> collegamenti
  const blocks = sheet.tabula.blocks;
  if (blocks.length) {
    const wb: Whiteboard = info.whiteboard ?? { version: 1, nodes: {}, notes: [], frames: [] };
    const right = Math.max(0, ...wb.notes.map((n) => n.x + n.w), ...wb.frames.map((f) => f.x + f.w), ...Object.values(wb.nodes).map((p) => p.x + 260));
    const minX = Math.min(...blocks.map((b) => b.x));
    const minY = Math.min(...blocks.map((b) => b.y));
    const dx = right + 200 - minX;
    const dy = -minY;
    const notes: WbNote[] = [...wb.notes];
    const nodes = { ...wb.nodes };
    const idMap = new Map<string, string>();
    for (const b of blocks) {
      const x = b.x + dx;
      const y = b.y + dy;
      if (b.kind === 'note' || b.kind === 'excerpt') {
        const id = `n${freshId()}`;
        const text = b.kind === 'excerpt' && b.anchor ? `«${b.anchor.quote}»${b.text ? `\n\n${b.text}` : ''}` : b.text;
        notes.push({ id, x, y, w: b.w, h: Math.max(b.h, 70), text });
        idMap.set(b.id, id);
      } else if (b.kind === 'image' && b.src && mediaRes.has(b.src)) {
        const hit = mediaRes.get(b.src)!;
        nodes[hit.id] = { x, y };
        idMap.set(b.id, hit.id);
      } else if (b.kind === 'link' && b.url) {
        const id = freshId();
        const r: Resource = { id, kind: 'web', title: b.text || b.url, url: b.url, csl: null, citeKey: null, isSource: false, tags: [], layers: [], created, meta: {}, pins: [] };
        writes.push({ path: `${res}/${id}/meta.json`, data: JSON.stringify(r, null, 2) });
        nodes[id] = { x, y };
        idMap.set(b.id, id);
      }
    }
    const links: Link[] = [...info.links];
    for (const l of sheet.tabula.links) {
      const from = idMap.get(l.from);
      const to = idMap.get(l.to);
      if (from && to) links.push({ id: `k${freshId()}`, from, to });
    }
    writes.push({ path: '.alexandria/whiteboard.json', data: JSON.stringify({ ...wb, notes, nodes }, null, 2) });
    if (links.length !== info.links.length) writes.push({ path: '.alexandria/links.json', data: JSON.stringify({ version: 1, links }, null, 2) });
  }
  return { docRel, writes };
}
