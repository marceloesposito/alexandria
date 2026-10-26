# Storia delle versioni

Tutte le modifiche di Alexandria, dalla prima riga di codice. Le versioni fino alla 0.1.4 sono state
numerate a posteriori (il 15 ottobre 2026) raggruppando le PR per tappa; la **0.2.0** e' la prima
versione con un tag git. I numeri fra parentesi sono le pull request su GitHub. Decisioni e dettagli
tecnici di ogni funzione stanno in `docs/STATO.md`.

Schema: `0.0.x a` = alpha (milestone M0-M9, prima dell'app installabile completa); `0.1.x` = prima
serie completa (M10-M12 e richieste del committente); `0.2.x` = serie attuale.

---

## Column 0.1.0 — in corso (ramo `column`, prima Folium)

App sorella portable di Alexandria (piano in `docs/COLUMN.md`): un pezzo indipendente `.clmn`,
barra in alto da 40 px, barretta flottante, Queries col clic destro, timer pomodoro, Clips
gravitazionali accanto al testo, Editions ad albero, export .docx con commenti, Markdown e PDF, Porta in un
Compendium. Eseguibile di 5,9 MB. Il 18/10/2026 Folium diventa Column, con il glossario di redazione
(Piece, Copy, Clips, Editions, Queries, Rundown, Typewriter; il timer resta timer pomodoro) e il coltello nei Clips; i
vecchi `.folium` si aprono ancora. Il 26/10 il confine di pagina diventa una linea continua centrata fra le righe, con il numero di pagina nel margine. Sempre il 26/10: due salvataggi dello stesso Piece insieme non si accavallano piu' (davano "The Piece cannot be saved: No such file or directory").

## Non ancora rilasciato

- **Tabula: il coltello** (#48): tenendo premuto Ctrl il cursore diventa un coltello; trascinando si
  tagliano i collegamenti che la scia attraversa, un clic su un collegamento taglia quello.

- `CLAUDE.md` piu' leggero (#47): da ~15k a ~7k caratteri; istruzioni di build, glossario e insidie
  di singole parti in skill caricate solo quando servono (`.claude/skills/`).

- **Confini di pagina nella vista senza bordi** (#46): una linea tratteggiata tenue dove finirebbe ogni
  pagina, con la stessa impaginazione della vista pagina (un paragrafo non si spezza). Non sposta il
  testo; si accende e si spegne da Visualizza > Confini di pagina (acceso di partenza).

- Piano di **Folium**, l'app sorella portable, in `docs/FOLIUM.md` (#43). Il 18/10/2026 Folium
  diventa **Column** (ramo `column`, #49).
- **Tabula: i post-it si eliminano** (#44). Un clic seleziona il post-it (e lo trascina), il doppio
  clic entra nella scrittura, Esc o un clic fuori ne escono. Backspace/Canc su un post-it selezionato
  lo elimina, come Backspace su un post-it vuoto in scrittura; il clic destro su post-it e cornici
  offre "Elimina" (e "Modifica testo"). Con la nota spariscono anche i suoi collegamenti.

## 0.2.0 — 15 ottobre 2026

Prima versione con tag (`v0.2.0`).

- **Codeberg tolto dall'app** (#42): i termini di Codeberg ammettono repository privati solo per
  progetti liberi e possono rimuovere i contenuti personali, come una tesi o un saggio. Il remoto
  del Compendium e' ora solo una **cartella** (chiavetta, NAS, cartella sincronizzata con Nextcloud
  o Syncthing): "Cartella remota…" crea la copia (`<Nome>.git`) nella cartella scelta e ci invia il
  Compendium; "Apri Compendium da una copia" lo apre su un altro computer. Tolti account, token,
  creazione ed elenco dei repository.
- "Accedi con Codeberg" (OAuth con PKCE, #41) annullato prima della pubblicazione, insieme al resto
  di Codeberg.
- Storia delle versioni (questo file) e numero di versione portato a 0.2.0.

## 0.1.4 — 13 ottobre 2026

Lavoro della sessione Mac.

- **Apri documento** (#35): File > Apri documento… trasforma .docx, .doc (lettore binario nostro),
  .odt, .rtf, .html, .epub, .txt e .md in una pergamena nuova; immagini nell'Armarium; revisioni
  tracciate e commenti di Word riapplicati come revisioni e Marginalia. "Apri con" dal Finder (solo
  macOS, rango Alternate); i file aperti dal sistema vanno alla revisione solo se `.recensio`.
- **Etichetta dei conteggi** (#36): una puntina per scegliere i conteggi sempre in vista; pulsanti
  dello zoom − / + accanto alla percentuale (clic = 100%).
- **Nome dal primo H1** (#37): al salvataggio la pergamena prende il nome del titolo in cima, senza
  ricaricare l'editor (cursore, annulla e Marginalia restano). Si spegne dalle Preferenze.
- **Carattere e corpo del testo** (#38, logos v0.2.0) in Esporta e in Layout: caratteri di
  Alexandria, classici dell'HTML (Times New Roman, Georgia…) e famiglie generiche; Typst con Inter e
  JetBrains Mono inclusi.
- **Sezioni della colonna sinistra** (#39): Pergamene, Codex, Armarium, Excerpta e Bibliografia da
  riordinare e nascondere, salvate nel layout del workspace.
- **Divisore negli export** (#40, logos v0.2.1): una riga vuota sopra il `---` in PDF, Word, HTML,
  LaTeX e testo.

## 0.1.3 — 12 ottobre 2026

- **Maniglia dei blocchi** (#27) staccata dal testo e allineata con lo zoom della pagina; lo
  spostamento alla Notion funziona anche nella vista pagina.
- **Vista pagina** senza oscillazioni dei fogli né scorrimento che si trascina (#28) e con salti
  pagina uguali qualunque sia la storia delle modifiche (#29).
- **Riquadri evidenziati** (#30): colore, icona e tipi propri del Compendium
  (`.alexandria/callouts.json`); predefiniti nota, importante, pericolo.
- **Scorciatoie da tastiera personalizzabili** (#31) da Preferenze > Scorciatoie, con conflitti e
  ripristino.
- **Nucleo condiviso `logos`** (#32, #33): 45 moduli puri (Markdown, citazioni, export, ancore,
  revisioni, Tabula, impaginazione) spostati nel repo MIT `marceloesposito/logos` (v0.1.0).
- **Solo Codeberg dentro l'app** (#34): tolti GitHub, GitLab e l'accesso con GitHub; il Rust rifiuta
  altri remoti (oltre alle cartelle locali: chiavetta, NAS). Codeberg e' stato poi tolto nella 0.2.0.
- Collaborazione in tempo reale senza server annotata come lavoro futuro (`docs/COLLABORAZIONE.md`,
  #26).

## 0.1.2 — 10 ottobre 2026

- **Colonne laterali richiudibili** con linguette sul bordo, come in AutoCAD (#24).
- Handover del progetto in `CLAUDE.md` e tabella di `docs/STATO.md` aggiornata (#25).

## 0.1.1 — 6 ottobre 2026

- **Stessa identita' in tutte le lingue** (#18): nomi tematici mai tradotti, glossario con test
  (`src/i18n/glossary.ts`); in italiano lo Scroll resta pergamena. Bookmarks diventa **Excerpta**,
  il sommario diventa **Index**; indice dei contenuti nell'export e bibliografia in un clic; lingua di
  scrittura per Compendium, separata da quella dell'interfaccia.
- Cartelle del Compendium con i nomi dell'app (`Pergamene/`, `Armarium/`), "Pergamena Senza Titolo".
- Tabula: pergamene come nodi fissi, frecce dai quattro lati, miniature nel navigatore.
- Link di siti con controllo anti-bot letti nel motore web dell'app ("Verifica il sito").
- Colore del testo, evidenziatore a colori e **barra flottante di formattazione**.
- **Silentium** (scrittura minimale), testo sempre leggibile fuori dal Silentium, Codex attenuato fuori
  dalla pergamena, blocchi che fanno posto mentre si trascinano.
- **Thesaurus offline** in italiano e inglese (Maiusc+F7 o tasto destro > Cerca sinonimi).
- Riquadri evidenziati (callout), stile di paragrafo Didascalia, carattere per stile (Serif, Sans,
  Monospace).
- Portable Windows con il thesaurus accanto all'eseguibile (#19).
- **Apri Compendium remoto** dalla schermata iniziale (#20).
- **Fonte trascinata nel testo** = apice numerato con nota a pie' di pagina e fonte per esteso; Alt =
  citazione nel testo (#21).
- **Vista pagina con fogli veri**: formato e margini dal Layout, interruzioni di pagina (#22).
- **Aggiungi da un altro Compendium**: pergamene, Marginalia, fonti, tipi e Codex (#23).

## 0.1.0 — 5 ottobre 2026

Prima serie completa (M10 e M11).

- **M10** (#7): aspetto dell'editor Pagina (righelli in cm) o Senza bordi; scrittura minimale a schermo
  intero; conteggi in un'etichetta flottante; tema chiaro/scuro/sistema; risorse trascinate o incollate
  nel testo; **embed con screenshot** della pagina (webview fuori schermo, senza cookie); snippet di
  codice come risorsa; rimozione delle risorse; OpenSSL incluso e build universale macOS; firma ad-hoc,
  portable, embed automatico dei link, PDF e foto funzionanti nell'app nativa.
- Nomi tematici: il vault diventa **Compendium**, in italiano lo Scroll diventa **pergamena**, tab
  Library nella navbar; barra degli strumenti riorganizzabile, navbar stile Affinity, introduzione;
  schermata iniziale per scegliere il Compendium; template e master page; pergamene nella Tabula;
  workspace Beginner, Studio e Pro con pannelli flottanti; History semplificata stile GitHub Desktop.
- **Barra del titolo disegnata dall'app su Windows** (#8).
- Rinomina: Bookshelf -> **Armarium**, History -> **Palimpsestus** (#9), Library -> **Bibliotheca**.
- **Quick switcher** (Ctrl+O), tavolozza dei comandi (`>`), anteprime al passaggio del mouse (#10).
- **Account sui server git** e repository con un clic dal Palimpsestus (#11).
- **Tipi di oggetto** con proprieta', header della pergamena (anche in pagina ed export), **Strata**
  come database (#12); correzione della build dopo il merge (#13).
- **Codex**: pergamene collegate lette ed esportate di seguito, riquadri accanto all'editor (#14).
- Modello di Compendium **Diario** e "Voce di diario di oggi" (#15).
- **Revisioni tracciate** (Suggerisci, accetta/rifiuta), stato dei Marginalia, andata e ritorno con
  Word (#16).
- **Recensio**: copia per revisione `.recensio`, modalita' revisore, ritorno su branch con merge,
  risposta ai revisori (#17).

## 0.0.7a — 5 ottobre 2026

- **M9** (#6): conversione immediata di `$formula$`, `[@citazione]`, `[[collegamento]]` e del Markdown
  incollato; icona dell'app; modalita' di prova fuori schermo con dati separati; workflow degli
  installer Windows e macOS su tag. Prima versione installabile.

## 0.0.6a — 5 ottobre 2026

- **M8 Export** (#5): PDF con Typst, DOCX, HTML, Markdown + BibTeX, TXT, LaTeX + BibTeX; anteprima di
  stampa nell'editor; scheda Layout con pagine mastro e stili; selettore Risorse | Indice nella
  colonna sinistra.

## 0.0.5a — 4 ottobre 2026

- **M6-M7 Risorse** (#4): gestore risorse (import multiformato con OCR, pagine web archiviate come
  testo, YouTube, DOI, BibTeX/RIS), Library globale, whiteboard, grafo, layer stile AutoCAD con filtri
  suggeriti, visualizzatore con pin, citazioni CSL e bibliografia.

## 0.0.4a — 4 ottobre 2026

- **M5 Version control** (#3): timeline con branch paralleli e anteprima al passaggio del mouse, diff
  per paragrafi e parole, commit con messaggio proposto, checkpoint automatici, branch, merge manuale
  con conflitti risolvibili sul posto, ripristino, remoto facoltativo.

## 0.0.3a — 4 ottobre 2026

- **M4 Commenti a margine** (#2): colonna dei commenti con cursore a fumetto, collegamento a parole,
  bolle trascinabili con connettori, risposte, risolti, orfani, ricerca; ancore con citazione e
  contesto.

## 0.0.2a — 4 ottobre 2026

- **M1-M3** (#1): guscio dell'app (menu, navbar, ribbon personalizzabile), vault con salvataggio
  automatico, editor a blocchi con numeri di riga, vista sorgente, trova e sostituisci.

## 0.0.1a — 4 ottobre 2026

- **M0 Setup**: scaffold Tauri 2 + React; backend Rust per file system, git (libgit2), indice SQLite
  FTS5, rete e Typst; Markdown di andata e ritorno (`parse(serialize(doc)) == doc`).
