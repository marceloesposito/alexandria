// i18n minimale: dizionari piatti, fallback inglese, interpolazione {nome}.
import { useSyncExternalStore } from 'react';
import { it } from './it';
import { en } from './en';

export type Lang = 'it' | 'en';
export type Dict = Record<string, string>;

const dicts: Record<Lang, Dict> = { it, en };
let current: Lang = 'it';
const listeners = new Set<() => void>();

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

export function getLang(): Lang {
  return current;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const raw = dicts[current][key] ?? dicts.en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Plurale semplice: chiave.one / chiave.other */
export function tn(key: string, n: number, vars?: Record<string, string | number>): string {
  return t(`${key}.${n === 1 ? 'one' : 'other'}`, { n, ...vars });
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

export function missingKeys(): { lang: Lang; key: string }[] {
  const out: { lang: Lang; key: string }[] = [];
  const all = new Set([...Object.keys(it), ...Object.keys(en)]);
  for (const key of all) {
    if (!(key in it)) out.push({ lang: 'it', key });
    if (!(key in en)) out.push({ lang: 'en', key });
  }
  return out;
}
