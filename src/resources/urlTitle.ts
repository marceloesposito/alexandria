// Titolo e sito ricavati dall'indirizzo, per i link la cui pagina non si lascia leggere.

/** Nome del sito senza "www." (es. "direct.mit.edu"). */
export function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Titolo leggibile dall'ultimo pezzo significativo del percorso: trattini e trattini bassi diventano
 * spazi; una maiuscola attaccata alla fine di una parola ("MindA") e' di solito l'inizio di un
 * sottotitolo rimasto senza i due punti ("Mind: A ..."). Senza percorso utile resta il sito.
 */
export function titleFromUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  const parts = u.pathname
    .split('/')
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    })
    .map((p) => p.replace(/\.(html?|php|aspx?)$/i, ''))
    // pezzi con almeno una parola vera (non solo numeri o identificativi corti)
    .filter((p) => /[a-zA-Z]{3,}/.test(p) && /[-_ ]/.test(p));
  const slug = parts.pop();
  if (!slug) return siteOf(url);
  const words = slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.replace(/^(.*[a-z])([A-Z])$/, '$1: $2'));
  const title = words.join(' ').replace(/\s+/g, ' ').trim();
  return title.charAt(0).toUpperCase() + title.slice(1);
}
