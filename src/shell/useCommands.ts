// Hook: ridisegna quando cambia lo stato dei comandi (selezione, documento, preferenze).
import { useSyncExternalStore } from 'react';
import { onCommandState, commandStateTick, onRegistryChange, registryVersion } from '../commands/registry';

export function useCommandTick(): number {
  const a = useSyncExternalStore(onCommandState, commandStateTick);
  const b = useSyncExternalStore(onRegistryChange, registryVersion);
  return a * 100000 + b;
}
