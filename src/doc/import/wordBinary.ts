// Documenti Word 97-2003 (.doc): contenitore OLE (Compound File), tabella dei pezzi del testo,
// stili dei paragrafi (titoli, citazioni), formattazione dei caratteri, note, tabelle, link e indice.
// Riferimento: [MS-CFB] e [MS-DOC]. Le immagini e la numerazione automatica degli elenchi non si leggono.
import type { PMMark, PMNode } from 'logos/doc/types';
import { doc, footnote, heading, noteText, paragraph, table, text } from './build';

export class ImportError extends Error {
  constructor(public code: 'encrypted' | 'oldWord' | 'corrupt' | 'pages' | 'unsupported') {
    super(code);
  }
}

const CFB_SIG = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export function isCfb(b: Uint8Array): boolean {
  return b.length >= 512 && CFB_SIG.every((x, i) => b[i] === x);
}

const u16 = (b: Uint8Array, o: number) => (o + 2 <= b.length ? b[o] | (b[o + 1] << 8) : 0);
const u32 = (b: Uint8Array, o: number) => (o + 4 <= b.length ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : 0);
const i32 = (b: Uint8Array, o: number) => u32(b, o) | 0;

// ---------------------------------------------------------------- contenitore OLE

/** Flussi al primo livello del contenitore (WordDocument, 1Table, ...). */
export function readCfb(b: Uint8Array): Map<string, Uint8Array> {
  if (!isCfb(b)) throw new ImportError('corrupt');
  const secSize = 1 << u16(b, 0x1e);
  const miniSize = 1 << u16(b, 0x20);
  const numFat = u32(b, 0x2c);
  const dirStart = u32(b, 0x30);
  const cutoff = u32(b, 0x38) || 4096;
  const miniFatStart = u32(b, 0x3c);
  let difat = u32(b, 0x44);
  const sector = (n: number) => b.subarray((n + 1) * secSize, (n + 2) * secSize);
  const fatSecs: number[] = [];
  for (let i = 0; i < 109 && fatSecs.length < numFat; i++) fatSecs.push(u32(b, 0x4c + i * 4));
  for (let guard = 0; difat < 0xfffffffa && fatSecs.length < numFat && guard < 1e5; guard++) {
    const s = sector(difat);
    for (let i = 0; i < secSize / 4 - 1 && fatSecs.length < numFat; i++) fatSecs.push(u32(s, i * 4));
    difat = u32(s, secSize - 4);
  }
  const fat: number[] = [];
  for (const fs of fatSecs) {
    const s = sector(fs);
    for (let i = 0; i < secSize / 4; i++) fat.push(u32(s, i * 4));
  }
  const chain = (start: number, table: number[]) => {
    const out: number[] = [];
    for (let n = start; n < 0xfffffffa && n < table.length && out.length <= table.length; n = table[n]) out.push(n);
    return out;
  };
  const readChain = (start: number) => {
    const secs = chain(start, fat);
    const out = new Uint8Array(secs.length * secSize);
    secs.forEach((s, i) => out.set(sector(s), i * secSize));
    return out;
  };
  const dir = readChain(dirStart);
  const entry = (i: number) => {
    const o = i * 128;
    const len = Math.max(0, u16(dir, o + 0x40) - 2);
    let name = '';
    for (let k = 0; k < len; k += 2) name += String.fromCharCode(u16(dir, o + k));
    return { name, type: dir[o + 0x42], left: u32(dir, o + 0x44), right: u32(dir, o + 0x48), child: u32(dir, o + 0x4c), start: u32(dir, o + 0x74), size: u32(dir, o + 0x78) };
  };
  const count = dir.length / 128;
  if (!count) throw new ImportError('corrupt');
  const root = entry(0);
  const ministream = readChain(root.start);
  const miniFatBytes = miniFatStart < 0xfffffffa ? readChain(miniFatStart) : new Uint8Array(0);
  const miniFat: number[] = [];
  for (let i = 0; i < miniFatBytes.length / 4; i++) miniFat.push(u32(miniFatBytes, i * 4));
  const streams = new Map<string, Uint8Array>();
  const seen = new Set<number>();
  // figli della radice: albero rosso-nero (sinistra, nodo, destra)
  const visit = (i: number) => {
    if (i >= count || seen.has(i)) return;
    seen.add(i);
    const e = entry(i);
    visit(e.left);
    if (e.type === 2) {
      if (e.size < cutoff) {
        const secs = chain(e.start, miniFat);
        const out = new Uint8Array(secs.length * miniSize);
        secs.forEach((s, k) => out.set(ministream.subarray(s * miniSize, (s + 1) * miniSize), k * miniSize));
        streams.set(e.name, out.subarray(0, e.size));
      } else streams.set(e.name, readChain(e.start).subarray(0, e.size));
    }
    visit(e.right);
  };
  visit(root.child);
  return streams;
}

