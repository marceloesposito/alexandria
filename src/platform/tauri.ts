// Implementazione Tauri: ogni metodo e' un comando Rust (src-tauri/src/*.rs) o un plugin.
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { Platform } from './types';
import { bytesToBase64 } from 'logos/lib/bytes';

const slash = (p: string) => p.replace(/\\/g, '/');

export const tauriPlatform: Platform = {
  kind: 'tauri',
  readText: (path) => invoke('fs_read_text', { path }),
  writeText: (path, text) => invoke('fs_write_text', { path, text }),
  readBytes: async (path) => new Uint8Array(await invoke<ArrayBuffer>('fs_read_bytes', { path })),
  writeBytes: (path, data) => invoke('fs_write_bytes', { path, dataB64: bytesToBase64(data) }),
  exists: (path) => invoke('fs_exists', { path }),
  list: (path) => invoke('fs_list', { path }),
  mkdir: (path) => invoke('fs_mkdir', { path }),
  remove: (path) => invoke('fs_remove', { path }),
  rename: (from, to) => invoke('fs_rename', { from, to }),

  dataDir: () => invoke('data_dir'),
  pickFiles: async (title, extensions) => {
    const filters = extensions?.length ? [{ name: title ?? extensions.join(', '), extensions }] : undefined;
    const r = await open({ directory: false, multiple: true, title, filters });
    if (!r) return [];
    return (Array.isArray(r) ? r : [r]).map((p) => slash(String(p)));
  },
  pickDirectory: async (title) => {
    const r = await open({ directory: true, multiple: false, title });
    return typeof r === 'string' ? slash(r) : null;
  },
  saveDialog: async (defaultName, extensions) => {
    const r = await save({ defaultPath: defaultName, filters: [{ name: extensions.join(', '), extensions }] });
    return r ? slash(r) : null;
  },
  startupFile: () => invoke('startup_file'),
  openExternal: (url) => openUrl(url),
};
