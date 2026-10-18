import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePack } from './pack';
import { makeStemmer } from './stem';

const stemmer = (p: string) => makeStemmer(parsePack(readFileSync(join(__dirname, p), 'utf8')));

// campione regolare dei vocabolari di prova di Snowball (snowball-data, BSD): sull'intero vocabolario
// lo stemmer guidato dai dati coincide al 99,99% in inglese (42.634 parole) e in italiano (35.496)
const EN =
  'acquaintance acquaint affied affi alluring allur announcing announc assaying assay avenue avenu baptistery baptisteri bespeaking bespeak bleeders bleeder camels camel casing case chinese chines cleanliness cleanli conventionalities convent counterpoints counterpoint criticize critic debts debt deteriorated deterior disagree disagre drooping droop eddying eddi emerging emerg excuse excus fabricated fabric fearfulty fearfulti flowed flow forsake forsak gases gase gladly glad grubs grub heavies heavi housekeepers housekeep ies ie impure impur inevitable inevit instability instabl leggings leg mails mail muffled muffl nodules nodul obstructing obstruct ordained ordain papering paper perishing perish precocious precoci quadruped quadrup reckoners reckon reputation reput romping romp saddling saddl shortly short smartly smart surmising surmis tailors tailor threes three tolling toll trays tray unbowed unbow unpitied unpiti unused unus variations variat villainy villaini wailings wail worries worri running run ponies poni generously generous happiness happi relational relat hopping hop hoping hope dying die skies sky';
const IT =
  'accettati accett addii addi affrettato affrett alleviare allev amministrato amministr annualmente annual approderemo approd assoluto assol augurate augur avvertiti avvert calciato calc capitali capital cercavi cerc commette commett concentrare concentr consumata consum convenevolmente convenevol cospicui cospicu cronache cronac decisiva decis denunciarli denunc dichiari dichiar dirige dirig eccezionale eccezional energetiche energet esempio esemp fotografia fotograf furtivamente furtiv giunse giuns gridano grid improvvisamente improvvis indagini indagin inflazionistico inflazionist interruzioni interru maggiorazioni maggior manifestata manifest miserabili miser oltraggio oltragg partisse partiss pensabile pensabil portatori portator prestargli prest radunarvi radun ravvicinava ravvicin riportate riport risultate risult scappassero scapp sentite sent sfuggita sfugg sosteneva sosten speculazioni specul stupire stup susurrandosi susurr trascorrevano trascorr uscivo usciv vedute ved alzavano alzav alzarsi alzars applicativo applic mostrandolo mostr parlarne parl nazionalità nazional';

function pairs(s: string): [string, string][] {
  const w = s.split(' ');
  return Array.from({ length: w.length / 2 }, (_, i) => [w[2 * i], w[2 * i + 1]]);
}

describe('stemmer guidato dai dati', () => {
  it('inglese come Snowball (Porter2)', () => {
    const st = stemmer('packs/en.picus');
    for (const [w, s] of pairs(EN)) expect(st(w), w).toBe(s);
  });

  it('italiano come Snowball', () => {
    const st = stemmer('../../src-tauri/resources/picus/it.picus');
    for (const [w, s] of pairs(IT)) expect(st(w), w).toBe(s);
  });

  it('le forme dello stesso verbo hanno la stessa radice', () => {
    const st = stemmer('packs/en.picus');
    expect(new Set(['argue', 'argued', 'argues', 'arguing'].map(st)).size).toBe(1);
    const it = stemmer('../../src-tauri/resources/picus/it.picus');
    expect(new Set(['considerare', 'considerato', 'considerazione', 'consideriamo'].map(it)).size).toBe(1);
  });
});
