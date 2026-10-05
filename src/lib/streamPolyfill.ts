// WKWebView (macOS) non sa iterare un ReadableStream con `for await`, che pdf.js usa sia nella pagina
// sia nel suo worker. Qui si aggiunge l'iteratore con l'API standard getReader(), solo se manca.
type Iterable = ReadableStream & { [Symbol.asyncIterator]?: unknown; values?: unknown };

export function installStreamIteration(scope: { ReadableStream?: typeof ReadableStream } = globalThis) {
  const RS = scope.ReadableStream;
  if (!RS) return;
  const proto = RS.prototype as Iterable;
  if (typeof proto[Symbol.asyncIterator] === 'function') return;
  async function* values(this: ReadableStream, opts?: { preventCancel?: boolean }) {
    const reader = this.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      if (!opts?.preventCancel) await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }
  Object.defineProperty(proto, 'values', { value: values, configurable: true, writable: true });
  Object.defineProperty(proto, Symbol.asyncIterator, { value: values, configurable: true, writable: true });
}

installStreamIteration();
