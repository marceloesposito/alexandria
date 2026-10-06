// Alexandria: guscio desktop. Il Rust fa solo I/O, git, indice, rete e impaginazione;
// tutta la logica di dominio e' nel frontend (src/), in funzioni pure testate.
mod fsops;
mod forge;
mod git;
mod index;
mod clipboard;
mod net;
mod portable;
mod snapshot;
mod thesaurus;
mod typeset;

/// File .recensio da aprire (passato all'avvio o, su macOS, dal Finder): lo legge una volta il frontend.
static OPEN_FILE: std::sync::Mutex<Option<String>> = std::sync::Mutex::new(None);

fn remember_open(path: String) {
    if let Ok(mut f) = OPEN_FILE.lock() {
        *f = Some(path);
    }
}

#[tauri::command]
fn startup_file() -> Option<String> {
    OPEN_FILE.lock().ok()?.take()
}

/// Autotest dell'import con foto (ALEXANDRIA_EMBED_TEST="<url>|<rapporto.json>"): lo esegue il frontend.
#[tauri::command]
fn selftest_spec() -> Option<String> {
    std::env::var("ALEXANDRIA_EMBED_TEST").ok()
}

#[tauri::command]
fn selftest_exit(app: tauri::AppHandle) {
    if std::env::var("ALEXANDRIA_EMBED_TEST").is_ok() {
        app.exit(0);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // portable su Windows: anche la cache di WebView2 resta sulla chiavetta, non sul PC ospite
    #[cfg(windows)]
    if let Some(p) = portable::data_root() {
        std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", p.join("webview"));
    }
    // doppio clic su un .recensio (Windows/Linux: il percorso arriva come argomento)
    if let Some(a) = std::env::args().skip(1).find(|a| a.to_lowercase().ends_with(".recensio")) {
        remember_open(a);
    }
    tauri::Builder::default()
        .setup(|app| {
            use tauri::Manager;
            if let Some(w) = app.get_webview_window("main") {
                // Windows: niente barra nativa, la barra dei menu dell'app fa da barra del titolo
                // (bordi, ombra e ridimensionamento restano quelli del sistema)
                #[cfg(windows)]
                let _ = w.set_decorations(false);
                // prove automatiche: finestra fuori schermo e senza focus (non disturba chi lavora)
                if std::env::var("ALEXANDRIA_TEST_OFFSCREEN").is_ok() {
                    let _ = w.set_position(tauri::PhysicalPosition::new(-6000, -6000));
                    let _ = w.show();
                } else {
                    let _ = w.center();
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            // autotest della foto dei link: ALEXANDRIA_SNAPSHOT_TEST="<url>|<file.png>" fotografa ed esce
            if let Ok(spec) = std::env::var("ALEXANDRIA_SNAPSHOT_TEST") {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let (url, out) = spec.split_once('|').unwrap_or((spec.as_str(), "snapshot-test.png"));
                    let t0 = std::time::Instant::now();
                    match snapshot::take(&handle, url).await {
                        Ok(png) => {
                            let _ = std::fs::write(out, &png);
                            eprintln!("SNAPSHOT OK {} byte in {:?} -> {out}", png.len(), t0.elapsed());
                        }
                        Err(e) => eprintln!("SNAPSHOT ERRORE dopo {:?}: {e}", t0.elapsed()),
                    }
                    handle.exit(0);
                });
            }
            // autotest della lettura nel motore web (siti con controllo anti-bot):
            // ALEXANDRIA_RENDER_TEST="<url>|<file.html>" salva l'HTML letto ed esce
            if let Ok(spec) = std::env::var("ALEXANDRIA_RENDER_TEST") {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let (url, out) = spec.split_once('|').unwrap_or((spec.as_str(), "render-test.html"));
                    let t0 = std::time::Instant::now();
                    match snapshot::render(&handle, url, std::env::var("ALEXANDRIA_RENDER_VISIBLE").is_ok()).await {
                        Ok(r) => {
                            let _ = std::fs::write(out, &r.html);
                            eprintln!("RENDER OK {} caratteri, foto {}, in {:?} -> {out} ({})", r.html.len(), r.png_b64.is_some(), t0.elapsed(), r.url);
                        }
                        Err(e) => eprintln!("RENDER ERRORE dopo {:?}: {e}", t0.elapsed()),
                    }
                    handle.exit(0);
                });
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
            fsops::fs_copy,
            fsops::app_data_dir,
            fsops::documents_dir,
            git::git_init,
            git::git_status,
            git::git_set_author,
            git::git_commit,
            git::git_log,
            git::git_changes,
            git::git_compare,
            git::git_read_at,
            git::git_create_branch,
            git::git_checkout,
            git::git_restore,
            git::git_merge,
            git::git_complete_merge,
            git::git_abort_merge,
            git::git_set_remote,
            git::git_remote,
            forge::forge_account,
            forge::forge_logout,
            forge::forge_set_token,
            forge::forge_device_start,
            forge::forge_device_poll,
            forge::forge_create_repo,
            git::git_push,
            git::git_pull,
            index::index_upsert,
            index::index_remove,
            index::index_search,
            net::net_fetch,
            snapshot::net_snapshot,
            snapshot::net_render,
            thesaurus::thesaurus_lookup,
            portable::portable_root,
            clipboard::clipboard_read,
            selftest_spec,
            startup_file,
            selftest_exit,
            typeset::typst_compile,
        ])
        .build(tauri::generate_context!())
        .expect("errore all'avvio di Alexandria")
        .run(|_app, _event| {
            // macOS: i file aperti dal Finder arrivano come evento
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = &_event {
                use tauri::Emitter;
                for u in urls {
                    if let Ok(p) = u.to_file_path() {
                        remember_open(p.to_string_lossy().into_owned());
                        let _ = _app.emit("open-file", ());
                    }
                }
            }
        });
}
