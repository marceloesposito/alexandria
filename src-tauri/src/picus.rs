// Picus: pacchetti di lingua fra le risorse dell'app (resources/picus, uno per lingua: it.picus...).
// L'installer copia solo quelli scelti nella pagina dei componenti; il portable li ha accanto
// all'eseguibile. I pacchetti aggiunti dall'utente stanno nella cartella dati dell'app e li legge il
// frontend con le funzioni del file system. Qui solo I/O: il formato lo interpreta src/picus/.
use crate::fsops::{err, CmdResult};
use std::path::{Path, PathBuf};
use tauri::path::BaseDirectory;
use tauri::Manager;

/// Codice di lingua accettato nel nome del file: 2-3 lettere minuscole (niente percorsi).
pub fn valid_lang(lang: &str) -> bool {
    (2..=3).contains(&lang.len()) && lang.bytes().all(|b| b.is_ascii_lowercase())
}

/// Lingue dei file "<lang>.picus" in una cartella, in ordine.
pub fn list_langs(dir: &Path) -> Vec<String> {
    let mut out: Vec<String> = std::fs::read_dir(dir)
        .map(|it| {
            it.filter_map(|e| e.ok())
                .filter_map(|e| {
                    let name = e.file_name().to_string_lossy().to_string();
                    let lang = name.strip_suffix(".picus")?;
                    valid_lang(lang).then(|| lang.to_string())
                })
                .collect()
        })
        .unwrap_or_default();
    out.sort();
    out
}

fn resource_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().resolve("picus", BaseDirectory::Resource).map_err(err)
}

/// Lingue dei pacchetti installati con l'app.
#[tauri::command]
pub fn picus_resources(app: tauri::AppHandle) -> CmdResult<Vec<String>> {
    Ok(list_langs(&resource_dir(&app)?))
}

/// Testo del pacchetto di una lingua fra le risorse (None se non e' stato installato).
#[tauri::command]
pub fn picus_resource(app: tauri::AppHandle, lang: String) -> CmdResult<Option<String>> {
    if !valid_lang(&lang) {
        return Ok(None);
    }
    let path = resource_dir(&app)?.join(format!("{lang}.picus"));
    match std::fs::read_to_string(&path) {
        Ok(t) => Ok(Some(t)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("picus {}: {e}", path.display())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lingue_valide() {
        assert!(valid_lang("it"));
        assert!(valid_lang("fra"));
        assert!(!valid_lang("../en"));
        assert!(!valid_lang("IT"));
        assert!(!valid_lang("i"));
        assert!(!valid_lang("italiano"));
    }

    #[test]
    fn elenca_i_pacchetti_delle_risorse() {
        // la cartella vera dei pacchetti: c'e' almeno l'italiano
        let langs = list_langs(Path::new("resources/picus"));
        assert!(langs.contains(&"it".to_string()), "{langs:?}");
        let text = std::fs::read_to_string("resources/picus/it.picus").unwrap();
        assert!(text.contains("@meta") && text.contains("lang it"));
    }

    #[test]
    fn ignora_gli_altri_file() {
        let dir = std::env::temp_dir().join(format!("picus-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        for f in ["en.picus", "LICENSE.txt", "de.picus.bak", "Fr.picus", "italiano.picus"] {
            std::fs::write(dir.join(f), "@meta\n").unwrap();
        }
        assert_eq!(list_langs(&dir), vec!["en"]);
        assert!(list_langs(&dir.join("non-c-e")).is_empty());
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
