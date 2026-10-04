// Implementazione Tauri: ogni metodo e' un comando Rust (src-tauri/src/*.rs).
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { Platform, FetchResult, TypstOutput } from './types';
import { bytesToBase64, base64ToBytes } from '../lib/bytes';

interface RawFetch {
  status: number;
  url: string;
  contentType: string;
  bodyB64: string;
}

interface RawTypst {
  ok: boolean;
  errors: string[];
  pdfB64?: string;
  svgPages?: string[];
}

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
  copy: (from, to) => invoke('fs_copy', { from, to }),
  fileUrl: (path) => convertFileSrc(path),

  appDataDir: () => invoke('app_data_dir'),
  documentsDir: () => invoke('documents_dir'),
  pickDirectory: async (title) => {
    const r = await open({ directory: true, multiple: false, title });
    return typeof r === 'string' ? r.replace(/\\/g, '/') : null;
  },
  pickFiles: async (title) => {
    const r = await open({ directory: false, multiple: true, title });
    if (!r) return [];
    return (Array.isArray(r) ? r : [r]).map((p) => String(p).replace(/\\/g, '/'));
  },
  saveDialog: async (defaultName, extensions) => {
    const r = await save({ defaultPath: defaultName, filters: [{ name: extensions.join(', '), extensions }] });
    return r ? r.replace(/\\/g, '/') : null;
  },
  openExternal: (url) => openUrl(url),

  gitInit: (repo) => invoke('git_init', { repo }),
  gitStatus: (repo) => invoke('git_status', { repo }),
  gitSetAuthor: (repo, name) => invoke('git_set_author', { repo, name }),
  gitCommit: (repo, message, opts) =>
    invoke('git_commit', { repo, message, amendCheckpoints: opts?.amendCheckpoints ?? false }),
  gitLog: (repo) => invoke('git_log', { repo }),
  gitChanges: (repo, sha) => invoke('git_changes', { repo, sha }),
  gitCompare: (repo, fromSha, toSha) => invoke('git_compare', { repo, fromSha, toSha }),
  gitReadAt: (repo, sha, path) => invoke('git_read_at', { repo, sha, path }),
  gitCreateBranch: (repo, name, fromSha) => invoke('git_create_branch', { repo, name, fromSha: fromSha ?? null }),
  gitCheckout: (repo, branch) => invoke('git_checkout', { repo, branch }),
  gitRestore: (repo, sha) => invoke('git_restore', { repo, sha }),
  gitMerge: (repo, branch) => invoke('git_merge', { repo, branch }),
  gitCompleteMerge: (repo, resolved, message) => invoke('git_complete_merge', { repo, resolved, message }),
  gitAbortMerge: (repo) => invoke('git_abort_merge', { repo }),
  gitSetRemote: (repo, url, token) => invoke('git_set_remote', { repo, url, token }),
  gitRemote: (repo) => invoke('git_remote', { repo }),
  gitPush: (repo) => invoke('git_push', { repo }),
  gitPull: (repo) => invoke('git_pull', { repo }),

  indexUpsert: (db, docs) => invoke('index_upsert', { db, docs }),
  indexRemove: (db, ids) => invoke('index_remove', { db, ids }),
  indexSearch: (db, query, limit) => invoke('index_search', { db, query, limit: limit ?? 50 }),

  fetchUrl: async (url): Promise<FetchResult> => {
    const r = await invoke<RawFetch>('net_fetch', { url });
    return { status: r.status, url: r.url, contentType: r.contentType, body: base64ToBytes(r.bodyB64) };
  },

  typst: async (source, files, format): Promise<TypstOutput> => {
    const r = await invoke<RawTypst>('typst_compile', {
      source,
      files: files.map((f) => ({ path: f.path, dataB64: bytesToBase64(f.data) })),
      format,
    });
    return { ok: r.ok, errors: r.errors, pdf: r.pdfB64 ? base64ToBytes(r.pdfB64) : undefined, svgPages: r.svgPages };
  },
};
