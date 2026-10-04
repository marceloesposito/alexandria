// Aggiunge chiavi ai dizionari: node scripts/add-i18n.mjs file.json  ({ "chiave": ["italiano", "english"] })
import { readFileSync, writeFileSync } from 'node:fs';

const add = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const [file, idx] of [
  ['src/i18n/it.ts', 0],
  ['src/i18n/en.ts', 1],
]) {
  let s = readFileSync(file, 'utf8');
  const lines = Object.entries(add)
    .filter(([k]) => !s.includes(`'${k}':`))
    .map(([k, v]) => `  '${k}': ${JSON.stringify(v[idx])},`);
  s = s.replace(/\n};\s*$/, `\n${lines.join('\n')}\n};\n`);
  writeFileSync(file, s);
}
