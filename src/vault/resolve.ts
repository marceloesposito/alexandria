// Percorsi delle immagini nel Markdown: relativi al file del documento, come in ogni editor Markdown.
import { platform, joinPath } from '../platform';

export function normalizePath(p: string): string {
  const isAbs = p.startsWith('/');
  const drive = /^[A-Za-z]:/.exec(p)?.[0] ?? '';
  const rest = drive ? p.slice(drive.length) : p;
  const out: string[] = [];
  for (const part of rest.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return (drive ? drive + '/' : isAbs ? '/' : '') + out.join('/');
}

/** Percorso assoluto di un'immagine citata da un documento del vault. */
export function resolveDocPath(src: string, vaultRoot: string, docRel: string): string {
  const docDir = docRel.includes('/') ? docRel.slice(0, docRel.lastIndexOf('/')) : '';
  return normalizePath(joinPath(vaultRoot, docDir, decodeURI(src)));
}

export function assetUrl(src: string, vaultRoot: string | null, docRel: string | null): string {
  if (!src) return '';
  if (/^(https?:|data:|blob:|asset:)/i.test(src)) return src;
  if (!vaultRoot || !docRel) return src;
  return platform.fileUrl(resolveDocPath(src, vaultRoot, docRel));
}

/** Percorso relativo da un documento a un file del vault (per scrivere ![](...) nel Markdown). */
export function relativeFromDoc(docRel: string, targetRel: string): string {
  const from = docRel.split('/').slice(0, -1);
  const to = targetRel.split('/');
  let i = 0;
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i++;
  const up = from.length - i;
  return [...Array(up).fill('..'), ...to.slice(i)].join('/');
}
