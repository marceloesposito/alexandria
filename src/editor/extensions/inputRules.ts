// Scrittura veloce in sintassi Markdown/Pandoc: $formula$, [@citazione], [[collegamento]]
// diventano subito nodi; il Markdown incollato come testo diventa formattato.
import { Extension, InputRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Slice, Fragment } from '@tiptap/pm/model';
import { parseCitation } from '../../doc/citeSyntax';
import { parseMarkdown } from '../../doc/parse';

/** Testo incollato che sembra Markdown (titoli, enfasi, elenchi, citazioni, formule, tabelle). */
export function looksLikeMarkdown(text: string): boolean {
  return /(^|\n)(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|\|.+\|)|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\[@[^\]]+\]|\$[^$\n]+\$|\[\^\d+\]/.test(text);
}

export const MarkdownShortcuts = Extension.create({
  name: 'markdownShortcuts',
  // prima degli altri: il Markdown incollato va riconosciuto prima del trattamento standard
  priority: 1000,
  addInputRules() {
    const { schema } = this.editor;
    return [
      new InputRule({
        find: /(?:^|[^$\\])\$([^$\n]+)\$$/,
        handler: ({ state, range, match }) => {
          const latex = match[1];
          const start = range.from + (match[0].length - latex.length - 2);
          state.tr.replaceWith(start, range.to, schema.nodes.mathInline.create({ latex }));
        },
      }),
      new InputRule({
        find: /\[([^[\]]*-?@[^[\]]+)\]$/,
        handler: ({ state, range, match }) => {
          const items = parseCitation(match[1]);
          if (!items) return null;
          state.tr.replaceWith(range.from, range.to, schema.nodes.citation.create({ items }));
        },
      }),
      new InputRule({
        find: /\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]$/,
        handler: ({ state, range, match }) => {
          state.tr.replaceWith(range.from, range.to, schema.nodes.wikilink.create({ target: match[1].trim(), alias: match[2]?.trim() ?? null }));
        },
      }),
    ];
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey('markdownPaste'),
        props: {
          handlePaste(view, event) {
            // solo testo semplice (non HTML da un'altra app) che sembra Markdown
            const data = event.clipboardData;
            const text = data?.getData('text/plain') ?? '';
            if (!text || data?.getData('text/html') || !looksLikeMarkdown(text)) return false;
            if (view.state.selection.$from.parent.type.name === 'codeBlock') return false;
            try {
              const doc = editor.schema.nodeFromJSON(parseMarkdown(text));
              // un solo paragrafo si incolla in linea, piu' blocchi come blocchi
              const md =
                doc.childCount === 1 && doc.firstChild!.type.name === 'paragraph'
                  ? new Slice(Fragment.from(doc.firstChild!.content), 0, 0)
                  : new Slice(doc.content, 0, 0);
              view.dispatch(view.state.tr.replaceSelection(md).scrollIntoView());
              return true;
            } catch {
              return false;
            }
          },
        },
      }),
    ];
  },
});
