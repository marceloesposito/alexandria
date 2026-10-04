// Alexandria: guscio desktop. Il Rust fa solo I/O, git, indice, rete e impaginazione;
// tutta la logica di dominio e' nel frontend (src/), in funzioni pure testate.
mod fsops;
mod git;
mod index;
mod net;
mod typeset;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            typeset::typst_compile,
        ])
        .run(tauri::generate_context!())
        .expect("errore all'avvio di Alexandria");
}
