// Prepara la versione portable da copiare su una chiavetta USB:
//   Alexandria-portable/
//     Alexandria.app  (macOS)  e/o  Alexandria.exe (Windows)
//     Alexandria-data/          <- la sua presenza attiva la modalita' portable
//     LEGGIMI.txt / README.txt
// Uso: node scripts/portable.mjs [--mac <Alexandria.app>] [--win <alexandria.exe>] [--out <cartella>]
import { cpSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(' ')
    .split(/\s+(?=--)/)
    .filter(Boolean)
    .map((a) => {
      const [k, ...v] = a.replace(/^--/, '').split(' ');
      return [k, v.join(' ')];
    }),
);

const out = args.out || 'dist-portable/Alexandria-portable';
if (!args.mac && !args.win) {
  console.error('Serve almeno --mac <Alexandria.app> o --win <alexandria.exe>');
  process.exit(1);
}
if (existsSync(out)) rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'Alexandria-data'), { recursive: true });

if (args.mac) cpSync(args.mac, join(out, 'Alexandria.app'), { recursive: true, verbatimSymlinks: true });
if (args.win) {
  cpSync(args.win, join(out, 'Alexandria.exe'));
  // risorse dell'app accanto all'eseguibile (thesaurus con le licenze), come le mette l'installer
  const res = join(dirname(args.win), 'thesaurus');
  if (existsSync(res)) cpSync(res, join(out, 'thesaurus'), { recursive: true });
}

writeFileSync(
  join(out, 'Alexandria-data', 'LEGGIMI.txt'),
  'Questa cartella contiene i dati di Alexandria portable: Compendium, Library, preferenze.\n' +
    'Non rinominarla e tienila accanto all\'app. Copiala per fare un backup.\n',
);

const readme = `Alexandria portable
===================

IT
--
Alexandria gira direttamente da questa cartella, anche da una chiavetta USB.
Tutto quello che scrivi resta in Alexandria-data/, accanto all'app: niente viene salvato sul computer
che stai usando. La cartella Alexandria-data deve restare accanto all'app con questo nome.

- macOS: apri Alexandria.app. La prima volta macOS potrebbe bloccarla perche' non e' firmata:
  clic destro > Apri. Se l'app non trova i tuoi dati (si apre come nuova), togli la quarantena una volta:
      xattr -dr com.apple.quarantine "/Volumes/<chiavetta>/Alexandria-portable/Alexandria.app"
- Windows: apri Alexandria.exe. Serve WebView2, gia' presente su Windows 10 aggiornato e Windows 11.
- Formatta la chiavetta in exFAT per usarla sia su Mac sia su Windows.
- Chiudi Alexandria prima di estrarre la chiavetta.

EN
--
Alexandria runs straight from this folder, even from a USB stick.
Everything you write stays in Alexandria-data/, next to the app: nothing is saved on the computer you
are using. Keep the Alexandria-data folder next to the app, with this name.

- macOS: open Alexandria.app. The first time macOS may block it because it is unsigned:
  right-click > Open. If the app does not find your data (it opens as new), remove the quarantine once:
      xattr -dr com.apple.quarantine "/Volumes/<stick>/Alexandria-portable/Alexandria.app"
- Windows: open Alexandria.exe. It needs WebView2, already present on updated Windows 10 and Windows 11.
- Format the stick as exFAT to use it on both Mac and Windows.
- Quit Alexandria before removing the stick.
`;
writeFileSync(join(out, 'LEGGIMI.txt'), readme);
writeFileSync(join(out, 'README.txt'), readme);
console.log(`Pronto: ${out}`);
