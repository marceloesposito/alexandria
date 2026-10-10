# Alexandria — contesto per Claude Code

App desktop offline per scrivere paper, articoli e saggi. Specifica completa e
decisioni prese con il committente: `docs/SPEC.md`. Stato e prossimi passi:
`docs/STATO.md` (va aggiornato nello stesso commit in cui lo stato cambia).

## Principi non negoziabili

- **Offline totale e leggera** (< 200 MB installata). Nessun codice remoto,
  nessuna analytics, font inclusi nel pacchetto. La rete si usa solo su azione
  esplicita dell'utente: import di un link, "cerca metadati", push/pull del
  remoto, riproduzione di un video. La CSP sta in `src-tauri/tauri.conf.json`.
- **Il Rust fa solo I/O**: file system, git (libgit2), indice SQLite FTS5, rete,
  Typst. Tutta la logica di dominio sta in `src/` in **funzioni pure testate**
  con vitest (conversione Markdown, conteggi, ancore dei commenti, sommari dei
  diff, filtri dei layer, suggerimenti, citazioni, export).
- **Il Markdown e' la fonte di verita'** del testo: `parse(serialize(doc)) ==
  doc` (test in `src/doc/markdown.test.ts`). Commenti, pin, layer e whiteboard
  vivono in file JSON accanto (`.alexandria/`), mai dentro il .md.
- **Git vero ma nascosto**: il vault e' un repository; l'utente vede commit,
  branch, timeline e merge, mai la riga di comando.

## Comandi

```sh
npm run dev          # interfaccia nel browser con piattaforma in memoria
npm run tauri dev    # app desktop
npm test             # vitest (logica del frontend)
npm run test:rust    # cargo test (git, indice, typst)
npm run build        # tsc + vite build
npm run tauri build  # installer
```

Prima di ogni commit: `npm test`, `npm run build` e `npm run test:rust` verdi.

## Struttura

- `src/platform/` — contratto `Platform` con due implementazioni: `tauri.ts`
  (comandi Rust) e `memory.ts` (file system e git simulati, per il browser e i
  test). Nessun componente chiama `invoke` direttamente.
- `src/doc/` — modello del documento (JSON di ProseMirror) e Markdown.
- `src/commands/` — registro dei comandi: menu, ribbon e scorciatoie usano gli
  stessi id. Il ribbon e' personalizzabile e salvato nello stato dell'app.
- `src/state/` — stato dell'app (`<appData>/state.json`) e del vault.
- `src-tauri/src/` — `fsops.rs`, `git.rs`, `index.rs`, `net.rs`, `typeset.rs`.

## Convenzioni

- Commenti e messaggi di commit in italiano, identificatori in inglese.
  Interfaccia bilingue: ogni stringa visibile passa da `t()` (`src/i18n/`),
  con la chiave presente sia in `it.ts` sia in `en.ts` (un test lo controlla).
- Colori solo dai token di `src/styles/tokens.css` (tema chiaro, scuro, di sistema).
- Nessun `dangerouslySetInnerHTML` con contenuto esterno: le pagine web
  archiviate si mostrano come testo estratto o in iframe `sandbox` senza script.
- Le finestre di test non devono rubare il focus all'utente: interfaccia
  provata con Chrome headless via CDP sul `npm run dev`.
- Su Windows `core.autocrlf` va tenuto spento nei vault (lo fa `git.rs`).
- Script Python su Windows: mai `"\b"` o `'\$1'` in stringhe non raw; per le
  sostituzioni nei file .ts preferire l'Edit diretto.

## Handover (aggiornato al 10 ottobre 2026, main dopo la PR #24)

Se riprendi il progetto adesso leggi prima questa sezione, poi `docs/STATO.md` (tabella delle
milestone e decisioni). Il lavoro si fa sia su Windows sia su un Mac del committente, con sessioni
diverse: **prima di iniziare `git fetch` e controlla PR aperte e rami recenti** (`gh pr list`).

### Dove siamo
- Milestone M0-M12 su `main` (PR #1-#24), CI verde su Windows, macOS e frontend.
- Nessuna release pubblicata, installer non firmati. Versione 0.1.0.
- Sul PC Windows del committente Alexandria e' **installata** (per utente, in
  `%LOCALAPPDATA%\Alexandria`); per aggiornarla si rilancia l'installer con `/S`.

### Nomi tematici (glossario in `src/i18n/glossary.ts`, un test li controlla in ogni lingua)
Compendium (vault), Scroll / **pergamena** in italiano (documento), Scriptorium (editor), Armarium
(risorse, era Bookshelf), Palimpsestus (versioni, era History), Bibliotheca (raccolta comune, era
Library), Marginalia (commenti), Tabula (whiteboard), Excerpta / Excerptum (pin, era Bookmarks),
Strata (layer), Codex (pergamene collegate lette di seguito), Index (indice dei contenuti),
Silentium (scrittura minimale), Recensio (copia per revisione `.recensio`). Gli identificatori
interni non sono cambiati (`resources`, `versions`, `view === 'resources'`...). In inglese i nomi
vanno con la maiuscola (`Scrolls`), altrimenti il test del glossario fallisce.

### Mappa delle funzioni recenti (cartelle di `src/`)
- `codex/` — catena di pergamene da `links.json` (`codexOrder`, `relinkAsChain`), pannello, lettura
  continua (`ReadOnlyDoc`: TipTap in sola lettura con `buildReadOnlyExtensions`), export del Codex.
