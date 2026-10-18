// Picus: flag delle varianti (bit nell'ordine). A parte dal parser, cosi' l'interfaccia li usa
// senza caricare il motore.
export const FLAGS = ['figurative', 'dated', 'technical', 'emphatic', 'euphemistic'] as const;
export type Flag = (typeof FLAGS)[number];

export const flagsOf = (bits: number): Flag[] => FLAGS.filter((_, i) => bits & (1 << i));

/** nome del "senso" che raccoglie i contrari di una parola (il pannello lo traduce) */
export const ANTONYMS = '!antonyms';
