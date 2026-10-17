// Folium portable sul Desktop, in una sola mossa:
//   1. interfaccia (vite build), 2. Rust col profilo `fast` (o --release), 3. cartella
//      ~/Desktop/Folium-portable/  con Folium.exe (Windows) o Folium.app (macOS) e Folium-data/.
// I dati gia' presenti in Folium-data/ restano: si sostituisce solo l'app. Stampa pesi e tempi.
// Uso: npm run folium:portable [-- --release] [-- --skip-web] [-- --out <cartella>]
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : null);
const release = flag('--release');
const profile = release ? 'release' : 'fast';
const mac = process.platform === 'darwin';
const win = process.platform === 'win32';
const t0 = Date.now();
const step = (what, cmd, env = {}) => {
  const s = Date.now();
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } });
  console.log(`  ${what}: ${((Date.now() - s) / 1000).toFixed(1)} s`);
};

const desktop = [join(homedir(), 'Desktop'), join(homedir(), 'OneDrive', 'Desktop')].find((d) => existsSync(d)) ?? homedir();
const out = opt('--out') ?? join(desktop, 'Folium-portable');
const target = join('src-tauri', 'target-folium');

if (!flag('--skip-web')) step('interfaccia', 'npm run build');
step(`Rust (${profile})`, `cargo build --manifest-path src-tauri/Cargo.toml --profile ${profile} --features tauri/custom-protocol`, { CARGO_TARGET_DIR: target });

const exe = join(target, profile, win ? 'folium.exe' : 'folium');
mkdirSync(join(out, 'Folium-data'), { recursive: true });

if (mac) {
  // pacchetto .app minimo: eseguibile, icona, Info.plist
  const app = join(out, 'Folium.app');
  rmSync(app, { recursive: true, force: true });
  mkdirSync(join(app, 'Contents', 'MacOS'), { recursive: true });
  mkdirSync(join(app, 'Contents', 'Resources'), { recursive: true });
  cpSync(exe, join(app, 'Contents', 'MacOS', 'folium'));
  cpSync(join('src-tauri', 'icons', 'icon.icns'), join(app, 'Contents', 'Resources', 'icon.icns'));
  const version = JSON.parse(execSync('node -p "JSON.stringify(require(\'./package.json\').version)"').toString());
  writeFileSync(
    join(app, 'Contents', 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Folium</string>
<key>CFBundleDisplayName</key><string>Folium</string>
<key>CFBundleIdentifier</key><string>app.folium</string>
<key>CFBundleExecutable</key><string>folium</string>
<key>CFBundleIconFile</key><string>icon.icns</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>${version}</string>
<key>LSMinimumSystemVersion</key><string>10.15</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
`,
  );
  execSync(`xattr -cr "${app}"`);
} else {
  cpSync(exe, join(out, win ? 'Folium.exe' : 'Folium'));
}

writeFileSync(
  join(out, 'LEGGIMI.txt'),
  `Folium portable
===============

Folium gira da questa cartella, anche da una chiavetta USB. I fogli in lavorazione e le preferenze
restano in Folium-data/, accanto all'app: tienila li' con questo nome.

- Windows: apri Folium.exe (serve WebView2, gia' presente su Windows 10 aggiornato e Windows 11).
- macOS: apri Folium.app; la prima volta, se macOS la blocca: clic destro > Apri.

Folium runs from this folder, even from a USB stick. Sheets in progress and preferences stay in
Folium-data/, next to the app: keep it there with this name.
`,
);

const size = (p) => {
  const s = statSync(p);
  return s.isDirectory() ? readdirSync(p).reduce((a, n) => a + size(join(p, n)), 0) : s.size;
};
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
// la cartella si misura senza i dati dell'utente
const appSize = size(exe);
const folder = readdirSync(out)
  .filter((n) => n !== 'Folium-data')
  .reduce((a, n) => a + size(join(out, n)), 0);
console.log(`\nFolium pronto in ${out}`);
console.log(`  eseguibile: ${mb(appSize)}   cartella (senza i dati): ${mb(folder)}   tempo totale: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
