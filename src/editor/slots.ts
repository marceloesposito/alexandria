// Punti di aggancio della schermata Editor: i moduli (commenti, risorse, anteprima)
// vi registrano i propri pannelli senza che l'editor dipenda da loro.
import type { ComponentType, RefObject } from 'react';
import type { NodeViewProps } from '@tiptap/react';

export interface PageProps {
  pageRef: RefObject<HTMLDivElement | null>;
}

function single<T>() {
  let value: T | null = null;
  return {
    set(v: T) {
      value = v;
    },
    get(): T | null {
      return value;
    },
  };
}

function many<T>() {
  const list: T[] = [];
  return {
    add(v: T) {
      list.push(v);
    },
    all(): T[] {
      return list;
    },
  };
}

export const leftPanelSections = many<ComponentType>();
export const rightPanel = single<ComponentType<PageProps>>();
export const centerOverlay = single<ComponentType<PageProps>>();
export const previewPanel = single<ComponentType>();
/** scheda di un embed (link o risorsa): la disegna il modulo risorse */
export const embedView = single<ComponentType<NodeViewProps>>();
