// Template di pergamena: testo di partenza (Markdown) + impostazioni (formato, margini, colonne,
// stili, master page, stile di citazione). Predefiniti nel codice; quelli dell'utente sono file JSON
// nella cartella dell'app, comuni a tutti i Compendium.
import { defaultDocSettings, normalizeDocSettings, withPaper, type DocSettings } from './model';

export interface Template {
  version: 1;
  id: string;
  name: string;
  description: string;
  builtIn?: boolean;
  markdown: string;
  settings: DocSettings;
}

type Lang = 'it' | 'en';
const L = (lang: Lang, it: string, en: string) => (lang === 'it' ? it : en);

function blank(lang: Lang): Template {
  return { version: 1, id: 'blank', name: L(lang, 'Vuota', 'Blank'), description: L(lang, 'Una pagina A4 vuota, con le impostazioni predefinite.', 'An empty A4 page with the default settings.'), builtIn: true, markdown: '', settings: defaultDocSettings(lang) };
}

function article(lang: Lang): Template {
  const s = defaultDocSettings(lang);
  s.citationStyle = 'apa';
  s.layout = { ...s.layout, marginInnerMm: 30, marginOuterMm: 30, headingNumbers: true };
  return {
    version: 1,
    id: 'article',
    name: L(lang, 'Articolo', 'Article'),
    description: L(lang, 'Articolo accademico: abstract, sezioni numerate, bibliografia APA.', 'Academic article: abstract, numbered sections, APA bibliography.'),
    builtIn: true,
    markdown: L(
      lang,
      '# Titolo dell’articolo\n\n**Abstract.** Riassunto in poche righe.\n\n## Introduzione\n\n## Metodo\n\n## Risultati\n\n## Discussione\n\n## Conclusioni\n',
      '# Article title\n\n**Abstract.** A summary in a few lines.\n\n## Introduction\n\n## Method\n\n## Results\n\n## Discussion\n\n## Conclusions\n',
    ),
    settings: s,
  };
}

function thesis(lang: Lang): Template {
  const s = defaultDocSettings(lang);
  s.citationStyle = 'chicago-author-date';
  s.layout = {
    ...s.layout,
    facingPages: true,
    marginInnerMm: 35,
    marginOuterMm: 25,
    leading: 1.6,
    headingNumbers: true,
    masters: {
      ...s.layout.masters,
      body: { ...s.layout.masters.body, header: '{chapter}', pageNumbers: 'bottom-outer' },
      appendix: { ...s.layout.masters.appendix, header: L(lang, 'Appendice', 'Appendix'), pageNumbers: 'bottom-outer' },
    },
  };
  return {
    version: 1,
    id: 'thesis',
    name: L(lang, 'Tesi', 'Thesis'),
    description: L(lang, 'Fronte-retro, frontespizio, sommario, capitoli e appendice con le loro master page.', 'Double-sided, title page, contents, chapters and appendix with their master pages.'),
    builtIn: true,
    markdown: L(
      lang,
      '<!-- section master="title" columns="1" -->\n\n# Titolo della tesi\n\nCandidato · Relatore · Anno accademico\n\n<!-- section master="body" columns="1" -->\n\n<!-- toc -->\n\n# Introduzione\n\n# Capitolo primo\n\n# Conclusioni\n\n<!-- section master="appendix" columns="1" -->\n\n# Appendice\n',
      '<!-- section master="title" columns="1" -->\n\n# Thesis title\n\nCandidate · Supervisor · Academic year\n\n<!-- section master="body" columns="1" -->\n\n<!-- toc -->\n\n# Introduction\n\n# Chapter one\n\n# Conclusions\n\n<!-- section master="appendix" columns="1" -->\n\n# Appendix\n',
    ),
    settings: s,
  };
}

function essay(lang: Lang): Template {
  const s = defaultDocSettings(lang);
  s.citationStyle = 'chicago-notes-bibliography';
  s.layout = { ...withPaper(s.layout, 'a5'), marginTopMm: 20, marginBottomMm: 22, marginInnerMm: 20, marginOuterMm: 18, fontSizePt: 11, leading: 1.4 };
  s.layout.styles = { ...s.layout.styles, body: { ...s.layout.styles.body, sizePt: 11, indentFirstMm: 5 } };
  return {
    version: 1,
    id: 'essay',
    name: L(lang, 'Saggio', 'Essay'),
    description: L(lang, 'Formato A5 da libro, rientro di prima riga, note a piè di pagina Chicago.', 'Book-like A5, first-line indent, Chicago footnotes.'),
    builtIn: true,
    markdown: L(lang, '# Titolo del saggio\n\n', '# Essay title\n\n'),
    settings: s,
  };
}

function twoColumns(lang: Lang): Template {
  const s = defaultDocSettings(lang);
  s.citationStyle = 'ieee';
  s.layout = { ...s.layout, columns: 2, columnGapMm: 7, marginTopMm: 20, marginBottomMm: 20, marginInnerMm: 18, marginOuterMm: 18, fontSizePt: 10, leading: 1.25, headingNumbers: true };
  return {
    version: 1,
    id: 'two-columns',
    name: L(lang, 'Paper a due colonne', 'Two-column paper'),
    description: L(lang, 'Stile conferenza: due colonne, corpo 10 pt, citazioni IEEE.', 'Conference style: two columns, 10 pt body, IEEE citations.'),
    builtIn: true,
    markdown: L(lang, '# Titolo\n\n**Abstract.**\n\n## Introduzione\n\n## Lavori correlati\n\n## Conclusioni\n', '# Title\n\n**Abstract.**\n\n## Introduction\n\n## Related work\n\n## Conclusions\n'),
    settings: s,
  };
}

export function builtInTemplates(lang: Lang): Template[] {
  return [blank(lang), article(lang), thesis(lang), essay(lang), twoColumns(lang)];
}

/** Template dalla pergamena corrente: le impostazioni senza titolo, autore e data. */
export function templateFromDoc(id: string, name: string, description: string, markdown: string, settings: DocSettings): Template {
  return { version: 1, id, name, description, markdown, settings: { ...settings, title: '', author: '', date: '' } };
}

/** Contenuto e impostazioni di una pergamena nuova dal template (il titolo va nelle impostazioni). */
export function instantiate(tpl: Template, title: string, lang: Lang): { markdown: string; settings: DocSettings } {
  return { markdown: tpl.markdown, settings: { ...normalizeDocSettings(tpl.settings, lang), title } };
}

/** Un template letto da disco: valido solo se ha nome, testo e impostazioni. */
export function parseTemplate(raw: unknown, lang: Lang): Template | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Template>;
  if (typeof r.id !== 'string' || typeof r.name !== 'string' || typeof r.markdown !== 'string') return null;
  return { version: 1, id: r.id, name: r.name, description: typeof r.description === 'string' ? r.description : '', markdown: r.markdown, settings: normalizeDocSettings(r.settings, lang) };
}
