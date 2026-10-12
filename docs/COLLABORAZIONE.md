# Compendium collaborativo in tempo reale, senza server (implementazione futura)

> Idea annotata il 12 ottobre 2026, **non iniziata**. Piano proposto e messo da parte dal committente:
> da riprendere come milestone dedicata (M13 o successiva).

## Contesto
L'utente chiede se un Compendium possa essere modificato da più persone in tempo reale senza un server
proprio. Risposte alle domande:
- **Rete:** LAN e internet.
- **Contenuto:** tutto il Compendium, non solo il testo.
- **Accesso:** con un ticket d'invito; chi non ha il Compendium lo riceve per intero.

Cosa c'è già nel codice:
- **Dipendenze Yjs:** `yjs`, `y-protocols`, `@tiptap/y-tiptap` e `@tiptap/extension-collaboration` sono installate dal M0 ma nessun file le usa.
- **Persistenza dei dati:** pergamene `.md` salvate con debounce da `editor/session.ts`. I file JSON in `.alexandria/` sono scritti interi da `writeJson` (`vault/vault.ts`). Le risorse stanno in `<resDir>/<id>/meta.json`.
- **Ricaricamento:** non c'è nessun watcher. Si ricarica con `useWorkspace.bumpReload()`.

Vincoli di `CLAUDE.md` da rispettare:
- il Rust fa solo I/O;
- la logica sta in funzioni pure testate;
- il Markdown resta la fonte di verità;
- la rete si usa solo su azione esplicita;
- l'app resta sotto i 200 MB.

