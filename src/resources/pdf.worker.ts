// Worker di pdf.js con l'iterazione dei ReadableStream aggiunta prima (WKWebView non ce l'ha).
import '../lib/streamPolyfill';
import 'pdfjs-dist/legacy/build/pdf.worker.mjs';
