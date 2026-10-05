// Alexandria: guscio desktop. Il Rust fa solo I/O, git, indice, rete e impaginazione;
// tutta la logica di dominio e' nel frontend (src/), in funzioni pure testate.
mod fsops;
mod git;
mod index;
mod clipboard;
mod net;
mod portable;
mod snapshot;
mod typeset;

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
    tauri::Builder::default()
        .setup(|app| {
            use tauri::Manager;
            if let Some(w) = app.get_webview_window("main") {
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
            git::git_push,
            git::git_pull,
            index::index_upsert,
            index::index_remove,
            index::index_search,
            net::net_fetch,
            snapshot::net_snapshot,
            portable::portable_root,
            clipboard::clipboard_read,
            selftest_spec,
            selftest_exit,
            typeset::typst_compile,
        ])
        .run(tauri::generate_context!())
        .expect("errore all'avvio di Alexandria");
}
