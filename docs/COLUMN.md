# Post-it della Tabula + Column, l'app sorella in mobilita'

> Fino al 18/10/2026 l'app si chiamava **Folium** (ramo `folium`, file `.folium`): il piano qui sotto
> e' stato riscritto col nome nuovo, i nomi latini degli ambienti sono quelli di allora. Nome e
> glossario attuali: sezione "Quarta revisione" in fondo.

> Piano originale. Dal 18/10/2026 Folium si chiama **Column**: il piano aggiornato e l'avanzamento
> sono in `docs/COLUMN.md` sul ramo `column`.

## Context
Alexandria e' completa ma l'interfaccia e' carica. Oggi sopra il testo ci sono circa 190 px di cromo
(menu, NavBar, ribbon) e lo Scriptorium mostra 80-85 controlli. L'app pesa 65 MB e la compilazione
in release richiede minuti. Il committente vuole **Column**: l'app sorella per il lavoro in
mobilita', che prende il posto dell'attuale versione portable di Alexandria. Requisiti:
- **branch dedicato** `column`;
- **solo portable**;
- **molto piu' leggera**;
- **veloce da provare**, con tutti i passaggi fatti da Claude in chat;
- **nessuna ridondanza**: ogni azione ha un solo controllo sullo schermo;
- **identita' affine ad Alexandria**;
- **timer pomodoro**;
- **commenti con il clic destro**;
- **niente Compendium**: ogni documento e' un *column* indipendente, e l'autore decide alla fine
  dove metterlo e come organizzarlo.

Prima di Column c'e' un difetto in Alexandria: **i post-it della Tabula non si possono eliminare**.

---

## Passo 0 — Il piano nel repo
Per prima cosa questo piano si salva nel repo come **`docs/COLUMN.md`**:
- un branch `docs-column` da `main`, commit e PR, merge a CI verde;
- un rimando da `docs/STATO.md` (sezione "Aperto / idee") e una riga nel `CHANGELOG.md`.

Cosi' resta anche su `main` e in ogni sessione, sul Mac e su Windows. Ogni cambiamento di piano
successivo si scrive li'.

## Parte A — Alexandria: eliminare i post-it (branch `tabula-elimina-note`, PR su `main`)

**Causa** (`src/resources/ui/Whiteboard.tsx:142-156`):
- `NoteNode` e' quasi tutto una `<textarea class="nodrag">`. Un clic mette il fuoco nel testo invece
  di selezionare il nodo.
- `onKeyDown` ferma la propagazione, quindi Backspace cancella lettere e il `deleteKeyCode` di React
  Flow non scatta mai.
- `onNodeContextMenu` (righe 405-421) gestisce solo i nodi `doc` e `res`: sul post-it compare il menu
  nativo.

**Correzione**:
1. **Modalita' selezione e modalita' scrittura**, come in Miro o FigJam:
   - un clic seleziona il post-it: la textarea e' `readOnly`, ha `pointer-events: none` e non ha
     `nodrag`, cosi' il post-it si trascina dal corpo;
   - un **doppio clic** entra nella scrittura (`nodrag`, fuoco, cursore in fondo);
   - Esc o un clic fuori ne esce e il post-it resta selezionato;
   - un post-it nuovo (testo vuoto) nasce gia' in scrittura.
2. **Backspace/Canc su un post-it selezionato** lo elimina: con il nodo selezionato e la textarea
   inattiva, il `deleteKeyCode={['Delete','Backspace']}` gia' presente arriva a `onNodesChange`
   (`remove`), che toglie note e riquadri (righe 316-324).
   In scrittura, **Backspace su un post-it vuoto** elimina il post-it.
3. **Clic destro** su post-it e riquadri: "Elimina nota" / "Elimina riquadro" (`danger`), insieme a
   "Modifica testo" per i post-it. Si riusa `openContextMenu`.
4. La rimozione passa da un helper puro `removeBoardItems(wb, ids)` in
   `src/resources/ui/boardEdit.ts`, usato sia da `onNodesChange` sia dal menu, con un test vitest:
   - toglie note e riquadri;
   - toglie i collegamenti che partono o arrivano li';
   - lascia stare le pergamene.

   Anche i collegamenti (`links`) di una nota eliminata spariscono, con `removeLink`.
5. Chiavi i18n `wb.note.delete`, `wb.note.edit` e `wb.frame.delete` in `it.ts` ed `en.ts`. Voce nel
   `CHANGELOG.md`.

**Verifica A**:
- `npm test`, `npm run build`, `npm run test:rust`.
- CDP su vite:1430:
  - crea un post-it e scrivi del testo;
  - clic fuori, poi clic sul post-it: e' selezionato. Backspace: sparito dallo stato
    (`window.__alexandria`) e da `whiteboard.json` dopo il salvataggio;
  - crea un secondo post-it, clic destro → Elimina;
  - post-it vuoto in scrittura + Backspace: sparito;
  - doppio clic: il testo resta modificabile e Backspace cancella solo lettere.
- Ricompilo e reinstallo Alexandria in `/Applications` solo se il committente lo chiede.

PR, CI verde, merge (come da accordi). Column parte da `main` aggiornato, quindi eredita la
correzione, anche se la Tabula in Column poi non c'e' (vedi B3).