// ---------------------------------------------------------------- proprieta' (sprm)

/** Operandi di una lista di sprm: [codice, posizione dell'operando, lunghezza]. */
function* sprms(g: Uint8Array): Generator<[number, number, number]> {
  let i = 0;
  while (i + 2 <= g.length) {
    const sprm = u16(g, i);
    i += 2;
    const spra = sprm >> 13;
    let len: number;
    if (spra === 0 || spra === 1) len = 1;
    else if (spra === 2 || spra === 4 || spra === 5) len = 2;
    else if (spra === 3) len = 4;
    else if (spra === 7) len = 3;
    else if (sprm === 0xd608 || sprm === 0xd606) {
      // sprmTDefTable e simili: lunghezza su due byte
      len = u16(g, i) + 1;
    } else {
      len = g[i] + 1;
      if (sprm === 0xc615 && g[i] === 255) return; // sprmPChgTabs lungo: si lascia perdere il resto
    }
    yield [sprm, spra === 6 ? i + (sprm === 0xd608 || sprm === 0xd606 ? 2 : 1) : i, len];
    i += len;
  }
}

interface Para {
  istd: number;
  inTable: boolean;
  rowEnd: boolean;
  list: boolean;
  outline: number | null;
}

interface Chp {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
  sup?: boolean;
  sub?: boolean;
  hidden?: boolean;
}

interface Run<T> {
  from: number;
  to: number;
  props: T;
}

const on = (v: number) => v === 1 || v === 0x81;

function parsePapx(g: Uint8Array, istd: number): Para {
  const p: Para = { istd, inTable: false, rowEnd: false, list: false, outline: null };
  for (const [s, o] of sprms(g)) {
    if (s === 0x2416 || s === 0x6649) p.inTable = p.inTable || (s === 0x2416 ? g[o] !== 0 : u32(g, o) > 0); // fInTable, itap
    else if (s === 0x2417 || s === 0x244c) p.rowEnd = p.rowEnd || g[o] !== 0; // fTtp, fInnerTtp
    else if (s === 0x460b) p.list = u16(g, o) > 0; // ilfo
    else if (s === 0x2640 && g[o] < 9) p.outline = g[o] + 1; // livello di struttura
  }
  return p;
}

function parseChpx(g: Uint8Array): Chp {
  const c: Chp = {};
  for (const [s, o] of sprms(g)) {
    if (s === 0x0835) c.bold = on(g[o]);
    else if (s === 0x0836) c.italic = on(g[o]);
    else if (s === 0x0837 || s === 0x2a53) c.strike = c.strike || on(g[o]);
    else if (s === 0x2a3e) c.underline = g[o] !== 0;
    else if (s === 0x2a48) {
      c.sup = g[o] === 1;
      c.sub = g[o] === 2;
    } else if (s === 0x083c) c.hidden = on(g[o]);
  }
  return c;
}

