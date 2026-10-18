# Stato dei lavori

Aggiornato: 15 ottobre 2026 (versione 0.2.0, storia delle versioni in `CHANGELOG.md`).

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
| Pacchetto portable Windows con il thesaurus accanto all'eseguibile | fatto | #19 |
| Apri Compendium da una copia (clone da una cartella) dalla schermata iniziale | fatto | #20, #42 |
| Fonte trascinata nel testo = apice numerato + nota a pie' di pagina con la fonte per esteso | fatto | #21 |
| Vista pagina con fogli veri (formato e margini del Layout, interruzioni di pagina) | fatto | #22 |
| Aggiungi da un altro Compendium (pergamene, Marginalia, fonti, tipi, Codex) | fatto | #23 |
| Remoto solo su cartella (chiavetta, NAS, cartella sincronizzata); Codeberg tolto | fatto | #42 |
| Colonne laterali richiudibili con linguette sul bordo | fatto | #24 |
| Apri documento: .docx, .doc, .odt, .rtf, .html, .epub, .txt, .md diventano pergamene | fatto | #35 |

## Decisioni prese durante il lavoro

- **Divisore negli export** (richiesta del committente, 13/10/2026): una riga vuota sopra il `---` in PDF
  (spazio alto una riga del corpo), Word, HTML, LaTeX e testo semplice (`logos` v0.2.1). Nello Scriptorium
  e nel Markdown non cambia nulla.

- **Sezioni della colonna sinistra** (scheda Armarium dello Scriptorium, richiesta del committente,
  13/10/2026): Pergamene, Codex, Armarium, Excerpta e Bibliografia si riordinano (trascinando o con le
  frecce) e si nascondono dal pulsante accanto alle schede (`editor/SidebarSections.tsx`, modello puro in
  `editor/leftSections.ts`, `prefs.leftSections`). I moduli registrano le sezioni con un id stabile
  (`leftPanelSections.add({ id, label, component })`); le sezioni nuove compaiono in fondo. La
  disposizione fa parte del layout del workspace (`LAYOUT_KEYS`): si salva e si riapplica con il
  selettore dei workspace in alto a destra; quelli predefiniti hanno l'ordine di serie.

- **Carattere e corpo nell'export** (richiesta del committente, 13/10/2026): in Esporta (PDF, Word, HTML;
  in LaTeX solo il corpo) e in Layout > Testo si sceglie fra i caratteri di Alexandria (Libertinus Serif,
  Inter, JetBrains Mono), i classici dell'HTML (Georgia, Times New Roman, Palatino, Helvetica, Arial,
  Verdana, Courier New) e le famiglie generiche (serif, sans-serif, monospace). Elenco e pile per web,
  Typst e Word in `logos` (`TEXT_FONTS`, `LayoutSettings.fontFamily`, `bodyFontStack`, v0.2.0); la scelta
  e' della pergamena e si vede anche nello Scriptorium. Per il PDF Typst ha Inter e JetBrains Mono inclusi
  (`src-tauri/fonts/`, licenza OFL accanto) e legge dal sistema solo le famiglie classiche dell'elenco
  (`SYSTEM_FAMILIES` in `typeset.rs`, con fontdb); se mancano, ripiega sui caratteri di Alexandria.

- **Nome della pergamena dal primo H1** (richiesta del committente, 13/10/2026): se la pergamena comincia
  con un titolo di livello 1, al salvataggio il file prende quel nome (`editor/titleSync.ts`,
  `headingTitle.ts`). Si aspetta finche' il cursore e' nel titolo (niente nomi a meta' parola); Salva
  (Cmd/Ctrl+S) rinomina subito. La rinomina e' "sul posto" (`moveOpenDoc` in `editor/session.ts`): i
  salvataggi restano in attesa e poi vanno al nuovo percorso, l'editor non ricarica (cursore, annulla e
  Marginalia restano). Nome gia' preso: vale la regola della rinomina manuale ("Titolo 2"). Mai nella copia
  per revisione. Si spegne da Preferenze > Editor (`prefs.titleFromHeading`, acceso di partenza).

