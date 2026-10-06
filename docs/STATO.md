# Stato dei lavori

Aggiornato: 7 ottobre 2026 (M11).

| Milestone | Stato | PR |
| --- | --- | --- |
| M0 Setup: scaffold Tauri 2 + React, backend Rust (file, git, indice FTS5, rete, Typst), Markdown | fatto | iniziale |
| M1–M3 Guscio (menu, navbar, ribbon personalizzabile), vault, editor a blocchi, numeri di riga | fatto | #1 |
| M4 Commenti a margine (fumetto, collegamento a parole, bolle trascinabili, orfani) | fatto | #2 |
| M5 Version control (timeline, diff, merge manuale, checkpoint, remoto) | fatto | #3 |
| M6–M7 Risorse, Library, whiteboard, grafo, layer, pin, citazioni CSL, bibliografia | fatto | #4 |
| M8 Export (PDF Typst, DOCX, HTML, MD, TXT, LaTeX), anteprima, Layout, indice | fatto | #5 |
| M9 Rifiniture: icona, digitazione e incolla in Markdown, prova dell'app vera, installer | fatto | #6 |
| M10 Vista senza bordi, righelli, scrittura minimale, contatore flottante, embed con screenshot, snippet, build universale | fatto | #7 |
| M11 Barra del titolo personalizzata (Windows), nomi Armarium/Palimpsestus/Bibliotheca, account sui server git | fatto | #8, #9, #11 |
| M11 Quick switcher (Ctrl+O), tavolozza dei comandi, anteprime al passaggio del mouse | fatto | #10 |
| M11 Tipi di oggetto con proprieta', header della pergamena (anche in pagina ed export), Strata come database | fatto | #12 |
| M11 Codex (pergamene collegate lette ed esportate di seguito) e riquadri accanto all'editor | fatto | #14 |
| M11 Modello di Compendium Diario e Voce di oggi | fatto | #15 |
| M11 Revisioni tracciate (Suggerisci), Marginalia da revisione, andata e ritorno con Word | fatto | #16 |
| M11 Copia per revisione (.recensio), modalita' revisore, import su branch, risposta ai revisori | fatto | #17 |
| Stessa identita' in tutte le lingue (glossario con test, pergamena in italiano), Bookmarks -> Excerpta | fatto | #18 |
| Indice dei contenuti nell'export, bibliografia in un clic visibile nello Scriptorium | fatto | #18 |
| Index in tutte le lingue; lingua di scrittura per Compendium, separata dall'interfaccia | fatto | #18 |

## Decisioni prese durante il lavoro