/** Pagine FKP (512 byte) di paragrafi o caratteri, dalla tabella dei loro inizi. */
function fkpRuns<T>(wd: Uint8Array, tbl: Uint8Array, fc: number, lcb: number, papx: boolean, read: (g: Uint8Array, istd: number) => T, none: T): Run<T>[] {
  const out: Run<T>[] = [];
  if (!lcb || fc + lcb > tbl.length) return out;
  const n = (lcb - 4) / 8;
  for (let k = 0; k < n; k++) {
    const pn = u32(tbl, fc + (n + 1) * 4 + k * 4) & 0x3fffff;
    const fkp = wd.subarray(pn * 512, pn * 512 + 512);
    if (fkp.length < 512) continue;
    const crun = fkp[511];
    for (let j = 0; j < crun; j++) {
      const from = u32(fkp, j * 4);
      const to = u32(fkp, (j + 1) * 4);
      if (papx) {
        const bOff = fkp[(crun + 1) * 4 + j * 13];
        if (!bOff) {
          out.push({ from, to, props: none });
          continue;
        }
        const at = bOff * 2;
        let start: number;
        let len: number;
        if (fkp[at]) {
          start = at + 1;
          len = 2 * fkp[at] - 1;
        } else {
          start = at + 2;
          len = 2 * fkp[at + 1];
        }
        out.push({ from, to, props: read(fkp.subarray(start + 2, start + len), u16(fkp, start)) });
      } else {
        const off = fkp[(crun + 1) * 4 + j];
        if (!off) {
          out.push({ from, to, props: none });
          continue;
        }
        const at = off * 2;
        out.push({ from, to, props: read(fkp.subarray(at + 1, at + 1 + fkp[at]), 0) });
      }
    }
  }
  return out.sort((a, b) => a.from - b.from);
}

function findRun<T>(runs: Run<T>[], fc: number): T | null {
  let lo = 0;
  let hi = runs.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = runs[mid];
    if (fc < r.from) hi = mid - 1;
    else if (fc >= r.to) lo = mid + 1;
    else return r.props;
  }
  return null;
}

// ---------------------------------------------------------------- stili

type StyleRole = { heading: number } | { quote: true } | null;

const HEADING_NAME = /^(heading|titolo|überschrift|titre|t[ií]tulo|kop|rubrik|nadpis|nagłówek)\s*(\d)$/i;

/** Ruolo di ogni stile di paragrafo: titolo di livello N, citazione o testo normale. */
function readStyles(tbl: Uint8Array, fc: number, lcb: number): StyleRole[] {
  const roles: StyleRole[] = [];
  if (!lcb || fc + lcb > tbl.length) return roles;
  const s = tbl.subarray(fc, fc + lcb);
  const cbStshi = u16(s, 0);
  const cstd = u16(s, 2);
  const cbBase = u16(s, 4) || 10;
  let p = 2 + cbStshi;
  for (let i = 0; i < cstd && p + 2 <= s.length; i++) {
    const cb = u16(s, p);
    p += 2;
    if (!cb) {
      roles.push(null);
      continue;
    }
    const std = s.subarray(p, p + cb);
    p += cb;
    const sti = u16(std, 0) & 0x0fff;
    const cch = u16(std, cbBase);
    let name = '';
    for (let k = 0; k < cch && cbBase + 2 + k * 2 + 1 < std.length; k++) name += String.fromCharCode(u16(std, cbBase + 2 + k * 2));
    name = name.trim();
    const m = HEADING_NAME.exec(name);
    if (sti >= 1 && sti <= 9) roles.push({ heading: sti });
    else if (m) roles.push({ heading: Number(m[2]) });
    else if (sti === 62 || /^(title|titolo|titel|titre|t[ií]tulo)$/i.test(name)) roles.push({ heading: 1 });
    else if (/^(subtitle|sottotitolo|untertitel|sous-titre|subt[ií]tulo)$/i.test(name)) roles.push({ heading: 2 });
    else if (/quote|citazione|zitat|citation|cita/i.test(name)) roles.push({ quote: true });
    else roles.push(null);
  }
  return roles;
}

// ---------------------------------------------------------------- testo

interface Piece {
  cpStart: number;
  cpEnd: number;
  fc: number;
  compressed: boolean;
}

