// Viste principali e componenti globali registrati dai moduli (Risorse, Versioni, visualizzatore).
import type { ComponentType } from 'react';

export const viewComponents: { resources: ComponentType | null; versions: ComponentType | null } = {
  resources: null,
  versions: null,
};

/** Componenti sempre montati (finestre sovrapposte come il visualizzatore delle risorse). */
export const globalComponents: ComponentType[] = [];
