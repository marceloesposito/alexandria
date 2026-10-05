// Crea un .recensio di prova per la verifica nell'app vera (solo con ALEXANDRIA_MAKE_RECENSIO=<percorso>).
// Con ALEXANDRIA_RECENSIO_BASE=<sha> e ALEXANDRIA_RECENSIO_DOC=<rel> crea una revisione restituita.
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { packRecensio, RECENSIO_FORMAT } from './format';

it.runIf(!!process.env.ALEXANDRIA_MAKE_RECENSIO)('crea un .recensio di prova', async () => {
  const base = process.env.ALEXANDRIA_RECENSIO_BASE ?? null;
  const rel = process.env.ALEXANDRIA_RECENSIO_DOC ?? 'documents/Capitolo di prova.md';
  const text = base
    ? 'La memoria collettiva è <del data-author="Prof. Rossi" data-date="2026-10-05">sempre</del><ins data-author="Prof. Rossi" data-date="2026-10-05">spesso</ins> un fatto sociale.\n'
    : '# Capitolo di prova\n\nLa memoria collettiva è sempre un fatto sociale.\n';
  const bytes = await packRecensio({
    manifest: {
      format: RECENSIO_FORMAT,
      version: 1,
      title: 'Capitolo di prova',
      author: 'Autrice',
      compendium: base ? 'Il mio Compendium' : 'Prova',
      created: '2026-10-05T10:00:00Z',
      baseSha: base,
      docs: [{ rel, title: 'Capitolo di prova' }],
      ...(base ? { reviewer: { name: 'Prof. Rossi' }, returned: '2026-10-06T09:00:00Z' } : {}),
    },
    texts: { [rel]: text },
    comments: base
      ? { [rel]: { version: 1, comments: [{ id: 'cR1', author: 'Prof. Rossi', body: 'Serve una fonte qui.', created: '2026-10-06T09:00:00Z', anchor: null, offsetX: null, offsetY: null, resolved: false, status: 'open', origin: { kind: 'reviewer', name: 'Prof. Rossi' }, commits: [], replies: [] }] } }
      : {},
    sources: {},
  });
  writeFileSync(process.env.ALEXANDRIA_MAKE_RECENSIO!, bytes);
});
