// Modalita' portable: se accanto all'app c'e' una cartella "Column-data", tutto vive li'
// (stato dell'app, bozza del pezzo senza file, dati della webview). Pensata per una chiavetta USB.
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

pub const DATA_DIR: &str = "Column-data";
/// cartella di quando l'app si chiamava Folium: al primo avvio diventa "Column-data"
const LEGACY_DIR: &str = "Folium-data";

/// Cartella in cui cercare "Column-data": quella dell'eseguibile, o quella che contiene
/// il pacchetto .app su macOS (l'eseguibile sta in Column.app/Contents/MacOS).
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

/// La cartella "Column-data" se l'app e' portable.
pub fn data_root() -> Option<&'static Path> {
    static ROOT: OnceLock<Option<PathBuf>> = OnceLock::new();
    ROOT.get_or_init(|| {
        let exe = std::env::current_exe().ok()?;
        let home = app_home(&exe)?;
        let d = home.join(DATA_DIR);
        let old = home.join(LEGACY_DIR);
        if !d.exists() && old.is_dir() {
            let _ = std::fs::rename(&old, &d);
        }
        d.is_dir().then_some(d)
    })
    .as_deref()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trova_la_cartella_accanto_al_pacchetto_app() {
        let exe = Path::new("/Volumes/USB/Column.app/Contents/MacOS/column");
        assert_eq!(app_home(exe).unwrap(), Path::new("/Volumes/USB"));
    }

    #[test]
    fn trova_la_cartella_accanto_all_eseguibile() {
        let exe = Path::new("/media/usb/Column/column");
        assert_eq!(app_home(exe).unwrap(), Path::new("/media/usb/Column"));
    }
}
