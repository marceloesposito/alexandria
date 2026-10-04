// Finestra modale dell'app.
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { t } from '../i18n';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'small' | 'medium' | 'large' | 'full';
  className?: string;
}

export function Modal({ title, onClose, children, footer, size = 'medium', className }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className={`modal modal--${size} ${className ?? ''}`} role="dialog" aria-modal aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2 className="modal__title">{title}</h2>
          <button className="icon-btn" onClick={onClose} title={t('common.close')} aria-label={t('common.close')}>
            <X size={16} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__actions">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
