// RTF (TextEdit, Scrivener, WordPad, Word) -> albero del documento: paragrafi, titoli (livello di
// struttura o stile "heading N"), grassetto, corsivo, sottolineato, barrato, apici, link, note,
// elenchi e tabelle. Immagini e oggetti si saltano.
import type { PMMark, PMNode } from 'logos/doc/types';
import { doc, footnote, heading, noteText, paragraph, table, text } from './build';

interface Chr {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  sup: boolean;
  sub: boolean;
}

interface Group {
  chr: Chr;
  /** destinazione da saltare (font, colori, immagini, info...) */
  skip: boolean;
  uc: number;
  dest: 'text' | 'note' | 'fldinst' | 'fldrslt' | 'stylesheet' | 'style' | 'listtext';
}

const SKIP = new Set([
  'fonttbl', 'colortbl', 'info', 'pict', 'object', 'header', 'footer', 'headerl', 'headerr', 'headerf', 'footerl', 'footerr', 'footerf',
  'themedata', 'colorschememapping', 'latentstyles', 'datastore', 'xmlnstbl', 'listtable', 'listoverridetable', 'rsidtbl', 'generator',
  'mmathPr', 'pgdsctbl', 'revtbl', 'filetbl', 'nonshppict', 'shp', 'shpinst', 'annotation', 'atnid', 'atnauthor', 'bkmkstart', 'bkmkend',
  'expandedcolortbl', 'pntxta', 'pntxtb', 'pn', 'docvar', 'userprops', 'template', 'operator', 'company', 'title', 'author',
]);

const plain = (): Chr => ({ bold: false, italic: false, underline: false, strike: false, sup: false, sub: false });

const HEADING_NAME = /^(heading|titolo|überschrift|titre|t[ií]tulo)\s*(\d)$/i;

const cp1252 = new TextDecoder('windows-1252');

