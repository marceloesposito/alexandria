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
