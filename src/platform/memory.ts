// Implementazione in memoria: file system simulato, per il browser e i test. Nel browser si conserva
// in localStorage, cosi' una ricarica della pagina ritrova i fogli.
import type { Platform, DirEntry } from './types';
import { bytesToBase64, base64ToBytes } from 'logos/lib/bytes';

const PERSIST_KEY = 'column.memfs.v1';

function norm(p: string): string {
  let s = p.replace(/\\/g, '/').replace(/\/+/g, '/');
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

function parent(p: string): string {
  const i = p.lastIndexOf('/');
  return i <= 0 ? '/' : p.slice(0, i);
}

export interface MemoryPlatform extends Platform {
  /** file scelti dalle prossime finestre di dialogo (prove) */
  queuePick(paths: string[] | string | null): void;
}

export function createMemoryPlatform(opts: { persist?: boolean; dataDir?: string } = {}): MemoryPlatform {
  const files = new Map<string, Uint8Array>();
  const dirs = new Set<string>(['/']);
  const mtimes = new Map<string, number>();
  const picks: (string[] | string | null)[] = [];

  if (opts.persist) {
    try {
      const raw = localStorage.getItem(PERSIST_KEY);
      if (raw) {
        const snap = JSON.parse(raw) as { files: [string, string][]; dirs: string[] };
        snap.dirs.forEach((d) => dirs.add(d));
        snap.files.forEach(([p, b64]) => files.set(p, base64ToBytes(b64)));
      }
    } catch {
      /* storage negato: si lavora solo in memoria */
    }
  }
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  function schedulePersist() {
    if (!opts.persist) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      try {
        const entries: [string, string][] = [];
        for (const [p, d] of files) if (d.length < 2_000_000) entries.push([p, bytesToBase64(d)]);
        localStorage.setItem(PERSIST_KEY, JSON.stringify({ files: entries, dirs: [...dirs] }));
      } catch {
        /* quota superata: niente persistenza */
      }
    }, 200);
  }

  function ensureDir(p: string) {
    let cur = norm(p);
    while (cur && !dirs.has(cur)) {
      dirs.add(cur);
      cur = parent(cur);
    }
  }

  function write(path: string, data: Uint8Array) {
    const p = norm(path);
    ensureDir(parent(p));
    files.set(p, data);
    mtimes.set(p, Date.now());
    schedulePersist();
  }

  function read(path: string): Uint8Array {
    const d = files.get(norm(path));
    if (!d) throw new Error(`File non trovato: ${path}`);
    return d;
  }

  const nextPick = () => (picks.length ? picks.shift()! : null);

  return {
    kind: 'memory',
    async readText(path) {
      return new TextDecoder().decode(read(path));
    },
    async writeText(path, text) {
      write(path, new TextEncoder().encode(text));
    },
    async readBytes(path) {
      return read(path).slice();
    },
    async writeBytes(path, data) {
      write(path, data.slice());
    },
    async exists(path) {
      const p = norm(path);
      return files.has(p) || dirs.has(p);
    },
    async list(path) {
      const p = norm(path);
      if (!dirs.has(p)) throw new Error(`Cartella non trovata: ${path}`);
      const out: DirEntry[] = [];
      const prefix = p === '/' ? '/' : p + '/';
      for (const d of dirs) if (d !== p && d.startsWith(prefix) && !d.slice(prefix.length).includes('/')) out.push({ name: d.slice(prefix.length), path: d, isDir: true, size: 0, mtime: 0 });
      for (const [f, data] of files)
        if (f.startsWith(prefix) && !f.slice(prefix.length).includes('/')) out.push({ name: f.slice(prefix.length), path: f, isDir: false, size: data.length, mtime: mtimes.get(f) ?? 0 });
      return out.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    },
    async mkdir(path) {
      ensureDir(path);
      schedulePersist();
    },
    async remove(path) {
      const p = norm(path);
      for (const f of [...files.keys()]) if (f === p || f.startsWith(p + '/')) files.delete(f);
      for (const d of [...dirs]) if (d === p || d.startsWith(p + '/')) dirs.delete(d);
      schedulePersist();
    },
    async rename(from, to) {
      const a = norm(from);
      const b = norm(to);
      ensureDir(parent(b));
      for (const [f, d] of [...files]) {
        if (f === a || f.startsWith(a + '/')) {
          files.delete(f);
          files.set(b + f.slice(a.length), d);
        }
      }
      for (const d of [...dirs]) {
        if (d === a || d.startsWith(a + '/')) {
          dirs.delete(d);
          dirs.add(b + d.slice(a.length));
        }
      }
      schedulePersist();
    },

    async dataDir() {
      const d = opts.dataDir ?? '/Column-data';
      ensureDir(d);
      return d;
    },
    async pickFiles() {
      const p = nextPick();
      return p === null ? [] : Array.isArray(p) ? p : [p];
    },
    async pickDirectory() {
      const p = nextPick();
      return Array.isArray(p) ? (p[0] ?? null) : p;
    },
    async saveDialog() {
      const p = nextPick();
      return Array.isArray(p) ? (p[0] ?? null) : p;
    },
    async startupFile() {
      return null;
    },
    async openExternal(url) {
      window.open(url, '_blank', 'noopener');
    },
    queuePick(p) {
      picks.push(p);
    },
  };
}