function readPieces(tbl: Uint8Array, fcClx: number, lcbClx: number): Piece[] {
  let i = fcClx;
  const end = fcClx + lcbClx;
  while (i < end && i < tbl.length) {
    const clxt = tbl[i];
    if (clxt === 1) {
      i += 3 + (u16(tbl, i + 1) << 16 >> 16);
      continue;
    }
    if (clxt !== 2) break;
    const lcb = u32(tbl, i + 1);
    const plc = i + 5;
    const n = (lcb - 4) / 12;
    const out: Piece[] = [];
    for (let k = 0; k < n; k++) {
      const raw = u32(tbl, plc + (n + 1) * 4 + k * 8 + 2);
      const compressed = (raw & 0x40000000) !== 0;
      const fc = raw & 0x3fffffff;
      out.push({ cpStart: u32(tbl, plc + k * 4), cpEnd: u32(tbl, plc + (k + 1) * 4), fc: compressed ? fc / 2 : fc, compressed });
    }
    return out;
  }
  throw new ImportError('corrupt');
}

const cp1252 = new TextDecoder('windows-1252');
const utf16 = new TextDecoder('utf-16le');

/** Caratteri del documento (unita' UTF-16, una per CP) con la posizione nel flusso di ognuno. */
function readChars(wd: Uint8Array, pieces: Piece[], total: number): { chars: string; fcs: Uint32Array } {
  let chars = '';
  const fcs = new Uint32Array(total);
  for (const p of pieces) {
    if (p.cpStart >= total) break;
    const n = Math.min(p.cpEnd, total) - p.cpStart;
    if (n <= 0) continue;
    const s = p.compressed ? cp1252.decode(wd.subarray(p.fc, p.fc + n)) : utf16.decode(wd.subarray(p.fc, p.fc + n * 2));
    const padded = s.length < n ? s + '\u0000'.repeat(n - s.length) : s.slice(0, n);
    chars += padded;
    for (let k = 0; k < n; k++) fcs[p.cpStart + k] = p.fc + (p.compressed ? k : k * 2);
  }
  return { chars, fcs };
}

interface Field {
  phase: 'code' | 'result';
  code: string;
  link?: string;
  toc?: boolean;
}

interface Unit {
  /** testo e marcature carattere per carattere */
  nodes: PMNode[];
  para: Para | null;
  /** terminatore: fine paragrafo, fine cella, interruzione di pagina */
  end: '\r' | '\x07' | '\x0c' | '';
  toc: boolean;
}

export interface WordBinary {
  doc: PMNode;
  title?: string;
}

