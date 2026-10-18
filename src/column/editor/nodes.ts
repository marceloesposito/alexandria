// Nodi del foglio oltre a quelli di StarterKit. Nomi e attributi coincidono con il modello di logos
// (parse/serialize), cosi' un Markdown scritto con Alexandria passa da Column senza perdite. Viste
// leggere in DOM semplice: Column non formatta citazioni, formule o indici, li mostra come segni.
import { Node, Extension, mergeAttributes } from '@tiptap/core';
import type { NodeViewRendererProps } from '@tiptap/core';
import { t } from '../../i18n';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    column: {
      insertFigure: (attrs: { src: string; caption?: string }) => ReturnType;
      insertFootnote: (text?: string) => ReturnType;
    };
  }
}

/** Percorso di un'immagine del foglio -> indirizzo mostrabile (lo imposta il foglio aperto). */
let resolveMedia: (src: string) => string = (s) => s;
export function setMediaResolver(f: (src: string) => string) {
  resolveMedia = f;
}

/** Chi apre una nota a pie' di pagina per modificarla (la imposta l'interfaccia). */
let editFootnote: ((text: string, done: (t: string | null) => void) => void) | null = null;
export function setFootnoteEditor(f: typeof editFootnote) {
  editFootnote = f;
}

function chip(cls: string, text: string, title?: string): HTMLElement {
  const el = document.createElement('span');
  el.className = `fx-chip ${cls}`;
  el.textContent = text;
  if (title) el.title = title;
  el.contentEditable = 'false';
  return el;
}

function atomBlock(name: string, tag: string, attrs: Record<string, unknown>, label: (a: Record<string, unknown>) => string) {
  return Node.create({
    name,
    group: 'block',
    atom: true,
    draggable: true,
    addAttributes: () => Object.fromEntries(Object.entries(attrs).map(([k, d]) => [k, { default: d }])),
    parseHTML: () => [{ tag: `${tag}[data-type="${name}"]` }],
    renderHTML: ({ HTMLAttributes }) => [tag, mergeAttributes(HTMLAttributes, { 'data-type': name })],
    addNodeView:
      () =>
      ({ node }: NodeViewRendererProps) => {
        const dom = document.createElement('div');
        dom.className = `fx-block fx-block--${name}`;
        dom.contentEditable = 'false';
        dom.textContent = label(node.attrs);
        return { dom };
      },
  });
}

function atomInline(name: string, attrs: Record<string, unknown>, text: (a: Record<string, unknown>) => string, title?: (a: Record<string, unknown>) => string) {
  return Node.create({
    name,
    group: 'inline',
    inline: true,
    atom: true,
    addAttributes: () => Object.fromEntries(Object.entries(attrs).map(([k, d]) => [k, { default: d }])),
    parseHTML: () => [{ tag: `span[data-type="${name}"]` }],
    renderHTML: ({ HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { 'data-type': name })],
    renderText: ({ node }) => text(node.attrs),
    addNodeView:
      () =>
      ({ node }: NodeViewRendererProps) => ({ dom: chip(`fx-chip--${name}`, text(node.attrs), title?.(node.attrs)) }),
  });
}

export const Figure = Node.create({
  name: 'figure',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes: () => ({
    src: { default: '' },
    caption: { default: '' },
    title: { default: null },
    placement: { default: 'inline' },
    width: { default: null },
  }),
  parseHTML: () => [{ tag: 'figure[data-type="figure"]' }],
  renderHTML: ({ HTMLAttributes }) => ['figure', mergeAttributes(HTMLAttributes, { 'data-type': 'figure' })],
  addNodeView:
    () =>
    ({ node }: NodeViewRendererProps) => {
      const dom = document.createElement('figure');
      dom.className = 'fx-figure';
      dom.contentEditable = 'false';
      const img = document.createElement('img');
      img.src = resolveMedia(String(node.attrs.src));
      img.alt = String(node.attrs.caption ?? '');
      img.draggable = false;
      dom.appendChild(img);
      if (node.attrs.caption) {
        const cap = document.createElement('figcaption');
        cap.textContent = String(node.attrs.caption);
        dom.appendChild(cap);
      }
      return { dom };
    },
  addCommands() {
    return {
      insertFigure:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { caption: '', ...attrs } }),
    };
  },
});

