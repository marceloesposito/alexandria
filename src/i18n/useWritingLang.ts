// Hook React della lingua di scrittura (separato da writing.ts, che resta senza React).
import { useSyncExternalStore } from 'react';
import { getWritingLang, onWritingLang, type WritingLang } from 'logos/i18n/writing';

export function useWritingLang(): WritingLang {
  return useSyncExternalStore(onWritingLang, getWritingLang);
}
