import { describe, expect, it } from 'vitest';
import { textMenuItems } from './contextMenuModel';

const ids = (c: Parameters<typeof textMenuItems>[0]) => textMenuItems(c).map((i) => (i.disabled ? `(${i.id})` : i.id));

describe('clic destro nel testo', () => {
  it('senza selezione: commento nel punto, niente taglia e copia', () => {
    expect(ids({ selection: false, inLink: false, onComment: false })).toEqual(['comment.add', 'edit.link', '(edit.cut)', '(edit.copy)', 'edit.paste']);
  });
  it('con una selezione su un link', () => {
    expect(ids({ selection: true, inLink: true, onComment: false })).toEqual(['comment.add', 'edit.link', 'edit.unlink', 'edit.cut', 'edit.copy', 'edit.paste']);
  });
  it('su un commento senza selezione si apre quello', () => {
    expect(ids({ selection: false, inLink: false, onComment: true })[0]).toBe('comment.open');
    expect(ids({ selection: true, inLink: false, onComment: true })[0]).toBe('comment.add');
  });
});