export function readWordBinary(data: Uint8Array): WordBinary {
  const streams = readCfb(data);
  const wd = streams.get('WordDocument');
  if (!wd || u16(wd, 0) !== 0xa5ec) throw new ImportError('corrupt');
  const nFib = u16(wd, 2);
  if (nFib < 0xc0) throw new ImportError('oldWord');
  const flags = u16(wd, 0x0a);
  if (flags & 0x0100) throw new ImportError('encrypted');
  const tbl = streams.get(flags & 0x0200 ? '1Table' : '0Table');
  if (!tbl) throw new ImportError('corrupt');
  const csw = u16(wd, 32);
  const lw = 34 + csw * 2 + 2;
  const cslw = u16(wd, lw - 2);
  const ccp = (i: number) => Math.max(0, i32(wd, lw + i * 4));
  const ccpText = ccp(3);
  const ccpFtn = ccp(4);
  const ccpHdd = ccp(5);
  const ccpAtn = ccp(7);
  const ccpEdn = ccp(8);
  const rg = lw + cslw * 4 + 2;
  const fcLcb = (i: number): [number, number] => [u32(wd, rg + i * 8), u32(wd, rg + i * 8 + 4)];

  const pieces = readPieces(tbl, ...fcLcb(33));
  const total = ccpText + ccpFtn + ccpHdd + ccpAtn + ccpEdn;
  const { chars, fcs } = readChars(wd, pieces, Math.min(total, pieces.length ? pieces[pieces.length - 1].cpEnd : 0));
  const roles = readStyles(tbl, ...fcLcb(1));
  const paras = fkpRuns<Para>(wd, tbl, ...fcLcb(13), true, parsePapx, { istd: 0, inTable: false, rowEnd: false, list: false, outline: null });
  const chps = fkpRuns<Chp>(wd, tbl, ...fcLcb(12), false, (g) => parseChpx(g), {});

  // note: posizione del richiamo nel testo -> testo della nota (nel suo sottodocumento)
  const notes = new Map<number, string>();
  const readNotes = (ref: [number, number], txt: [number, number], base: number) => {
    const [fcRef, lcbRef] = ref;
    const [fcTxt, lcbTxt] = txt;
    if (!lcbRef || !lcbTxt) return;
    const n = (lcbRef - 4) / 6;
    for (let k = 0; k < n; k++) {
      const at = u32(tbl, fcRef + k * 4);
      const from = base + u32(tbl, fcTxt + k * 4);
      const to = base + u32(tbl, fcTxt + (k + 1) * 4);
      const units = scan(from, to, false);
      const parts: PMNode[] = [];
      for (const u of units) {
        if (parts.length) parts.push(text(' ', []));
        parts.push(...u.nodes);
      }
      notes.set(at, noteText(parts));
    }
  };

  /** Testo da `from` a `to` diviso in paragrafi, con campi, link e caratteri speciali risolti. */
  function scan(from: number, to: number, main: boolean): Unit[] {
    const units: Unit[] = [];
    let cur: PMNode[] = [];
    let buf = '';
    let bufMarks: PMMark[] = [];
    let bufKey = '';
    const fields: Field[] = [];
    let tocUnit = false;
    const flushText = () => {
      if (buf) cur.push(text(buf, bufMarks));
      buf = '';
    };
    const push = (s: string, marks: PMMark[]) => {
      const key = JSON.stringify(marks);
      if (key !== bufKey) {
        flushText();
        bufMarks = marks;
        bufKey = key;
      }
      buf += s;
    };
    const end = (term: Unit['end'], cp: number) => {
      flushText();
      const fc = term && cp < fcs.length ? fcs[cp] : -1;
      units.push({ nodes: cur, para: fc >= 0 ? findRun(paras, fc) : null, end: term, toc: tocUnit });
      cur = [];
      tocUnit = false;
    };
    for (let cp = from; cp < to && cp < chars.length; cp++) {
      const ch = chars[cp];
      const code = ch.charCodeAt(0);
      if (code === 0x13) {
        fields.push({ phase: 'code', code: '' });
        continue;
      }
      if (code === 0x14 || code === 0x15) {
        const f = fields[fields.length - 1];
        if (f && f.phase === 'code') {
          const c = f.code.trim();
          const link = /^HYPERLINK\s+(?:\\l\s+)?"([^"]+)"/i.exec(c);
          if (link) f.link = /^(https?:|mailto:)/i.test(link[1]) ? link[1] : undefined;
          if (/^TOC\b/i.test(c)) {
            f.toc = true;
            if (main) units.push({ nodes: [], para: null, end: '', toc: true });
          }
          f.phase = 'result';
        }
        if (code === 0x15) fields.pop();
        continue;
      }
      const inCode = fields.some((f) => f.phase === 'code');
      if (inCode) {
        fields[fields.length - 1].code += ch;
        // i campi possono andare a capo: il paragrafo finisce comunque
        if (code !== 0x0d) continue;
      }
      const inToc = fields.some((f) => f.toc);
      if (code === 0x0d || code === 0x07 || code === 0x0c) {
        if (code === 0x0c) {
          // interruzione di pagina in mezzo al testo: chiude il paragrafo e ne lascia traccia
          end('\r', cp);
          if (main) units.push({ nodes: [], para: null, end: '\x0c', toc: false });
          continue;
        }
        if (inToc) {
          cur = [];
          buf = '';
          continue;
        }
        end(code === 0x0d ? '\r' : '\x07', cp);
        continue;
      }
      if (inToc) continue;
      const chp = findRun(chps, fcs[cp]) ?? {};
      if (chp.hidden) continue;
      if (code === 0x02 && main) {
        const note = notes.get(cp);
        if (note !== undefined) {
          flushText();
          cur.push(footnote(note));
        }
        continue;
      }
      if (code === 0x0b) {
        flushText();
        cur.push({ type: 'hardBreak' });
        continue;
      }
      let s = ch;
      if (code === 0x09 || code === 0xa0) s = code === 0x09 ? ' ' : ' ';
      else if (code === 0x1e) s = '-';
      else if (code === 0x1f || code === 0xad) continue;
      else if (code < 0x20) continue;
      const marks: PMMark[] = [];
      const link = [...fields].reverse().find((f) => f.link)?.link;
      if (link) marks.push({ type: 'link', attrs: { href: link, title: null } });
      if (chp.bold) marks.push({ type: 'bold' });
      if (chp.italic) marks.push({ type: 'italic' });
      if (chp.strike) marks.push({ type: 'strike' });
      if (chp.underline && !link) marks.push({ type: 'underline' });
      if (chp.sup) marks.push({ type: 'superscript' });
      if (chp.sub) marks.push({ type: 'subscript' });
      push(s, marks);
    }
    if (buf || cur.length) end('', to);
    return units;
  }

  readNotes(fcLcb(2), fcLcb(3), ccpText);
  readNotes(fcLcb(46), fcLcb(47), ccpText + ccpFtn + ccpHdd + ccpAtn);

  const units = scan(0, ccpText, true);
  const blocks: PMNode[] = [];
  let rows: PMNode[][][] = [];
  let row: PMNode[][] = [];
  let cell: PMNode[] = [];
  let list: PMNode[] = [];
  let quote: PMNode[] = [];
  const closeList = () => {
    if (list.length) blocks.push({ type: 'bulletList', content: list });
    list = [];
  };
  const closeQuote = () => {
    if (quote.length) blocks.push({ type: 'blockquote', content: quote });
    quote = [];
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
  let tableOpen = false;
  let tocDone = false;
  for (const u of units) {
    if (u.toc && !u.nodes.length) {
      closeList();
      closeQuote();
      if (!tocDone) blocks.push({ type: 'toc' });
      tocDone = true;
      continue;
    }
    if (u.end === '\x0c') {
      closeList();
      closeQuote();
      if (tableOpen) closeTable();
      tableOpen = false;
      blocks.push({ type: 'pageBreak' });
      continue;
    }
    const p = u.para;
    if (p?.inTable || u.end === '\x07') {
      closeList();
      closeQuote();
      tableOpen = true;
      if (p?.rowEnd) {
        if (cell.length) row.push(cell);
        rows.push(row);
        row = [];
        cell = [];
        continue;
      }
      if (cell.length && u.nodes.length) cell.push({ type: 'hardBreak' });
      cell.push(...u.nodes);
      if (u.end === '\x07') {
        row.push(cell);
        cell = [];
      }
      continue;
    }
    if (tableOpen) {
      closeTable();
      tableOpen = false;
    }
    const role = p ? roles[p.istd] ?? null : null;
    const level = role && 'heading' in role ? role.heading : p?.outline ?? null;
    if (level) {
      closeList();
      closeQuote();
      const h = heading(level, u.nodes);
      if (h) blocks.push(h);
      continue;
    }
    const para = paragraph(u.nodes);
    if (!para) continue;
    if (p?.list) {
      closeQuote();
      list.push({ type: 'listItem', content: [para] });
      continue;
    }
    closeList();
    if (role && 'quote' in role) {
      quote.push(para);
      continue;
    }
    closeQuote();
    blocks.push(para);
  }
  closeList();
  closeQuote();
  if (tableOpen) closeTable();
  return { doc: doc(blocks) };
}
