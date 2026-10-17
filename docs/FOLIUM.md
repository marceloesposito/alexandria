# Post-it della Tabula + Folium, l'app sorella in mobilita'

## Context
Alexandria e' completa ma l'interfaccia e' carica. Oggi sopra il testo ci sono circa 190 px di cromo
(menu, NavBar, ribbon) e lo Scriptorium mostra 80-85 controlli. L'app pesa 65 MB e la compilazione
in release richiede minuti. Il committente vuole **Folium**: l'app sorella per il lavoro in
mobilita', che prende il posto dell'attuale versione portable di Alexandria. Requisiti:
- **branch dedicato** `folium`;
- **solo portable**;
- **molto piu' leggera**;
- **veloce da provare**, con tutti i passaggi fatti da Claude in chat;
- **nessuna ridondanza**: ogni azione ha un solo controllo sullo schermo;
- **identita' affine ad Alexandria**;
- **timer pomodoro**;
- **commenti con il clic destro**;
- **niente Compendium**: ogni documento e' un *folium* indipendente, e l'autore decide alla fine
  dove metterlo e come organizzarlo.

Prima di Folium c'e' un difetto in Alexandria: **i post-it della Tabula non si possono eliminare**.

---

## Passo 0 — Il piano nel repo
Per prima cosa questo piano si salva nel repo come **`docs/FOLIUM.md`**:
- un branch `docs-folium` da `main`, commit e PR, merge a CI verde;
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

PR, CI verde, merge (come da accordi). Folium parte da `main` aggiornato, quindi eredita la
correzione, anche se la Tabula in Folium poi non c'e' (vedi B3).

---

## Parte B — Folium (branch `folium`, di lunga durata; PR in bozza solo per la CI)

### B0. Solo cio' che distingue Folium (criterio di leggerezza)
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
- Un documento di Folium e' un **file `.folium`**: uno zip, come gia' il `.recensio` (si riusa il
  codice zip di `src/recensio/` prima di toglierlo, con `jszip`). Contiene:
  ```
  folium.json      nome, data, carattere, impostazioni del timer usate, versione del formato
  testo.md         il Markdown, fonte di verita' (parse/serialize di logos invariati)
  marginalia.json  commenti (stesso modello di logos/comments/model)
  tabula.json      l'Armarium del foglio: blocchi e collegamenti (B9)
  media/           immagini e file incollati o trascinati (nel testo o nella Tabula)
  palimpsestus/    albero delle versioni: versions.json (nodi, genitori, rami, etichette)
                   + un file Markdown per versione (B10)
  ```
- **Niente Compendium, niente vault, niente git, niente indice.** All'avvio si apre l'ultimo
  foglio, oppure uno nuovo e vuoto con il cursore pronto.
- I fogli in lavorazione stanno nella cartella dei dati portable, `Folium-data/fogli/`, e si
  salvano da soli (stesso ritardo di `scheduleSave`).
- **Alla fine l'autore decide**, dal popover del titolo:
  - **Salva come…** un `.folium` ovunque;
  - **Esporta** in **.docx** (con commenti e revisioni, `logos/export` + `export/comments.ts`) o
    **PDF** (stampa di sistema della webview con `@media print`);
  - **Porta in un Compendium…**: sceglie la cartella di un Compendium di Alexandria e vi scrive la
    pergamena in `docsDir()`, i media in `resDir()` e i commenti in `.alexandria/` (letto
    `vault.json`, come fa `docKeyIn()`). Da li' organizzazione, risorse e versioni passano ad
    Alexandria.
- Logica pura testata: `src/folium/format.ts` (pack/unpack, andata e ritorno, versioni del
  formato), `src/folium/snapshots.ts` (quando fare un'istantanea, potatura),
  `src/folium/toCompendium.ts` (piano dei file da scrivere, senza sovrascritture).
- Annotato per dopo, su `main`: "Apri documento" di Alexandria accetta i `.folium`.

### B2. Identita'
- Stesso glossario latino (Scriptorium, Marginalia, Palimpsestus, Silentium, Index), stessi token di
  `tokens.css`, caratteri Libertinus, Inter e JetBrains Mono, icone lucide.
- Nome **Folium**, `identifier` `app.folium`, dati in `Folium-data/` accanto all'app
  (`portable.rs`), bundle disattivato, niente associazioni di file.
- Icona derivata da quella di Alexandria.
- Quando il committente approva, su `main` si tolgono `scripts/portable.mjs` e la modalita' portable
  di Alexandria.

### B3. Cosa si toglie dal branch (codice cancellato, non nascosto)
- **Frontend**:
  - l'Armarium del Compendium (`resources/`: store, Inspector, viewer, import web e DOI),
    Bibliotheca, Strata e Grafo, tipi e proprieta', Codex, citazioni CSL e Fonti, Recensio e
    modalita' revisore, `review/`. L'**Armarium del foglio** si riscrive da capo in
    `src/folium/tabula/` (B9). Del vecchio `Whiteboard.tsx` si riusano solo i pezzi utili: frecce
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
    stato e la proporzione dello split si salvano per foglio in `folium.json` (B9, B10).
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
    Mono) in `folium.json`.
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
1. **Posti di equilibrio** (`src/folium/tabula/flowLayout.ts`, puro e testato):
   - disposizione a strati **dall'alto in basso** dai collegamenti dell'utente: radici in alto,
     figli sotto, fratelli affiancati;
   - con larghezza massima limitata, i fratelli oltre un certo numero si **impilano in verticale**
     invece di allargarsi;
   - componenti separate una sotto l'altra, blocchi non collegati in coda;
   - ordine dei fratelli dato dalla loro x attuale, cosi' l'utente riordina trascinando.