export function rtfToDoc(rtf: string): PMNode {
  const styles = new Map<number, string>();
  const stack: Group[] = [{ chr: plain(), skip: false, uc: 1, dest: 'text' }];
  const top = () => stack[stack.length - 1];

  const blocks: PMNode[] = [];
  let cur: PMNode[] = [];
  let buf = '';
  let bufKey = '';
  let bufMarks: PMMark[] = [];
  // proprieta' del paragrafo corrente
  let outline: number | null = null;
  let style = 0;
  let inTable = false;
  let listKind: 'bullet' | 'ordered' | null = null;
  let listText = '';
  let list: { kind: 'bullet' | 'ordered'; items: PMNode[] } | null = null;
  let rows: PMNode[][][] = [];
  let row: PMNode[][] = [];
  let cell: PMNode[] = [];
  // note e campi raccolgono il testo a parte
  let note: PMNode[] | null = null;
  let fldInst = '';
  let link: string | null = null;
  let styleName = '';
  let styleNum = 0;
  let skipChars = 0;

  const target = () => (note ? note : cur);
  const flushText = () => {
    if (buf) target().push(text(buf, bufMarks));
    buf = '';
  };
  const emit = (s: string) => {
    const g = top();
    if (g.skip) return;
    if (g.dest === 'fldinst') {
      fldInst += s;
      return;
    }
    if (g.dest === 'style') {
      styleName += s;
      return;
    }
    if (g.dest === 'listtext') {
      listText += s;
      return;
    }
    if (g.dest === 'stylesheet') return;
    const c = g.chr;
    const marks: PMMark[] = [];
    if (link) marks.push({ type: 'link', attrs: { href: link, title: null } });
    if (c.bold) marks.push({ type: 'bold' });
    if (c.italic) marks.push({ type: 'italic' });
    if (c.underline && !link) marks.push({ type: 'underline' });
    if (c.strike) marks.push({ type: 'strike' });
    if (c.sup && !note) marks.push({ type: 'superscript' });
    if (c.sub) marks.push({ type: 'subscript' });
    const key = JSON.stringify(marks) + (note ? 'n' : '');
    if (key !== bufKey) {
      flushText();
      bufKey = key;
      bufMarks = marks;
    }
    buf += s;
  };
  const closeList = () => {
    if (list) blocks.push(list.kind === 'ordered' ? { type: 'orderedList', attrs: { start: 1 }, content: list.items } : { type: 'bulletList', content: list.items });
    list = null;
  };
  const closeTable = () => {
    if (cell.length) row.push(cell);
    if (row.length) rows.push(row);
    const t = table(rows);
    if (t) blocks.push(t);
    rows = [];
    row = [];
    cell = [];
  };
  const endParagraph = () => {
    flushText();
    const nodes = cur;
    cur = [];
    if (inTable) {
      closeList();
      if (cell.length && nodes.length) cell.push({ type: 'hardBreak' });
      cell.push(...nodes);
      return;
    }
    if (rows.length || row.length || cell.length) closeTable();
    const name = styles.get(style) ?? '';
    const hm = HEADING_NAME.exec(name);
    const level = outline ?? (hm ? Number(hm[2]) : /^(title|titolo)$/i.test(name) ? 1 : null);
    if (level) {
      closeList();
      const h = heading(level, nodes);
      if (h) blocks.push(h);
      return;
    }
    const p = paragraph(nodes);
    if (!p) return;
    if (listKind) {
      if (list && list.kind !== listKind) closeList();
      list ??= { kind: listKind, items: [] };
      list.items.push({ type: 'listItem', content: [p] });
      return;
    }
    closeList();
    if (/quote|citazione/i.test(name)) blocks.push({ type: 'blockquote', content: [p] });
    else blocks.push(p);
  };

  let i = 0;
  while (i < rtf.length) {
    const ch = rtf[i];
    if (ch === '{') {
      flushText();
      const g = top();
      stack.push({ chr: { ...g.chr }, skip: g.skip, uc: g.uc, dest: g.dest === 'stylesheet' ? 'style' : g.dest });
      if (stack.length > 2 && top().dest === 'style') {
        styleName = '';
        styleNum = 0;
      }
      i++;
      if (rtf.startsWith('\\*', i)) {
        // destinazione ignorabile: si legge solo \fldinst, il resto si salta
        const m = /^\\\*\\([a-zA-Z]+)/.exec(rtf.slice(i, i + 40));
        if (m?.[1] === 'fldinst') top().dest = 'fldinst';
        else top().skip = true;
      }
      continue;
    }
    if (ch === '}') {
      flushText();
      const g = stack.length > 1 ? stack.pop()! : top();
      if (g.dest === 'style' && top().dest === 'stylesheet' && !g.skip) styles.set(styleNum, styleName.replace(/;\s*$/, '').trim());
      if (g.dest === 'note' && top().dest !== 'note' && note) {
        const t = noteText(note);
        note = null;
        if (t) cur.push(footnote(t));
      }
      if (g.dest === 'listtext' && top().dest !== 'listtext') listKind = /\d|[a-z][.)]/i.test(listText) ? 'ordered' : 'bullet';
      if (g.dest === 'fldinst' && top().dest !== 'fldinst') {
        const m = /HYPERLINK\s+"([^"]+)"/i.exec(fldInst);
        link = m && /^(https?:|mailto:)/i.test(m[1]) ? m[1] : null;
        fldInst = '';
      }
      if (g.dest === 'fldrslt' && top().dest !== 'fldrslt') link = null;
      i++;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      i++;
      continue;
    }
    if (ch !== '\\') {
      if (skipChars > 0) skipChars--;
      else emit(ch);
      i++;
      continue;
    }
    const next = rtf[i + 1];
    if (next === undefined) break;
    if (next === '\n' || next === '\r') {
      // "\" seguito da a capo vale \par (TextEdit lo scrive cosi')
      if (!top().skip && top().dest === 'text') endParagraph();
      i += 2;
      continue;
    }
    if (next === '\\' || next === '{' || next === '}') {
      if (skipChars > 0) skipChars--;
      else emit(next);
      i += 2;
      continue;
    }
    if (next === "'") {
      const code = parseInt(rtf.slice(i + 2, i + 4), 16);
      if (skipChars > 0) skipChars--;
      else if (!Number.isNaN(code)) emit(cp1252.decode(new Uint8Array([code])));
      i += 4;
      continue;
    }
    if (next === '~') {
      emit(' ');
      i += 2;
      continue;
    }
    if (next === '_') {
      emit('-');
      i += 2;
      continue;
    }
    if (!/[a-zA-Z]/.test(next)) {
      i += 2;
      continue;
    }
    const m = /^([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i + 1, i + 64))!;
    const [all, word, num] = m;
    const n = num === undefined ? null : Number(num);
    i += 1 + all.length;
    const g = top();
    if (word === 'bin' && n) {
      i += n;
      continue;
    }
    if (SKIP.has(word)) {
      g.skip = true;
      continue;
    }
    if (word === 'stylesheet') {
      g.dest = 'stylesheet';
      continue;
    }
    if (g.dest === 'style') {
      if (word === 's') styleNum = n ?? 0;
      continue;
    }
    if (word === 'footnote') {
      flushText();
      g.dest = 'note';
      note = [];
      continue;
    }
    if (word === 'fldrslt') {
      g.dest = 'fldrslt';
      continue;
    }
    if (word === 'listtext' || word === 'pntext') {
      g.dest = 'listtext';
      listText = '';
      continue;
    }
    if (g.skip) continue;
    const c = g.chr;
    const flag = n !== 0;
    switch (word) {
      case 'par':
        if (g.dest === 'note') emit(' ');
        else endParagraph();
        break;
      case 'line':
        flushText();
        target().push({ type: 'hardBreak' });
        break;
      case 'page':
        endParagraph();
        closeList();
        blocks.push({ type: 'pageBreak' });
        break;
      case 'tab':
        emit(' ');
        break;
      case 'cell':
      case 'nestcell':
        endParagraph();
        row.push(cell);
        cell = [];
        break;
      case 'row':
      case 'nestrow':
        flushText();
        if (cell.length) row.push(cell);
        rows.push(row);
        row = [];
        cell = [];
        break;
      case 'intbl':
        inTable = true;
        break;
      case 'pard':
        // dentro una nota: le proprieta' del paragrafo che la contiene restano
        if (note) break;
        outline = null;
        style = 0;
        inTable = false;
        listKind = null;
        break;
      case 'outlinelevel':
        outline = n !== null && n < 9 ? n + 1 : null;
        break;
      case 's':
        style = n ?? 0;
        break;
      case 'ls':
      case 'ilvl':
        listKind ??= 'bullet';
        break;
      case 'plain':
        g.chr = plain();
        break;
      case 'b':
        c.bold = flag;
        break;
      case 'i':
        c.italic = flag;
        break;
      case 'ul':
      case 'uld':
      case 'uldb':
      case 'ulw':
        c.underline = flag;
        break;
      case 'ulnone':
        c.underline = false;
        break;
      case 'strike':
      case 'striked':
        c.strike = flag;
        break;
      case 'super':
        c.sup = true;
        c.sub = false;
        break;
      case 'sub':
        c.sub = true;
        c.sup = false;
        break;
      case 'nosupersub':
        c.sup = c.sub = false;
        break;
      case 'uc':
        g.uc = n ?? 1;
        break;
      case 'u': {
        let code = n ?? 0;
        if (code < 0) code += 65536;
        emit(String.fromCharCode(code));
        skipChars = g.uc;
        break;
      }
      case 'emdash':
        emit('—');
        break;
      case 'endash':
        emit('–');
        break;
      case 'lquote':
        emit('‘');
        break;
      case 'rquote':
        emit('’');
        break;
      case 'ldblquote':
        emit('“');
        break;
      case 'rdblquote':
        emit('”');
        break;
      case 'bullet':
        emit('•');
        break;
      case 'chftn':
        break;
      default:
        break;
    }
  }
  endParagraph();
  closeList();
  if (rows.length || row.length || cell.length) closeTable();
  return doc(blocks);
}
