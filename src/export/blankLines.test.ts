import { describe, it, expect } from 'vitest';
import { keepBlankLines } from './run';
import type { PMNode } from 'logos/doc/types';

const p = (text?: string): PMNode => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : undefined });

describe('keepBlankLines', () => {
  it('trasforma i paragrafi vuoti interni in righe bianche e toglie quelli ai bordi', () => {
    const out = keepBlankLines({ type: 'doc', content: [p(), p('uno'), p(), p(), p('due'), p()] });
    expect(out.content!.map((n) => n.content?.[0]?.text ?? '')).toEqual(['uno', ' ', ' ', 'due']);
  });
});
