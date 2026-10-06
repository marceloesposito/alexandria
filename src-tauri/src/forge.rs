// Account sui server git (GitHub, GitLab, Gitea/Forgejo): accesso con il Device Flow di GitHub o
// con un token personale, creazione della repository remota. Il token resta nel portachiavi del
// sistema e non torna mai all'interfaccia.
use crate::fsops::{err, CmdResult};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const KEYRING_SERVICE: &str = "app.alexandria.desktop.git";
const UA: &str = "Alexandria (offline writing app)";

#[derive(Serialize, Deserialize, Clone)]
pub struct Account {
    pub kind: String, // github | gitlab | gitea
    pub host: String,
    pub login: String,
    token: String,
}

fn entry(host: &str) -> Option<keyring::Entry> {
    keyring::Entry::new(KEYRING_SERVICE, &format!("account:{host}")).ok()
}

/** Account salvato per l'host di un indirizzo https (usato da push e pull). */
pub fn account_for_url(url: &str) -> Option<(String, String)> {
    let host = url.strip_prefix("https://")?.split(['/', '@']).find(|s| s.contains('.'))?;
    let a: Account = serde_json::from_str(&entry(host)?.get_password().ok()?).ok()?;
    let user = match a.kind.as_str() {
        "github" => "x-access-token".to_string(),
        "gitlab" => "oauth2".to_string(),
        _ => a.login.clone(),
    };
    Some((user, a.token))
}

fn client() -> CmdResult<reqwest::Client> {
    reqwest::Client::builder()
        .user_agent(UA)
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(err)
}

fn api_base(kind: &str, host: &str) -> String {
    match kind {
        "github" if host == "github.com" => "https://api.github.com".into(),
        "github" => format!("https://{host}/api/v3"),
        "gitlab" => format!("https://{host}/api/v4"),
        _ => format!("https://{host}/api/v1"),
    }
}

fn auth(kind: &str, token: &str) -> (String, String) {
    match kind {
        "gitlab" => ("Authorization".into(), format!("Bearer {token}")),
        "gitea" => ("Authorization".into(), format!("token {token}")),
        _ => ("Authorization".into(), format!("Bearer {token}")),
    }
}

async fn send_json(req: reqwest::RequestBuilder) -> CmdResult<(u16, Value)> {
    let res = req.send().await.map_err(err)?;
    let status = res.status().as_u16();
    let bytes = res.bytes().await.map_err(err)?;
    let v: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    Ok((status, v))
}

fn api_error(status: u16, v: &Value) -> String {
    let msg = v.get("message").or_else(|| v.get("error_description")).or_else(|| v.get("error"));
    match msg {
        Some(m) => format!("{} ({status})", m.as_str().map(|s| s.to_string()).unwrap_or_else(|| m.to_string())),
        None => format!("Errore del server ({status})"),
    }
}

fn form(pairs: &[(&str, &str)]) -> String {
    pairs
        .iter()
        .map(|(k, v)| {
            let enc: String = v
                .bytes()
                .map(|b| match b {
                    b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
                    _ => format!("%{b:02X}"),
                })
                .collect();
            format!("{k}={enc}")
        })
        .collect::<Vec<_>>()
        .join("&")
}

/** Verifica il token, legge il nome utente e salva l'account nel portachiavi. */
async fn store(kind: &str, host: &str, token: &str) -> CmdResult<String> {
    let url = format!("{}/user", api_base(kind, host));
    let (h, v) = auth(kind, token);
    let (status, body) = send_json(client()?.get(url).header(h, v).header("Accept", "application/json")).await?;
    if status >= 300 {
        return Err(format!("Token non valido: {}", api_error(status, &body)));
    }
    let login = body
        .get("login")
        .or_else(|| body.get("username"))
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let a = Account { kind: kind.into(), host: host.into(), login: login.clone(), token: token.into() };
    entry(host).ok_or("Portachiavi non disponibile")?.set_password(&serde_json::to_string(&a).map_err(err)?).map_err(err)?;
    Ok(login)
}

#[derive(Serialize)]
pub struct AccountInfo {
    kind: String,
    host: String,
    login: String,
}

#[tauri::command]
pub fn forge_account(host: String) -> CmdResult<Option<AccountInfo>> {
    let Some(e) = entry(&host) else { return Ok(None) };
    let Ok(s) = e.get_password() else { return Ok(None) };
    let a: Account = serde_json::from_str(&s).map_err(err)?;
    Ok(Some(AccountInfo { kind: a.kind, host: a.host, login: a.login }))
}

#[tauri::command]
pub fn forge_logout(host: String) -> CmdResult<()> {
    if let Some(e) = entry(&host) {
        let _ = e.delete_credential();
    }
    Ok(())
}

#[tauri::command]
pub async fn forge_set_token(kind: String, host: String, token: String) -> CmdResult<String> {
    store(&kind, &host, token.trim()).await
}

#[derive(Serialize)]
pub struct DeviceCode {
    device_code: String,
    user_code: String,
    verification_uri: String,
    interval: u64,
    expires_in: u64,
}

