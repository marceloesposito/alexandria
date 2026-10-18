import { describe, expect, it } from 'vitest';
import { MIN_CHANGE, PAUSE_MS, changedChars, shouldSnapshot } from './snapshots';

describe('versioni automatiche', () => {
  it('conta i caratteri cambiati', () => {
    expect(changedChars('abc', 'abc')).toBe(0);
    expect(changedChars('abcdef', 'abXYef')).toBe(2);
    expect(changedChars('abc', 'abcdef')).toBe(3);
    expect(changedChars('aaaa', 'aa')).toBe(2);
  });

  it('dopo una pausa e con abbastanza cambiamenti', () => {
    const last = 'x'.repeat(100);
    const text = last + 'y'.repeat(MIN_CHANGE);
    expect(shouldSnapshot({ last, text, lastEdit: 0, now: PAUSE_MS - 1 })).toBe(false);
    expect(shouldSnapshot({ last, text, lastEdit: 0, now: PAUSE_MS })).toBe(true);
    expect(shouldSnapshot({ last, text: last + 'y', lastEdit: 0, now: PAUSE_MS })).toBe(false);
  });

  it('alla chiusura basta un cambiamento', () => {
    expect(shouldSnapshot({ last: 'a', text: 'ab', lastEdit: 0, now: 1, closing: true })).toBe(true);
    expect(shouldSnapshot({ last: 'a', text: 'a', lastEdit: 0, now: 1, closing: true })).toBe(false);
  });

  it('la prima versione arriva quando il foglio ha del testo', () => {
    expect(shouldSnapshot({ last: null, text: '  ', lastEdit: 0, now: PAUSE_MS, closing: true })).toBe(false);
    expect(shouldSnapshot({ last: null, text: 'ciao', lastEdit: 0, now: 10, closing: true })).toBe(true);
    expect(shouldSnapshot({ last: null, text: 'ciao', lastEdit: 0, now: PAUSE_MS })).toBe(true);
  });
});
