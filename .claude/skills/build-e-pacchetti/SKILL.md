---
name: build-e-pacchetti
description: Prove dell'interfaccia sul Mac, build, installazione dell'app e pacchetti (installer NSIS, portable, .dmg) di Alexandria. Da usare quando si compila, si installa o si prepara un pacchetto, o si prova l'interfaccia su macOS.
---

# Build e pacchetti di Alexandria

## Sul Mac (niente WebView2)
- Interfaccia provata con `npx vite --port 1430 --strictPort` (la 1420 puo' essere occupata da un vite
  di un vecchio worktree) e
  `CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node scripts/cdp.mjs http://localhost:1430 <script.mjs>`;
  negli script usare `window.__alexandria` (ws, platform, comments...) e `window.__editor`.
- Build: `export PATH="$HOME/.cargo/bin:$PATH" SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk`
  poi `npx tauri build`.
- Installazione ad app chiusa: `ditto` del `.app` in `/Applications` + `lsregister -f`; se il
  committente chiede il .dmg, aprirlo e poi `hdiutil detach /Volumes/Alexandria` a copia finita.

## Pacchetti
- `npx tauri build` (installer NSIS in `src-tauri/target/release/bundle/nsis/`).
- `node scripts/portable.mjs --win src-tauri/target/release/alexandria.exe` (cartella
  `dist-portable/`, con `thesaurus/` accanto all'exe); lo zip per i tester va sul Desktop.
