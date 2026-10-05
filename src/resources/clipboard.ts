// Cmd/Ctrl+V fuori dai campi di testo: cio' che c'e' negli appunti diventa una risorsa del tipo giusto.
import { splitLinks, findDoi, findIsbn } from './detect';

export type ClipKind =
  | { kind: 'files' }
  | { kind: 'links'; urls: string[] }
  | { kind: 'bibliography'; text: string }
  | { kind: 'doi'; doi: string }
  | { kind: 'isbn'; isbn: string }
  | { kind: 'code'; code: string; language: string }
  | { kind: 'text'; text: string };

const BIB = /^\s*@\w+\s*\{[^,]+,/;
const RIS = /^TY {2}- /m;

/** Linguaggio di uno snippet, dagli indizi piu' riconoscibili (altrimenti 'text'). */
export function guessLanguage(code: string): string {
  const c = code;
  if (/^\s*[{[][\s\S]*[}\]]\s*$/.test(c) && /"\w+"\s*:/.test(c)) return 'json';
  if (/^\s*(def |class \w+(\(.*\))?:|import \w+|from \w+ import )/m.test(c) && !/[;{}]\s*$/m.test(c)) return 'python';
  if (/\bfn \w+\s*\(|\blet mut\b|\bimpl\b|::new\(/.test(c)) return 'rust';
  if (/\bfunc \w+\(|package main\b/.test(c)) return 'go';
  if (/#include\s*<|std::/.test(c)) return 'cpp';
  if (/\bpublic (static |class |void )/.test(c)) return 'java';
  if (/\b(SELECT|INSERT INTO|UPDATE|CREATE TABLE)\b[\s\S]*\b(FROM|VALUES|SET|\()/i.test(c) && /^\s*(SELECT|INSERT|UPDATE|CREATE|WITH)\b/i.test(c)) return 'sql';
  if (/^\s*<(!doctype|html|div|span|p|section)\b/i.test(c)) return 'html';
  if (/^\s*[.#]?[\w-]+\s*\{[^}]*:[^}]*;/m.test(c) && !/\bfunction\b|=>/.test(c)) return 'css';
  if (/^\s*(\$ |#!\/bin\/(ba)?sh|sudo |npm |git |cd )/m.test(c)) return 'bash';
  if (/\\(documentclass|begin\{|section\{|usepackage)/.test(c)) return 'tex';
  if (/:\s*(string|number|boolean)\b|interface \w+|\btype \w+ =|<\w+>\(/.test(c)) return 'ts';
  if (/\b(const|let|var|function)\b|=>|console\.log/.test(c)) return 'js';
  return 'text';
}

/** Testo che sembra codice: piu' righe con struttura tipica (parentesi, punto e virgola, rientri, parole chiave). */
export function looksLikeCode(text: string): boolean {
  const lines = text.split('\n').filter((l) => l.trim());
  if (!lines.length) return false;
  const signals = lines.filter((l) => /[{};]\s*$|^\s{2,}\S|^\s*(def|class|function|const|let|var|import|return|if|for|while|#include|SELECT|fn|pub|public)\b|=>|\)\s*\{/.test(l)).length;
  if (lines.length === 1) return /[;{}]\s*$|=>|^\s*(def|function|const|let|import|SELECT)\b/.test(lines[0]) && /[(){}=;]/.test(lines[0]);
  return signals / lines.length >= 0.4;
}

export function classifyClipboard(d: { fileCount: number; plain: string }): ClipKind | null {
  if (d.fileCount > 0) return { kind: 'files' };
  const text = d.plain.trim();
  if (!text) return null;
  if (BIB.test(text) || RIS.test(text)) return { kind: 'bibliography', text };
  const words = text.split(/[\s,;]+/).filter(Boolean);
  if (words.length <= 2 && !/^https?:\/\//i.test(text)) {
    const isbn = findIsbn(/isbn/i.test(text) ? text : `ISBN ${text}`);
    if (isbn && /^[\d-\sXx]{10,17}$/.test(text.replace(/^isbn:?\s*/i, ''))) return { kind: 'isbn', isbn };
    const doi = findDoi(text);
    if (doi) return { kind: 'doi', doi };
  }
  const links = splitLinks(text);
  if (links.length && links.length === words.length) return { kind: 'links', urls: links };
  if (looksLikeCode(text)) return { kind: 'code', code: d.plain.replace(/\s+$/, ''), language: guessLanguage(text) };
  return { kind: 'text', text };
}

/** Titolo di una nota o di uno snippet: la prima riga, accorciata. */
export function titleFromText(text: string, max = 60): string {
  const first = text.trim().split('\n')[0].replace(/^[#>*\-\s]+/, '').trim();
  return first.length > max ? first.slice(0, max - 1).trimEnd() + '…' : first;
}
