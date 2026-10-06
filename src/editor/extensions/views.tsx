// Viste React dei nodi speciali dell'editor.
import { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react';
import katex from 'katex';
import { t } from '../../i18n';
import { docTexts, useWritingLang } from '../../i18n/writing';
import { Popover } from '../../components/Popover';
import { useWorkspace } from '../../state/workspace';
import { assetUrl } from '../../vault/resolve';
import { citationRenderer, useCitationTick } from '../../citations/renderer';
import { formatCitation, parseCitation } from '../../doc/citeSyntax';
import type { CitationItem } from '../../doc/types';
import { runCommand } from '../../commands/registry';
import { useDocSettings } from '../../layout/docSettings';
import { masterLabel } from '../../layout/TemplatesView';
import { HoverCard, useHoverCard } from '../../components/HoverCard';
import { DocPreview } from '../../shell/DocPreview';
import { citationPreview } from '../slots';
import { Info, Lightbulb, Star, TriangleAlert, OctagonAlert } from 'lucide-react';
import { CALLOUT_KINDS, isCalloutKind, type CalloutKind } from '../../doc/callouts';

function Katex({ latex, display }: { latex: string; display: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(latex || '\\square', ref.current, { displayMode: display, throwOnError: false, trust: false });
    } catch {
      ref.current.textContent = latex;
    }
  }, [latex, display]);
  return <span ref={ref} />;
}

function useEditing(props: NodeViewProps) {
  const [open, setOpen] = useState(false);
  // un nodo appena inserito e vuoto si apre subito in modifica
  useEffect(() => {
    if (props.selected && open === false && isEmptyAtom(props)) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.selected]);
  return [open, setOpen] as const;
}

function isEmptyAtom(p: NodeViewProps): boolean {
  const a = p.node.attrs;
  if (p.node.type.name === 'mathBlock' || p.node.type.name === 'mathInline') return !a.latex;
  if (p.node.type.name === 'footnote') return !a.text;
  return false;
}

export function MathBlockView(props: NodeViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useEditing(props);
  const [draft, setDraft] = useState(props.node.attrs.latex as string);
  useEffect(() => setDraft(props.node.attrs.latex), [props.node.attrs.latex]);
  return (
    <NodeViewWrapper className={`nv-math-block ${props.selected ? 'is-selected' : ''}`} data-drag-handle>
      <div ref={ref} className="nv-math-block__render" onDoubleClick={() => setOpen(true)} title={t('editor.math.edit')}>
        <Katex latex={props.node.attrs.latex} display />
      </div>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)}>
        <div className="popover__form">
          <label className="field-label">{t('editor.math.latex')}</label>
          <textarea
            className="input mono"
            rows={4}
            autoFocus
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              props.updateAttributes({ latex: e.target.value });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) setOpen(false);
            }}
          />
          <div className="popover__preview">
            <Katex latex={draft} display />
          </div>
        </div>
      </Popover>
    </NodeViewWrapper>
  );
}

export function MathInlineView(props: NodeViewProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useEditing(props);
  return (
    <NodeViewWrapper as="span" className={`nv-math-inline ${props.selected ? 'is-selected' : ''}`}>
      <span ref={ref} onClick={() => setOpen(true)} title={t('editor.math.edit')}>
        <Katex latex={props.node.attrs.latex} display={false} />
      </span>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)}>
        <div className="popover__form">
          <input
            className="input mono"
            autoFocus
            value={props.node.attrs.latex}
            placeholder="a^2 + b^2"
            onChange={(e) => props.updateAttributes({ latex: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && setOpen(false)}
          />
        </div>
      </Popover>
    </NodeViewWrapper>
  );
}

export function FootnoteView(props: NodeViewProps) {
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useEditing(props);
  return (
    <NodeViewWrapper as="sup" className={`nv-footnote ${props.selected ? 'is-selected' : ''}`}>
      <span ref={ref} className="nv-footnote__ref" onClick={() => setOpen(true)} title={props.node.attrs.text || t('editor.footnote.empty')} />
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)}>
        <div className="popover__form">
          <label className="field-label">{t('editor.footnote.label')}</label>
          <textarea
            className="input"
            rows={3}
            autoFocus
            value={props.node.attrs.text}
            onChange={(e) => props.updateAttributes({ text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                setOpen(false);
              }
            }}
          />
          <p className="hint">{t('editor.footnote.hint')}</p>
        </div>
      </Popover>
    </NodeViewWrapper>
  );
}

