import { describe, expect, it } from 'vitest';
import { installStreamIteration } from './streamPolyfill';

describe('iterazione dei ReadableStream', () => {
  it('aggiunge for await a un ReadableStream che non lo supporta', async () => {
    // un ReadableStream "alla WebKit": senza iteratore asincrono
    class Plain extends (ReadableStream as unknown as { new (src: UnderlyingDefaultSource<string>): ReadableStream<string> }) {}
    Object.defineProperty(Plain.prototype, Symbol.asyncIterator, { value: undefined, configurable: true, writable: true });
    installStreamIteration({ ReadableStream: Plain as unknown as typeof ReadableStream });
    const s = new Plain({
      start(c) {
        c.enqueue('a');
        c.enqueue('b');
        c.close();
      },
    });
    const out: string[] = [];
    for await (const v of s as unknown as AsyncIterable<string>) out.push(v);
    expect(out).toEqual(['a', 'b']);
  });
});
