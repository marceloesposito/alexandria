// Rete: usata solo su azione esplicita dell'utente (import di un link, metadati DOI,
// archiviazione di una pagina). Nessun cookie, nessun referrer.
use crate::fsops::{err, CmdResult};
use base64::Engine;
use serde::Serialize;

const MAX_BYTES: usize = 60 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchResult {
    status: u16,
    url: String,
    content_type: String,
    body_b64: String,
}

#[tauri::command]
pub async fn net_fetch(url: String, accept: Option<String>) -> CmdResult<FetchResult> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("Sono ammessi solo indirizzi http(s)".into());
    }
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Alexandria; offline writing app; archive on user request)")
        .redirect(reqwest::redirect::Policy::limited(8))
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(err)?;
    let mut req = client.get(&url);
    // negoziazione del contenuto (per esempio CSL-JSON da doi.org)
    if let Some(a) = accept {
        req = req.header(reqwest::header::ACCEPT, a);
    }
    let res = req.send().await.map_err(err)?;
    let status = res.status().as_u16();
    let final_url = res.url().to_string();
    let content_type = res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let bytes = res.bytes().await.map_err(err)?;
    if bytes.len() > MAX_BYTES {
        return Err("File troppo grande (oltre 60 MB)".into());
    }
    Ok(FetchResult {
        status,
        url: final_url,
        content_type,
        body_b64: base64::engine::general_purpose::STANDARD.encode(&bytes),
    })
}
