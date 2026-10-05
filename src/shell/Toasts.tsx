import { X } from 'lucide-react';
import { useWorkspace } from '../state/workspace';

export function Toasts() {
  const toasts = useWorkspace((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} className={`toast toast--${x.kind}`}>
          <span>{x.text}</span>
          {x.action && (
            <button
              className="toast__action"
              onClick={() => {
                x.action!.run();
                useWorkspace.getState().dismissToast(x.id);
              }}
            >
              {x.action.label}
            </button>
          )}
          <button className="icon-btn tiny" onClick={() => useWorkspace.getState().dismissToast(x.id)} aria-label="×">
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
