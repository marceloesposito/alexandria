# Stato dei lavori

Aggiornato: 5 ottobre 2026 (M10).

| Milestone | Stato | PR |
| --- | --- | --- |
| M0 Setup: scaffold Tauri 2 + React, backend Rust (file, git, indice FTS5, rete, Typst), Markdown | fatto | iniziale |
| M1–M3 Guscio (menu, navbar, ribbon personalizzabile), vault, editor a blocchi, numeri di riga | fatto | #1 |
| M4 Commenti a margine (fumetto, collegamento a parole, bolle trascinabili, orfani) | fatto | #2 |
| M5 Version control (timeline, diff, merge manuale, checkpoint, remoto) | fatto | #3 |
| M6–M7 Risorse, Library, whiteboard, grafo, layer, pin, citazioni CSL, bibliografia | fatto | #4 |
| M8 Export (PDF Typst, DOCX, HTML, MD, TXT, LaTeX), anteprima, Layout, indice | fatto | #5 |
| M9 Rifiniture: icona, digitazione e incolla in Markdown, prova dell'app vera, installer | fatto | #6 |
| M10 Vista senza bordi, righelli, scrittura minimale, contatore flottante, embed con screenshot, snippet, build universale | in revisione | #7 |

## Decisioni prese durante il lavoro

- **Colonna sinistra dell'editor**: selettore Risorse | Indice (richiesta del committente,
  5/10). L'indice mostra H1–H3, si aggiorna mentre si scrive, evidenzia la sezione corrente.
- **Righe del PDF e dell'editor**: stesso carattere (Libertinus Serif), stessa misura e
  stesso corpo; la corrispondenza riga per riga e' molto vicina ma non garantita al 100%
  (giustificazione e sillabazione di Typst e del browser differiscono).
- **Merge dei file binari** in conflitto: resta la versione del branch corrente.
- **xmldom**: la versione aggiornata e' forzata solo per MathJax (mammoth richiede la 0.8).
- **Pagine web**: archiviate come blocchi di solo testo (`page.json`), mai come HTML.

- **Aspetto dell'editor** (Visualizza): Pagina, con righelli in cm e inizi di pagina stimati, oppure
  Senza bordi (stile Notion/Obsidian). La **scrittura minimale** (Cmd/Ctrl+Maiusc+D, Esc per uscire)
  nasconde tutto tranne il testo e mette la finestra a schermo intero; non si salva nello stato.
- **Conteggi**: etichetta flottante in basso a destra al posto della barra di stato.
- **Embed**: `[Titolo](url){embed resource=id image="..."}`. All'import di un link l'app fotografa la
  pagina con una webview fuori schermo, senza focus, senza cookie e senza capability (WKWebView su
  macOS, WebView2 su Windows); la foto e' ridotta a WebP o JPEG. Se non riesce resta og:image.
  Negli export l'embed diventa un link.
- **Snippet di codice**: nuovo tipo di risorsa (file `snippet.<ext>`), creato da Aggiungi risorse,
  modificabile nel visualizzatore, inseribile nel testo dal menu / o trascinandolo.
- **Rimozione delle risorse**: ribbon, menu Risorse, clic destro, Canc nella tabella, visualizzatore.
- **OpenSSL** compilato dentro l'app (`vendored-openssl` di git2): niente dipendenza da Homebrew.
- **Nomi tematici** (scelti dal committente, solo nelle stringhe di `src/i18n/`, uguali in IT ed EN):
  documento -> Scroll (in italiano Pergamena), gestore risorse -> Bookshelf, schermata Editor -> Scriptorium, Versioni ->
  History, commenti a margine -> Marginalia, whiteboard -> Tabula, pin -> Bookmarks, layer -> Strata.
  Restano Library e Bibliografia; vault -> Compendium (la cartella creata al primo avvio si chiama "Il mio Compendium"; quelle esistenti non cambiano nome). Identificatori, cartelle
  (`documents/`, `resources/`) e file su disco non cambiano.
- **Navbar**: Bookshelf · Scriptorium · History | Library (Cmd/Ctrl+1..4). La Library e' una tab a
  parte (stessa schermata della Bookshelf sulla raccolta comune); il selettore Vault/Library e' sparito.
- **Barra degli strumenti**: ogni gruppo si trascina dalla maniglia in basso a destra (anche nel
  cestino, con Annulla) e puo' essere esteso o compatto (un pulsante che apre gli strumenti in un
  pannello); nella personalizzazione gli strumenti sono tessere con l'etichetta sotto l'icona e i gruppi
  tolti si possono rimettere.
- **Navbar** in stile Affinity: icone grandi colorate per sezione, etichetta sotto.
- **Schermata iniziale** (stile VS Code / Adobe Home): all'avvio si sceglie il Compendium (riprendi
  l'ultimo, recenti, nuovo, apri; al primo avvio "crea il tuo primo Compendium"). Si torna da File >
  Schermata iniziale. Preferenze > All'avvio: schermata iniziale (predefinito) o ultimo Compendium.
- **Template e master page** (Scriptorium > Layout > Template, File > Nuova da template...):
  template predefiniti (Vuota, Articolo, Tesi, Saggio, Paper a due colonne) e dell'utente in
  `<appData>/templates/*.json`, comuni a tutti i Compendium; un template e' testo di partenza +
  impostazioni. Le master page non sono piu' tre fisse: si creano, rinominano, duplicano ed eliminano
  (il corpo resta; una sezione con una master eliminata usa il corpo). "Nuova pergamena" resta vuota.
- **Introduzione** al primo avvio (cinque pagine), riapribile da Aiuto.
- **Bookshelf**: l'albero degli Strata mostra le risorse sotto gruppi e filtri, con filtro e ordinamento.

## Installer

- `npm run tauri build`: installer NSIS 27,5 MB e MSI 34 MB (Windows), molto sotto i 200 MB.
- Il workflow `release.yml` costruisce Windows e macOS (universale) a ogni tag `v*` e li
  allega a una release in bozza.
- macOS in locale: `npm run tauri build -- --target universal-apple-darwin --bundles app,dmg`
  (serve `rustup target add x86_64-apple-darwin`).

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
