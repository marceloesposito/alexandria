// Implementazione in memoria: file system e git simulati, per il browser e i test.
// La semantica del git simulato rispecchia quella dei comandi Rust (src-tauri/src/git.rs).
import type {
  Platform,
  DirEntry,
  GitCommit,
  GitLog,
  FileChange,
  MergeResult,
  IndexDoc,
  SearchHit,
} from './types';
import { utf8, toUtf8, bytesToBase64, base64ToBytes } from '../lib/bytes';
import { findBlock } from '../thesaurus/model';

type FileData = Uint8Array;

interface MemCommit {
  sha: string;
  parents: string[];
  message: string;
  time: number;
  tree: Map<string, FileData>;
  author?: string;
}

interface MemRepo {
  commits: Map<string, MemCommit>;
  branches: Map<string, string>;
  head: string; // nome del branch
  merging: { theirs: string } | null;
  remote: string | null;
  author?: string;
}


const PERSIST_KEY = 'alexandria.memfs.v1';
const IGNORED = ['/.git/', '/.alexandria-cache/'];

function norm(p: string): string {
  let s = p.replace(/\\/g, '/').replace(/\/+/g, '/');
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

function parent(p: string): string {
  const i = p.lastIndexOf('/');
  return i <= 0 ? '/' : p.slice(0, i);
}

function same(a: FileData | undefined, b: FileData | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function isText(d: FileData | undefined): boolean {
  if (!d) return true;
  const n = Math.min(d.length, 8000);
  for (let i = 0; i < n; i++) if (d[i] === 0) return false;
  return true;
}

let shaCounter = 0;
function fakeSha(): string {
  shaCounter += 1;
  const rnd = Math.random().toString(16).slice(2, 10);
  return (Date.now().toString(16) + rnd + shaCounter.toString(16)).padEnd(40, '0').slice(0, 40);
}

// thesaurus nel browser: file compresso delle risorse, letto una volta per lingua
const thesaurusText: Partial<Record<'it' | 'en', Promise<string>>> = {};

async function loadThesaurus(lang: 'it' | 'en'): Promise<string> {
  const res = await fetch(`/src-tauri/resources/thesaurus/th_${lang}.dat.gz`);
  if (!res.ok) throw new Error(`thesaurus ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  // il server di sviluppo lo manda con Content-Encoding: gzip e il browser lo ha gia' decompresso
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return new TextDecoder().decode(bytes);
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

export function createMemoryPlatform(opts: { persist?: boolean } = {}): Platform {
  const files = new Map<string, FileData>();
  const dirs = new Set<string>(['/']);
  const mtimes = new Map<string, number>();
  const repos = new Map<string, MemRepo>();
  const indexes = new Map<string, Map<string, IndexDoc>>();

  // --- persistenza opzionale in localStorage (solo per lo sviluppo nel browser)
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
    }, 300);
  }

  function ensureDir(p: string) {
    let cur = norm(p);
    const toAdd: string[] = [];
    while (cur && !dirs.has(cur)) {
      toAdd.push(cur);
      cur = parent(cur);
    }
    toAdd.forEach((d) => dirs.add(d));
  }

  function write(path: string, data: FileData) {
    const p = norm(path);
    ensureDir(parent(p));
    files.set(p, data);
    mtimes.set(p, Date.now());
    schedulePersist();
  }

  function read(path: string): FileData {
    const d = files.get(norm(path));
    if (!d) throw new Error(`File non trovato: ${path}`);
    return d;
  }

  // --- git simulato
  function repoOf(path: string): MemRepo {
    const r = repos.get(norm(path));
    if (!r) throw new Error('Non e\' un repository');
    return r;
  }

  function workTree(repo: string): Map<string, FileData> {
    const root = norm(repo) + '/';
    const out = new Map<string, FileData>();
    for (const [p, d] of files) {
      if (!p.startsWith(root)) continue;
      const rel = p.slice(root.length);
      if (IGNORED.some((ig) => ('/' + rel).startsWith(ig))) continue;
      out.set(rel, d);
    }
    return out;
  }

  function setWorkTree(repo: string, tree: Map<string, FileData>) {
    const root = norm(repo) + '/';
    for (const rel of workTree(repo).keys()) files.delete(root + rel);
    for (const [rel, d] of tree) write(root + rel, d);
    schedulePersist();
  }

  function headSha(r: MemRepo): string | null {
    return r.branches.get(r.head) ?? null;
  }

  function treeEq(a: Map<string, FileData>, b: Map<string, FileData>): boolean {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) if (!same(v, b.get(k))) return false;
    return true;
  }

  function ancestors(r: MemRepo, sha: string): Set<string> {
    const seen = new Set<string>();
    const stack = [sha];
    while (stack.length) {
      const s = stack.pop()!;
      if (seen.has(s)) continue;
      seen.add(s);
      r.commits.get(s)?.parents.forEach((p) => stack.push(p));
    }
    return seen;
  }

  function mergeBase(r: MemRepo, a: string, b: string): string | null {
    const aa = ancestors(r, a);
    // BFS da b: il primo antenato comune
    const queue = [b];
    const seen = new Set<string>();
    while (queue.length) {
      const s = queue.shift()!;
      if (seen.has(s)) continue;
      seen.add(s);
      if (aa.has(s)) return s;
      r.commits.get(s)?.parents.forEach((p) => queue.push(p));
    }
    return null;
  }

  function diffTrees(a: Map<string, FileData>, b: Map<string, FileData>): FileChange[] {
    const out: FileChange[] = [];
    const paths = new Set([...a.keys(), ...b.keys()]);
    for (const p of [...paths].sort()) {
      const x = a.get(p);
      const y = b.get(p);
      if (same(x, y)) continue;
      const binary = !isText(x) || !isText(y);
      out.push({
        path: p,
        status: !x ? 'added' : !y ? 'deleted' : 'modified',
        binary,
        before: x && !binary ? utf8(x) : null,
        after: y && !binary ? utf8(y) : null,
      });
    }
    return out;
  }

  function commitTree(r: MemRepo, sha: string | null): Map<string, FileData> {
    return sha ? new Map(r.commits.get(sha)!.tree) : new Map();
  }

  function doMerge(repo: string, r: MemRepo, theirsSha: string): MergeResult {
    const ours = headSha(r);
    if (!ours) {
      r.branches.set(r.head, theirsSha);
      setWorkTree(repo, commitTree(r, theirsSha));
      return { status: 'fast-forward', conflicts: [], theirsSha };
    }
    if (ancestors(r, ours).has(theirsSha)) return { status: 'up-to-date', conflicts: [], theirsSha };
    if (ancestors(r, theirsSha).has(ours)) {
      r.branches.set(r.head, theirsSha);
      setWorkTree(repo, commitTree(r, theirsSha));
      return { status: 'fast-forward', conflicts: [], theirsSha };
    }
    const base = commitTree(r, mergeBase(r, ours, theirsSha));
    const o = commitTree(r, ours);
    const t = commitTree(r, theirsSha);
    const result = new Map<string, FileData>();
    const conflicts: MergeResult['conflicts'] = [];
    for (const p of new Set([...base.keys(), ...o.keys(), ...t.keys()])) {
      const b = base.get(p);
      const x = o.get(p);
      const y = t.get(p);
      if (same(x, y)) {
        if (x) result.set(p, x);
      } else if (same(b, x)) {
        if (y) result.set(p, y);
      } else if (same(b, y)) {
        if (x) result.set(p, x);
      } else {
        const binary = !isText(b) || !isText(x) || !isText(y);
        conflicts.push({
          path: p,
          base: b && !binary ? utf8(b) : null,
          ours: x && !binary ? utf8(x) : null,
          theirs: y && !binary ? utf8(y) : null,
          binary,
        });
        if (x) result.set(p, x);
      }
    }
    setWorkTree(repo, result);
    if (conflicts.length) {
      r.merging = { theirs: theirsSha };
      return { status: 'conflicts', conflicts, theirsSha };
    }
    const sha = fakeSha();
    r.commits.set(sha, { sha, parents: [ours, theirsSha], message: 'Merge', time: Date.now() / 1000, tree: result, author: r.author });
    r.branches.set(r.head, sha);
    return { status: 'merged', conflicts: [], theirsSha };
  }

  const platform: Platform = {
    kind: 'memory',
    async readText(path) {
      return utf8(read(path));
    },
    async writeText(path, text) {
      write(path, toUtf8(text));
    },
    async readBytes(path) {
      return read(path);
    },
    async writeBytes(path, data) {
      write(path, data);
    },
    async exists(path) {
      const p = norm(path);
      return files.has(p) || dirs.has(p);
    },
    async list(path) {
      const root = norm(path);
      const prefix = root === '/' ? '/' : root + '/';
      const out = new Map<string, DirEntry>();
      for (const d of dirs) {
        if (d !== root && d.startsWith(prefix) && !d.slice(prefix.length).includes('/')) {
          out.set(d, { name: d.slice(prefix.length), path: d, isDir: true, size: 0, mtime: 0 });
        }
      }
      for (const [p, data] of files) {
        if (p.startsWith(prefix) && !p.slice(prefix.length).includes('/')) {
          out.set(p, { name: p.slice(prefix.length), path: p, isDir: false, size: data.length, mtime: mtimes.get(p) ?? 0 });
        }
      }
      return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
    async mkdir(path) {
      ensureDir(path);
      schedulePersist();
    },
    async remove(path) {
      const p = norm(path);
      files.delete(p);
      for (const f of [...files.keys()]) if (f.startsWith(p + '/')) files.delete(f);
      for (const d of [...dirs]) if (d === p || d.startsWith(p + '/')) dirs.delete(d);
      schedulePersist();
    },
    async rename(from, to) {
      const a = norm(from);
      const b = norm(to);
      if (files.has(a)) {
        write(b, files.get(a)!);
        files.delete(a);
      } else {
        for (const [f, d] of [...files]) {
          if (f.startsWith(a + '/')) {
            write(b + f.slice(a.length), d);
            files.delete(f);
          }
        }
        for (const d of [...dirs]) if (d === a || d.startsWith(a + '/')) {
          dirs.delete(d);
          dirs.add(b + d.slice(a.length));
        }
      }
      schedulePersist();
    },
    async copy(from, to) {
      write(to, read(from));
    },
    fileUrl(path) {
      const d = files.get(norm(path));
      if (!d) return '';
      return URL.createObjectURL(new Blob([d as BlobPart]));
    },

    async readClipboard() {
      return null;
    },
    async portableRoot() {
      return null;
    },
    async appDataDir() {
      return '/appdata';
    },
    async documentsDir() {
      return '/documents';
    },
    async pickDirectory(title) {
      const { promptDialog } = await import('../components/confirm');
      return promptDialog(title ?? 'Cartella', '/documents/Vault');
    },
    async pickFiles() {
      return [];
    },
    async saveDialog(defaultName) {
      return '/documents/' + defaultName;
    },
    async openPath(path) {
      const u = platform.fileUrl(path);
      if (u) window.open(u, '_blank', 'noreferrer');
    },
    async openExternal(url) {
      window.open(url, '_blank', 'noreferrer');
    },

    async gitInit(repo) {
      if (repos.has(norm(repo))) return;
      repos.set(norm(repo), { commits: new Map(), branches: new Map(), head: 'main', merging: null, remote: null });
      ensureDir(repo + '/.git');
    },
    async gitSetAuthor(repo, name) {
      repoOf(repo).author = name.trim() || undefined;
    },
    async gitStatus(repo) {
      const r = repoOf(repo);
      const changes = diffTrees(commitTree(r, headSha(r)), workTree(repo));
      return { dirty: changes.length > 0, changed: changes.map((c) => c.path), merging: !!r.merging };
    },
    async gitCommit(repo, message, opts) {
      const r = repoOf(repo);
      const tree = workTree(repo);
      let parentSha = headSha(r);
      if (opts?.amendCheckpoints) {
        // assorbe i checkpoint consecutivi in cima al branch
        while (parentSha) {
          const c = r.commits.get(parentSha)!;
          if (!c.message.startsWith('checkpoint:') || c.parents.length !== 1) break;
          parentSha = c.parents[0] ?? null;
        }
      }
      const parentTree = commitTree(r, parentSha);
      if (!r.merging && parentSha === headSha(r) && treeEq(parentTree, tree)) return null;
      const sha = fakeSha();
      const parents = parentSha ? [parentSha] : [];
      if (r.merging) parents.push(r.merging.theirs);
      r.commits.set(sha, { sha, parents, message, time: Date.now() / 1000, tree: new Map(tree), author: r.author });
      r.branches.set(r.head, sha);
      r.merging = null;
      return sha;
    },
    async gitLog(repo): Promise<GitLog> {
      const r = repoOf(repo);
      const refs = new Map<string, string[]>();
      for (const [name, sha] of r.branches) refs.set(sha, [...(refs.get(sha) ?? []), name]);
      const reachable = new Set<string>();
      for (const sha of r.branches.values()) ancestors(r, sha).forEach((s) => reachable.add(s));
      const commits: GitCommit[] = [...r.commits.values()]
        .filter((c) => reachable.has(c.sha))
        .sort((a, b) => b.time - a.time)
        .map((c) => ({
          sha: c.sha,
          parents: c.parents,
          message: c.message,
          author: c.author || 'Alexandria',
          time: Math.floor(c.time),
          refs: refs.get(c.sha) ?? [],
        }));
      return {
        head: headSha(r),
        branch: r.head,
        branches: [...r.branches].map(([name, sha]) => ({ name, sha })),
        commits,
      };
    },
    async gitChanges(repo, sha) {
      const r = repoOf(repo);
      const c = r.commits.get(sha);
      if (!c) return [];
      return diffTrees(commitTree(r, c.parents[0] ?? null), c.tree);
    },
    async gitCompare(repo, fromSha, toSha) {
      const r = repoOf(repo);
      return diffTrees(commitTree(r, fromSha), toSha === 'WORKTREE' ? workTree(repo) : commitTree(r, toSha));
    },
    async gitReadAt(repo, sha, path) {
      const r = repoOf(repo);
      const d = r.commits.get(sha)?.tree.get(path);
      return d ? utf8(d) : null;
    },
    async gitCreateBranch(repo, name, fromSha) {
      const r = repoOf(repo);
      if (r.branches.has(name)) throw new Error(`Il branch ${name} esiste gia'`);
      const sha = fromSha ?? headSha(r);
      if (!sha) throw new Error('Serve almeno un commit');
      r.branches.set(name, sha);
    },
    async gitCheckout(repo, branch) {
      const r = repoOf(repo);
      const sha = r.branches.get(branch);
      if (!sha) throw new Error(`Branch ${branch} inesistente`);
      r.head = branch;
      setWorkTree(repo, commitTree(r, sha));
    },
    async gitRestore(repo, sha) {
      const r = repoOf(repo);
      setWorkTree(repo, commitTree(r, sha));
    },
    async gitMerge(repo, branch) {
      const r = repoOf(repo);
      const theirs = r.branches.get(branch);
      if (!theirs) throw new Error(`Branch ${branch} inesistente`);
      return doMerge(repo, r, theirs);
    },
    async gitCompleteMerge(repo, resolved, message) {
      const r = repoOf(repo);
      const root = norm(repo) + '/';
      for (const f of resolved) {
        if (f.content === null) files.delete(root + f.path);
        else write(root + f.path, toUtf8(f.content));
      }
      const sha = await platform.gitCommit(repo, message);
      return sha ?? headSha(r)!;
    },
    async gitAbortMerge(repo) {
      const r = repoOf(repo);
      r.merging = null;
      setWorkTree(repo, commitTree(r, headSha(r)));
    },
    async gitSetRemote(repo, url) {
      repoOf(repo).remote = url;
    },
    async gitRemote(repo) {
      return repoOf(repo).remote;
    },
    async gitPush() {
      throw new Error('Remoto non disponibile nella versione browser');
    },
    async gitPull() {
      throw new Error('Remoto non disponibile nella versione browser');
    },
    async startupFile() {
      return null;
    },
    async onOpenFile() {
      return () => undefined;
    },
    async forgeAccount() {
      return null;
    },
    async forgeLogout() {},
    async forgeSetToken() {
      throw new Error('Account non disponibili nella versione browser');
    },
    async forgeDeviceStart() {
      throw new Error('Account non disponibili nella versione browser');
    },
    async forgeDevicePoll() {
      return 'pending';
    },
    async forgeCreateRepo() {
      throw new Error('Account non disponibili nella versione browser');
    },

    async indexUpsert(db, docs) {
      const m = indexes.get(db) ?? new Map();
      docs.forEach((d) => m.set(d.id, d));
      indexes.set(db, m);
    },
    async indexRemove(db, ids) {
      ids.forEach((id) => indexes.get(db)?.delete(id));
    },
    async indexSearch(db, query, limit = 50): Promise<SearchHit[]> {
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      const out: SearchHit[] = [];
      for (const d of indexes.get(db)?.values() ?? []) {
        const hay = `${d.title} ${d.authors} ${d.tags} ${d.text}`.toLowerCase();
        let score = 0;
        for (const t of terms) {
          const n = hay.split(t).length - 1;
          if (n === 0) {
            score = 0;
            break;
          }
          score += n + (d.title.toLowerCase().includes(t) ? 5 : 0);
        }
        if (score > 0) {
          const i = d.text.toLowerCase().indexOf(terms[0]);
          out.push({ id: d.id, title: d.title, score, snippet: i >= 0 ? d.text.slice(Math.max(0, i - 40), i + 80) : '' });
        }
      }
      return out.sort((a, b) => b.score - a.score).slice(0, limit);
    },

    async fetchUrl(url, accept) {
      const res = await fetch(url, accept ? { headers: { Accept: accept } } : undefined);
      return {
        status: res.status,
        url: res.url,
        contentType: res.headers.get('content-type') ?? '',
        body: new Uint8Array(await res.arrayBuffer()),
      };
    },
    async snapshotUrl() {
      return null; // solo nell'app desktop
    },
    async renderPage() {
      return null; // solo nell'app desktop
    },
    async thesaurus(lang, word) {
      // nel browser di sviluppo i dati arrivano dal server di Vite (stessi file delle risorse dell'app)
      try {
        const text = await (thesaurusText[lang] ??= loadThesaurus(lang));
        return findBlock(text, word);
      } catch {
        return null;
      }
    },
    async typst() {
      return { ok: false, errors: ['Typst is available only in the desktop app.'] };
    },
  };
  return platform;
}