- **Colonna sinistra dell'editor**: selettore Risorse | Index (richiesta del committente,
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
- **Siti che rifiutano lo scaricamento** (403/429/503, controlli anti-bot come Cloudflare): l'import
  legge la pagina nel motore web dell'app (`net_render` in `snapshot.rs`: finestra fuori schermo che
  esegue gli script del controllo, poi HTML e foto con `eval_with_callback`). Se il sito chiede un
  controllo "sei umano?", il link si salva comunque (titolo dall'indirizzo, `titleFromUrl`) e
  "Verifica il sito" (nel messaggio e nell'ispettore) apre una finestra normale: l'utente supera il
  controllo e la risorsa si completa al suo posto. Le finestre di lettura tengono i cookie del controllo
  superato (quelle della sola foto restano senza cookie). Autotest: `ALEXANDRIA_RENDER_TEST="<url>|<file>"`.
- **Colore del testo ed evidenziatore**: tavolozza con nomi (`src/doc/colors.ts`: rosso, arancio, verde, blu,
  viola, grigio; evidenziatori giallo, verde, blu, rosa, arancio, viola). Nel Markdown
  `<span data-color="red">` e `<mark data-color="green">` (il giallo resta `<mark>`); colori fuori
  tavolozza o `<span>` qualsiasi restano testo. Nell'editor i token del tema, negli export i colori di
  stampa (PDF, HTML, Word; in LaTeX e testo semplice resta il testo). Nel gruppo Carattere della Home e
  nella barra flottante.
- **Barra flottante di formattazione** in basso al centro dello Scriptorium (`src/editor/FormatBar.tsx`):
  stili, grassetto/corsivo/sottolineato/barrato, colore, evidenziatore, elenchi, link, cancella formato;
  si riduce a una pillola, si nasconde da Visualizza > Aspetto dello Scriptorium (`prefs.formatBar`). Non
  compare nella scrittura minimale ne' nella vista sorgente; con la barra aperta il contatore sale sopra.
- **Silentium** (era "scrittura minimale" / Zen; nome nel glossario): solo il testo, a schermo intero, e
  qui soltanto le righe diverse da quella in cui si scrive sono attenuate (il blocco col cursore riceve
  `has-focus`, `src/editor/extensions/focusBlock.ts`). Nella vista normale e nella modalita' focus tutta
  la pergamena resta leggibile.
- **Lettura continua del Codex**: la pergamena aperta resta leggibile, il testo delle altre pergamene
  collegate e' attenuato (piu' chiaro al passaggio del mouse).
- **Spostamento dei blocchi come in Notion** (`src/editor/extensions/blockReorder.ts`): mentre si trascina
  uno o piu' blocchi dalla maniglia, gli altri scorrono per aprire il vuoto dove andranno; al rilascio lo
  spostamento lo fa il plugin, nel posto esatto del vuoto. Il disegno passa da decorazioni (ProseMirror
  ridisegna i blocchi toccati direttamente nel DOM).
- **Snippet di codice**: nuovo tipo di risorsa (file `snippet.<ext>`), creato da Aggiungi risorse,
  modificabile nel visualizzatore, inseribile nel testo dal menu / o trascinandolo.
- **Rimozione delle risorse**: ribbon, menu Risorse, clic destro, Canc nella tabella, visualizzatore.
- **OpenSSL** compilato dentro l'app (`vendored-openssl` di git2): niente dipendenza da Homebrew.
- **Nomi tematici** (scelti dal committente, solo nelle stringhe di `src/i18n/`, uguali in IT ed EN):
  documento -> Scroll (in italiano Pergamena), gestore risorse -> Armarium (era Bookshelf), schermata Editor -> Scriptorium, Versioni ->
  Palimpsestus (era History), commenti a margine -> Marginalia, whiteboard -> Tabula, pin -> Excerpta (un Excerptum; era Bookmarks), layer -> Strata. Le pergamene collegate in sequenza formano un Codex.
  Restano Library e Bibliografia; vault -> Compendium. Identificatori interni invariati.
- **Cartelle con i nomi dell'app**: un Compendium nuovo si chiama "Compendium" e contiene `Pergamene/`
  (`Scrolls/` con l'interfaccia in inglese) e `Armarium/`; i nomi stanno in `vault.json` (`dirs`) e tutto il
  codice li legge da li' (`docsDir()`, `resDir()`, `isDocPath()` in `src/vault/paths.ts`). I Compendium di
  prima (e le cartelle che hanno gia' `documents/`) restano con `documents/` e `resources/`: spostarli
  romperebbe la storia delle versioni. La copia per revisione porta con se' le cartelle d'origine.
  Una pergamena senza titolo si chiama "Pergamena Senza Titolo" / "Untitled Scroll".
- **Navbar**: Armarium · Scriptorium · Palimpsestus | Library (Cmd/Ctrl+1..4). La Library e' una tab a
  parte (stessa schermata dell'Armarium sulla raccolta comune); il selettore Vault/Library e' sparito.
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
- **Pergamene nella Tabula**: ogni pergamena del Compendium e' un nodo fisso (sempre presente, si sposta
  ma non si toglie; la prima volta in colonna a sinistra delle risorse, poi la posizione resta salvata),
  collegabile alle fonti e alle altre pergamene; i collegamenti entrano anche nel Grafo, che con
  almeno una pergamena non e' mai vuoto. "Vai alla pergamena aperta" la porta in vista.
  Rinomina ed eliminazione aggiornano nodi e legami.
- **Navigatore della Tabula** (in basso a destra): miniature dei nodi (pergamene in blu, fonti col colore
  del gruppo e l'immagine di anteprima se c'e', note in giallo, cornici tratteggiate), sempre leggibile.
  Era vuoto perche' i nodi controllati non riportavano le misure di React Flow: ora le modifiche
  'dimensions' tornano nei nodi come `measured`.
- **Collegamenti nella Tabula**: quattro punti di aggancio per nodo (sopra, sotto, destra, sinistra),
  14 px con un'area cliccabile piu' larga; ognuno puo' iniziare o ricevere un collegamento
  (`ConnectionMode.Loose`). Le frecce si attaccano ai lati che si guardano e li seguono quando i nodi
  si spostano (`facingSides` in `src/resources/tabula.ts`). Nella vista senza bordi
  una barra di una riga mostra le pergamene collegate (clic per aprirle); non compare in Pagina, nella
  scrittura minimale ne' nell'export.
- **Incolla nell'Armarium**: Cmd/Ctrl+V fuori dai campi crea la risorsa del tipo giusto; un link
  incollato da solo su una riga vuota diventa una scheda embed.
- **Portable**: cartella `Alexandria-data` accanto all'app (`node scripts/portable.mjs --mac ... --win ...`).
- **macOS**: pacchetto firmato ad-hoc. Senza Developer ID e notarizzazione Apple, su altri Mac al primo
  avvio serve Impostazioni di sistema > Privacy e sicurezza > Apri comunque.
- **Workspace** (come Illustrator): Beginner (vicino alla modalita' focus: niente colonne, vista senza
  bordi, una scheda "Essenziali" per ambiente; le altre schede restano nascoste), Studio (predefinito),
  Pro (tutto visibile, icone piccole). Da Visualizza > Workspace o dal selettore in alto a destra;
  "Salva workspace corrente" salva colonne, viste, barra e pannelli flottanti (`src/state/workspaces.ts`).
- **Pannelli flottanti**: un gruppo trascinato fuori dalla barra diventa un pannello libero; altri gruppi
  si aggiungono trascinandoli sopra; si richiudono nella barra (`src/commands/floatModel.ts`).
- **Palimpsestus semplificato** (stile GitHub Desktop): a sinistra variante, "Salva una versione" e storia
  verticale (salvataggi automatici nascosti); al centro la pergamena come documento; passando su una
  versione il centro si divide nelle due versioni allineate (`src/versions/docDiff.ts`). Interfaccia in
  parole semplici: versione (commit), variante (branch), unisci (merge), pubblica/scarica (push/pull).
- **Introduzione** al primo avvio (sette pagine con le funzioni di ogni ambiente), riapribile da Aiuto.
- **Armarium**: l'albero degli Strata mostra le risorse sotto gruppi e filtri, con filtro e ordinamento.

## Installer

- `npm run tauri build`: installer NSIS 27,5 MB e MSI 34 MB (Windows), molto sotto i 200 MB.
- Il workflow `release.yml` costruisce Windows e macOS (universale) a ogni tag `v*` e li
  allega a una release in bozza.
- macOS in locale: `npm run tauri build -- --target universal-apple-darwin --bundles app,dmg`
  (serve `rustup target add x86_64-apple-darwin`). Bastano i Command Line Tools, non serve Xcode.
  Se fra gli SDK ce n'e' uno piu' nuovo del linker (es. un MacOSX27.0.sdk rimasto da una beta, con
  architetture che `ld` non conosce: "unknown architecture" nei .tbd), indicare l'SDK giusto:
  `SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk npm run tauri build -- ...`

## Prove

- `npm test`: logica del frontend (Markdown, conteggi, righe, ricerca, commenti, merge,
  timeline, risorse, filtri, suggerimenti, CSL, BibTeX/RIS, esportatori).
- `npm run test:rust`: git (commit, branch, merge con conflitti), indice FTS5, Typst
  (compila anche il sorgente prodotto dal test del convertitore del frontend).
- Interfaccia: Chrome headless via CDP (`scripts/cdp.mjs`) sul server di sviluppo.
  App desktop: `ALEXANDRIA_TEST_OFFSCREEN=1` apre la finestra fuori schermo e senza focus.
- Autotest dell'app nativa (WKWebView/WebView2, dove il browser di prova non arriva), con
  `ALEXANDRIA_DATA_DIR` su una cartella di prova:
  - `ALEXANDRIA_SNAPSHOT_TEST="<url>|<out.png>"`: solo la foto della pagina (Rust);
  - `ALEXANDRIA_EMBED_TEST="<url>|<rapporto.json>"`: import del link, foto salvata, scheda nel testo,
    immagine caricata; con `pdf:<percorso>` al posto dell'URL prova l'import di un PDF.
- WKWebView non sa iterare i `ReadableStream` (`for await`), che pdf.js usa nella pagina e nel worker:
  `src/lib/streamPolyfill.ts` li completa, caricato per primo e dal worker `src/resources/pdf.worker.ts`.
- Asset protocol: `requireLiteralLeadingDot: false`, altrimenti le immagini in cartelle nascoste
  (es. Compendium dentro una cartella che inizia con un punto) non si vedono.

## M11 in breve (ottobre 2026)

- **Nomi**: Bookshelf -> Armarium, History -> Palimpsestus, Library -> Bibliotheca, Librum -> Codex
  (solo testi visibili; identificatori interni invariati).
- **Stessa identita' in tutte le lingue**: i nomi tematici sono nomi propri, mai tradotti; unica
  eccezione voluta: in italiano lo Scroll e' la pergamena. Bookmarks -> Excerpta (singolare Excerptum:
  i passaggi estratti dalle fonti); "Indices" e' stato scartato perche' si confondeva con l'indice dei
  contenuti e con un eventuale indice analitico.
- **Index**: l'indice dei contenuti si chiama Index in tutte le lingue (scheda della colonna sinistra,
  blocco da inserire, menu /, opzione dell'export). Il titolo stampato dentro il testo e nel PDF e'
  nella lingua di scrittura ("Indice", "Contents", "Inhaltsverzeichnis"...).
- **Lingua di scrittura per Compendium**, separata da quella dell'interfaccia: `language` in
  `.alexandria/vault.json` (assente = lingua dell'interfaccia, come prima). Si sceglie dalla sezione
  "Lingua di scrittura" in Home dello Scriptorium (o dalla tavolozza dei comandi). Lingue: italiano,
  inglese, tedesco, francese, spagnolo (locale CSL nel pacchetto, `public/csl/locales-*.xml`).
  Decide: attributo `lang` dell'editor (controllo ortografico e sillabazione della webview), lingua
  dell'export (Typst `text(lang)`, babel, `<html lang>`, titolo dell'indice in Word), lingua delle
  citazioni e titolo della bibliografia delle pergamene nuove e dei template predefiniti (testo di
  partenza in italiano o inglese), testi inseriti nel documento (`docTexts` in `src/i18n/writing.ts`).
  Al cambio di lingua le pergamene con i predefiniti della vecchia lingua passano alla nuova
  (`retargetLanguage`); le scelte fatte a mano restano. Restano nella lingua dell'interfaccia le
  etichette dell'header (Autore, Data, Tipo) quando l'header va nell'export.
- **Index nell'export**: opzione per pergamena (`layout.tocInExport`, nel dialogo
  Esporta per tutti i formati tranne Markdown); se la pergamena non ha gia' un blocco indice se ne
  mette uno in testa al documento esportato (`src/export/toc.ts`), il .md non cambia. Vale anche per i Codex.
- **Bibliografia in un clic**: "Genera bibliografia" (prima solo "Bibliografia" in Riferimenti) e' anche
  in Home (gruppo Citazioni) e negli Essenziali di Beginner; nella colonna sinistra la sezione
  Bibliografia conta le fonti citate, segnala le citazioni senza fonte nell'Armarium e ha il pulsante
  (Aggiorna se la bibliografia c'e' gia').
- **Barra salvata e gruppi nuovi**: `RibbonConfig.rev` e `RibbonGroup.since`. Un gruppo predefinito nato
  dopo l'ultima revisione vista entra al suo posto anche nelle barre personalizzate; se l'utente poi
  lo toglie non torna.
  `src/i18n/glossary.ts` li elenca con le traduzioni e i nomi vecchi da evitare; un test
  controlla ogni lingua contro l'inglese, cosi' una lingua nuova eredita la stessa identita'.
- **Codex**: nessun oggetto nuovo su disco oltre a `.alexandria/codices/<radice>.json` (nome,
  separatore, titoli come capitoli): la catena sono i legami direzionali fra pergamene gia' in
  `links.json`, letti in profondita' nell'ordine di creazione (`src/codex/model.ts`). Riordinare
  riscrive i legami interni come catena semplice.
- **Tipi e proprieta'**: `.alexandria/types.json`; per le pergamene stanno nel `DocSettings`
  (`object`, `header`), il .md non cambia; per le risorse in `Resource.object`.
- **Revisioni tracciate** nel Markdown come `<ins|del data-author data-date>` (HTML standard, leggibile
  ovunque) invece di CriticMarkup: il parser gestiva gia' l'HTML in linea. In export: testo pulito
  di default, revisioni visibili a richiesta, revisioni vere in Word.
- **Copia per revisione** `.recensio` (zip): il revisore la apre in un Compendium temporaneo
  (cartella dell'app) con testo bloccato: solo revisioni tracciate (filterTransaction) e Marginalia.
  Al ritorno: branch `revisione-<nome>-<data>` dalla versione di partenza e unione guidata.
- **Bug corretto**: `createBranch`, `switchBranch` e il ripristino leggevano come fallimento i
  comandi git senza risultato (null), cosi' "Nuova variante" risultava fallita anche quando riusciva.

## In valutazione (A/B test del committente)

- **Split dello Scriptorium**: risolto con i riquadri accanto (pergamene in sola lettura, Codex,
  risorse); un secondo editor modificabile resta non implementato per i motivi qui sotto.
- (storico) **Split dello Scriptorium** (piu' pergamene aperte affiancate): non implementato. Rischi da valutare
  per Marginalia: oggi c'e' un solo editor attivo (`getEditor()`), le bolle si ancorano alle posizioni
  di quell'editor e la colonna dei commenti segue una sola pagina; con due editor servirebbero colonne
  (o colori) per pergamena, ancore per editor e salvataggio/checkpoint per ciascuna.

## Prossimi passi possibili

- **Thesaurus offline** (richiesta del committente, da fare in futuro): parola selezionata, clic destro >
  "Cerca sinonimi", solo italiano e inglese, senza rete. Dati possibili: i thesaurus di LibreOffice
  (formato MyThes, `th_it_IT` e `th_en_US`, licenze libere LGPL/BSD), qualche MB ciascuno, letti nel Rust
  o in un indice SQLite; la lingua e' quella di scrittura del Compendium.

- Firma degli installer e aggiornamenti automatici (oggi assenti per scelta: niente rete).
- Corrispondenza esatta righe editor/PDF calcolando le righe con Typst in background.
- Modelli di documento (tesi, articolo, saggio) come preset di impaginazione.

## Verifica su Windows (5/10)

Build di release `npm run tauri build` su Windows 11 (installer NSIS 27,6 MB), app avviata fuori
schermo e senza focus con dati in una cartella di prova:
- foto di un link con WebView2 (`ALEXANDRIA_SNAPSHOT_TEST`): riuscita in 1,8 s;
- autotest dell'embed (`ALEXANDRIA_EMBED_TEST`): import di una pagina web, `screenshot.webp`
  salvato, scheda nel testo con l'immagine caricata (1200 x 750);
- import di un PDF: titolo e autore dai metadati, 2 pagine, miniatura, testo estratto;
- schermata iniziale, creazione del primo Compendium, Scriptorium con righelli e contatore.