---

## Parte B — Column (branch `column`, di lunga durata; PR in bozza solo per la CI)

### B0. Solo cio' che distingue Column (criterio di leggerezza)
Ogni funzione deve servire a una di queste **sei differenze** dalla concorrenza (iA Writer, Bear,
Obsidian, Ulysses, Word). Tutto il resto si toglie:
1. **Zero attrito**: si apre e si scrive, e ogni foglio e' un file indipendente.
2. **Palimpsestus ad albero** con rami e diff alle biforcazioni: nessun concorrente ce l'ha in
   questa forma.
3. **Testo + Tabula ibridi**, con la disposizione gravitazionale verticale.
4. **Andata e ritorno con Word per i commenti** (.docx con commenti in uscita e in entrata).
5. **Timer di scrittura** con le parole per sessione.
6. **Offline, UE, portable, senza account**, piu' il ponte verso Alexandria.

**Tagli aggiuntivi** rispetto ad Alexandria, perche' non servono a nessuna delle sei:
- unione dei rami;
- revisioni tracciate e Suggerisci: dal .docx si importano solo i commenti, le revisioni si
  accettano all'apertura;
- vista pagina e righelli;
- formule (KaTeX e i suoi caratteri);
- import di .doc binario, .odt, .rtf, .html ed .epub: restano .docx, .md e .txt;
- blocchi File nella Tabula: restano Nota, Estratto, Immagine e Link;
- preferenza di densita';
- note a pie' di pagina nella barretta (restano raggiungibili con `/`);
- conversione delle versioni in commit con "Porta in un Compendium", che porta solo l'ultima
  versione.

La dipendenza piu' pesante che resta e' TipTap/ProseMirror. React Flow e d3-force insieme fanno circa
250 KB minificati e servono alla differenza n. 3. Obiettivo invariato: cartella portable < 15 MB.

### B1. Il modello: un foglio, un file
- Un documento di Column e' un **file `.clmn`**: uno zip, come gia' il `.recensio` (si riusa il
  codice zip di `src/recensio/` prima di toglierlo, con `jszip`). Contiene:
  ```
  column.json      nome, data, carattere, impostazioni del timer usate, versione del formato
  testo.md         il Markdown, fonte di verita' (parse/serialize di logos invariati)
  marginalia.json  commenti (stesso modello di logos/comments/model)
  tabula.json      l'Armarium del foglio: blocchi e collegamenti (B9)
  media/           immagini e file incollati o trascinati (nel testo o nella Tabula)
  palimpsestus/    albero delle versioni: versions.json (nodi, genitori, rami, etichette)
                   + un file Markdown per versione (B10)
  ```
- **Niente Compendium, niente vault, niente git, niente indice.** All'avvio si apre l'ultimo
  foglio, oppure uno nuovo e vuoto con il cursore pronto.
- I fogli in lavorazione stanno nella cartella dei dati portable, `Column-data/fogli/`, e si
  salvano da soli (stesso ritardo di `scheduleSave`).
- **Alla fine l'autore decide**, dal popover del titolo:
  - **Salva come…** un `.clmn` ovunque;
  - **Esporta** in **.docx** (con commenti e revisioni, `logos/export` + `export/comments.ts`) o
    **PDF** (stampa di sistema della webview con `@media print`);
  - **Porta in un Compendium…**: sceglie la cartella di un Compendium di Alexandria e vi scrive la
    pergamena in `docsDir()`, i media in `resDir()` e i commenti in `.alexandria/` (letto
    `vault.json`, come fa `docKeyIn()`). Da li' organizzazione, risorse e versioni passano ad
    Alexandria.
