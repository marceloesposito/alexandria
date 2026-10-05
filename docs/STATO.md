# Stato dei lavori

Aggiornato: 5 ottobre 2026.

| Milestone | Stato | PR |
| --- | --- | --- |
| M0 Setup: scaffold Tauri 2 + React, backend Rust (file, git, indice FTS5, rete, Typst), Markdown | fatto | iniziale |
| M1–M3 Guscio (menu, navbar, ribbon personalizzabile), vault, editor a blocchi, numeri di riga | fatto | #1 |
| M4 Commenti a margine (fumetto, collegamento a parole, bolle trascinabili, orfani) | fatto | #2 |
| M5 Version control (timeline, diff, merge manuale, checkpoint, remoto) | fatto | #3 |
| M6–M7 Risorse, Library, whiteboard, grafo, layer, pin, citazioni CSL, bibliografia | fatto | #4 |
| M8 Export (PDF Typst, DOCX, HTML, MD, TXT, LaTeX), anteprima, Layout, indice | fatto | #5 |
| M9 Rifiniture: icona, digitazione e incolla in Markdown, prova dell'app vera, installer | fatto | #6 |

## Decisioni prese durante il lavoro

- **Colonna sinistra dell'editor**: selettore Risorse | Indice (richiesta del committente,
  5/10). L'indice mostra H1–H3, si aggiorna mentre si scrive, evidenzia la sezione corrente.
- **Righe del PDF e dell'editor**: stesso carattere (Libertinus Serif), stessa misura e
  stesso corpo; la corrispondenza riga per riga e' molto vicina ma non garantita al 100%
  (giustificazione e sillabazione di Typst e del browser differiscono).
- **Merge dei file binari** in conflitto: resta la versione del branch corrente.
- **xmldom**: la versione aggiornata e' forzata solo per MathJax (mammoth richiede la 0.8).
- **Pagine web**: archiviate come blocchi di solo testo (`page.json`), mai come HTML.

## Installer

- `npm run tauri build`: installer NSIS 27,5 MB e MSI 34 MB (Windows), molto sotto i 200 MB.
- Il workflow `release.yml` costruisce Windows e macOS (universale) a ogni tag `v*` e li
  allega a una release in bozza.

## Prove

- `npm test`: logica del frontend (Markdown, conteggi, righe, ricerca, commenti, merge,
  timeline, risorse, filtri, suggerimenti, CSL, BibTeX/RIS, esportatori).
- `npm run test:rust`: git (commit, branch, merge con conflitti), indice FTS5, Typst
  (compila anche il sorgente prodotto dal test del convertitore del frontend).
- Interfaccia: Chrome headless via CDP (`scripts/cdp.mjs`) sul server di sviluppo.
  App desktop: `ALEXANDRIA_TEST_OFFSCREEN=1` apre la finestra fuori schermo e senza focus.

## Prossimi passi possibili

- Firma degli installer e aggiornamenti automatici (oggi assenti per scelta: niente rete).
- Corrispondenza esatta righe editor/PDF calcolando le righe con Typst in background.
- Modelli di documento (tesi, articolo, saggio) come preset di impaginazione.
