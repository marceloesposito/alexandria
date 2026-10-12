// Account sul server git remoto: solo Codeberg (Forgejo, no-profit tedesco). Scelta del committente:
// dentro l'app nessun servizio americano (niente GitHub o GitLab). Accesso con un token personale,
// creazione della repository remota. Il token resta nel portachiavi del sistema e non torna mai
// all'interfaccia.
use crate::fsops::{err, CmdResult};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const KEYRING_SERVICE: &str = "app.alexandria.desktop.git";
/** L'unico server git ammesso. */
pub const FORGE_HOST: &str = "codeberg.org";

fn only_codeberg(host: &str) -> CmdResult<()> {
    if host == FORGE_HOST {
        Ok(())
    } else {
        Err(format!("Alexandria usa solo Codeberg ({FORGE_HOST}) come server git"))
    }
}
const UA: &str = "Alexandria (offline writing app)";

#[derive(Serialize, Deserialize, Clone)]
pub struct Account {
    pub kind: String, // sempre "gitea" (Forgejo)
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
    if host != FORGE_HOST {
        return None;
    }
    let a: Account = serde_json::from_str(&entry(host)?.get_password().ok()?).ok()?;
    Some((a.login.clone(), a.token))
}

fn client() -> CmdResult<reqwest::Client> {
    reqwest::Client::builder()
        .user_agent(UA)
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(err)
}

fn api_base(host: &str) -> String {
    format!("https://{host}/api/v1")
}

fn auth(token: &str) -> (String, String) {
    ("Authorization".into(), format!("token {token}"))
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

/** Verifica il token, legge il nome utente e salva l'account nel portachiavi. */
async fn store(host: &str, token: &str) -> CmdResult<String> {
    only_codeberg(host)?;
    let url = format!("{}/user", api_base(host));
    let (h, v) = auth(token);
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
    let a = Account { kind: "gitea".into(), host: host.into(), login: login.clone(), token: token.into() };
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
pub async fn forge_set_token(host: String, token: String) -> CmdResult<String> {
    store(&host, token.trim()).await
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
    only_codeberg(&host)?;
    let s = entry(&host).ok_or("Portachiavi non disponibile")?.get_password().map_err(|_| "Nessun account collegato".to_string())?;
    let a: Account = serde_json::from_str(&s).map_err(err)?;
    let url = format!("{}/user/repos?limit=100", api_base(&a.host));
    let (h, v) = auth(&a.token);
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
                    full_name: s(r, "full_name"),
                    clone_url: s(r, "clone_url"),
                    private: r.get("private").and_then(|x| x.as_bool()).unwrap_or(false),
                    updated: s(r, "updated_at"),
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
    only_codeberg(&host)?;
    let s = entry(&host).ok_or("Portachiavi non disponibile")?.get_password().map_err(|_| "Nessun account collegato".to_string())?;
    let a: Account = serde_json::from_str(&s).map_err(err)?;
    let desc = description.unwrap_or_default();
    let url = format!("{}/user/repos", api_base(&a.host));
    let body = json!({ "name": name, "private": private, "description": desc, "auto_init": false });
    let (h, v) = auth(&a.token);
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
        .and_then(|x| x.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Risposta del server senza indirizzo della repository".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn solo_codeberg() {
        assert_eq!(api_base("codeberg.org"), "https://codeberg.org/api/v1");
        assert!(only_codeberg("codeberg.org").is_ok());
        assert!(only_codeberg("github.com").is_err());
        assert!(only_codeberg("gitlab.com").is_err());
        assert_eq!(account_for_url("https://github.com/x/y.git"), None);
    }
}
