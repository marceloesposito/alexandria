// Prepara gli asset locali dell'OCR (nessun download a runtime: l'app resta offline).
// - worker e core WASM di tesseract.js copiati da node_modules
// - dati delle lingue (tessdata_fast) scaricati una volta e tenuti in public/tessdata
import { copyFileSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';

const LANGS = ['ita', 'eng'];
mkdirSync('public/tesseract/core', { recursive: true });
mkdirSync('public/tessdata', { recursive: true });

copyFileSync('node_modules/tesseract.js/dist/worker.min.js', 'public/tesseract/worker.min.js');
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']) {
  copyFileSync(`node_modules/tesseract.js-core/${f}`, `public/tesseract/core/${f}`);
}

for (const lang of LANGS) {
  const dest = `public/tessdata/${lang}.traineddata`;
  if (existsSync(dest) && statSync(dest).size > 100_000) continue;
  const url = `https://github.com/tesseract-ocr/tessdata_fast/raw/main/${lang}.traineddata`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`OCR: impossibile scaricare ${lang} (${res.status}); l'OCR in questa lingua non sara' disponibile`);
    continue;
  }
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`OCR: ${lang} pronto`);
}
