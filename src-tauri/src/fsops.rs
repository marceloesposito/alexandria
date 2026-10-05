// Operazioni sul file system per vault, Library e stato dell'app.
use base64::Engine;
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;
use tauri::Manager;

pub type CmdResult<T> = Result<T, String>;

pub fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
    mtime: u64,
}

fn ensure_parent(path: &str) -> CmdResult<()> {
    if let Some(p) = Path::new(path).parent() {
        fs::create_dir_all(p).map_err(err)?;
    }
    Ok(())
}

/// Scrittura atomica: file temporaneo + rename, cosi' un crash non lascia file a meta'.
pub fn write_atomic(path: &str, data: &[u8]) -> CmdResult<()> {
    ensure_parent(path)?;
    let tmp = format!("{}.alexandria-tmp", path);
    fs::write(&tmp, data).map_err(err)?;
    fs::rename(&tmp, path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        err(e)
    })
}

#[tauri::command]
pub fn fs_read_text(path: String) -> CmdResult<String> {
    fs::read_to_string(&path).map_err(err)
}

#[tauri::command]
pub fn fs_write_text(path: String, text: String) -> CmdResult<()> {
    write_atomic(&path, text.as_bytes())
}

#[tauri::command]
pub fn fs_read_bytes(path: String) -> CmdResult<tauri::ipc::Response> {
    let data = fs::read(&path).map_err(err)?;
    Ok(tauri::ipc::Response::new(data))
}

#[tauri::command]
pub fn fs_write_bytes(path: String, data_b64: String) -> CmdResult<()> {
    let data = base64::engine::general_purpose::STANDARD.decode(data_b64).map_err(err)?;
    write_atomic(&path, &data)
}

#[tauri::command]
pub fn fs_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
pub fn fs_list(path: String) -> CmdResult<Vec<DirEntry>> {
    let mut out = Vec::new();
    for entry in fs::read_dir(&path).map_err(err)? {
        let entry = entry.map_err(err)?;
        let meta = entry.metadata().map_err(err)?;
        let mtime = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        let name = entry.file_name().to_string_lossy().to_string();
        out.push(DirEntry {
            path: format!("{}/{}", path.trim_end_matches(['/', '\\']), name),
            name,
            is_dir: meta.is_dir(),
            size: meta.len(),
            mtime,
        });
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

#[tauri::command]
pub fn fs_mkdir(path: String) -> CmdResult<()> {
    fs::create_dir_all(&path).map_err(err)
}

#[tauri::command]
pub fn fs_remove(path: String) -> CmdResult<()> {
    let p = Path::new(&path);
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(err)
    } else if p.exists() {
        fs::remove_file(p).map_err(err)
    } else {
        Ok(())
    }
}

#[tauri::command]
pub fn fs_rename(from: String, to: String) -> CmdResult<()> {
    ensure_parent(&to)?;
    fs::rename(&from, &to).map_err(err)
}

fn copy_rec(from: &Path, to: &Path) -> std::io::Result<()> {
    if from.is_dir() {
        fs::create_dir_all(to)?;
        for e in fs::read_dir(from)? {
            let e = e?;
            copy_rec(&e.path(), &to.join(e.file_name()))?;
        }
        Ok(())
    } else {
        fs::copy(from, to).map(|_| ())
    }
}

#[tauri::command]
pub fn fs_copy(from: String, to: String) -> CmdResult<()> {
    ensure_parent(&to)?;
    copy_rec(Path::new(&from), Path::new(&to)).map_err(err)
}

fn slash(p: std::path::PathBuf) -> String {
    p.to_string_lossy().replace('\\', "/")
}

#[tauri::command]
pub fn app_data_dir(app: tauri::AppHandle) -> CmdResult<String> {
    // prove automatiche: tutto in una cartella a parte, mai nei dati veri dell'utente
    let dir = match std::env::var("ALEXANDRIA_DATA_DIR") {
        Ok(d) => Path::new(&d).join("appdata"),
        // portable: lo stato dell'app viaggia sulla chiavetta
        Err(_) => match crate::portable::data_root() {
            Some(p) => p.join("appdata"),
            None => app.path().app_config_dir().map_err(err)?,
        },
    };
    fs::create_dir_all(&dir).map_err(err)?;
    Ok(slash(dir))
}

#[tauri::command]
pub fn documents_dir(app: tauri::AppHandle) -> CmdResult<String> {
    if let Ok(d) = std::env::var("ALEXANDRIA_DATA_DIR") {
        let p = Path::new(&d).join("documents");
        fs::create_dir_all(&p).map_err(err)?;
        return Ok(slash(p));
    }
    if let Some(p) = crate::portable::data_root() {
        return Ok(slash(p.to_path_buf()));
    }
    app.path()
        .document_dir()
        .or_else(|_| app.path().home_dir())
        .map(slash)
        .map_err(err)
}
