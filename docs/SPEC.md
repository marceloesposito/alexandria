# Alexandria â€” app desktop di scrittura per paper e saggi

## Context
Nuovo progetto, separato da EZDH. L'utente vuole un editor offline e leggero (< 200 MB, niente
wrapper di webapp remote) per scrivere paper/articoli/saggi con: editor a blocchi con numeri di riga
e commenti ancorati, version control stile git, gestore risorse (whiteboard/grafo/layer) con pin e
citazioni CSL, ribbon personalizzabile. Invece di un prompt, l'utente ha chiesto di **creare
direttamente un repo pubblico separato e costruire l'app in modalitÃ  auto**.

## Decisioni prese
- **Stack**: Tauri 2 (Rust) + React 19 + TypeScript + Vite + Zustand. Target Windows + macOS. UI i18n IT+EN.
- **Offline totale**: CSP rigida, nessuno script remoto; rete solo su azione esplicita (import di un link,
  "cerca metadati DOI/ISBN", push/pull remoto, play YouTube via youtube-nocookie).
- **Editor**: TipTap/ProseMirror WYSIWYG a blocchi trascinabili (drag handle, slash menu) + toggle vista
  sorgente (CodeMirror 6). Pagina a **larghezza fissa** â†’ righe visive stabili e numerate in un gutter,
  identiche al PDF con numeri di riga; in vista sorgente numeri delle righe del .md.
- **Vault = progetto** (piÃ¹ documenti .md, risorse condivise), repo git (crate `git2`) nascosto.
- **Library globale** fuori dai vault, non versionata, indice SQLite+FTS5 (sha256 dedup, CSL-JSON, testo,
  miniatura, tag). Nel vault solo una scheda leggera versionata; azione "Copia nel vault".
- **Citazioni**: citation-js + citeproc, stili CSL inclusi (APA, MLA, Chicago A-D e note, IEEE, Harvard,
  Vancouver) + import .csl; locali it/en. Sintassi Pandoc nel .md: `[@key, p. 12]`.
- **PDF** con Typst integrato (crate `typst`, font inclusi). Export anche .txt .docx .md .html .tex+.bib.
- **Commenti**: thread, risolto, versionati, Orfani, ricerca. Ancore stile W3C (TextQuote + posizione) con
  ri-ancoraggio fuzzy.
- **Versioni**: autosave continuo, checkpoint automatici (piccoli in timeline, compattabili), messaggio di
  commit suggerito deterministico, remoto opzionale (token nel keychain). Merge = diff unificato con
  regioni di conflitto risolvibili inline (mio / loro / entrambi / modifica).
- **Layer stile AutoCAD**: appartenenza multipla, on/off, lock, colore; filtri di gruppo annidabili e di
  proprietÃ  a regole; tag; **suggerimenti automatici** deterministici (metadati + TF-IDF + clustering,
  con motivazione) che l'utente accetta o disattiva.
- **Web/YouTube archiviati all'import** (Readability + og:image + screenshot best-effort); OCR con
  tesseract.js locale (ita+eng inclusi).
