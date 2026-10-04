// Contratto fra interfaccia e sistema. Due implementazioni: Tauri (Rust) e memoria
// (browser, per i test e lo sviluppo dell'interfaccia senza backend).

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  mtime: number;
}

export interface GitCommit {
  sha: string;
  parents: string[];
  message: string;
  author: string;
  time: number; // secondi epoch
  refs: string[]; // branch che puntano qui
}

export interface GitLog {
  head: string | null; // sha
  branch: string | null; // branch corrente
  branches: { name: string; sha: string }[];
  commits: GitCommit[]; // ordine topologico, dal piu' recente
}

export interface FileChange {
  path: string;
  status: 'added' | 'deleted' | 'modified' | 'renamed';
  binary: boolean;
  /** Testo prima/dopo (solo file di testo) */
  before: string | null;
  after: string | null;
}

export interface MergeConflictFile {
  path: string;
  base: string | null;
  ours: string | null;
  theirs: string | null;
  binary: boolean;
}

export interface MergeResult {
  status: 'up-to-date' | 'fast-forward' | 'merged' | 'conflicts';
  conflicts: MergeConflictFile[];
  theirsSha: string;
}

export interface GitStatus {
  dirty: boolean;
  changed: string[];
  merging: boolean;
}

export interface IndexDoc {
  id: string;
  title: string;
  authors: string;
  year: string;
  kind: string;
  tags: string;
  text: string;
}

export interface SearchHit {
  id: string;
  title: string;
  snippet: string;
  score: number;
}

export interface FetchResult {
  status: number;
  url: string;
  contentType: string;
  body: Uint8Array;
}

export interface TypstFile {
  path: string;
  data: Uint8Array;
}

export interface TypstOutput {
  ok: boolean;
  errors: string[];
  pdf?: Uint8Array;
  svgPages?: string[];
}

export interface Platform {
  kind: 'tauri' | 'memory';
  // file system (percorsi assoluti, separatore '/')
  readText(path: string): Promise<string>;
  writeText(path: string, text: string): Promise<void>;
  readBytes(path: string): Promise<Uint8Array>;
  writeBytes(path: string, data: Uint8Array): Promise<void>;
  exists(path: string): Promise<boolean>;
  list(path: string): Promise<DirEntry[]>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  copy(from: string, to: string): Promise<void>;
  /** URL caricabile dall'interfaccia per un file locale (immagini, pdf, video) */
  fileUrl(path: string): string;

  // luoghi
  appDataDir(): Promise<string>;
  documentsDir(): Promise<string>;
  pickDirectory(title?: string): Promise<string | null>;
  pickFiles(title?: string): Promise<string[]>;
  saveDialog(defaultName: string, extensions: string[]): Promise<string | null>;
  openExternal(url: string): Promise<void>;

  // git
  gitInit(repo: string): Promise<void>;
  gitStatus(repo: string): Promise<GitStatus>;
  gitCommit(repo: string, message: string, opts?: { amendCheckpoints?: boolean }): Promise<string | null>;
  gitLog(repo: string): Promise<GitLog>;
  gitChanges(repo: string, sha: string): Promise<FileChange[]>;
  gitCompare(repo: string, fromSha: string, toSha: string): Promise<FileChange[]>;
  gitReadAt(repo: string, sha: string, path: string): Promise<string | null>;
  gitCreateBranch(repo: string, name: string, fromSha?: string): Promise<void>;
  gitCheckout(repo: string, branch: string): Promise<void>;
  gitRestore(repo: string, sha: string): Promise<void>;
  gitMerge(repo: string, branch: string): Promise<MergeResult>;
  gitCompleteMerge(repo: string, resolved: { path: string; content: string | null }[], message: string): Promise<string>;
  gitAbortMerge(repo: string): Promise<void>;
  gitSetRemote(repo: string, url: string, token: string | null): Promise<void>;
  gitRemote(repo: string): Promise<string | null>;
  gitPush(repo: string): Promise<string>;
  gitPull(repo: string): Promise<MergeResult>;

  // indice full-text
  indexUpsert(db: string, docs: IndexDoc[]): Promise<void>;
  indexRemove(db: string, ids: string[]): Promise<void>;
  indexSearch(db: string, query: string, limit?: number): Promise<SearchHit[]>;

  // rete (solo su azione esplicita dell'utente)
  fetchUrl(url: string): Promise<FetchResult>;

  // impaginazione
  typst(source: string, files: TypstFile[], format: 'pdf' | 'svg'): Promise<TypstOutput>;
}