export function CitationView(props: NodeViewProps) {
  useCitationTick();
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const items = (props.node.attrs.items ?? []) as CitationItem[];
  const r = citationRenderer();
  const label = r.label(items);
  const [draft, setDraft] = useState(formatCitation(items));
  useEffect(() => setDraft(formatCitation(items)), [props.node.attrs.items]); // eslint-disable-line react-hooks/exhaustive-deps
  const hover = useHoverCard();
  const Preview = citationPreview.get();
  return (
    <NodeViewWrapper as="span" className={`nv-citation ${props.selected ? 'is-selected' : ''} ${r.isNoteStyle() ? 'is-note' : ''}`}>
      <span
        ref={ref}
        {...hover.triggerProps}
        onClick={() => {
          hover.close();
          if (props.editor.isEditable) setOpen(true);
        }}
      >
        {r.isNoteStyle() ? <sup className="nv-citation__note" /> : label}
      </span>
      {Preview && !open && (
        <HoverCard anchor={hover.anchor} cardProps={hover.cardProps}>
          <Preview keys={items.map((i) => i.key)} />
        </HoverCard>
      )}
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)}>
        <div className="popover__form">
          <label className="field-label">{t('editor.citation.edit')}</label>
          <input
            className="input mono"
            autoFocus
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              const inner = e.target.value.trim().replace(/^\[/, '').replace(/\]$/, '');
              const parsed = parseCitation(inner);
              if (parsed) props.updateAttributes({ items: parsed });
            }}
            onKeyDown={(e) => e.key === 'Enter' && setOpen(false)}
          />
          <p className="hint">{t('editor.citation.hint')}</p>
          <div className="popover__list">
            {items.map((i) => (
              <div key={i.key} className="popover__list-item">
                {r.describe(i.key) ?? t('editor.citation.unknown', { key: i.key })}
              </div>
            ))}
          </div>
        </div>
      </Popover>
    </NodeViewWrapper>
  );
}

export function WikilinkView(props: NodeViewProps) {
  const docs = useWorkspace((s) => s.docs);
  const target = String(props.node.attrs.target);
  const doc = docs.find((d) => d.title.toLowerCase() === target.toLowerCase());
  const hover = useHoverCard();
  return (
    <NodeViewWrapper as="span" className={`nv-wikilink ${doc ? '' : 'is-missing'} ${props.selected ? 'is-selected' : ''}`}>
      {doc && (
        <HoverCard anchor={hover.anchor} cardProps={hover.cardProps}>
          <DocPreview rel={doc.rel} />
        </HoverCard>
      )}
      <span
        {...hover.triggerProps}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey || e.detail === 2) {
            if (doc) useWorkspace.getState().openDoc(doc.rel);
            else void useWorkspace.getState().newDoc(target);
          }
        }}
        title={doc ? t('editor.wikilink.open') : t('editor.wikilink.create')}
      >
        {props.node.attrs.alias || target}
      </span>
    </NodeViewWrapper>
  );
}

