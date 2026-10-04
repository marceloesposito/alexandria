// Sceglie l'implementazione: Tauri se l'app gira nel guscio desktop, memoria altrimenti.
import type { Platform } from './types';
import { createMemoryPlatform } from './memory';
import { tauriPlatform } from './tauri';

export * from './types';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const platform: Platform = isTauri ? tauriPlatform : createMemoryPlatform({ persist: true });

export function joinPath(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .join('/')
    .replace(/\\/g, '/')
    .replace(/(?<!:)\/+/g, '/');
}

export function baseName(p: string): string {
  const s = p.replace(/\\/g, '/');
  return s.slice(s.lastIndexOf('/') + 1);
}

export function dirName(p: string): string {
  const s = p.replace(/\\/g, '/');
  const i = s.lastIndexOf('/');
  return i <= 0 ? '/' : s.slice(0, i);
}

export function extName(p: string): string {
  const b = baseName(p);
  const i = b.lastIndexOf('.');
  return i <= 0 ? '' : b.slice(i + 1).toLowerCase();
}

export function stripExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i <= 0 ? name : name.slice(0, i);
}