- Logica pura testata: `src/column/format.ts` (pack/unpack, andata e ritorno, versioni del
  formato), `src/column/snapshots.ts` (quando fare un'istantanea, potatura),
  `src/column/toCompendium.ts` (piano dei file da scrivere, senza sovrascritture).
- Annotato per dopo, su `main`: "Apri documento" di Alexandria accetta i `.clmn`.

### B2. Identita'
- Stesso glossario latino (Scriptorium, Marginalia, Palimpsestus, Silentium, Index), stessi token di
  `tokens.css`, caratteri Libertinus, Inter e JetBrains Mono, icone lucide.
- Nome **Column**, `identifier` `app.column`, dati in `Column-data/` accanto all'app
  (`portable.rs`), bundle disattivato, niente associazioni di file.
- Icona derivata da quella di Alexandria.
- Quando il committente approva, su `main` si tolgono `scripts/portable.mjs` e la modalita' portable
  di Alexandria.

### B3. Cosa si toglie dal branch (codice cancellato, non nascosto)
- **Frontend**:
  - l'Armarium del Compendium (`resources/`: store, Inspector, viewer, import web e DOI),
    Bibliotheca, Strata e Grafo, tipi e proprieta', Codex, citazioni CSL e Fonti, Recensio e
    modalita' revisore, `review/`. L'**Armarium del foglio** si riscrive da capo in
    `src/column/tabula/` (B9). Del vecchio `Whiteboard.tsx` si riusano solo i pezzi utili: frecce
    `FloatingEdge`, `facingSides`, post-it con la correzione della Parte A;
  - versioni git (sostituite dalle istantanee del foglio), remoto, workspace, ribbon e
    personalizzazione, `FloatingPanels`, `SidePane`, anteprima, vista sorgente, OCR (tesseract),
    thesaurus, MathJax (resta KaTeX), Yjs;
  - export diversi da .docx e PDF;
  - i rispettivi test e le chiavi i18n.
- **Dipendenze npm** (restano `@xyflow/react` e `d3-force` per la Tabula): `tesseract.js`,
  `mathjax-full`, `pdfjs-dist`, `citeproc`, `@citation-js/*`, `yjs`, `y-protocols`, `@tiptap/y-tiptap`,
  `@tiptap/extension-collaboration`, `@mozilla/readability`, `@codemirror/*` (dopo una verifica
  dei punti in cui si usano).
- **Rust**:
  - si tolgono `git.rs`, `index.rs`, `net.rs`, `typeset.rs`, `snapshot.rs`;
  - si tolgono le crate `git2`, `rusqlite`, `reqwest`, `typst*`, `fontdb`, `tokio` (se resta
    inutilizzato), `objc2*` e `webview2-com` (se servivano solo a `snapshot.rs`);
  - restano `fsops.rs` (con zip/unzip), `portable.rs`, il dialogo e l'opener.
- `src/platform/` (`Platform`, `tauri.ts`, `memory.ts`) si riduce a file system, dialoghi e
  apertura di link.
- **Obiettivo**: eseguibile **< 12 MB**, cartella portable **< 15 MB**. Lo script stampa le misure.

### B4. Interfaccia (Hick, Fitts, un'azione = un controllo)
- **Principi**:
  - livelli: L0 sempre visibile (≤ 10 bersagli), L1 popover (≤ 7 voci), L2 per nome
    (⌘K, `/`, scorciatoie);
  - bersagli di almeno 28 px;
  - azioni distruttive nei "…";
  - pannelli chiusi finche' non servono.
- **Header da 40 px**, fuso con la barra del titolo su macOS (`titleBarStyle: Overlay`):
  ```
  [✦]  [▤ ≡]   [✎ | ⧉ | ◇ | ⟲]      Titolo del foglio ▾ ●      [⌕ Cerca o comando ⌘K]
  ```
  - **[✎ | ⧉ | ◇ | ⟲]** e' un **solo** controllo segmentato a quattro stati: Scriptorium,
    **Entrambi** (affiancati), Armarium, Palimpsestus. Si cambia con un clic o con ⌘1-⌘4. Lo
    stato e la proporzione dello split si salvano per foglio in `column.json` (B9, B10).
  - **✦** e' il menu dell'app su Windows e Linux: Preferenze, Aiuto, Informazioni, Esci. Su macOS
    c'e' solo il menu nativo minimo, con le stesse voci piu' Modifica e Finestra di sistema.
  - **▤ ≡** sono la barra di attivita': **Fogli** (i fogli in lavorazione, Nuovo, Apri…,
    eliminazione nel "…" della riga) e **Index** (outline e chip "Marginalia" con l'elenco dei
    commenti e gli orfani). Un clic apre o chiude il pannello, uno solo alla volta, con
    larghezza fissa di 260 px.
  - **Titolo ▾** apre il popover del foglio: Rinomina, Salva come…, Esporta (.docx, PDF), Porta in
    un Compendium…. Le versioni stanno solo in
    Palimpsestus.
  - **●** indica il salvataggio (pieno, cavo o rosso); non e' cliccabile.
  - **⌘K**: fogli, comandi, testo.
