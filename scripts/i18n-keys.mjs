// Estrae le chiavi i18n usate nel codice: t('...'), tn('...') (plurali .one/.other), label: '...', hint: '...'.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) && !p.includes('i18n')) out.push(p);
  }
  return out;
}

export function usedKeys(root = 'src') {
  const keys = new Set();
  const simple = [/\bt\(\s*'([a-zA-Z][\w.-]*)'/g, /\blabel:\s*'([a-z][\w-]*\.[\w.-]+)'/g, /\bhint:\s*'([a-z][\w-]*\.[\w.-]+)'/g];
  const plural = /\btn\(\s*'([a-zA-Z][\w.-]*)'/g;
  for (const f of walk(root)) {
    const s = readFileSync(f, 'utf8');
    for (const r of simple) for (const m of s.matchAll(r)) keys.add(m[1]);
    for (const m of s.matchAll(plural)) {
      keys.add(m[1] + '.one');
      keys.add(m[1] + '.other');
    }
  }
  return keys;
}

if (process.argv[1].endsWith('i18n-keys.mjs')) {
  console.log([...usedKeys()].sort().join('\n'));
}
