// Menu "/" nel testo: gli stessi inserimenti del "+" della barretta, cercati per nome.
import { Extension } from '@tiptap/core';
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { createRoot, type Root } from 'react-dom/client';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { t } from '../../i18n';
import { insertItems, type InsertItem } from './insertItems';

interface ListHandle {
  onKeyDown: (p: SuggestionKeyDownProps) => boolean;
}

const SlashList = forwardRef<ListHandle, { items: InsertItem[]; command: (i: InsertItem) => void }>(function SlashList({ items: list, command }, ref) {
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
  if (!list.length) return <div className="fx-menu fx-slash is-empty">{t('slash.none')}</div>;
  return (
    <div className="fx-menu fx-slash" role="listbox">
      {list.map((it, i) => (
        <button
          key={it.id}
          role="option"
          aria-selected={i === sel}
          className={`fx-menu__item ${i === sel ? 'is-active' : ''}`}
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

export const SlashMenu = Extension.create({
  name: 'slashMenu',
  addProseMirrorPlugins() {
    return [
      Suggestion<InsertItem>({
        editor: this.editor,
        pluginKey: new PluginKey('slash'),
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        items: ({ query }) => {
          const q = query.toLowerCase();
          return insertItems().filter((i) => !q || i.label.toLowerCase().includes(q) || i.keywords.includes(q)).slice(0, 12);
        },
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run();
          props.run(editor);
        },
        render: () => {
          let host: HTMLDivElement | null = null;
          let root: Root | null = null;
          let handle: ListHandle | null = null;
          const place = (p: SuggestionProps<InsertItem>) => {
            const rect = p.clientRect?.();
            if (!host || !rect) return;
            host.style.left = `${rect.left}px`;
            const below = rect.bottom + 6;
            host.style.top = `${below + 340 > window.innerHeight ? Math.max(8, rect.top - 346) : below}px`;
          };
          const render = (p: SuggestionProps<InsertItem>) =>
            root?.render(
              <SlashList
                ref={(h) => {
                  handle = h;
                }}
                items={p.items}
                command={(i) => p.command(i)}
              />,
            );
          return {
            onStart: (p) => {
              host = document.createElement('div');
              host.className = 'fx-slash-host';
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