export function FigureView(props: NodeViewProps) {
  const vaultRoot = useWorkspace((s) => s.vaultRoot);
  const activeDoc = useWorkspace((s) => s.activeDoc);
  const a = props.node.attrs;
  const url = assetUrl(a.src, vaultRoot, activeDoc);
  return (
    <NodeViewWrapper className={`nv-figure placement-${a.placement} ${props.selected ? 'is-selected' : ''}`} data-drag-handle>
      <img src={url} alt={a.caption} style={a.width ? { width: a.width } : undefined} draggable={false} />
      <input
        className="nv-figure__caption"
        value={a.caption}
        placeholder={t('editor.figure.caption')}
        onChange={(e) => props.updateAttributes({ caption: e.target.value })}
        onKeyDown={(e) => e.stopPropagation()}
      />
      {props.selected && (
        <div className="nv-figure__tools" contentEditable={false}>
          <select
            className="select small"
            value={a.placement}
            onChange={(e) => props.updateAttributes({ placement: e.target.value })}
            title={t('editor.figure.placement')}
          >
            {['inline', 'top', 'bottom', 'full'].map((p) => (
              <option key={p} value={p}>
                {t(`editor.figure.placement.${p}`)}
              </option>
            ))}
          </select>
          <select
            className="select small"
            value={a.width ?? ''}
            onChange={(e) => props.updateAttributes({ width: e.target.value || null })}
            title={t('editor.figure.width')}
          >
            <option value="">{t('editor.figure.width.auto')}</option>
            {['25%', '40%', '50%', '60%', '75%', '100%'].map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
      )}
    </NodeViewWrapper>
  );
}

export function SectionBreakView(props: NodeViewProps) {
  const a = props.node.attrs;
  const masters = useDocSettings((s) => s.settings.layout.masters);
  return (
    <NodeViewWrapper className={`nv-break nv-section ${props.selected ? 'is-selected' : ''}`} data-drag-handle>
      <span className="nv-break__label">{t('editor.section.label')}</span>
      <select className="select small" value={a.master} onChange={(e) => props.updateAttributes({ master: e.target.value })}>
        {Object.entries(masters).map(([id, m]) => (
          <option key={id} value={id}>
            {masterLabel(id, m)}
          </option>
        ))}
        {!masters[a.master] && <option value={a.master}>{t('tpl.masters.missing')}</option>}
      </select>
      <select className="select small" value={a.columns} onChange={(e) => props.updateAttributes({ columns: Number(e.target.value) })}>
        {[1, 2, 3].map((c) => (
          <option key={c} value={c}>
            {t('editor.section.columns', { n: c })}
          </option>
        ))}
      </select>
    </NodeViewWrapper>
  );
}

export function TocView(props: NodeViewProps) {
  const writingLang = useWritingLang();
  const headings: { level: number; text: string }[] = [];
  props.editor.state.doc.descendants((n) => {
    if (n.type.name === 'heading') headings.push({ level: n.attrs.level, text: n.textContent });
    return n.type.name !== 'heading';
  });
  return (
    <NodeViewWrapper className={`nv-toc ${props.selected ? 'is-selected' : ''}`} data-drag-handle>
      <div className="nv-toc__title">{docTexts(writingLang).toc}</div>
      {headings.length === 0 && <div className="hint">{t('editor.toc.empty')}</div>}
      {headings.map((h, i) => (
        <div key={i} className={`nv-toc__item level-${h.level}`}>
          {h.text}
        </div>
      ))}
    </NodeViewWrapper>
  );
}

export function BibliographyView(props: NodeViewProps) {
  return (
    <NodeViewWrapper className={`nv-bibliography ${props.selected ? 'is-selected' : ''}`}>
      <div className="nv-bibliography__bar" contentEditable={false}>
        <span>{t('editor.bibliography.label')}</span>
        <button className="btn small" onClick={() => runCommand('cite.bibliography')}>
          {t('editor.bibliography.regenerate')}
        </button>
      </div>
      <NodeViewContent className="nv-bibliography__content" />
    </NodeViewWrapper>
  );
}

const CALLOUT_ICONS: Record<CalloutKind, typeof Info> = { note: Info, tip: Lightbulb, important: Star, warning: TriangleAlert, caution: OctagonAlert };

/** Blocco evidenziato: icona e intestazione in stile didascalia (titolo libero, tipo a scelta), poi il contenuto. */
export function CalloutView(props: NodeViewProps) {
  const kind: CalloutKind = isCalloutKind(props.node.attrs.kind) ? props.node.attrs.kind : 'note';
  const Icon = CALLOUT_ICONS[kind];
  return (
    <NodeViewWrapper className={`nv-callout is-${kind} ${props.selected ? 'is-selected' : ''}`} data-kind={kind}>
      <div className="nv-callout__head" contentEditable={false}>
        <Icon size={14} strokeWidth={2} />
        <input
          className="nv-callout__title"
          value={props.node.attrs.title ?? ''}
          placeholder={t(`callout.${kind}`)}
          aria-label={t('callout.title')}
          onChange={(e) => props.updateAttributes({ title: e.target.value })}
          onKeyDown={(e) => {
            e.stopPropagation();
            // Invio: si passa al contenuto del riquadro
            if (e.key === 'Enter') {
              e.preventDefault();
              const pos = props.getPos();
              if (typeof pos === 'number') props.editor.chain().focus(pos + 2).run();
            }
          }}
        />
        <select className="nv-callout__kind" value={kind} title={t('callout.kind')} onChange={(e) => props.updateAttributes({ kind: e.target.value })}>
          {CALLOUT_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`callout.${k}`)}
            </option>
          ))}
        </select>
      </div>
      <NodeViewContent className="nv-callout__body" />
    </NodeViewWrapper>
  );
}
