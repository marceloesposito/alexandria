// Contratto fra interfaccia e sistema. Due implementazioni: Tauri (Rust) e memoria (browser, per i
// test e lo sviluppo dell'interfaccia senza backend). In Column solo file, dialoghi e link.

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  mtime: number;
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

  /** cartella dei dati: Column-data accanto all'app (portable) o quella dell'utente */
  dataDir(): Promise<string>;
  /** scelta di file; con `extensions` la finestra propone solo quelli */
  pickFiles(title?: string, extensions?: string[]): Promise<string[]>;
  pickDirectory(title?: string): Promise<string | null>;
  saveDialog(defaultName: string, extensions: string[]): Promise<string | null>;
  /** file passato all'avvio (doppio clic, "Apri con"), una volta sola */
  startupFile(): Promise<string | null>;
  openExternal(url: string): Promise<void>;
}
