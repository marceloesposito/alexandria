// Posizione della maniglia dei blocchi. La pagina ha lo `zoom` CSS (zoom dell'utente per
// l'adattamento alla finestra): floating-ui misura i rettangoli in pixel dello schermo, ma `left`/`top`
// della maniglia, che sta dentro la pagina, vengono di nuovo moltiplicati per lo zoom. Senza
// correzione la maniglia scivola verso il testo e, scendendo nella pagina, finisce accanto al blocco
// sbagliato. Qui si riporta la posizione in pixel della pagina.
//
// La distanza dal testo non e' uno spostamento ma un `padding-right` trasparente della maniglia
// (`editor.css`): l'estensione nasconde la maniglia quando il mouse esce dal testo verso qualcosa che
// non e' la maniglia, quindi lo spazio fra icona e testo deve far parte della maniglia.

/**
 * Da pixel dello schermo a pixel della pagina con zoom `zoom`. Con `left-start` floating-ui toglie
 * la larghezza della maniglia (`width`, in pixel CSS) a una coordinata dello schermo: la si rimette
 * prima di dividere per lo zoom e la si toglie dopo, cosi' il bordo destro tocca il testo.
 */
export function handlePosition(x: number, y: number, zoom: number, width = 0): { x: number; y: number } {
  const z = zoom > 0 && Number.isFinite(zoom) ? zoom : 1;
  return { x: (x + width) / z - width, y: y / z };
}

/** Zoom effettivo di un elemento (prodotto degli `zoom` degli antenati), 1 se il motore non lo dice. */
export function cssZoomOf(el: Element): number {
  const z = (el as Element & { currentCSSZoom?: number }).currentCSSZoom;
  return typeof z === 'number' && z > 0 ? z : 1;
}

/** Configurazione di floating-ui per la maniglia (il middleware basta come `{ name, fn }`). */
export const handlePositionConfig = {
  placement: 'left-start' as const,
  strategy: 'absolute' as const,
  middleware: [
    {
      name: 'alexandriaHandle',
      fn: ({ x, y, elements }: { x: number; y: number; elements: { floating: HTMLElement } }) =>
        handlePosition(x, y, cssZoomOf(elements.floating), elements.floating.offsetWidth),
    },
  ],
};
