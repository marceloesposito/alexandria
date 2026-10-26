# Alexandria — contesto per Claude Code

App desktop offline per scrivere paper, articoli e saggi. Specifica completa e
decisioni prese con il committente: `docs/SPEC.md`. Stato e prossimi passi:
`docs/STATO.md` (va aggiornato nello stesso commit in cui lo stato cambia).
Column (prima Folium), l'app sorella portable, vive dal 26/10/2026 nella repo `marceloesposito/column`
(il ramo `column` qui e' congelato).

## Principi non negoziabili

- **Offline totale e leggera** (< 200 MB installata). Nessun codice remoto,
  nessuna analytics, font inclusi nel pacchetto. La rete si usa solo su azione
  esplicita dell'utente: import di un link, "cerca metadati", push/pull del
  remoto, riproduzione di un video. La CSP sta in `src-tauri/tauri.conf.json`.
- **Dentro l'app nessun servizio americano** (decisione del committente, 12/10/2026) e, dal
  15/10/2026, **nessun server git di terzi**: il remoto e' solo una cartella (chiavetta, NAS,
  cartella sincronizzata). Codeberg e' stato tolto perche' i suoi termini non ammettono testi
  personali privati e possono rimuoverli; le alternative sono in valutazione (`docs/STATO.md`).
  `remote_allowed` in `git.rs` e `remoteAllowed` in `versions/remote.ts` lo impongono. Lo
  *sviluppo* invece resta su GitHub (repo, PR, CI).
- **Il Rust fa solo I/O**: file system, git (libgit2), indice SQLite FTS5, rete,
  Typst. Tutta la logica di dominio sta in **funzioni pure testate** con vitest
  (conversione Markdown, conteggi, ancore dei commenti, sommari dei diff, filtri
  dei layer, suggerimenti, citazioni, export). Quelle condivise con Simposium
  stanno nel nucleo **`logos`** (repo `marceloesposito/logos`, MIT), importato
  come `logos/doc/parse` ecc. dalla dipendenza git con tag.
- **Il Markdown e' la fonte di verita'** del testo: `parse(serialize(doc)) ==
  doc` (test in `logos`, `src/doc/markdown.test.ts`). Commenti, pin, layer e whiteboard
  vivono in file JSON accanto (`.alexandria/`), mai dentro il .md.
- **Git vero ma nascosto**: il vault e' un repository; l'utente vede commit,
  branch, timeline e merge, mai la riga di comando.

## Comandi

Prima di ogni commit: `npm test`, `npm run build` e `npm run test:rust` verdi.

## Struttura

- `src/platform/` — contratto `Platform` con due implementazioni: `tauri.ts`
  (comandi Rust) e `memory.ts` (file system e git simulati, per il browser e i
  test). Nessun componente chiama `invoke` direttamente.
- `logos` (in `node_modules/logos/src/`) — nucleo puro condiviso: `doc/`
  (Markdown), `citations/`, `export/`, `comments/model`, `resources/model` e
  Tabula, `layout/model`, `types/model`, `versions/merge`, `commands/shortcuts`.
  Per cambiarlo: PR su `logos`, nuovo tag, poi `npm install
  logos@github:marceloesposito/logos#vX.Y.Z` qui. In locale si puo' provare
  con `npm link ../logos`.
- `src/commands/` — registro dei comandi: menu, ribbon e scorciatoie usano gli
  stessi id. Il ribbon e' personalizzabile e salvato nello stato dell'app.

## Convenzioni

- Commenti e messaggi di commit in italiano, identificatori in inglese.
  Interfaccia bilingue: ogni stringa visibile passa da `t()` (`src/i18n/`),
  con la chiave presente sia in `it.ts` sia in `en.ts` (un test lo controlla).
- Colori solo dai token di `src/styles/tokens.css` (tema chiaro, scuro, di sistema).
- Nessun `dangerouslySetInnerHTML` con contenuto esterno: le pagine web
  archiviate si mostrano come testo estratto o in iframe `sandbox` senza script.
- Su Windows `core.autocrlf` va tenuto spento nei vault (lo fa `git.rs`).

## Handover (aggiornato al 13 ottobre 2026, main dopo la PR #40, logos v0.2.1)

Se riprendi il progetto adesso leggi prima questa sezione, poi `docs/STATO.md` (tabella delle
milestone e decisioni). Il lavoro si fa sia su Windows sia su un Mac del committente, con sessioni
diverse: **prima di iniziare `git fetch` e controlla PR aperte e rami recenti** (`gh pr list`).

### Dove siamo
- Milestone M0-M12 su `main` (PR #1-#24), poi PR #25-#40; CI verde su Windows, macOS e frontend.
- Nessuna release pubblicata, installer non firmati. Versione 0.2.0 (tag `v0.2.0`); storia delle versioni in `CHANGELOG.md` (va aggiornata con ogni PR).
- Sul PC Windows del committente Alexandria e' **installata** (per utente, in
  `%LOCALAPPDATA%\Alexandria`); per aggiornarla si rilancia l'installer con `/S`.
- Sul Mac del committente e' **installata** in `/Applications/Alexandria.app` (build del 13/10 con
  tutto il lavoro di quel giorno; cronologia in `CHANGELOG.md`).

### Nomi tematici
Nell'interfaccia gli ambienti hanno nomi latini fissi (Compendium = vault, pergamena/Scroll =
documento, Armarium = risorse, Palimpsestus = versioni...), uguali in ogni lingua; gli
identificatori interni restano inglesi. Elenco completo e regole: skill `glossario`
(`src/i18n/glossary.ts`, un test li controlla).

### Due cose che il codice non dice da solo
- Le righe dell'editor (`editor/lines.ts`) sono in pixel dello schermo: dentro la pagina con lo zoom
  si dividono per `pageZoom()`.
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
- Mai rubare il focus al committente: interfaccia provata con Chrome headless via CDP sul
  `npm run dev`, app vera fuori schermo; non chiudere la sua app senza dirlo.
- Prove sul Mac, build, installazione e pacchetti (installer, portable, .dmg): skill
  `build-e-pacchetti`.

### Insidie gia' trovate
- Merge di conflitti in CSS/i18n "tenendo entrambe le parti": puo' perdere una graffa (build rotta).
- Heredoc bash e script Python su Windows: `\n`, `\s`, `\p`, `\t`, `"\b"`, `'\$1'` in stringhe non
  raw si corrompono (a capo, tabulazioni, backspace); usare Edit o stringhe raw. Controllo:
  `grep -rlP '\x08' src`.
- Vite in sviluppo: dopo un aggiornamento a caldo `import('/src/...')` da CDP restituisce un'altra
  istanza degli store (URL con `?t=`); riavviare vite o usare `window.__alexandria`. Al primo avvio
  con dipendenze nuove la pagina si ricarica da sola: rilanciare la prova.
- Insidie di singole parti (git e `guard()`, associazioni di file, nomi che differiscono solo per le
  maiuscole, mammoth, `logos`, note nelle note): skill `insidie-del-codice`.

Idee annotate e limiti noti: `docs/STATO.md`, sezione "Prossimi passi possibili".
