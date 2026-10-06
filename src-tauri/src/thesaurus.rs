// Thesaurus offline (formato MyThes dei dizionari di LibreOffice): i file compressi stanno fra le
// risorse dell'app (resources/thesaurus, con le loro licenze), si leggono alla prima richiesta e si
// indicizzano in memoria. Restituisce il blocco grezzo di una parola: l'interpretazione (significati,
// sinonimi, contrari) sta nel frontend, in src/thesaurus/.
use crate::fsops::{err, CmdResult};
use std::collections::HashMap;
use std::io::Read;
use std::sync::{Mutex, OnceLock};
use tauri::path::BaseDirectory;
use tauri::Manager;

pub struct Thes {
    text: String,
    /// parola in minuscolo -> intervallo di byte del suo blocco (intestazione + significati)
    index: HashMap<String, (usize, usize)>,
}

impl Thes {
    /// Indicizza un file MyThes: prima riga la codifica, poi per ogni parola "parola|n" seguita da n righe.
    pub fn parse(text: String) -> Thes {
        let mut index = HashMap::new();
        let mut pos = 0;
        let mut lines = text.split_inclusive('\n').peekable();
        // riga della codifica (UTF-8)
        if let Some(first) = lines.next() {
            pos += first.len();
        }
        while let Some(line) = lines.next() {
            let start = pos;
            pos += line.len();
            let head = line.trim_end_matches(['\n', '\r']);
            let Some((word, n)) = head.rsplit_once('|') else { continue };
            let Ok(n) = n.parse::<usize>() else { continue };
            for _ in 0..n {
                match lines.next() {
                    Some(l) => pos += l.len(),
                    None => break,
                }
            }
            index.entry(word.to_lowercase()).or_insert((start, pos));
        }
        Thes { text, index }
    }

    pub fn lookup(&self, word: &str) -> Option<&str> {
        let (a, b) = *self.index.get(&word.trim().to_lowercase())?;
        Some(&self.text[a..b])
    }
}

fn cache() -> &'static Mutex<HashMap<String, std::sync::Arc<Thes>>> {
    static C: OnceLock<Mutex<HashMap<String, std::sync::Arc<Thes>>>> = OnceLock::new();
    C.get_or_init(|| Mutex::new(HashMap::new()))
}

fn load(app: &tauri::AppHandle, lang: &str) -> Result<std::sync::Arc<Thes>, String> {
    if let Some(t) = cache().lock().map_err(err)?.get(lang) {
        return Ok(t.clone());
    }
    let path = app
        .path()
        .resolve(format!("thesaurus/th_{lang}.dat.gz"), BaseDirectory::Resource)
        .map_err(err)?;
    let gz = std::fs::read(&path).map_err(|e| format!("thesaurus {}: {e}", path.display()))?;
    let mut text = String::new();
    flate2::read::GzDecoder::new(&gz[..]).read_to_string(&mut text).map_err(err)?;
    let t = std::sync::Arc::new(Thes::parse(text));
    cache().lock().map_err(err)?.insert(lang.to_string(), t.clone());
    Ok(t)
}

/// Blocco del thesaurus per una parola (None se non c'e'). Lingue: "it" e "en".
#[tauri::command]
pub async fn thesaurus_lookup(app: tauri::AppHandle, lang: String, word: String) -> CmdResult<Option<String>> {
    if lang != "it" && lang != "en" {
        return Ok(None);
    }
    // la prima volta si decomprime e si indicizza il file: fuori dal thread dell'interfaccia
    tauri::async_runtime::spawn_blocking(move || {
        let t = load(&app, &lang)?;
        Ok(t.lookup(&word).map(str::to_string))
    })
    .await
    .map_err(err)?
}

#[cfg(test)]
mod tests {
    use super::Thes;

    const SAMPLE: &str = "UTF-8\nabate|1\n(s.m.)|priore|superiore\nBello|2\n(agg.)|carino|grazioso\n(s.m.)|bellezza\nzero|1\n(num.)|nulla\n";

    #[test]
    fn indicizza_e_trova_senza_maiuscole() {
        let t = Thes::parse(SAMPLE.to_string());
        assert_eq!(t.lookup("abate"), Some("abate|1\n(s.m.)|priore|superiore\n"));
        assert_eq!(t.lookup("bello"), Some("Bello|2\n(agg.)|carino|grazioso\n(s.m.)|bellezza\n"));
        assert_eq!(t.lookup("  ZERO "), Some("zero|1\n(num.)|nulla\n"));
        assert_eq!(t.lookup("assente"), None);
    }

    /// I file veri delle risorse: si aprono, si indicizzano in tempi ragionevoli e trovano parole comuni.
    #[test]
    fn file_delle_risorse() {
        use std::io::Read;
        for (lang, words) in [("it", ["bello", "scrivere", "Casa"]), ("en", ["happy", "write", "House"])] {
            let gz = std::fs::read(format!("resources/thesaurus/th_{lang}.dat.gz")).expect("risorsa del thesaurus");
            let t0 = std::time::Instant::now();
            let mut text = String::new();
            flate2::read::GzDecoder::new(&gz[..]).read_to_string(&mut text).unwrap();
            let t = Thes::parse(text);
            let ms = t0.elapsed().as_millis();
            eprintln!("thesaurus {lang}: {} parole in {ms} ms", t.index.len());
            assert!(t.index.len() > 10_000);
            for w in words {
                assert!(t.lookup(w).is_some(), "{lang}: manca {w}");
            }
        }
    }

    #[test]
    fn file_tronco_non_rompe() {
        let t = Thes::parse("UTF-8\nparola|3\n(x)|uno\n".to_string());
        assert_eq!(t.lookup("parola"), Some("parola|3\n(x)|uno\n"));
    }
}