#[tauri::command]
pub async fn forge_device_start(client_id: String) -> CmdResult<DeviceCode> {
    let req = client()?
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(form(&[("client_id", &client_id), ("scope", "repo")]));
    let (status, v) = send_json(req).await?;
    if status >= 300 || v.get("device_code").is_none() {
        return Err(api_error(status, &v));
    }
    let s = |k: &str| v.get(k).and_then(|x| x.as_str()).unwrap_or("").to_string();
    let n = |k: &str, d: u64| v.get(k).and_then(|x| x.as_u64()).unwrap_or(d);
    Ok(DeviceCode {
        device_code: s("device_code"),
        user_code: s("user_code"),
        verification_uri: s("verification_uri"),
        interval: n("interval", 5),
        expires_in: n("expires_in", 900),
    })
}

/** Un giro di attesa del Device Flow: "pending", "slow_down" oppure il nome utente a login fatto. */
#[tauri::command]
pub async fn forge_device_poll(client_id: String, device_code: String) -> CmdResult<String> {
    let req = client()?
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(form(&[
            ("client_id", &client_id),
            ("device_code", &device_code),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ]));
    let (status, v) = send_json(req).await?;
    if let Some(tok) = v.get("access_token").and_then(|x| x.as_str()) {
        let login = store("github", "github.com", tok).await?;
        return Ok(format!("ok:{login}"));
    }
    match v.get("error").and_then(|x| x.as_str()) {
        Some("authorization_pending") => Ok("pending".into()),
        Some("slow_down") => Ok("slow_down".into()),
        _ => Err(api_error(status, &v)),
    }
}

#[derive(Serialize)]
pub struct RepoInfo {
    name: String,
    full_name: String,
    clone_url: String,
    private: bool,
    updated: String,
    description: String,
}

/** Repository dell'account collegato per l'host, dalle piu' recenti. */
#[tauri::command]
pub async fn forge_list_repos(host: String) -> CmdResult<Vec<RepoInfo>> {
    let s = entry(&host).ok_or("Portachiavi non disponibile")?.get_password().map_err(|_| "Nessun account collegato".to_string())?;
    let a: Account = serde_json::from_str(&s).map_err(err)?;
    let base = api_base(&a.kind, &a.host);
    let url = match a.kind.as_str() {
        "gitlab" => format!("{base}/projects?membership=true&order_by=last_activity_at&per_page=100"),
        "gitea" => format!("{base}/user/repos?limit=100"),
        _ => format!("{base}/user/repos?per_page=100&sort=updated"),
    };
    let (h, v) = auth(&a.kind, &a.token);
    let (status, body) = send_json(client()?.get(url).header(h, v).header("Accept", "application/json")).await?;
    if status >= 300 {
        return Err(api_error(status, &body));
    }
    let s = |x: &Value, k: &str| x.get(k).and_then(|y| y.as_str()).unwrap_or("").to_string();
    Ok(body
        .as_array()
        .map(|list| {
            list.iter()
                .map(|r| RepoInfo {
                    name: s(r, "name"),
                    full_name: { let f = s(r, "full_name"); if f.is_empty() { s(r, "path_with_namespace") } else { f } },
                    clone_url: { let c = s(r, "clone_url"); if c.is_empty() { s(r, "http_url_to_repo") } else { c } },
                    private: r.get("private").and_then(|x| x.as_bool()).unwrap_or_else(|| s(r, "visibility") == "private"),
                    updated: { let u = s(r, "updated_at"); if u.is_empty() { s(r, "last_activity_at") } else { u } },
                    description: s(r, "description"),
                })
                .filter(|r| !r.clone_url.is_empty())
                .collect()
        })
        .unwrap_or_default())
}

/** Crea una repository vuota sull'account e ne restituisce l'indirizzo https per git. */
#[tauri::command]
pub async fn forge_create_repo(host: String, name: String, private: bool, description: Option<String>) -> CmdResult<String> {
    let s = entry(&host).ok_or("Portachiavi non disponibile")?.get_password().map_err(|_| "Nessun account collegato".to_string())?;
    let a: Account = serde_json::from_str(&s).map_err(err)?;
    let base = api_base(&a.kind, &a.host);
    let desc = description.unwrap_or_default();
    let (url, body) = match a.kind.as_str() {
        "gitlab" => (
            format!("{base}/projects"),
            json!({ "name": name, "visibility": if private { "private" } else { "public" }, "description": desc }),
        ),
        _ => (format!("{base}/user/repos"), json!({ "name": name, "private": private, "description": desc, "auto_init": false })),
    };
    let (h, v) = auth(&a.kind, &a.token);
    let req = client()?
        .post(url)
        .header(h, v)
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .body(body.to_string());
    let (status, v) = send_json(req).await?;
    if status >= 300 {
        return Err(api_error(status, &v));
    }
    v.get("clone_url")
        .or_else(|| v.get("http_url_to_repo"))
        .and_then(|x| x.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Risposta del server senza indirizzo della repository".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn form_codifica_i_caratteri_riservati() {
        assert_eq!(form(&[("a", "x y:z"), ("b", "ok-1")]), "a=x%20y%3Az&b=ok-1");
    }
    #[test]
    fn indirizzi_delle_api() {
        assert_eq!(api_base("github", "github.com"), "https://api.github.com");
        assert_eq!(api_base("gitlab", "gitlab.com"), "https://gitlab.com/api/v4");
        assert_eq!(api_base("gitea", "codeberg.org"), "https://codeberg.org/api/v1");
    }
}
