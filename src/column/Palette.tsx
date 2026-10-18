// ⌘K: fogli, comandi e testo del foglio, cercati per nome.
import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Command as CmdIcon, TextSearch } from 'lucide-react';
import { fuzzyScore } from 'logos/lib/fuzzy';
import { useColumn } from './store';
import { useUi } from './ui';
import { displayName } from './format';
import { paletteCommands, runCommand } from './commands';
import { getEditor } from './editor/editorRef';
import { shortcutLabel } from './keys';
import { t, useLang } from '../i18n';

interface Hit {
  key: string;
  kind: 'sheet' | 'command' | 'text';
  label: string;
  detail?: string;
  run: () => void;
}

function textHits(q: string): Hit[] {
  const editor = getEditor();
  if (!editor || q.length < 2) return [];
  const out: Hit[] = [];
  const needle = q.toLowerCase();
  editor.state.doc.descendants((n, pos) => {
    if (!n.isTextblock || out.length >= 8) return out.length < 8;
    const text = n.textContent;
    const i = text.toLowerCase().indexOf(needle);
    if (i >= 0) {
      const from = Math.max(0, i - 30);
      out.push({
        key: `t${pos}`,
        kind: 'text',
        label: (from ? '…' : '') + text.slice(from, i + q.length + 40),
        run: () => {
          // posizione del carattere dentro il blocco (i nodi atomici contano 1)
          let at = pos + 1;
          let seen = 0;
          n.forEach((child, offset) => {
            if (seen > i) return;
            const len = child.isText ? child.text!.length : 1;
            if (seen + len > i) at = pos + 1 + offset + (child.isText ? i - seen : 0);
            seen += len;
          });
          editor.chain().focus().setTextSelection({ from: at, to: at + q.length }).scrollIntoView().run();
        },
      });
    }
    return false;
  });
  return out;
}

export function Palette() {
  useLang();
  const open = useUi((s) => s.palette);
  const sheets = useColumn((s) => s.sheets);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      setTimeout(() => input.current?.focus(), 0);
    }
  }, [open]);

  const hits = useMemo<Hit[]>(() => {
    if (!open) return [];
    const close = () => useUi.getState().setPalette(false);
    const score = (s: string) => (q ? (fuzzyScore(q, s) ?? -Infinity) : 0);
    const sheetHits = sheets
      .map((s) => ({ s, name: displayName({ meta: { name: s.name } as never, markdown: s.preview }, t('sheet.untitled')) }))
      .map((x) => ({ x, sc: score(x.name) }))
      .filter((x) => x.sc > -Infinity)
      .sort((a, b) => b.sc - a.sc)
      .slice(0, 6)
      .map(({ x }) => ({
        key: `s${x.s.id}`,
        kind: 'sheet' as const,
        label: x.name,
        run: () => {
          close();
          void useColumn.getState().open(x.s.id);
        },
      }));
    const cmdHits = paletteCommands()
      .map((c) => ({ c, sc: score(t(c.label)) }))
      .filter((x) => x.sc > -Infinity)
      .sort((a, b) => b.sc - a.sc)
      .slice(0, q ? 8 : 6)
      .map(({ c }) => ({
        key: `c${c.id}`,
        kind: 'command' as const,
        label: t(c.label),
        detail: c.shortcut ? shortcutLabel(c.shortcut) : undefined,
        run: () => {
          close();
          runCommand(c.id);
        },
      }));
    const text = textHits(q).map((h) => ({ ...h, run: () => (close(), h.run()) }));
    return [...sheetHits, ...cmdHits, ...text];
  }, [open, q, sheets]);

  if (!open) return null;
  const go = (h?: Hit) => h?.run();
  const ICON = { sheet: FileText, command: CmdIcon, text: TextSearch };
  return (
    <div className="fx-palette-backdrop" onMouseDown={() => useUi.getState().setPalette(false)}>
      <div className="fx-palette" role="dialog" aria-label={t('palette.title')} onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={input}
          className="fx-palette__input"
          value={q}
          placeholder={t('palette.placeholder')}
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') useUi.getState().setPalette(false);
            else if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSel((s) => Math.min(hits.length - 1, s + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSel((s) => Math.max(0, s - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              go(hits[sel]);
            }
          }}
        />
        <ul className="fx-palette__list" role="listbox">
          {hits.map((h, i) => {
            const Icon = ICON[h.kind];
            const head = i === 0 || hits[i - 1].kind !== h.kind;
            return (
              <li key={h.key}>
                {head && <div className="fx-palette__group">{t(`palette.group.${h.kind}`)}</div>}
                <button role="option" aria-selected={i === sel} className={`fx-palette__item ${i === sel ? 'is-active' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => go(h)}>
                  <Icon size={15} />
                  <span className="fx-palette__label">{h.label}</span>
                  {h.detail && <kbd>{h.detail}</kbd>}
                </button>
              </li>
            );
          })}
          {!hits.length && <li className="fx-empty">{t('palette.none')}</li>}
        </ul>
      </div>
    </div>
  );
}
