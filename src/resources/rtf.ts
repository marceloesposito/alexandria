// RTF -> testo semplice: parole di controllo ignorate, \par come a capo, \'hh e \uN decodificati.
const SKIP_DESTINATIONS = new Set([
  'fonttbl',
  'colortbl',
  'stylesheet',
  'info',
  'pict',
  'object',
  'header',
  'footer',
  'headerl',
  'headerr',
  'footerl',
  'footerr',
  'xmlnstbl',
  'listtable',
  'listoverridetable',
  'rsidtbl',
  'generator',
  'themedata',
  'colorschememapping',
  'latentstyles',
  'datastore',
  'mmathPr',
  'pgdsctbl',
]);

const CP1252: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹',
  0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™',
  0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
};

export function rtfToText(rtf: string): string {
  let out = '';
  let i = 0;
  const stack: { skip: boolean; uc: number }[] = [{ skip: false, uc: 1 }];
  let skipChars = 0;
  const top = () => stack[stack.length - 1];
  while (i < rtf.length) {
    const ch = rtf[i];
    if (ch === '{') {
      stack.push({ ...top() });
      i++;
      // gruppo "ignorabile" {\*\destinazione ...}
      if (rtf.startsWith('\\*', i)) top().skip = true;
      continue;
    }
    if (ch === '}') {
      if (stack.length > 1) stack.pop();
      i++;
      continue;
    }
    if (ch === '\\') {
      const next = rtf[i + 1];
      if (next === undefined) break;
      if (next === '\\' || next === '{' || next === '}') {
        if (!top().skip) out += next;
        i += 2;
        continue;
      }
      if (next === "'") {
        const code = parseInt(rtf.slice(i + 2, i + 4), 16);
        if (!top().skip) {
          if (skipChars > 0) skipChars--;
          else out += CP1252[code] ?? String.fromCharCode(code);
        }
        i += 4;
        continue;
      }
      if (next === '~') {
        if (!top().skip) out += ' ';
        i += 2;
        continue;
      }
      if (next === '-' || next === '_') {
        i += 2;
        continue;
      }
      const m = /^([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i + 1, i + 40));
      if (!m) {
        i += 2;
        continue;
      }
      const [all, word, num] = m;
      i += 1 + all.length;
      if (SKIP_DESTINATIONS.has(word)) {
        top().skip = true;
        continue;
      }
      if (top().skip) continue;
      switch (word) {
        case 'par':
        case 'line':
        case 'sect':
        case 'page':
          out += '\n';
          break;
        case 'tab':
        case 'cell':
          out += '\t';
          break;
        case 'row':
          out += '\n';
          break;
        case 'emdash':
          out += '—';
          break;
        case 'endash':
          out += '–';
          break;
        case 'lquote':
          out += '‘';
          break;
        case 'rquote':
          out += '’';
          break;
        case 'ldblquote':
          out += '“';
          break;
        case 'rdblquote':
          out += '”';
          break;
        case 'bullet':
          out += '•';
          break;
        case 'uc':
          top().uc = Number(num ?? 1);
          break;
        case 'u': {
          let code = Number(num ?? 0);
          if (code < 0) code += 65536;
          out += String.fromCharCode(code);
          skipChars = top().uc;
          break;
        }
        default:
          break;
      }
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      i++;
      continue;
    }
    if (!top().skip) {
      if (skipChars > 0) skipChars--;
      else out += ch;
    }
    i++;
  }
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