- **Apri documento** (File > Apri documento…, richiesta del committente, 13/10/2026): il file diventa una
  pergamena nuova del Compendium aperto; l'originale non si tocca. Tutto in TypeScript, senza programmi
  esterni: .docx con mammoth (HTML -> `doc/import/html.ts`), .doc Word 97-2003 con un lettore nostro del
  formato binario (`wordBinary.ts`: contenitore OLE, pezzi del testo, stili per i titoli, grassetto e
  corsivo, note, tabelle, link, indice; niente immagini ne' numerazione automatica degli elenchi, che
  diventano puntati), .odt/.fodt (`odt.ts`), .rtf (`rtf.ts`), HTML ed EPUB (`html.ts`), testo e Markdown.
  Immagini nell'Armarium come figure. Un .docx con revisioni tracciate o commenti parte dal testo
  originale e la revisione si riapplica con `applyWordReview` (revisioni da accettare e Marginalia),
  dopo una versione di sicurezza. Pages (.pages) non si legge: il messaggio spiega come esportare in Word.
  I file aperti dal sistema (doppio clic, "Apri con", trascinati sull'icona) vanno alla revisione se
  `.recensio`, altrimenti all'import. Associazioni ai documenti **solo su macOS** e con rango
  "Alternate" (`tauri.macos.conf.json`): su Windows l'installer NSIS diventerebbe il programma
  predefinito dei .docx al posto di Word.

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
- **Conteggi**: etichetta flottante in basso a destra al posto della barra di stato. Nella lista aperta
  una puntina per ogni conteggio sceglie quali restano in vista a etichetta chiusa (anche nessuno;
  `prefs.countsShown`, predefiniti parole e pagine; `shell/countsModel.ts`). Accanto alla percentuale
  dello zoom i pulsanti riduci/ingrandisci (clic sulla percentuale = 100%), richiesta del committente 13/10/2026.
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
- **Riquadri evidenziati (callout)**: fondo molto chiaro, bordino, icona e intestazione in stile didascalia
  (titolo libero o il nome del tipo). Nel
  Markdown la sintassi degli avvisi di GitHub/Obsidian (`> [!WARNING] Titolo`, riga vuota, contenuto;
  `src/doc/callouts.ts`). Da Inserisci > Riquadro evidenziato, dal menu / (uno per tipo) e dal gruppo
  Blocchi; negli export riquadro colorato (Typst, HTML, Word come tabella a una cella), in LaTeX una
  citazione con intestazione. L'intestazione senza titolo e' nella lingua di scrittura (`docTexts`).
  **Aspetto a scelta** (richiesta del committente, ottobre 2026): predefiniti proposti solo nota,
  importante e pericolo (suggerimento e attenzione si leggono ancora dal Markdown, non si propongono).
  Ogni riquadro ha un pannello (pulsante col nome del tipo nell'intestazione, `editor/CalloutPicker.tsx`):
  tipo, colore dalla tavolozza del tema (`--series-1..8`, si adatta a chiaro e scuro; in stampa i colori
  del tema chiaro) e una di 24 icone. Nel Markdown i metadati alla Obsidian:
  `> [!NOTE|color=series-3 icon=book-open] Titolo`. "Salva tipo" crea un tipo proprio del Compendium
  (nome, colore, icona) in `.alexandria/callouts.json` (`callouts/store.ts`), scritto `> [!definizione]`
  e proposto nel pannello e nel menu /. Un tipo sconosciuto (es. `[!quote]` di Obsidian) e' un riquadro
  con l'aspetto della nota. Non fatto: "Aggiungi da un altro Compendium" non copia i tipi propri.
- **Carattere per stile** (Layout > Stili di paragrafo > Carattere): "Come il documento", Serif, Sans o
  Monospace per corpo, H1-H3, citazione, didascalia e nota (`ParaStyle.font`; gli stili salvati prima valgono
  "come il documento"). Nell'editor Libertinus Serif, Inter e JetBrains Mono (variabili `--style-font-*`), nel
  PDF Libertinus Serif, New Computer Modern Sans e DejaVu Sans Mono, in HTML le stesse famiglie con i ripieghi
  di sistema, in Word Libertinus Serif, Calibri e Consolas (corpo e titoli 1-3).
- **Stile di paragrafo "Didascalia"**: nel menu degli stili, in Formato e nel menu /; nel Markdown
  `<!-- style:caption -->` in coda al paragrafo (accanto a `<!-- align:... -->`); negli export lo stile
  "caption" del layout (Typst), `p.caption` (HTML), lo stile Caption di Word.
- **Thesaurus offline** (italiano e inglese, lingua di scrittura del Compendium): parola selezionata, tasto
  destro > "Cerca sinonimi" (o Maiusc+F7); senza una selezione fatta prima resta il menu del sistema col
  controllo ortografico. Il pannello mostra i significati per categoria, i termini simili e i contrari;
  un clic sostituisce la parola con le stesse maiuscole. Se la parola non c'e' si provano le forme base
  (bella -> bello, cities -> city) e in italiano il sinonimo si accorda (amena). Dati: thesaurus MyThes di
  LibreOffice, compressi in `src-tauri/resources/thesaurus/` (0,7 + 4 MB) con le licenze accanto:
  italiano di LibreItalia (GPL-3, distribuito come file separato, non incluso nel codice MIT), inglese da
  WordNet (licenza Princeton). Il Rust (`thesaurus.rs`) decomprime e indicizza alla prima richiesta
  (16 ms e 60 ms) e restituisce il blocco grezzo; l'interpretazione e' in `src/thesaurus/model.ts`.
- **Lettura continua del Codex**: la pergamena aperta resta leggibile, il testo delle altre pergamene
  collegate e' attenuato (piu' chiaro al passaggio del mouse).
- **Spostamento dei blocchi come in Notion** (`src/editor/extensions/blockReorder.ts`): mentre si trascina
  uno o piu' blocchi dalla maniglia, gli altri scorrono per aprire il vuoto dove andranno; al rilascio lo
  spostamento lo fa il plugin, nel posto esatto del vuoto. Il disegno passa da decorazioni (ProseMirror
  ridisegna i blocchi toccati direttamente nel DOM). I blocchi si leggono con `view.nodeDOM` (nella vista
  pagina fra i figli dell'editor ci sono i widget `.page-gap`) e lo scorrimento e' diviso per lo zoom.
- **Maniglia dei blocchi** (`src/editor/dragHandlePosition.ts`): floating-ui misura in pixel dello schermo,
  la pagina ha lo `zoom` CSS; la posizione si riporta in pixel della pagina (prima la maniglia scivolava
  verso il testo e, in basso, accanto al blocco sbagliato). La distanza dal testo e' un padding
  trasparente della maniglia (12 px, 52 px con i numeri di riga, che restano visibili): il mouse lo
  attraversa senza che la maniglia sparisca.
- **Nessun server git di terzi** (decisione del committente, 15/10/2026; prima, dal 12/10, solo
  Codeberg): i termini di Codeberg ammettono repository privati solo per progetti liberi e piccole
  note personali, e prevedono la rimozione immediata dei contenuti fuori regola; un Compendium con
  una tesi o un saggio privato ne resterebbe fuori. Tolti account, token, creazione ed elenco dei
  repository, "Accedi con Codeberg" (OAuth, PR #41, mai pubblicato) e la dipendenza `keyring`. Il
  remoto e' solo una cartella (chiavetta, NAS, cartella sincronizzata con Nextcloud o Syncthing):
  "Cartella remota…" sceglie la cartella e ci crea `<Nome>.git` (repository bare,
  `prepare_folder_remote` in `git.rs`), poi invia; "Apri Compendium da una copia" la copia su un
  altro computer. Clone, collegamento, push e pull rifiutano gli indirizzi di rete
  (`remote_allowed` in `git.rs`, `remoteAllowed` in `versions/remote.ts`). Chi aveva gia' un remoto
  su Codeberg vede l'errore e lo ricollega a una cartella. Alternative europee che ammettano
  progetti personali privati: in valutazione. Lo sviluppo del progetto resta su GitHub.
- **Nucleo condiviso `logos`** (fase P0 del piano Simposium, ottobre 2026): 45 moduli puri (Markdown,
  citazioni, export, ancore dei commenti, revisioni, Tabula, impaginazione, confronto dei testi,
  scorciatoie) e i loro 209 test sono passati nel repo `marceloesposito/logos` (MIT), usato come
  dipendenza git con tag (`v0.1.0`). Qui restano i moduli con React, store e I/O; i percorsi
  `src/doc/...`, `src/export/...` citati sotto sono ora in `logos`.
- **Scorciatoie personalizzabili** (Preferenze > Scorciatoie, `src/shell/dialogs/ShortcutsPrefs.tsx`):
  ogni comando del registro, con ricerca per nome o tasto; Cambia cattura il tasto (Esc annulla, Backspace
  toglie), rifiuta quelle senza modificatore (salvo i tasti F) e quelle del sistema, e in caso di
  conflitto propone di sostituire. Si salvano solo le differenze, in forma portabile ("Mod"), in
  `state.json` (`app.shortcuts`; modello puro in `src/commands/shortcuts.ts`). Menu, ribbon, barra
  flottante, Ctrl+O e Aiuto > Scorciatoie (con "Personalizza...") mostrano quelle in uso (`shortcutOf`).
  Nell'editor `extensions/customShortcuts.ts` esegue le nuove e ferma le predefinite tolte, che la keymap
  di TipTap altrimenti eseguirebbe. Lettere e cifre si leggono dal tasto fisico quando Alt o Shift le
  trasformano (prima Mod+Shift+9 non scattava: Shift+9 da' "(").
- **Vista pagina senza oscillazioni** (`src/editor/pagination.ts`): gli spazi fra i fogli si sommano con
  l'altezza vera (`offsetHeight` arrotondava di mezzo pixel) e si ridisegna solo se un salto cambia di
  almeno un pixel (`samePagination`). Prima, in certe pergamene, misura e ridisegno si inseguivano
  all'infinito (altezza dei fogli che oscilla di 1 px) e in WebKit lo scorrimento col trackpad si
  trascinava dopo aver staccato le dita. Salti uguali qualunque sia la storia delle modifiche (prima
  dopo un annulla cambiavano): lo spazio fra i fogli non prende piu' il margine di `.doc-body > * + *`
  e la misura toglie i margini che il salto impedisce di fondere (`marginOverlap`).
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
- **Post-it della Tabula** (17/10): selezione e scrittura separate, come in Miro o FigJam. Un clic
  seleziona e trascina (la textarea e' `readOnly` e senza `pointer-events`), il doppio clic scrive
  (`useNoteEdit` in `Whiteboard.tsx`), Esc o un clic fuori escono; un post-it nuovo nasce in scrittura.
  Backspace/Canc sul post-it selezionato, Backspace su un post-it vuoto e il clic destro lo eliminano
  passando da `removeBoardItems` (`resources/ui/boardEdit.ts`), che toglie anche i collegamenti.
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

- **Personalizzazione dei singoli stili di testo** (richiesta del committente, da fare): oggi Layout > Stili
  di paragrafo regola, per pergamena, corpo, peso, corsivo, allineamento, spazi, rientro, interlinea e
  maiuscoletto di sette stili (corpo, H1-H3, citazione, didascalia, nota) e vale soprattutto per l'export.
  Il carattere per stile c'e' gia' (sotto). Mancano: colore per stile, H4-H6 e l'intestazione dei riquadri, la resa identica
  nell'editor, stili condivisi dal Compendium o dai template invece che per pergamena, stili nuovi creati
  dall'utente (applicabili come la Didascalia, `textStyle` del paragrafo).
- Thesaurus: lemmatizzazione vera (oggi solo regole semplici per le forme base) e altre lingue.

- Firma degli installer e aggiornamenti automatici (oggi assenti per scelta: niente rete).
- Corrispondenza esatta righe editor/PDF calcolando le righe con Typst in background.
- Modelli di documento (tesi, articolo, saggio) come preset di impaginazione.
- **Collaborazione in tempo reale senza server** (implementazione futura, non iniziata): piu' persone
  sullo stesso Compendium, via LAN e internet, con invito tramite ticket. Trasporto P2P iroh in Rust,
  fusione con Yjs di pergamene, Marginalia, Tabula, Strata e risorse; Markdown e git restano la fonte
  di verita'. Piano in 5 PR: `docs/COLLABORAZIONE.md`.
- Compendium nella Bibliotheca (istantanea in sola lettura, riuso e citazione del proprio lavoro).
- Sincronizzazione senza server (remoto git su chiavetta/NAS gia' ammesso; `git bundle` per
  Nextcloud/Syncthing).
- Piano di lancio open source (designer per la UI, test di usabilita', licenze: CPAL di citeproc,
  CC BY-SA degli stili CSL, GPL-3 del thesaurus italiano distribuito come file separato).
- Limiti noti: in modalita' revisore non si creano paragrafi nuovi (Invio bloccato); la vista pagina
  non spezza un paragrafo fra due fogli (il PDF si').
- **Column** (prima Folium; piano del 17/10/2026, in corso): app sorella portable e leggera per il
  lavoro in mobilita', al posto della versione portable di Alexandria; ogni documento e' un pezzo
  `.clmn` indipendente, senza Compendium. Branch di lunga durata `column`. Piano e fasi F0-F7:
  `docs/COLUMN.md` (ogni cambiamento di piano si scrive li').

## Verifica su Windows (5/10)

Build di release `npm run tauri build` su Windows 11 (installer NSIS 27,6 MB), app avviata fuori
schermo e senza focus con dati in una cartella di prova:
- foto di un link con WebView2 (`ALEXANDRIA_SNAPSHOT_TEST`): riuscita in 1,8 s;
- autotest dell'embed (`ALEXANDRIA_EMBED_TEST`): import di una pagina web, `screenshot.webp`
  salvato, scheda nel testo con l'immagine caricata (1200 x 750);
- import di un PDF: titolo e autore dai metadati, 2 pagine, miniatura, testo estratto;
- schermata iniziale, creazione del primo Compendium, Scriptorium con righelli e contatore.
