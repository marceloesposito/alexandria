// OCR locale con tesseract.js: worker, motore WASM e lingue serviti dall'app stessa.
import type { Worker } from 'tesseract.js';

let worker: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!worker) {
    worker = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker(['ita', 'eng'], 1, {
        workerPath: '/tesseract/worker.min.js',
        corePath: '/tesseract/core',
        langPath: '/tessdata',
        gzip: false,
        workerBlobURL: false,
        cacheMethod: 'none',
      });
    })();
  }
  return worker;
}

/** Testo riconosciuto in un'immagine (o in una pagina di PDF disegnata su canvas). */
export async function recognize(image: Blob | HTMLCanvasElement): Promise<string> {
  const w = await getWorker();
  const res = await w.recognize(image);
  return res.data.text.replace(/[ \t]+\n/g, '\n').trim();
}

export async function ocrPdf(bytes: Uint8Array, onPage?: (i: number, n: number) => void): Promise<string[]> {
  const { openPdf } = await import('./extract');
  const doc = await openPdf(bytes);
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    onPage?.(i, doc.numPages);
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 2 });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width);
    c.height = Math.round(vp.height);
    await page.render({ canvas: c, canvasContext: c.getContext('2d')!, viewport: vp }).promise;
    out.push(await recognize(c));
  }
  return out;
}

export async function terminateOcr() {
  if (worker) {
    const w = await worker;
    await w.terminate();
    worker = null;
  }
}
