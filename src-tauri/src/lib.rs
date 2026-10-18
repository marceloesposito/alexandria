// Column: guscio desktop. Il Rust fa solo I/O (file, dialoghi, stampa); tutta la logica di dominio
// e' nel frontend (src/), in funzioni pure testate.
mod fsops;
mod portable;

/// File da aprire passato all'avvio (doppio clic, "Apri con"): lo legge una volta il frontend.
static OPEN_FILE: std::sync::Mutex<Option<String>> = std::sync::Mutex::new(None);

/// File che Column sa aprire dal sistema.
fn opened_file_ok(path: &str) -> bool {
    const EXT: [&str; 7] = ["clmn", "folium", "docx", "md", "markdown", "txt", "text"];
    let lower = path.to_lowercase();
    lower.rsplit_once('.').map(|(_, e)| EXT.contains(&e)).unwrap_or(false)
}

#[tauri::command]
fn startup_file() -> Option<String> {
    OPEN_FILE.lock().ok()?.take()
}

/// Stampa della pagina (Esporta in PDF): la finestra di stampa del sistema.
#[tauri::command]
fn print_page(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // portable: anche la cache della webview resta nella cartella dei dati, non sul PC ospite
    #[cfg(windows)]
    if let Some(p) = portable::data_root() {
        std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", p.join("webview"));
    }
    if let Some(a) = std::env::args().skip(1).find(|a| opened_file_ok(a)) {
        if let Ok(mut f) = OPEN_FILE.lock() {
            *f = Some(a);
        }
    }
    tauri::Builder::default()
        .setup(|app| {
            use tauri::Manager;
            if let Some(w) = app.get_webview_window("main") {
                // Windows e Linux: niente barra di sistema, la barra in alto dell'app fa da barra del titolo
                #[cfg(not(target_os = "macos"))]
                let _ = w.set_decorations(false);
                // prove automatiche: finestra fuori schermo e senza fuoco (non disturba chi lavora)
                if std::env::var("COLUMN_TEST_OFFSCREEN").is_ok() {
                    let _ = w.set_position(tauri::PhysicalPosition::new(-6000, -6000));
                    let _ = w.show();
                } else {
                    let _ = w.center();
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            fsops::fs_read_text,
            fsops::fs_write_text,
            fsops::fs_read_bytes,
            fsops::fs_write_bytes,
            fsops::fs_exists,
            fsops::fs_list,
            fsops::fs_mkdir,
            fsops::fs_remove,
            fsops::fs_rename,
            fsops::data_dir,
            startup_file,
            print_page,
        ])
        .run(tauri::generate_context!())
        .expect("errore all'avvio di Column");
}

#[cfg(test)]
mod tests {
    use super::opened_file_ok;

    #[test]
    fn file_aperti_dal_sistema() {
        assert!(opened_file_ok("C:/Tesi/capitolo.DOCX"));
        assert!(opened_file_ok("/Users/a/saggio.clmn"));
        assert!(opened_file_ok("vecchio.folium"));
        assert!(opened_file_ok("note.md"));
        assert!(!opened_file_ok("--flag"));
        assert!(!opened_file_ok("vecchio.doc"));
    }
}