2. **Fisica** (`src/folium/tabula/gravity.ts`, con `d3-force`):
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
**Modello** (senza git, dentro il `.folium`; puro e testato in `src/folium/versions/tree.ts`):
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
- **App vera**: `npm run folium:portable` (nuovo `scripts/folium-portable.mjs`):
  - compila con il **profilo Cargo `fast`**: senza LTO, `codegen-units = 16`, `incremental`,
    `opt-level = 2`, e `CARGO_TARGET_DIR` fisso in `src-tauri/target-folium`;
  - con la cache calda e il Rust gia' ridotto, la ricompilazione dopo una modifica
    all'interfaccia dovrebbe stare intorno ai **20-40 s**;
  - assembla `Folium-portable/` (con `Folium-data/`) sul **Desktop** e toglie la quarantena
    (`xattr -cr`);
  - Claude la apre quando serve, oppure la avvia fuori schermo per le prove.
- **CI**: i job esistenti girano anche sul branch `folium`.

### B8. Fasi (commit sul branch `folium`, CI verde, STATO.md e CHANGELOG del branch aggiornati)
1. **F0 Dimagrimento**: identita', tagli di B3 (frontend, npm, Rust), profilo `fast`,
   `folium:portable` sul Desktop. Si misurano peso e tempi.
2. **F1 Il foglio**: formato `.folium`, fogli in lavorazione, salvataggio automatico, Nuovo, Apri
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
  - Salva come `.folium` e riapertura, Esporta .docx con i commenti, PDF dalla stampa;
  - Porta in un Compendium su un Compendium di prova, poi il file appare in Alexandria
    (`npm run dev` di `main`).
- Portable: dimensioni dell'eseguibile e della cartella, tempo della seconda compilazione,
  avvio fuori schermo con `Folium-data/` accanto, chiusura forzata senza perdita del foglio.

---

## Avanzamento (ramo `folium`)

| Fase | Stato | Note |
| --- | --- | --- |
| A Post-it della Tabula (Alexandria) | fatto | PR #44 su `main` |
| F0 Dimagrimento | fatto | nuovo ingresso `src/main.tsx` -> `src/folium/App.tsx`; 216 file di Alexandria tolti; Rust ridotto a `fsops.rs` + `portable.rs`; profilo `fast`; `npm run folium:portable` |
| F1 Il foglio | scritto, da provare | formato `.folium`, fogli in lavorazione, Apri (.folium .docx .md .txt), Salva come |
| F2 Interfaccia | scritto, da provare | barra da 40 px, barretta, Fogli e Index, menu dell'app, ⌘K, test "un'azione, un controllo" |
| F3 Marginalia | scritto, da provare | clic destro -> Commenta, nuvoletta, thread |
| F4 Timer | scritto, da provare | modello puro + chip e popover |
| F5 Armarium del foglio | scritto, da provare | Tabula gravitazionale, Entrambi, trascinamento testo <-> Tabula |
| F6 Palimpsestus | scritto, da provare | albero, anteprima semitrasparente, barretta |
| F7 Uscita | scritto, da provare | .docx con commenti, PDF dalla stampa, Porta in un Compendium |

Misure (Windows 11, 17/10/2026): eseguibile 6,8 MB col profilo `fast`; interfaccia 3,9 MB (quasi
tutto caratteri).

### Scostamenti dal piano, decisi lavorando
- **Fogli in lavorazione come cartelle**: in `Folium-data/fogli/<id>/` ci sono gli stessi file del
  `.folium`, non compressi; il salvataggio automatico riscrive solo quelli cambiati (scrittura atomica
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
  perdita nell'andata e ritorno), ma Folium non li formatta. Le revisioni tracciate si accettano
  all'apertura.
