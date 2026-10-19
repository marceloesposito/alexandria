// Picus: pacchetti di lingua. L'inglese e' incluso; gli altri stanno fra le risorse dell'app (scelti
// nell'installer) o nella cartella dati dell'utente (aggiunti da Preferenze, anche sul Mac e nel
// portable). Quello dell'utente vale piu' di quello dell'app: si puo' aggiornare senza reinstallare.
import { platform, joinPath } from '../platform';
import { parsePack } from './pack';
import { BUILTIN, engineFor, forgetEngine, type Engine } from './engine';

export interface PackInfo {
  lang: string;
  name: string;
  source: 'builtin' | 'app' | 'user';
}

const userDir = async () => joinPath(await platform.appDataDir(), 'picus');
const userFile = async (lang: string) => joinPath(await userDir(), `${lang}.picus`);

async function userText(lang: string): Promise<string | null> {
  const f = await userFile(lang);
  return (await platform.exists(f)) ? platform.readText(f) : null;
}

/** Testo del pacchetto di una lingua (prima quello dell'utente, poi quello dell'app). */
export async function packText(lang: string): Promise<string | null> {
  if (!/^[a-z]{2,3}$/.test(lang)) return null;
  return (await userText(lang).catch(() => null)) ?? (await platform.picusResource(lang).catch(() => null));
}

/** Motore per la lingua di scrittura, o null se il pacchetto non c'e'. */
export async function loadEngine(lang: string): Promise<Engine | null> {
  if (lang === BUILTIN) return engineFor(lang);
  const cached = engineFor(lang, null);
  if (cached) return cached;
  const text = await packText(lang);
  return text ? engineFor(lang, text) : null;
}

const nameOf = (text: string, lang: string) => /^name\s+(.+)$/m.exec(text)?.[1].trim() || lang;

/** Pacchetti disponibili, per le Preferenze. */
export async function installedPacks(): Promise<PackInfo[]> {
  const out: PackInfo[] = [{ lang: BUILTIN, name: 'English', source: 'builtin' }];
  const seen = new Set([BUILTIN]);
  const dir = await userDir();
  const user = (await platform.exists(dir)) ? (await platform.list(dir)).filter((e) => !e.isDir && /^[a-z]{2,3}\.picus$/.test(e.name)) : [];
  for (const e of user) {
    const lang = e.name.slice(0, -'.picus'.length);
    if (seen.has(lang)) continue;
    seen.add(lang);
    out.push({ lang, name: nameOf(await platform.readText(joinPath(dir, e.name)), lang), source: 'user' });
  }
  for (const lang of await platform.picusResources().catch(() => [] as string[])) {
    if (seen.has(lang)) continue;
    seen.add(lang);
    const text = await platform.picusResource(lang).catch(() => null);
    if (text) out.push({ lang, name: nameOf(text, lang), source: 'app' });
  }
  return out;
}

/** Aggiunge un pacchetto scelto dall'utente: si controlla tutto prima di copiarlo. */
export async function installPack(path: string): Promise<PackInfo> {
  const text = await platform.readText(path);
  // errori del formato con il numero di riga (PackError)
  const pack = parsePack(text);
  if (!/^[a-z]{2,3}$/.test(pack.lang)) throw new Error(`lang "${pack.lang}"`);
  if (pack.lang === BUILTIN) throw new Error('English is built in');
  const dir = await userDir();
  await platform.mkdir(dir);
  await platform.writeText(await userFile(pack.lang), text);
  forgetEngine(pack.lang);
  return { lang: pack.lang, name: nameOf(text, pack.lang), source: 'user' };
}

/** Toglie un pacchetto aggiunto dall'utente (quelli dell'app si tolgono con l'installer). */
export async function removePack(lang: string): Promise<void> {
  const f = await userFile(lang);
  if (await platform.exists(f)) await platform.remove(f);
  forgetEngine(lang);
}
