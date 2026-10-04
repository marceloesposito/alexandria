# Alexandria

*An offline writing studio for papers, articles and essays.*
*Uno studio di scrittura offline per paper, articoli e saggi.*

Alexandria è un'app desktop leggera (Tauri) per Windows e macOS. Mette insieme:

- **Editor a blocchi** in stile Notion, con il Markdown come formato dei file:
  blocchi trascinabili, vista sorgente, numeri di riga stabili su una pagina a
  larghezza fissa, conteggio di battute, parole e pagine.
- **Commenti a margine** ancorati a righe, parole o selezioni, con risposte,
  stato "risolto" e una sezione per i commenti orfani.
- **Versioni** con git vero ma nascosto: commit, checkpoint automatici,
  branch, timeline, diff e merge.
- **Risorse**: import di PDF, testi, immagini, pagine web e video, con viste
  whiteboard, grafo e layer filtrabili in stile AutoCAD, pin sulle fonti e una
  Library globale condivisa fra i vault.
- **Citazioni** CSL (APA, MLA, Chicago, IEEE, Harvard, Vancouver e altri) e
  bibliografia con un clic.
- **Export** in PDF (Typst integrato), DOCX, HTML, Markdown, TXT e LaTeX + BibTeX,
  con anteprima e impaginazione.

Tutto resta in una cartella locale (il *vault*), come in Obsidian. Nessun
account, nessun server, nessuna telemetria.

## Sviluppo

```sh
npm install
npm run tauri dev   # app desktop
npm run dev         # sola interfaccia nel browser (file system in memoria)
npm test && npm run test:rust
```

Requisiti: Node 20+, Rust stable e, su Windows, i Build Tools C++ di Visual Studio.

## Licenza

MIT. Gli stili CSL inclusi sono distribuiti dal progetto Citation Style
Language con licenza CC BY-SA 3.0.
