---
name: insidie-del-codice
description: Insidie gia' incontrate in parti specifiche di Alexandria - versioni git e guard(), associazioni di file dell'installer, nomi di file che differiscono solo per le maiuscole su macOS, import .docx con mammoth, aggiornare il nucleo logos, citazioni nelle note. Da leggere prima di toccare versions/, tauri.conf.json, doc/import/, citazioni/export, o la dipendenza logos.
---

# Insidie di singole parti del codice

- **Versioni git, `guard()` in `versions/actions.ts`**: i comandi git senza risultato tornano `null`,
  che `guard` usava per l'errore. Per i comandi "void" restituire `true`
  (`async () => (await f(), true)`).
- **Associazioni di file**: su Windows l'installer NSIS diventa il programma predefinito dei formati
  dichiarati. Le associazioni ai documenti (.docx...) stanno solo in `tauri.macos.conf.json` (rango
  Alternate); in `tauri.conf.json` resta solo `.recensio`.
- **Modello NSIS personalizzato** (`src-tauri/windows/installer.nsi`, per la pagina Componenti con le
  lingue di Picus): e' la copia di quello di tauri-cli 2.12.1 con le aggiunte marcate "Alexandria:".
  Aggiornando tauri-cli va riallineato al modello nuovo. Le sezioni di Tauri sono nascoste (`-Install`),
  altrimenti comparirebbero come caselle; una nuova lingua di Picus vuole una `Section` nel gruppo
  "Picus", la preselezione in `.onInit` e la cancellazione in `-PicusCleanup`.
- **macOS non distingue le maiuscole nei nomi di file**: `leftSections.ts` e `LeftSections.tsx` nella
  stessa cartella rompono tsc. Nomi diversi, non solo per maiuscole.
- **mammoth**: la versione per node (test) vuole `buffer`, quella per il browser `arrayBuffer`; si
  passano entrambi. Nei test jsdom `import.meta.url` non e' un file: usare `__dirname`.
- **`logos`**: aspettare la CI della PR anche per un commit che cambia solo la versione, poi merge e
  tag; qui `npm install logos@github:marceloesposito/logos#vX.Y.Z`.
- **Note dentro le note**: le citazioni in una nota passano `inNote` a `ctx.cite` (fonte per esteso,
  mai `#footnote` annidato).
