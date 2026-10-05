// Formule LaTeX -> SVG con MathJax (per PDF, DOCX e HTML). Caricato solo quando si esporta.
let converter: Promise<(latex: string, display: boolean) => string> | null = null;

async function load() {
  const [{ mathjax }, { TeX }, { SVG }, { liteAdaptor }, { RegisterHTMLHandler }, { AllPackages }] = await Promise.all([
    import('mathjax-full/js/mathjax.js'),
    import('mathjax-full/js/input/tex.js'),
    import('mathjax-full/js/output/svg.js'),
    import('mathjax-full/js/adaptors/liteAdaptor.js'),
    import('mathjax-full/js/handlers/html.js'),
    import('mathjax-full/js/input/tex/AllPackages.js'),
  ]);
  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const tex = new TeX({ packages: AllPackages.filter((p: string) => p !== 'bussproofs') });
  const svg = new SVG({ fontCache: 'none' });
  const html = mathjax.document('', { InputJax: tex, OutputJax: svg });
  return (latex: string, display: boolean) => {
    const node = html.convert(latex || '\\square', { display });
    const out = adaptor.innerHTML(node);
    return out;
  };
}

export interface MathSvg {
  svg: string;
  /** dimensioni in ex (unita' di MathJax), da convertire in em per Typst e DOCX */
  widthEx: number;
  heightEx: number;
  depthEx: number;
}

export async function texToSvg(latex: string, display: boolean): Promise<MathSvg> {
  converter ??= load();
  const conv = await converter;
  let svg: string;
  try {
    svg = conv(latex, display);
  } catch {
    svg = conv('\\text{?}', display);
  }
  const num = (re: RegExp) => parseFloat(re.exec(svg)?.[1] ?? '0');
  const widthEx = num(/width="([\d.]+)ex"/);
  const heightEx = num(/height="([\d.]+)ex"/);
  const depthEx = -num(/vertical-align:\s*(-?[\d.]+)ex/);
  // colore esplicito: in PDF e DOCX "currentColor" non sempre funziona
  svg = svg.replace(/currentColor/g, '#000000');
  if (!/xmlns=/.test(svg)) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  return { svg, widthEx, heightEx, depthEx };
}
