// Colore del testo ed evidenziazione a colori nell'editor. Nel DOM il colore e' un attributo
// data-color (il CSS lo traduce nei token del tema), nel Markdown lo stesso attributo in HTML.
import { Mark, mergeAttributes } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import { isHighlightColor, isTextColor, type TextColor } from '../../doc/colors';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textColor: {
      setTextColor: (color: TextColor) => ReturnType;
      unsetTextColor: () => ReturnType;
    };
  }
}

export const TextColorMark = Mark.create({
  name: 'textColor',
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (el) => {
          const c = el.getAttribute('data-color');
          return isTextColor(c) ? c : null;
        },
        renderHTML: (a) => (a.color ? { 'data-color': a.color } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-color]', getAttrs: (el) => (isTextColor((el as HTMLElement).getAttribute('data-color')) ? null : false) }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'tc' }, HTMLAttributes), 0];
  },
  addCommands() {
    return {
      setTextColor:
        (color) =>
        ({ commands }) =>
          commands.setMark(this.name, { color }),
      unsetTextColor:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});

/** Evidenziazione con colore facoltativo (senza colore: il giallo del tema, come prima). */
export const ColorHighlight = Highlight.extend({
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (el) => {
          const c = el.getAttribute('data-color');
          return isHighlightColor(c) ? c : null;
        },
        renderHTML: (a) => (a.color ? { 'data-color': a.color } : {}),
      },
    };
  },
});
