// Modalita' portable: se accanto all'app c'e' una cartella "Alexandria-data", tutto vive li'
// (stato dell'app, Compendium, Library, dati della webview). Pensata per una chiavetta USB.
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

pub const DATA_DIR: &str = "Alexandria-data";

/// Cartella in cui cercare "Alexandria-data": quella dell'eseguibile, o quella che contiene
/// il pacchetto .app su macOS (l'eseguibile sta in Alexandria.app/Contents/MacOS).
fn app_home(exe: &Path) -> Option<PathBuf> {
    let dir = exe.parent()?;
    let mut cur = Some(dir);
    while let Some(d) = cur {
        if d.extension().is_some_and(|e| e == "app") {
            return d.parent().map(Path::to_path_buf);
        }
        cur = d.parent();
    }
    Some(dir.to_path_buf())
}

/// La cartella "Alexandria-data" se l'app e' portable.
pub fn data_root() -> Option<&'static Path> {
    static ROOT: OnceLock<Option<PathBuf>> = OnceLock::new();
    ROOT.get_or_init(|| {
        let exe = std::env::current_exe().ok()?;
        let d = app_home(&exe)?.join(DATA_DIR);
        d.is_dir().then_some(d)
    })
    .as_deref()
}

#[tauri::command]
pub fn portable_root() -> Option<String> {
    data_root().map(|p| p.to_string_lossy().replace('\\', "/"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trova_la_cartella_accanto_al_pacchetto_app() {
        let exe = Path::new("/Volumes/USB/Alexandria.app/Contents/MacOS/alexandria");
        assert_eq!(app_home(exe).unwrap(), Path::new("/Volumes/USB"));
    }

    #[test]
    fn trova_la_cartella_accanto_all_eseguibile() {
        let exe = Path::new("/media/usb/Alexandria/alexandria");
        assert_eq!(app_home(exe).unwrap(), Path::new("/media/usb/Alexandria"));
    }
}