- `editor/SidePane.tsx` + `paneStore.ts` — riquadri accanto (pergamene, Codex, risorse con
  `resources/viewer/ResourceBody.tsx`).
- `editor/pagination.ts` — vista pagina a fogli: `paginate()` puro + plugin che inserisce widget
  `.page-gap` fra i blocchi. Le righe (`editor/lines.ts`) sono in pixel dello schermo: dentro la
  pagina con lo zoom si dividono per `pageZoom()`.
- `types/` — tipi di oggetto con proprieta' (`.alexandria/types.json`), header della pergamena
  (`editor/DocHeader.tsx`, anche in pagina ed export), Strata come database (`LayerTable`).
- `editor/extensions/track.ts` + `revision/` — revisioni tracciate (`<ins>/<del data-author
  data-date>` nel Markdown), Suggerisci, accetta/rifiuta, andata e ritorno Word (`comments/word.ts`,
  `export/comments.ts`).
- `recensio/` — copia per revisione: zip, modalita' revisore (Compendium temporaneo, testo bloccato
  con `filterTransaction`), ritorno su branch e merge; `review/` risposta ai revisori.
- `vault/append.ts` — Aggiungi da un altro Compendium (`planAppend` puro).
- `versions/forge.ts`, `src-tauri/src/forge.rs` — account sui server git (token nel portachiavi),
  crea repository, elenco repository; `git_clone` + `versions/OpenRemoteDialog.tsx`.
- `citations/fullNote.ts` — fonte per esteso nelle note a pie' di pagina (trascinare una fonte crea
  una nota; Alt = citazione nel testo; preferenza `dropSource`).
- `shell/QuickSwitcher.tsx` (Ctrl+O, `>` comandi), `components/HoverCard.tsx`,
  `components/SideRail.tsx` (colonne richiuse), `shell/WindowControls.tsx` (barra del titolo
  disegnata dall'app su Windows/Linux).
- Cartelle dei Compendium: nuovi con `Pergamene/` (o `Scrolls/`) e `Armarium/` scritti in
  `vault.json` (`dirs`); i vecchi restano `documents/` e `resources/`. Mai percorsi fissi: usare
  `docsDir()`, `resDir()`, `itemDir()`, `docKeyIn()` per Compendium diversi da quello aperto.

### Come si lavora (concordato con il committente)
- Branch + PR per ogni lavoro, merge **solo a CI verde** (anche il job macOS, spesso in coda: se e'
  "cancelled" si rilancia con `gh run rerun <id> --failed`). Le PR create dal Mac possono essere in
  bozza: `gh pr ready <n>` prima del merge. Commit, push e merge senza chiedere conferma.
- Ogni cambiamento d'interfaccia si prova **nell'app vera fuori schermo**:
  `node scripts/app-test.mjs <exe> <script.mjs> <cartella-dati>` (CDP sul WebView2). Se l'app del
  committente e' aperta: compilare in un'altra cartella (`CARGO_TARGET_DIR=<tmp> npx tauri build
  --no-bundle`) e passare `WEBVIEW2_USER_DATA_FOLDER=<tmp>` alla prova, altrimenti il WebView2 si
  aggancia all'istanza aperta. Argomenti all'avvio (es. un `.recensio`): `ALEXANDRIA_TEST_ARGS`.
- Mai rubare il focus al committente (finestre fuori schermo); non chiudere la sua app senza dirlo.
- Pacchetti: `npx tauri build` (installer NSIS in `src-tauri/target/release/bundle/nsis/`),
  `node scripts/portable.mjs --win src-tauri/target/release/alexandria.exe` (cartella
  `dist-portable/`, con `thesaurus/` accanto all'exe); lo zip per i tester va sul Desktop.

### Insidie gia' trovate
- `guard()` in `versions/actions.ts`: i comandi git senza risultato tornano `null`, che `guard` usava
  per l'errore. Per i comandi "void" restituire `true` (`async () => (await f(), true)`).
- Merge di conflitti in CSS/i18n "tenendo entrambe le parti": puo' perdere una graffa (build rotta).
- Heredoc bash e script Python con `\n`, `\s`, `\p`, `\t` su Windows: si corrompono (diventano a
  capo, tabulazioni o backspace); usare Edit o stringhe raw. Controllo: `grep -rlP '\x08' src`.
- Le note dentro le note: le citazioni in una nota passano `inNote` a `ctx.cite` (fonte per esteso,
  mai `#footnote` annidato).

### Aperto / idee annotate (non iniziate)
- Compendium nella Bibliotheca (istantanea in sola lettura, riuso e citazione del proprio lavoro).
- Sincronizzazione senza GitHub (remoto git su chiavetta/NAS, `git bundle` per Dropbox/Syncthing).
- "Accedi con GitHub" (Device Flow) attivo solo con il Client ID di un'OAuth App in
  `src/versions/forge.ts` (oggi vuoto: si usa il token personale).
- Piano di lancio open source (designer per la UI, test di usabilita', licenze: CPAL di citeproc,
  CC BY-SA degli stili CSL, GPL-3 del thesaurus italiano distribuito come file separato).
- In modalita' revisore non si creano paragrafi nuovi (Invio bloccato); la vista pagina non spezza
  un paragrafo fra due fogli (il PDF si').
