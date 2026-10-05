// Menu "/" per inserire blocchi, come in Notion.
import { Extension, type Editor, type Range } from '@tiptap/core';
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { createRoot, type Root } from 'react-dom/client';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code2,
  Minus,
  Sigma,
  Table,
  Image,
  Footprints,
  SeparatorHorizontal,
  BookOpen,
  Quote as CiteIcon,
  ListTree,
  Pilcrow,
  Paperclip,
  SquareCode,
} from 'lucide-react';
import { t } from '../i18n';
import { runCommand } from '../commands/registry';

interface SlashItem {
  id: string;
  label: string;
  keywords: string;
  icon: React.ComponentType<{ size?: number }>;
  run: (editor: Editor, range: Range) => void;
}

function items(): SlashItem[] {
  const del = (e: Editor, r: Range) => e.chain().focus().deleteRange(r);
  return [
    { id: 'p', label: t('slash.paragraph'), keywords: 'text testo paragrafo', icon: Pilcrow, run: (e, r) => del(e, r).setParagraph().run() },
    { id: 'h1', label: t('slash.h1'), keywords: 'heading titolo h1', icon: Heading1, run: (e, r) => del(e, r).setHeading({ level: 1 }).run() },
    { id: 'h2', label: t('slash.h2'), keywords: 'heading titolo h2', icon: Heading2, run: (e, r) => del(e, r).setHeading({ level: 2 }).run() },
    { id: 'h3', label: t('slash.h3'), keywords: 'heading titolo h3', icon: Heading3, run: (e, r) => del(e, r).setHeading({ level: 3 }).run() },
    { id: 'ul', label: t('slash.bullet'), keywords: 'list elenco puntato', icon: List, run: (e, r) => del(e, r).toggleBulletList().run() },
    { id: 'ol', label: t('slash.ordered'), keywords: 'list elenco numerato', icon: ListOrdered, run: (e, r) => del(e, r).toggleOrderedList().run() },
    { id: 'task', label: t('slash.task'), keywords: 'todo checklist attivita', icon: ListChecks, run: (e, r) => del(e, r).toggleTaskList().run() },
    { id: 'quote', label: t('slash.quote'), keywords: 'blockquote citazione', icon: Quote, run: (e, r) => del(e, r).toggleBlockquote().run() },
    { id: 'code', label: t('slash.code'), keywords: 'code codice', icon: Code2, run: (e, r) => del(e, r).toggleCodeBlock().run() },
    { id: 'hr', label: t('slash.divider'), keywords: 'divider separatore linea', icon: Minus, run: (e, r) => del(e, r).setHorizontalRule().run() },
    { id: 'math', label: t('slash.math'), keywords: 'math formula equazione latex', icon: Sigma, run: (e, r) => del(e, r).insertMathBlock('').run() },
    {
      id: 'table',
      label: t('slash.table'),
      keywords: 'table tabella',
      icon: Table,
      run: (e, r) => del(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      id: 'image',
      label: t('slash.image'),
      keywords: 'image immagine figura',
      icon: Image,
      run: (e, r) => {
        del(e, r).run();
        void runCommand('insert.image');
      },
    },
    {
      id: 'resource',
      label: t('slash.resource'),
      keywords: 'resource risorsa file link embed url pdf bookmark',
      icon: Paperclip,
      run: (e, r) => {
        del(e, r).run();
        void runCommand('res.insert');
      },
    },
    {
      id: 'snippet',
      label: t('slash.snippet'),
      keywords: 'snippet code codice',
      icon: SquareCode,
      run: (e, r) => {
        del(e, r).run();
        void runCommand('res.insertSnippet');
      },
    },
    { id: 'footnote', label: t('slash.footnote'), keywords: 'note nota footnote', icon: Footprints, run: (e, r) => del(e, r).insertFootnote('').run() },
    {
      id: 'cite',
      label: t('slash.citation'),
      keywords: 'cite citazione fonte',
      icon: CiteIcon,
      run: (e, r) => {
        del(e, r).run();
        void runCommand('cite.insert');
      },
    },
    { id: 'pagebreak', label: t('slash.pagebreak'), keywords: 'page break interruzione pagina', icon: SeparatorHorizontal, run: (e, r) => del(e, r).insertPageBreak().run() },
    { id: 'toc', label: t('slash.toc'), keywords: 'toc sommario indice', icon: ListTree, run: (e, r) => del(e, r).insertToc().run() },
    {
      id: 'bib',
      label: t('slash.bibliography'),
      keywords: 'bibliography bibliografia riferimenti',
      icon: BookOpen,
      run: (e, r) => {
        del(e, r).run();
        void runCommand('cite.bibliography');
      },
    },
  ];
}

interface ListHandle {
  onKeyDown: (p: SuggestionKeyDownProps) => boolean;
}

const SlashList = forwardRef<ListHandle, { items: SlashItem[]; command: (i: SlashItem) => void }>(function SlashList(
  { items: list, command },
  ref,
) {
  const [sel, setSel] = useState(0);
  useEffect(() => setSel(0), [list]);
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowDown') {
        setSel((s) => (s + 1) % Math.max(1, list.length));
        return true;
      }
      if (event.key === 'ArrowUp') {
        setSel((s) => (s - 1 + list.length) % Math.max(1, list.length));
        return true;
      }
      if (event.key === 'Enter') {
        if (list[sel]) command(list[sel]);
        return true;
      }
      return false;
    },
  }));
  if (!list.length) return <div className="slash-menu empty">{t('slash.none')}</div>;
  return (
    <div className="slash-menu" role="listbox">
      {list.map((it, i) => (
        <button
          key={it.id}
          role="option"
          aria-selected={i === sel}
          className={`slash-menu__item ${i === sel ? 'is-active' : ''}`}
          onMouseEnter={() => setSel(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            command(it);
          }}
        >
          <it.icon size={16} />
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
});

export const SlashCommands = Extension.create({
  name: 'slashCommands',
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        pluginKey: new PluginKey('slash'),
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        items: ({ query }) => {
          const q = query.toLowerCase();
          return items().filter((i) => !q || i.label.toLowerCase().includes(q) || i.keywords.includes(q)).slice(0, 12);
        },
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let host: HTMLDivElement | null = null;
          let root: Root | null = null;
          let handle: ListHandle | null = null;
          const place = (p: SuggestionProps<SlashItem>) => {
            const rect = p.clientRect?.();
            if (!host || !rect) return;
            host.style.left = `${rect.left}px`;
            const below = rect.bottom + 6;
            host.style.top = `${below + 320 > window.innerHeight ? Math.max(8, rect.top - 326) : below}px`;
          };
          const render = (p: SuggestionProps<SlashItem>) =>
            root?.render(<SlashList ref={(h) => {
                handle = h;
              }} items={p.items} command={(i) => p.command(i)} />);
          return {
            onStart: (p) => {
              host = document.createElement('div');
              host.className = 'slash-host';
              document.body.appendChild(host);
              root = createRoot(host);
              render(p);
              place(p);
            },
            onUpdate: (p) => {
              render(p);
              place(p);
            },
            onKeyDown: (p) => {
              if (p.event.key === 'Escape') {
                host?.remove();
                return true;
              }
              return handle?.onKeyDown(p) ?? false;
            },
            onExit: () => {
              const r = root;
              setTimeout(() => r?.unmount());
              host?.remove();
              host = null;
            },
          };
        },
      }),
    ];
  },
});
