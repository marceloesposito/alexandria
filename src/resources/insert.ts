// Risorse inserite nel testo: file o link trascinati da altre finestre, incollati o scelti.
// Riconosce da solo se arriva un file o un link, importa nel vault e mette nel documento
// una figura (immagini) o una scheda embed (pagine web, video, snippet, altri file).
import { splitLinks, detectUrl } from './detect';
import { relativeFromDoc } from '../vault/resolve';
import type { Resource } from './model';
import type { EmbedAttrs } from '../editor/extensions/nodes';

export interface TransferLike {
  types: readonly string[];
  fileCount: number;
  uriList: string;
  plain: string;
}

export type Classified = { kind: 'files' } | { kind: 'links'; urls: string[] } | null;

/**
 * Cosa contiene un trascinamento o un incolla: i file vincono (un'immagine trascinata dal
 * browser porta anche il suo link), poi text/uri-list, poi testo che sia fatto solo di link.
 */
export function classifyTransfer(d: TransferLike): Classified {
  if (d.fileCount > 0) return { kind: 'files' };
  const uris = d.uriList
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x && !x.startsWith('#') && detectUrl(x));
  if (uris.length) return { kind: 'links', urls: uris };
  const text = d.plain.trim();
  if (!text) return null;
  const links = splitLinks(text);
  // testo normale con un link dentro: non e' una risorsa, resta testo
  const words = text.split(/[\s,;]+/).filter(Boolean);
  return links.length && links.length === words.length ? { kind: 'links', urls: links } : null;
}

export function readTransfer(dt: DataTransfer): TransferLike {
  return {
    types: Array.from(dt.types ?? []),
    fileCount: dt.files?.length ?? 0,
    uriList: dt.getData('text/uri-list') ?? '',
    plain: dt.getData('text/plain') ?? '',
  };
}

/** Attributi della scheda embed per una risorsa, con i percorsi relativi al documento. */
export function embedAttrsFor(r: Resource, docRel: string): EmbedAttrs {
  const local = (f: string) => relativeFromDoc(docRel, `resources/${r.id}/${f}`);
  const preview = r.meta.screenshot ?? r.meta.thumb;
  const url = r.url ?? (r.file && !r.library ? local(r.file) : '');
  return { url, title: r.title, resource: r.id, image: preview && !r.library ? local(preview) : null };
}

/** Figura per le immagini del vault, scheda embed per tutto il resto. */
export function nodeFor(r: Resource, docRel: string): { type: string; attrs: Record<string, unknown> } {
  if (r.kind === 'image' && r.file && !r.library) {
    return { type: 'figure', attrs: { src: relativeFromDoc(docRel, `resources/${r.id}/${r.file}`), caption: r.title } };
  }
  return { type: 'embed', attrs: { ...embedAttrsFor(r, docRel) } };
}