## Architettura
**Trasporto (Rust): iroh**, nuovo modulo `src-tauri/src/collab.rs`.
- **Connessione:** P2P QUIC cifrato, identità per chiave pubblica. Attraversa i NAT; se il collegamento diretto fallisce passa da un relay (quelli pubblici di n0 oppure un relay proprio indicato nelle Preferenze). In LAN trova i peer da solo (`discovery-local-network`, mDNS) e funziona anche senza internet.
- **Messaggi live:** `iroh-gossip`, un topic per sessione, rete a maglia senza host obbligatorio.
- **Sync iniziale:** stream diretti per la sincronizzazione al momento dell'ingresso.
- **File binari** (PDF, immagini): `iroh-blobs`, indirizzati per hash.
- **Ticket:** contiene `NodeAddr` dell'host e un segreto di sessione. Dal segreto derivano il topic e l'handshake. Chi si collega senza il segreto viene rifiutato.
- **Comandi:** `collab_host`, `collab_join(ticket)`, `collab_send(bytes)`, `collab_leave`, `collab_blob_get/put`. I messaggi in arrivo passano al frontend con un `tauri::ipc::Channel` (oggi nell'app non se ne usa nessuno).
- **Il Rust non interpreta Yjs:** trasporta solo byte.

**Dominio (TS, puro e testato):** nuova cartella `src/collab/`.
- `docSync.ts`: un `Y.Doc` per pergamena (`Y.XmlFragment` legato a TipTap tramite `Collaboration`). Contiene le conversioni pure `fragmentToMarkdown` (y-tiptap → JSON PM → `serializeMarkdown`) e `seedFromMarkdown` (`parseMarkdown` → fragment). Se il `.md` è cambiato fuori sessione, la differenza si applica con `updateYFragment`, che fa un diff e non duplica il testo.
- `jsonSync.ts`: un `Y.Doc` "vault" con una `Y.Map` per ogni file JSON.
  - Gli array con `id` diventano `Y.Map` id → oggetto: commenti, layers, links, nodi/note/frame della whiteboard, types, pins.
  - Elementi diversi modificati in contemporanea si fondono; sullo stesso elemento vince l'ultima scrittura.
  - Funzioni pure: `applyJson(ymap, value, schema)` e `readJson(ymap)`, con lo schema degli id per percorso.
- `fileLayer.ts`: decora la `Platform` durante la sessione.
  - In uscita: `writeText`/`remove`/`rename` su percorsi del vault aggiornano anche il Y.Doc.
  - In entrata: un aggiornamento remoto riscrive il file su disco e chiama `bumpReload()`.
  - Gli store zustand esistenti restano invariati: un unico punto d'aggancio invece di riscrivere ogni store.
- `files.ts`: i file binari stanno nella mappa `path → hash`; i peer scaricano dai blob quelli che mancano.
- `protocol.ts`: buste dei messaggi `{docId, kind: sync1|sync2|update|awareness}` sopra `y-protocols`.
- `session.ts`: store zustand della sessione (stato, peer, ticket).
- **Persistenza:** lo stato Yjs va in `.alexandria-cache/collab/*.ydoc`, che è gitignored. Le modifiche fatte offline si fondono alla riconnessione. Il file vale solo se l'hash del `.md` coincide; altrimenti si rifà il seed con diff.

**Editor:**
- In sessione, `loadDocument` (`editor/session.ts`) lega l'editor al fragment Yjs invece di `setContent`, e l'annulla passa a `yUndoPlugin`.
- Cursori e nomi degli altri: `yCursorPlugin` di `@tiptap/y-tiptap`. Il colore si ottiene con `reviewerColor(name)` (`comments/CommentsColumn.tsx`); il nome viene da `prefs.authorName`.
- In sessione si disattivano la vista sorgente, che diventa sola lettura (oppure si applica con diff), e Recensio.
- Il salvataggio su `.md` resta quello di adesso (debounce 700 ms), e lo fa ogni peer. Anche i peer che non hanno la pergamena aperta la scrivono da `fragmentToMarkdown`.

**Git:**
- **Durante la sessione** solo l'host fa i checkpoint automatici; quelli degli ospiti sono spenti (`startAutoCheckpoints`, `versions/actions.ts`). Il contenuto è identico per tutti, quindi non nascono conflitti.
- **Ingresso senza Compendium:** si trasferisce la storia intera con un pack di libgit2 (`PackBuilder`). In `git.rs` servono `git_pack_export` (pack + refs) e `git_pack_import` (`odb.packwriter` + refs). Il nuovo Compendium si apre con `enterVault`, come fa `OpenRemoteDialog`.
- **Fine sessione:** gli ospiti ricevono il pack dell'host e fanno un fast-forward o un merge banale.

**Interfaccia:**
- Comando `versions.collaborate` nel registro dei comandi, nel menu Palimpsestus e nel ribbon.
- Dialogo "Collabora": **Avvia** mostra il ticket con un pulsante Copia; **Unisciti** incolla il ticket e sceglie la cartella.
- Presenza nella barra del titolo (iniziali colorate) e indicatore di connessione: diretta, via relay o LAN.
- Tutte le stringhe passano da `t()` (`it.ts`/`en.ts`). Il nome tematico va nel glossario (`src/i18n/glossary.ts`), ad esempio "Symposium".

**Browser e test:** `memory.ts` implementa lo stesso contratto con `BroadcastChannel`, così due schede di `npm run dev` collaborano davvero.

## PR in sequenza (ciascuna con CI verde)
1. **Nucleo puro:** `src/collab/docSync.ts`, `jsonSync.ts` e `protocol.ts`, con test vitest di 2-3 `Y.Doc` che convergono:
   - modifiche concorrenti allo stesso paragrafo;
   - commenti diversi aggiunti insieme;
   - spostamenti nella whiteboard;
   - andata e ritorno md → Y → md identica.
2. **Contratto e browser:** contratto `Platform` (`collabHost`/`Join`/`Send`/`Leave`/`onCollabMessage`, blob) in `platform/types.ts` e `memory.ts` (BroadcastChannel). Più `fileLayer`, aggancio dell'editor, dialogo, presenza e cursori. Si prova con due schede.
3. **Rust:** `collab.rs` con iroh (endpoint, gossip, blobs, ticket) e mappatura in `tauri.ts`. Test cargo con due endpoint nello stesso processo (relay spento, indirizzi diretti) che si scambiano messaggi e blob.
4. **Ingresso completo e riconciliazione:** `git_pack_export/import` con test cargo su repo temporanei; ingresso senza Compendium; riconciliazione git a fine sessione.
5. **Rifiniture e documenti:** relay personalizzato nelle Preferenze, indicatore LAN/relay, riconnessione. Aggiornare SPEC e STATO, e nella `CLAUDE.md` la mappa delle funzioni.

## Rischi da tenere d'occhio
- **API di iroh:** cambiano spesso tra le versioni, quindi va fissata una versione esatta. Peso stimato +5-10 MB, entro il limite.
- **Relay pubblici:** sono di terzi (n0). Si usano solo dopo "Avvia/Unisciti", e c'è l'opzione per un relay proprio.
- **Memoria:** per un Compendium molto grande si carica lo stato Yjs delle pergamene in modo pigro, solo all'apertura o quando arriva un aggiornamento.

## Verifica
- `npm test`: test di convergenza e di andata e ritorno in `src/collab/*.test.ts`.
- `npm run test:rust`: due endpoint iroh locali e pack export/import.
- `npm run build`.
- **Browser:** due schede di `npm run dev` con lo stesso Compendium. Si scrive in entrambe, si commenta e si sposta una nota della Tabula, e si controlla che `.md` e JSON finali siano identici.
- **App vera:** Mac e PC Windows del committente su reti diverse (via internet), poi sulla stessa Wi-Fi senza internet (LAN). Ingresso da ticket senza Compendium e controllo della storia git a fine sessione.
