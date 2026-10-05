// Elementi comuni: icona per tipo, miniatura, scheda uniforme di una risorsa.
import {
  FileText,
  FileType,
  Image as ImageIcon,
  Globe,
  SquarePlay,
  Film,
  Music,
  BookOpen,
  Quote,
  File,
  FileCode,
  Pin as PinIcon,
  Library,
  SquareCode,
} from 'lucide-react';
import type { Resource, ResourceKind } from '../model';
import { displayAuthorYear, domainOf } from '../model';
import { fileOf } from '../store';
import { platform } from '../../platform';
import { t } from '../../i18n';

const ICONS: Record<ResourceKind, React.ComponentType<{ size?: number; className?: string }>> = {
  pdf: FileType,
  text: FileText,
  markdown: FileCode,
  rtf: FileText,
  docx: FileText,
  odt: FileText,
  epub: BookOpen,
  html: Globe,
  image: ImageIcon,
  web: Globe,
  youtube: SquarePlay,
  video: Film,
  audio: Music,
  reference: Quote,
  snippet: SquareCode,
  other: File,
};

export function KindIcon({ kind, size = 14 }: { kind: ResourceKind; size?: number }) {
  const I = ICONS[kind] ?? File;
  return <I size={size} className={`kind-icon kind-${kind}`} />;
}

export function kindLabel(kind: ResourceKind): string {
  return t(`kind.${kind}`);
}

export function thumbUrl(r: Resource): string | null {
  // la foto della pagina vince sulla miniatura og:image
  for (const f of [r.meta.screenshot, r.meta.thumb]) {
    const p = f ? fileOf(r, f) : null;
    if (p) return platform.fileUrl(p);
  }
  if (r.meta.thumb) {
    const p = fileOf(r, r.meta.thumb);
    if (p) return platform.fileUrl(p);
  }
  if (r.kind === 'image' && r.file) {
    const p = fileOf(r);
    if (p) return platform.fileUrl(p);
  }
  return null;
}

export function subtitle(r: Resource): string {
  const ay = displayAuthorYear(r);
  const site = r.meta.siteName ?? domainOf(r);
  return [ay, site].filter(Boolean).join(' · ') || kindLabel(r.kind);
}

export function ResourceCard({ r, color, compact }: { r: Resource; color?: string | null; compact?: boolean }) {
  const thumb = thumbUrl(r);
  return (
    <div className={`res-card ${compact ? 'is-compact' : ''}`} style={color ? { borderTopColor: color } : undefined}>
      {!compact && (
        <div className="res-card__thumb">
          {thumb ? <img src={thumb} alt="" draggable={false} loading="lazy" /> : <KindIcon kind={r.kind} size={30} />}
        </div>
      )}
      <div className="res-card__body">
        <div className="res-card__title" title={r.title}>
          <KindIcon kind={r.kind} size={13} /> <span>{r.title}</span>
        </div>
        <div className="res-card__sub">{subtitle(r)}</div>
        <div className="res-card__chips">
          {r.isSource && <span className="chip chip--source">{t('res.source')}</span>}
          {r.library && (
            <span className="chip" title={t('res.fromLibrary')}>
              <Library size={10} />
            </span>
          )}
          {r.pins.length > 0 && (
            <span className="chip" title={t('res.pins', { n: r.pins.length })}>
              <PinIcon size={10} /> {r.pins.length}
            </span>
          )}
          {r.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="chip">
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