export const Footnote = Node.create({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes: () => ({ text: { default: '' } }),
  parseHTML: () => [{ tag: 'sup[data-type="footnote"]' }],
  renderHTML: ({ HTMLAttributes }) => ['sup', mergeAttributes(HTMLAttributes, { 'data-type': 'footnote' })],
  renderText: () => '',
  addNodeView:
    () =>
    ({ node, getPos, editor }: NodeViewRendererProps) => {
      const dom = document.createElement('sup');
      dom.className = 'fx-footnote';
      dom.contentEditable = 'false';
      dom.title = String(node.attrs.text ?? '');
      dom.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (!editFootnote || typeof getPos !== 'function') return;
        editFootnote(String(node.attrs.text ?? ''), (t) => {
          const pos = getPos();
          if (t === null || typeof pos !== 'number') return;
          editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { text: t }));
        });
      });
      return { dom };
    },
  addCommands() {
    return {
      insertFootnote:
        (text = '') =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { text } }),
    };
  },
});

export const Embed = atomBlock('embed', 'div', { url: '', title: '', resource: null, image: null }, (a) => `↗ ${a.title || a.url}`);
export const MathBlock = atomBlock('mathBlock', 'div', { latex: '' }, (a) => `$$ ${a.latex} $$`);
export const PageBreak = atomBlock('pageBreak', 'div', {}, () => '— — —');
export const SectionBreak = atomBlock('sectionBreak', 'div', { master: 'body', columns: 1 }, () => '§');
export const Toc = atomBlock('toc', 'nav', {}, () => t('node.toc'));
export const MathInline = atomInline('mathInline', { latex: '' }, (a) => `$${a.latex}$`);
export const Citation = atomInline(
  'citation',
  { items: [] },
  (a) => (a.items as { key: string }[]).map((i) => `@${i.key}`).join('; '),
);
export const Wikilink = atomInline('wikilink', { target: '', alias: null }, (a) => String(a.alias || a.target), (a) => `[[${a.target}]]`);

export const Bibliography = Node.create({
  name: 'bibliography',
  group: 'block',
  content: 'block+',
  defining: true,
  parseHTML: () => [{ tag: 'section[data-type="bibliography"]' }],
  renderHTML: () => ['section', { 'data-type': 'bibliography', class: 'fx-bibliography' }, 0],
});

/** Blocco evidenziato di Alexandria: qui un riquadro semplice, il tipo resta nel Markdown. */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes: () => ({
    kind: { default: 'note', parseHTML: (el) => el.getAttribute('data-kind') ?? 'note', renderHTML: (a) => ({ 'data-kind': a.kind }) },
    title: { default: '', parseHTML: (el) => el.getAttribute('data-title') ?? '', renderHTML: (a) => (a.title ? { 'data-title': a.title } : {}) },
    color: { default: '', parseHTML: (el) => el.getAttribute('data-color') ?? '', renderHTML: (a) => (a.color ? { 'data-color': a.color } : {}) },
    icon: { default: '', parseHTML: (el) => el.getAttribute('data-icon') ?? '', renderHTML: (a) => (a.icon ? { 'data-icon': a.icon } : {}) },
  }),
  parseHTML: () => [{ tag: 'aside[data-type="callout"]' }],
  renderHTML: ({ HTMLAttributes }) => ['aside', { 'data-type': 'callout', class: 'fx-callout', ...HTMLAttributes }, 0],
});

/** Stile del paragrafo (didascalia): si conserva, Column non lo cambia. */
export const ParagraphStyle = Extension.create({
  name: 'paragraphStyle',
  addGlobalAttributes: () => [
    {
      types: ['paragraph'],
      attributes: {
        textStyle: {
          default: null,
          parseHTML: (el) => (el.getAttribute('data-style') === 'caption' ? 'caption' : null),
          renderHTML: (a) => (a.textStyle ? { 'data-style': a.textStyle } : {}),
        },
      },
    },
  ],
});
