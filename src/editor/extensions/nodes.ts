// Nodi di Alexandria oltre a quelli di StarterKit. I nomi e gli attributi coincidono con
// il modello di src/doc (parse/serialize), cosi' il JSON dell'editor e' gia' il documento.
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { FigureView, MathBlockView, MathInlineView, FootnoteView, CitationView, WikilinkView, SectionBreakView, TocView, BibliographyView } from './views';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    alexandria: {
      insertFigure: (attrs: { src: string; caption?: string }) => ReturnType;
      insertMathBlock: (latex?: string) => ReturnType;
      insertMathInline: (latex?: string) => ReturnType;
      insertFootnote: (text?: string) => ReturnType;
      insertCitation: (items: { key: string; locator?: string }[]) => ReturnType;
      insertWikilink: (target: string) => ReturnType;
      insertPageBreak: () => ReturnType;
      insertSectionBreak: (attrs?: { master?: string; columns?: number }) => ReturnType;
      insertToc: () => ReturnType;
    };
  }
}

export const Figure = Node.create({
  name: 'figure',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: '' },
      caption: { default: '' },
      title: { default: null },
      placement: { default: 'inline' },
      width: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'figure[data-type="figure"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes, { 'data-type': 'figure' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(FigureView);
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

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { latex: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="math-block"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'math-block' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView);
  },
  addCommands() {
    return {
      insertMathBlock:
        (latex = '') =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { latex } }),
    };
  },
});

export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { latex: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'span[data-type="math-inline"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'math-inline' })];
  },
  renderText({ node }) {
    return `$${node.attrs.latex}$`;
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathInlineView);
  },
  addCommands() {
    return {
      insertMathInline:
        (latex = '') =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { latex } }),
    };
  },
});

export const Footnote = Node.create({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { text: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'sup[data-type="footnote"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes(HTMLAttributes, { 'data-type': 'footnote' })];
  },
  renderText() {
    return '';
  },
  addNodeView() {
    return ReactNodeViewRenderer(FootnoteView);
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

export const Citation = Node.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { items: { default: [] } };
  },
  parseHTML() {
    return [{ tag: 'span[data-type="citation"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-type': 'citation' }, { 'data-items': JSON.stringify(HTMLAttributes.items ?? []) })];
  },
  renderText({ node }) {
    return (node.attrs.items as { key: string }[]).map((i) => `@${i.key}`).join('; ');
  },
  addNodeView() {
    return ReactNodeViewRenderer(CitationView);
  },
  addCommands() {
    return {
      insertCitation:
        (items) =>
        ({ commands }) =>
          commands.insertContent([{ type: this.name, attrs: { items } }]),
    };
  },
});

export const Wikilink = Node.create({
  name: 'wikilink',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { target: { default: '' }, alias: { default: null } };
  },
  parseHTML() {
    return [{ tag: 'a[data-type="wikilink"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['a', mergeAttributes(HTMLAttributes, { 'data-type': 'wikilink' })];
  },
  renderText({ node }) {
    return node.attrs.alias || node.attrs.target;
  },
  addNodeView() {
    return ReactNodeViewRenderer(WikilinkView);
  },
  addCommands() {
    return {
      insertWikilink:
        (target) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { target } }),
    };
  },
});

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  draggable: true,
  parseHTML() {
    return [{ tag: 'div[data-type="page-break"]' }];
  },
  renderHTML() {
    return ['div', { 'data-type': 'page-break', class: 'page-break' }];
  },
  addCommands() {
    return {
      insertPageBreak:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
});

export const SectionBreak = Node.create({
  name: 'sectionBreak',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { master: { default: 'body' }, columns: { default: 1 } };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="section-break"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'section-break' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(SectionBreakView);
  },
  addCommands() {
    return {
      insertSectionBreak:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});

export const Toc = Node.create({
  name: 'toc',
  group: 'block',
  atom: true,
  draggable: true,
  parseHTML() {
    return [{ tag: 'nav[data-type="toc"]' }];
  },
  renderHTML() {
    return ['nav', { 'data-type': 'toc' }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(TocView);
  },
  addCommands() {
    return {
      insertToc:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
});

export const Bibliography = Node.create({
  name: 'bibliography',
  group: 'block',
  content: 'block+',
  defining: true,
  draggable: true,
  parseHTML() {
    return [{ tag: 'section[data-type="bibliography"]' }];
  },
  renderHTML() {
    return ['section', { 'data-type': 'bibliography' }, 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(BibliographyView);
  },
});
