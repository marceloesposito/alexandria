---
name: glossario
description: Nomi tematici dell'interfaccia di Alexandria (latini - Compendium, pergamena, Scriptorium, Armarium, Palimpsestus, Tabula...) e di Column (redazione - Piece, Copy, Clips, Editions...) e regole delle traduzioni. Da usare quando si scrivono o cambiano testi visibili, chiavi i18n (it.ts, en.ts) o nomi di funzioni nell'interfaccia.
---

# Glossario dei nomi tematici

Gli ambienti e gli oggetti hanno nomi propri latini, **uguali in tutte le lingue** (mai tradotti).
Unica eccezione voluta dal committente: in italiano lo Scroll si chiama **pergamena**.

| Nome | Cos'e' | Era |
| --- | --- | --- |
| Compendium | il vault (cartella di lavoro) | vault |
| Scroll / pergamena (it) | il documento | — |
| Scriptorium | l'editor | — |
| Armarium | le risorse | Bookshelf |
| Palimpsestus | le versioni | History |
| Bibliotheca | la raccolta comune | Library |
| Marginalia | i commenti | — |
| Tabula | la whiteboard | — |
| Excerpta / Excerptum | i pin | Bookmarks |
| Strata | i layer | — |
| Codex | pergamene collegate lette di seguito | Librum |
| Index | l'indice dei contenuti | — |
| Silentium | la scrittura minimale | zen |
| Recensio | la copia per revisione (`.recensio`) | — |

## Regole
- Gli identificatori interni non sono cambiati (`resources`, `versions`, `view === 'resources'`...).
- In inglese i nomi vanno con la maiuscola (`Scrolls`), altrimenti il test del glossario fallisce.
- Parole da evitare in ogni lingua (il test le cerca in tutti i testi): vault, bookshelf, scaffale,
  storia, cronologia, history, lavagna, whiteboard, board, bookmark, segnalibro, indice, sommario,
  outline, libreria, biblioteca, zen, "scrittura minimale"; in inglese anche "scroll" minuscolo.
- Ogni stringa visibile passa da `t()` (`src/i18n/`), con la chiave sia in `it.ts` sia in `en.ts`;
  le variabili `{nome}` devono coincidere fra le lingue.
- Elenco e controlli: `src/i18n/glossary.ts` e `src/i18n/i18n.test.ts`.

## Column (ramo `column`)
Column non usa i nomi latini: il lessico e' quello della redazione e delle macchine da scrivere,
sempre nomi propri uguali in ogni lingua. Eccezione: in italiano il Piece e' il **pezzo**.

| Nome | Cos'e' | In Alexandria |
| --- | --- | --- |
| Piece / pezzo (it) | il documento (file `.clmn`) | Scroll |
| Copy | l'editor | Scriptorium |
| Clips | blocchi e collegamenti del pezzo | Tabula / Armarium |
| Editions | l'albero delle versioni | Palimpsestus |
| Queries | i commenti | Marginalia |
| Rundown | la struttura del testo | Index |
| Typewriter | la scrittura minimale | Silentium |

Il timer resta "timer pomodoro" (Deadline e' stato scartato). Compendium resta (e' Alexandria). Da evitare: i nomi latini sopra, fogli/sheets, whiteboard,
lavagna, history, cronologia, index, indice, sommario, outline, zen. "Copy" come comando degli
appunti (`cmd.edit.copy`) e' escluso dal controllo.