- **Stile visivo**: sobrio da scrittura (carta/inchiostro, serif nel testo, sans nell'UI), chiaro/scuro.
- **Repo**: `marceloesposito/alexandria`, **pubblico**, in `C:\Users\espos\Documents\GitHub\alexandria`.
  Licenza MIT (citeproc resta sotto CPAL, con attribuzione).

## Layout del vault
```
MioVault/
  .git/
  documents/*.md                      testo (citazioni in sintassi Pandoc)
  resources/<id>/file + meta.json     risorse del vault (CSL-JSON, pin, tag, layer)
  .alexandria/ vault.json, comments/<doc>.json, whiteboard.json, layers.json, links.json, doc-settings/<doc>.json
  .alexandria-cache/  (gitignored) index.sqlite, miniature, testo estratto/OCR
```
Lo stato dell'app (ultimo vault/file, cursore, ribbon personalizzato, preferenze) sta nella config
dir di Tauri, non nel vault. Primo avvio â†’ vault di default + documento nuovo; poi â†’ ultimo file.

## Interfaccia
1. **Menu**: File, Modifica, Inserisci, Formato, Visualizza, Versioni, Risorse, Preferenze, Aiuto (voci
   come da bozza: Nuovo/Apri/Recenti/Vault/Esporta/Stampa/Impostazioni documento; Trova e sostituisci regex,
   Vai a riga; personalizza toolbar, colonne, numeri di riga, focus, zoom, tema; scorciatoie, guida).
2. **Mini navbar**: Risorse Â· Editor Â· Versioni.
3. **Ribbon contestuale** grande con icone (Lucide), a schede per vista. Editor: Home, Inserisci,
   Riferimenti (citazione, bibliografia, nota, stile), Revisione (commenti, conteggi, numeri di riga),
   Visualizza. Risorse: Aggiungi, Viste, Strumenti whiteboard, Filtri/Layer, Tag. Versioni: Commit, Branch,
   Confronta, Unisci, Remoto. Personalizzazione con tasto destro o da Visualizza: drag di comandi fra
   schede e gruppi, icone grandi/piccole, reset, import/export JSON.
4. **Editor a 3 colonne**:
   - Sinistra: albero gerarchico delle risorse (layer/cartelle) + sezione **Pinned**; drag sul testo
     inserisce la citazione inline (con locator del pin).
   - Centro: pagina, gutter con i numeri di riga, status bar (battute con/senza spazi, parole, pagine stimate
     dal formato in Impostazioni documento, riga/colonna).
   - Destra: colonna commenti, cursore a fumetto, hover â†’ evidenzia la riga, click â†’ bolla, Invio â†’ crea;
     hover sulla bolla â†’ X + pallino; drag dal pallino a una parola o alla selezione â†’ collegamento
     (connettore SVG); dopo il collegamento la bolla si trascina liberamente in verticale.
5. **Versioni**: timeline orizzontale, pallini con timestamp, branch come linee parallele dal punto di
   divergenza, hover â†’ "X righe aggiunte/rimosse/modificate: [estratto]"; vista diff; merge.
6. **Risorse**: vuota con "+" â†’ modale con drop zone multipla e campo link; riconoscimento automatico del
   formato (txt, md, rtf, pdf, docx, odt, epub, html, immagini, bib/ris, URL web, YouTube) â†’ anteprima uniforme
   in card. Viste: Whiteboard (@xyflow/react, connessioni trascinate), Grafo (d3-force su canvas, link
   interni/[[wikilink]]/hyperlink/connessioni), Layer. Visualizzatore interno: pdf.js con text layer,
   lettore di testo, immagini, pagine archiviate, video; pin = selezione di testo, rettangolo o timestamp.

7. **Anteprima export e impaginazione** (richiesta aggiunta): nell'editor, pannello/split "Anteprima"
   che rende le pagine reali via Typst (SVG per pagina, aggiornamento con debounce, zoom, salto
   paginaâ†”blocco). Strumenti di impaginazione stile InDesign semplificato, nella scheda ribbon "Layout":
   formato pagina e margini, colonne (1â€“3) e gutter, pagine mastro (frontespizio, corpo, con
   intestazioni/piÃ¨ di pagina e numeri di pagina variabili), stili di paragrafo e carattere con nome
   (font, corpo, interlinea, spaziature, rientri, sillabazione, vedove/orfane), griglia di base opzionale,
   interruzioni di pagina/sezione, figure con didascalia e posizionamento (in linea/alto/basso/a piena
   larghezza), sommario automatico. Il layout Ã¨ salvato in `doc-settings/<doc>.json` e preset riusabili.

## Milestone (branch + PR + merge con CI verde per ciascuna)
- **M0 Setup**: installare Rustup + VS 2022 Build Tools (workload C++) via winget; scaffold Tauri+React; repo
  pubblico con gh; CI GitHub Actions (vitest, tsc, cargo test, build Win/mac); CLAUDE.md, docs/SPEC.md (questa specifica).
- **M1 Shell**: menu, navbar, ribbon con registro comandi + personalizzazione, i18n, temi, persistenza di stato, avvio sull'ultimo file.
- **M2 Vault e file**: apertura/creazione vault, albero documenti, autosave, watcher, round-trip Markdown testato.
- **M3 Editor**: blocchi, drag, slash menu, formattazione completa, trova/sostituisci, tabelle, note, equazioni
  KaTeX, toggle sorgente, numeri di riga, conteggi.
- **M4 Commenti**: colonna, bolle, ancore, connettori, thread, risolti, orfani, ricerca.
- **M5 Versioni**: git2 (commit, checkpoint, branch, diff, merge con conflitti), timeline, messaggi suggeriti, remoto.
- **M6 Risorse**: import multiformato + OCR + archiviazione web, indice SQLite FTS5, Library globale, viste Whiteboard/Grafo/Layer, tag, suggerimenti.
- **M7 Pin e citazioni**: visualizzatore e pin, colonna sinistra + Pinned, dragâ†’citazione, stili CSL in
  Impostazioni documento, bibliografia con un click (generata, poi modificabile).
- **M8 Export, anteprima, layout**: anteprima Typst nell'editor, scheda Layout (mastri, stili, colonne), Typst PDF (numeri di riga opzionali, template), txt, md, html, docx, tex+bib.
- **M9 Rifiniture**: scorciatoie, guida, accessibilitÃ , installer Win (.msi/.exe) e mac (.dmg, solo in CI), controllo dimensione.

## Verifica
- Unit test (vitest) per i motori deterministici: round-trip md, conteggi, ancore e ri-ancoraggio, sommario
  diff, messaggi di commit, filtri a regole, TF-IDF/clustering, citazioni (output atteso per APA/MLA/IEEE).
- `cargo test` per vault, git (commit/branch/merge/conflitti su repo temporanei), indice, import, export Typst.
- Flussi UI provati in un browser vero: Playwright sul frontend Vite con mock dell'API Tauri, e avvio
  reale di `tauri dev` con screenshot dei flussi principali (commento collegato, commit + hover timeline,
  import bulk, pin â†’ citazione, export PDF).
- `tauri build` su Windows: installer < 200 MB, app avviata senza rete.
- Report finale all'utente in italiano: link del repo, PR, stato di ogni milestone, cosa resta.