- **Barretta in basso al centro**, alta 32 px. Evolve `editor/FormatBar.tsx` su una base comune
  `shell/FloatingBar.tsx`:
  ```
  Stile ▾ | B I U S | Colore ▾ | + ▾ | ⏱ 25:00 | 128 parole
  ```
  - **Stile ▾**: Titolo 1-3, Corpo, Citazione, Codice, e il carattere del foglio (Serif, Sans,
    Mono) in `column.json`.
  - **Colore ▾**: due schede, Testo ed Evidenzia (`ColorPicker`, `applyColor`).
  - **+ ▾**: Inserisci (elenco, attivita', tabella, immagine, link),
    lo stesso menu del `/`.
  - **⏱** e' il timer (B6).
  - **Parole** apre conteggi e zoom (assorbe `CountsBadge`).
  - Nessuna barra sulla selezione e nessun ribbon.
- **Clic destro nel testo** (nuovo `editor/ContextMenu.tsx` + modello puro
  `contextMenuModel.ts`): Commenta, link, Taglia/Copia/Incolla.
- **Test "un'azione, un controllo"**:
  - ogni comando del registro dichiara un `home`
    (`'bar' | 'crumb' | 'context' | 'panel' | 'appMenu' | 'none'`);
  - il test fallisce se un id compare in due superfici o se non e' raggiungibile ne' da una
    superficie ne' da ⌘K;
  - un secondo test conta i controlli L0 (≤ 10).
- **Token**: `--space-1..6` (scala di 4 px), `--ctl-h` 28, `--bar-h` 40, `--icon` 16, `--hit` 28.
  Le regole duplicate di `app.css` spariscono insieme al vecchio header.
- **Silentium** (⌘⇧D): restano solo il testo e, in trasparenza, la barretta.

### B5. Marginalia all'osso
- **Clic destro → "Commenta"** sulla selezione o, senza selezione, nel punto del cursore (ancora a
  larghezza zero).
- Si apre una **nuvoletta inline** con il campo a fuoco: Invio salva, Esc annulla.
- Il testo commentato ha una sottolineatura tenue; un commento su un punto e' un piccolo segno nel
  testo. Un clic sul segno o sulla sottolineatura apre il thread: Rispondi, Risolvi ed Elimina
  (nel "…").
- Niente colonna destra: `CommentsColumn`, le bolle, `rightPanel`, `showRight` e `rightWidth` si
  tolgono. Restano il modello di logos e l'andata e ritorno con Word.

### B6. Timer di scrittura (pomodoro personalizzabile)
- **Modello puro** `src/timer/model.ts`, con test vitest a orologio finto:
  - fasi `work`, `short` e `long`; durate, cicli prima della pausa lunga e avvio automatico
    personalizzabili;
  - stato calcolato dai timestamp (niente deriva in background);
  - `start`, `pause`, `resume`, `skip`, `reset`, `remaining(now)`;
  - **parole scritte per fase**, dai conteggi di `shell/countsModel.ts`.
- **Store** `src/timer/store.ts`. Le impostazioni stanno in `prefs.timer`, lo storico del giorno
  (pomodori e parole) nello stato dell'app.
- **UI**:
  - il chip ⏱ fa avvio e pausa, con un anello di progresso e un colore diverso fra lavoro e pausa;
  - il popover ha salta, azzera, le durate, i cicli, l'avvio automatico, il suono, "entra in
    Silentium quando parte il lavoro", e i pomodori e le parole di oggi.
- A fine fase: un breve suono con WebAudio (disattivabile) e un avviso discreto. Nessun plugin di
  notifica.
- Comandi `timer.toggle` (⌘⌥T), `timer.skip` e `timer.reset` con `home: 'bar'` / `'none'`.

### B9. Armarium del foglio: ibrido con lo Scriptorium e Tabula "gravitazionale"
**Meno compartimenti, piu' fluidita'.** Testo e Tabula sono due facce dello stesso foglio:
- **Entrambi**: Scriptorium a sinistra, Armarium a destra, con uno splitter trascinabile. Il flusso
  verticale della Tabula e' fatto apposta per una colonna stretta.
  - Passando da "Entrambi" a uno solo, la parte nascosta scivola via con un'animazione; niente salti.
- **Trascinare fra le due parti**, nei due sensi:
  - **testo selezionato → Tabula**: diventa un blocco *estratto*, ancorato al punto del testo (stesso
    meccanismo delle ancore dei commenti). Un clic sul blocco porta il testo a quel punto;
  - **blocco → testo**: un'immagine o un file si inserisce, una nota diventa un paragrafo, un link
    diventa un collegamento;
  - con "Entrambi", spostando il cursore nel testo si illuminano i blocchi ancorati al paragrafo
    corrente.
- **Blocchi**:
  - Nota (testo breve) ed Estratto;
  - Immagine (in `media/`);
  - Link: l'URL e un titolo scritto a mano, nessuna richiesta di rete.

  Si eliminano con il clic destro → Elimina o con Backspace sul blocco selezionato (lo schema della
  Parte A: un clic seleziona, il doppio clic modifica).
- **Barretta flottante della Tabula** in basso al centro, con la stessa base `FloatingBar` della
  barretta del testo: `+ Blocco ▾ | ⌕ | − 100% + ⤢`. Con "Entrambi" ogni parte mostra la propria
  barretta, che fa azioni diverse.

**Disposizione gravitazionale** (scelta del committente: niente snap rigido, i blocchi trovano
l'equilibrio):
1. **Posti di equilibrio** (`src/column/tabula/flowLayout.ts`, puro e testato):
   - disposizione a strati **dall'alto in basso** dai collegamenti dell'utente: radici in alto,
     figli sotto, fratelli affiancati;
   - con larghezza massima limitata, i fratelli oltre un certo numero si **impilano in verticale**
     invece di allargarsi;
   - componenti separate una sotto l'altra, blocchi non collegati in coda;
   - ordine dei fratelli dato dalla loro x attuale, cosi' l'utente riordina trascinando.
2. **Fisica** (`src/column/tabula/gravity.ts`, con `d3-force`):
   - `forceX`/`forceY` verso il posto di equilibrio di ogni blocco, con forza moderata e attrito
     (`velocityDecay`) per un moto morbido;
   - `forceCollide` sui rettangoli dei blocchi: non si sovrappongono e si fanno spazio;
   - **durante il trascinamento** il blocco segue il mouse, gli altri gli fanno spazio e la
     simulazione si riscalda (`alphaTarget`);
   - **al rilascio** il blocco "cade" verso il nuovo equilibrio, senza scatti.
3. **Collegare come in Scratch**: lasciare un blocco poco sotto un altro (entro una soglia) crea il
   collegamento padre → figlio e il blocco si assesta sotto. Allontanarlo con decisione lo stacca
   (`flowLayout` ricalcola i posti). Restano anche le maniglie per collegare a mano.
4. Le **posizioni d'equilibrio si salvano**: alla riapertura i blocchi sono gia' fermi. Le
   preferenze di movimento ridotto del sistema (`prefers-reduced-motion`) spengono l'animazione.

Logica pura testata con vitest:
- `flowLayout`: strati, impilamento verticale, ordine dei fratelli, componenti separate;
- `attachRule`: quando un rilascio collega o stacca;
- `gravity.settle()`: simulazione portata a riposo senza sovrapposizioni.

### B10. Palimpsestus: solo l'albero genealogico
**Modello** (senza git, dentro il `.clmn`; puro e testato in `src/column/versions/tree.ts`):
- ogni versione e' un nodo con id, genitori (uno, due dopo un'unione), data, etichetta facoltativa
  e ramo;
- **versioni automatiche** dopo una pausa nella scrittura o alla chiusura (soglia di cambiamento
  minima), **versioni manuali** con un nome;
- **Riprendi da qui** su una versione vecchia apre un **ramo nuovo**: il foglio torna a quel
  testo e le versioni successive restano nell'albero;
- **niente unione dei rami** (taglio per leggerezza, vedi B0): per riportare una parte di un ramo
  nell'altro si copia dall'anteprima;
- **potatura** delle versioni automatiche vecchie, mai di quelle con un nome o nei punti di
  biforcazione e unione;
- diff con il pacchetto `diff` gia' presente; i sommari dei diff riusano le funzioni pure
  esistenti di `versions/`.

**Schermata scarna**:
- C'e' **solo l'albero**, verticale: la versione piu' recente in alto, i rami come linee
  parallele con un colore per ramo dai token `--series-N`. Niente elenchi, timeline o pannelli
  laterali. La disposizione e' quella pura di `flowLayout` (B9), senza fisica: le versioni non si
  trascinano.
- **Anteprima flottante semitrasparente**, solo **al passaggio del mouse** su un nodo:
  - vetro smerigliato (`backdrop-filter: blur`, sfondo `--paper` all'85% circa), accanto al nodo,
    scompare quando il mouse esce;
  - su un **punto di biforcazione** (nodo con piu' figli) mostra il **diff** fra le punte dei rami
    che partono da li';
  - su ogni altro nodo mostra l'**anteprima del documento** a quella versione, in sola lettura con
    `ReadOnlyDoc`/`buildReadOnlyExtensions`, scorciata con una sfumatura;
  - si apre dopo circa 150 ms, per non lampeggiare mentre il mouse attraversa l'albero.
- Un clic **seleziona** un nodo, a cui si applicano i comandi della barretta.
- **Solo i comandi principali, solo nella barretta flottante** in basso al centro (stessa
  `FloatingBar`): `Salva versione | Riprendi da qui`.
  - "Salva versione" chiede un nome facoltativo.
  - Non ci sono "…", clic destro o altri pulsanti su questa schermata.
- ⌘4 o il segmento ⟲ dell'header.

Test vitest:
- `tree.ts`: rami, Riprendi da qui, potatura che conserva i nodi importanti;
- `forkDiffTarget(node)`: cosa confrontare per ogni tipo di nodo (biforcazione o altro).

### B7. Prove rapide, tutte lanciate da Claude
- **Interfaccia**: `npx vite --port 1430` con la piattaforma in memoria e prove CDP
  (`scripts/cdp.mjs`). Non si compila nulla.
- **App vera**: `npm run column:portable` (nuovo `scripts/column-portable.mjs`):
  - compila con il **profilo Cargo `fast`**: senza LTO, `codegen-units = 16`, `incremental`,
    `opt-level = 2`, e `CARGO_TARGET_DIR` fisso in `src-tauri/target-column`;
  - con la cache calda e il Rust gia' ridotto, la ricompilazione dopo una modifica
    all'interfaccia dovrebbe stare intorno ai **20-40 s**;
  - assembla `Column-portable/` (con `Column-data/`) sul **Desktop** e toglie la quarantena
    (`xattr -cr`);
  - Claude la apre quando serve, oppure la avvia fuori schermo per le prove.
- **CI**: i job esistenti girano anche sul branch `column`.

### B8. Fasi (commit sul branch `column`, CI verde, STATO.md e CHANGELOG del branch aggiornati)
1. **F0 Dimagrimento**: identita', tagli di B3 (frontend, npm, Rust), profilo `fast`,
   `column:portable` sul Desktop. Si misurano peso e tempi.
2. **F1 Il foglio**: formato `.clmn`, fogli in lavorazione, salvataggio automatico, Nuovo, Apri
   (anche .docx, .md e .txt con `doc/import/`) e Salva come.
3. **F2 Interfaccia**: header, barretta, pannelli Fogli e Index, menu dell'app, token, test
   "un'azione, un controllo".
4. **F3 Marginalia** con il clic destro.
5. **F4 Timer pomodoro.**
6. **F5 Armarium del foglio**: Tabula gravitazionale, vista Entrambi, trascinamento fra testo e
   Tabula.
7. **F6 Palimpsestus**: albero delle versioni, anteprima semitrasparente, barretta.
8. **F7 Uscita**: Esporta .docx e PDF, Porta in un Compendium (la Tabula diventa risorse, post-it e
   collegamenti di Alexandria; le versioni diventano commit nel git del Compendium, in ordine).

A ogni fase: nuova portable sul Desktop e un breve resoconto.

### Verifica B
- `npm test` (formato, istantanee, Compendium, timer, menu contestuale, un'azione/un controllo, i18n e
  glossario), `npm run build`, `npm run test:rust`.
- CDP:
  - all'avvio c'e' un foglio vuoto con il cursore pronto;
  - si scrive, si ricarica e il testo c'e' ancora;
  - cromo sopra il testo ≤ 40 px e controlli L0 ≤ 10;
  - B/I/colore e stile;
  - clic destro → Commenta, su una selezione e su un punto, con risposta e risoluzione;
  - timer con una fase da 3 s: avviso, fase successiva, parole contate;
  - ⌘2 (Entrambi):
    - un testo trascinato sulla Tabula diventa un blocco estratto;
    - un blocco rilasciato sotto un altro si collega e si assesta;
    - dopo `settle` non ci sono sovrapposizioni e il flusso e' verticale;
    - un clic sul blocco fa scorrere il testo;
    - screenshot in sequenza per vedere la caduta;
  - ⌘4:
    - salvo una versione e faccio Riprendi da qui su una vecchia: compare un ramo;
    - al passaggio del mouse sulla biforcazione compare il diff, su un altro nodo l'anteprima,
      e l'anteprima e' semitrasparente;
    - sulla schermata ci sono solo l'albero e la barretta con due comandi;
  - ⌘K;
  - Salva come `.clmn` e riapertura, Esporta .docx con i commenti, PDF dalla stampa;
  - Porta in un Compendium su un Compendium di prova, poi il file appare in Alexandria
    (`npm run dev` di `main`).
- Portable: dimensioni dell'eseguibile e della cartella, tempo della seconda compilazione,
  avvio fuori schermo con `Column-data/` accanto, chiusura forzata senza perdita del foglio.

---

## Avanzamento (ramo `column`)

| Fase | Stato | Note |
| --- | --- | --- |
| A Post-it della Tabula (Alexandria) | fatto | PR #44 su `main` |
| F0 Dimagrimento | fatto | nuovo ingresso `src/main.tsx` -> `src/column/App.tsx`; 216 file di Alexandria tolti; Rust ridotto a `fsops.rs` + `portable.rs`; profilo `fast`; `npm run column:portable` |
| F1 Il foglio | fatto | formato `.clmn`, fogli in lavorazione, Apri (.clmn .docx con i commenti di Word, .md, .txt), Salva come; provato con CDP (ricarica, riapertura, .docx) |
| F2 Interfaccia | fatto | barra da 40 px (6 controlli), barretta, Fogli e Index, menu dell'app, Preferenze, ⌘K, "/", zoom, Silentium, test "un'azione, un controllo" |
| F3 Marginalia | fatto | clic destro -> Commenta su selezione o punto, Invio/Esc, thread con risposta, Risolvi, Elimina; le ancore seguono il testo |
| F4 Timer | fatto | fase da 3 s provata: avviso con le parole, fase successiva, storico del giorno, Silentium al via del lavoro |
| F5 Armarium del foglio | fatto | Entrambi, estratto dal testo, collegamento lasciando un blocco sotto un altro, nessuna sovrapposizione, doppio clic sull'estratto, blocchi illuminati, blocco -> testo |
| F6 Palimpsestus | fatto | Riprendi da qui -> ramo nuovo, diff sulla biforcazione e anteprima semitrasparente al passaggio del mouse, barretta con due comandi |
| F7 Uscita | fatto | .docx con i commenti di Word, PDF dalla stampa, Porta in un Compendium (pergamena, Marginalia, post-it, risorse) |

Misure (Windows 11, 17/10/2026): eseguibile **5,9 MB** col profilo `fast` (cartella portable 5,9 MB
senza i dati); interfaccia 2,9 MB (caratteri ridotti agli alfabeti latini). Prima compilazione 2 min 8 s,
seconda dopo una modifica all'interfaccia 51 s (Rust 43 s). App vera provata fuori schermo: scrittura,
salvataggio su disco, chiusura forzata senza perdite, `Column-data/` accanto all'eseguibile (anche la
cache della webview).

### Scostamenti dal piano, decisi lavorando
- **Fogli in lavorazione come cartelle**: in `Column-data/fogli/<id>/` ci sono gli stessi file del
  `.clmn`, non compressi; il salvataggio automatico riscrive solo quelli cambiati (scrittura atomica
  del Rust). Lo zip nasce solo con Salva come.
- **Collisione della Tabula**: i blocchi si scansano solo dal blocco tenuto col mouse. Fra blocchi in
  volo verso posti d'equilibrio gia' separati la collisione li incastrava; a riposo non si
  sovrappongono comunque, perche' i posti di `flowLayout` non si sovrappongono (test).
- **Un solo padre per blocco** nella Tabula (`attach` sostituisce il padre): il flusso dall'alto in
  basso resta un albero, e i cicli sono impossibili.
- **Porta in un Compendium porta solo l'ultima versione** (come in B0): niente conversione delle
  versioni in commit. Note ed estratti diventano post-it, immagini e link risorse dell'Armarium.
- **L0 contati per superficie**: barra in alto 6 controlli, barretta 6 gruppi (test in
  `commandSpecs.test.ts`); "/" e ⌘K sono ricerche per nome, non superfici.
- **PDF**: la stampa la apre il Rust (`print_page`, `WebviewWindow::print`), perche' WKWebView non
  risponde a `window.print()`.
- **Formule, citazioni, indici** di un `.md` di Alexandria restano nel testo come segni (nessuna
  perdita nell'andata e ritorno), ma Column non li formatta. Le revisioni tracciate si accettano
  all'apertura.

### Non ancora provato o non fatto
- **macOS**: niente prove sul Mac. Da verificare la barra in alto fusa con quella del titolo
  (`titleBarStyle: Overlay` in `tauri.macos.conf.json`, 78 px per i semafori), il pacchetto `.app`
  minimo che costruisce `scripts/column-portable.mjs` e `xattr -cr`.
- **Finestre native** (Apri, Salva come, Esporta, scelta del Compendium) e **stampa vera** provate solo
  nel browser con la piattaforma in memoria: nell'app vera aprirebbero finestre e ruberebbero il fuoco.
- **Porta in un Compendium**: i file scritti seguono la struttura di Alexandria (`vault.json`, cartelle,
  `.alexandria/comments/<chiave>.json`, `whiteboard.json`, `links.json`), ma non e' ancora stato aperto
  in Alexandria un Compendium che li ha ricevuti.
- **Animazione del passaggio fra le viste** (la parte nascosta che "scivola via", B9): c'e' solo lo
  splitter animato; cambiando vista le parti si sostituiscono.
- Annotato per `main`: "Apri documento" di Alexandria che accetta i `.clmn`; togliere
  `scripts/portable.mjs` e la modalita' portable di Alexandria quando il committente approva Column.

### Revisione del committente (17/10/2026, dopo la prima prova)
- **Niente barra di navigazione piena**: in alto resta solo il passaggio fra Scriptorium e
  Palimpsestus (Ctrl+1 / Ctrl+3), senza bordi e sullo stesso fondo del testo; fa anche da barra del
  titolo. Fogli, Index, Salva come, Esporta, Porta in un Compendium, Preferenze, Aiuto: per nome con
  ⌘K o con le scorciatoie (`home: 'none'` in `commandSpecs.ts`). Tolte le viste Entrambi e Armarium.
- **Scriptorium come in Silentium**: pagina senza scrivania ne' ombra, barretta in trasparenza finche'
  non ci si passa sopra. Silentium (Ctrl+Maiusc+D) toglie anche barretta e linguetta.
- **Tabula flottante** (`tabula/FloatingTabula.tsx`): un'unica finestra sopra il testo, dentro Column,
  che non si apre e non si chiude ma si sposta. Riposta, scorre oltre il bordo sinistro e ne resta
  fuori una striscia di 18 px alta quasi quanto la finestra (96%); afferrandola la finestra intera
  scorre dentro seguendo il puntatore, spinta oltre il bordo per piu' di meta' si ripone (e richiamata
  torna dove stava). Anche un clic sulla striscia o Ctrl+2. Si
  sposta dalla sua barra e si ridimensiona dagli orli; posizione, misure e aggancio restano in
  `stato.json`. **Aggancio come in Windows** (`tabula/snap.ts`, puro e testato): meta' sinistra o
  destra, quadranti negli angoli, tutto lo spazio in alto; poco sensibile: la zona si attiva solo col
  puntatore entro 10 px dal bordo e fermo per 280 ms (passando veloce non scatta), con un'anteprima
  prima del rilascio. Staccandola torna alle misure di prima; doppio clic sulla barra = tutto lo
  spazio e ritorno.
- **Avvio**: splash, onboarding in una sola schermata al primo lancio (Scriptorium, Armarium,
  Palimpsestus, una riga ciascuno con un'icona) (`onboarded` in `stato.json`), poi la
  pagina d'ingresso con solo "Inizia a scrivere" oppure, se ci sono fogli, "Riprendi da dove eri
  rimasto" e "Nuovo foglio" (`Welcome.tsx`). Un file aperto dal sistema salta l'ingresso.
- Nell'app vera la chiusura della finestra aspetta il salvataggio dell'ultimo testo
  (`onCloseRequested`).

### Seconda revisione (17/10/2026)
- **Niente barra di navigazione**: in cima, sullo stesso fondo del testo, solo il **timer**, il
  **contatore di parole** (con conteggi e zoom) e **Esporta** (Word, PDF, Salva come `.clmn`, Porta
  in un Compendium). La fascia fa anche da barra del titolo; il resto per nome con ⌘K.
- La barretta in basso ha solo Stile, B I U S, Colore e Inserisci.
- **Palimpsestus come la Tabula, sul bordo destro** (`FloatingPanel.tsx`, comune alle due finestre):
  riposto oltre il bordo destro con la sua striscia, tirato dentro trascinandola, spinto fuori per
  riporlo. Ctrl+1 la Tabula, Ctrl+2 il Palimpsestus; la finestra toccata per ultima sta davanti. Non
  ci sono piu' viste da scegliere: si scrive sempre nello Scriptorium.
- Onboarding in una sola schermata con tre righe: Scriptorium, Armarium, Palimpsestus.

### Terza revisione (17/10/2026)
- **Barra in alto**: a sinistra il **nome del foglio**, che si cambia con un clic (Invio o clic fuori
  salvano, Esc annulla); al centro, centrato sulla finestra intera, il posto della barretta quando e'
  agganciata; a destra i controlli della finestra (Windows e Linux).
- **Barretta unica** (`Toolbar.tsx`): stile, B I U S, colore, inserisci, timer, contatore, Esporta.
  Si sposta dalla maniglia; la posizione libera e' in frazioni della finestra (`barPosition.ts`, puro e
  testato). **Magnetica**: trascinata entro 36 px dalla barra in alto compare il segnale e, lasciata
  li', si aggancia e ne diventa parte; trascinata via si stacca. I suoi menu si aprono verso il centro.
- **Contatore a scelta** (`editor/countsModel.ts`): parole, battute, battute senza spazi, pagine,
  cartelle, minuti di lettura; si sceglie dal suo menu, almeno uno resta acceso.
- **Confini di pagina** nel testo senza bordi (`editor/pageHints.ts`): una linea tratteggiata tenue
  dove finirebbe una pagina A4 del Layout predefinito di Alexandria, in proporzione alla colonna; un
  blocco non si spezza. Le linee hanno altezza zero (il testo non si sposta) e danno anche le
  "pagine" del contatore. Stessa cosa nella vista senza bordi di Alexandria (PR su `main`).

### Quarta revisione (18/10/2026): Column e glossario di redazione
- **Nome**: Folium diventa **Column** (Folio, Quire, Recto, Colophon erano gia' presi). Il committente
  vuole allontanarsi dai nomi latini e greci di Alexandria: il lessico viene dalla redazione di un
  giornale e dall'epoca delle macchine da scrivere.
- **File**: `.clmn` (zip con `column.json` al posto di `folium.json`); i vecchi `.folium` e i fogli in
  lavorazione con `folium.json` si aprono ancora. Cartella portable `Column-data`: una
  `Folium-data` accanto all'app si rinomina da sola al primo avvio. Ramo `column`, eseguibile
  `Column.exe`, identificatore `app.column`, variabili `COLUMN_DATA_DIR` e `COLUMN_TEST_OFFSCREEN`.
- **Glossario** (`src/i18n/glossary.ts`, controllato dal test): Piece (in italiano *pezzo*) = il
  foglio; **Copy** = lo Scriptorium; **Clips** = Tabula e Armarium del foglio; **Editions** = il
  Palimpsestus; **Queries** = i Marginalia; **Rundown** = l'Index; il timer resta **timer pomodoro**
  (Deadline provato e scartato dal committente);
  **Typewriter** = il Silentium. Compendium resta, perche' e' il nome di Alexandria. Onboarding:
  "Un foglio nella macchina", con Copy, Clips ed Editions.
- **Nome nella landing** in Courier Prime (OFL, incluso nel pacchetto; token `--font-type`), da
  macchina da scrivere.
- **Coltello nei Clips**: lo stesso di Alexandria (PR #48): tenendo premuto Ctrl il cursore diventa un
  coltello e la scia taglia i collegamenti che attraversa (`tabula/knife.ts`, `KnifeLayer.tsx`).

### Quinta revisione (19/10/2026): focus mentre si scrive

- **Paragrafo in primo piano, acceso di default**: mentre si scrive nel Copy gli altri paragrafi
  svaniscono (opacita' 0,3, dissolvenza di 0,4 s) e tornano quando si muove il mouse o si clicca; in
  Typewriter restano sempre attenuati, come Silentium in Alexandria. Si spegne nelle Preferenze o con
  il comando "Paragrafo in primo piano" (`app.focus` in `stato.json`, `editor/focusBlock.ts`).
- **Allineamento del testo** (19/10/2026): una sola icona nella barretta, accanto a B I U S, con il
  menu a tendina (sinistra, centro, destra); l'icona mostra l'allineamento del paragrafo del cursore.
  Non aggiunge un gruppo (la barretta resta a 10 controlli). Nel Markdown `<!-- align:center -->` come
  in Alexandria; per nome anche "Allinea a sinistra", "Centra", "Allinea a destra" (`editor/align.ts`).
- **Blocchi movibili** (19/10/2026): la maniglia ⠿ di Alexandria accanto a ogni blocco del Copy; trascinandola
  gli altri blocchi scorrono per fare posto (come in Notion) e al rilascio il blocco va dove si vede il
  vuoto (`editor/blockReorder.ts` e `dragHandlePosition.ts`, copiati da Alexandria). Dipendenze nuove:
  `@tiptap/extension-drag-handle(-react)` con i suoi pari (node-range, collaboration, y-tiptap, yjs),
  circa 0,1 MB in piu' nel pacchetto.
