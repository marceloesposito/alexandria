// Dichiarazioni minime per librerie senza tipi.
declare module 'citeproc' {
  interface Sys {
    retrieveLocale(lang: string): string;
    retrieveItem(id: string): unknown;
  }
  class Engine {
    constructor(sys: Sys, style: string, lang?: string, forceLang?: boolean);
    opt: { xclass: string };
    setOutputFormat(f: 'html' | 'text' | 'rtf'): void;
    updateItems(ids: string[]): void;
    makeCitationCluster(items: Record<string, unknown>[]): string;
    makeBibliography(): [Record<string, unknown>, string[]] | false;
  }
  const CSL: { Engine: typeof Engine };
  export default CSL;
}

declare module '@citation-js/plugin-bibtex';
declare module '@citation-js/plugin-ris';
