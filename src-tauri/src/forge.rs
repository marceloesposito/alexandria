// Account sul server git remoto: solo Codeberg (Forgejo, no-profit tedesco). Scelta del committente:
// dentro l'app nessun servizio americano (niente GitHub o GitLab). Accesso con un token personale,
// creazione della repository remota. Accesso con OAuth (il browser apre Codeberg, che rimanda
// l'autorizzazione a un server di un attimo su 127.0.0.1; PKCE, client pubblico) oppure con un token
// personale. Il token resta nel portachiavi del sistema e non torna mai all'interfaccia.
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
    /** Solo per l'accesso OAuth: il token scade (un'ora su Codeberg) e si rinnova con questo. */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    refresh: Option<String>,
    /** Scadenza del token OAuth, in secondi Unix. */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    expires: Option<i64>,
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

fn load(host: &str) -> CmdResult<Account> {
    let s = entry(host).ok_or("Portachiavi non disponibile")?.get_password().map_err(|_| "Nessun account collegato".to_string())?;
    serde_json::from_str(&s).map_err(err)
}

fn save(a: &Account) -> CmdResult<()> {
    entry(&a.host).ok_or("Portachiavi non disponibile")?.set_password(&serde_json::to_string(a).map_err(err)?).map_err(err)
}

/** Verifica il token, legge il nome utente e salva l'account nel portachiavi. */
async fn store(host: &str, token: &str) -> CmdResult<String> {
    store_with(host, token, None, None).await
}

async fn store_with(host: &str, token: &str, refresh: Option<String>, expires: Option<i64>) -> CmdResult<String> {
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
    save(&Account { kind: "gitea".into(), host: host.into(), login: login.clone(), token: token.into(), refresh, expires })?;
    Ok(login)
}

#[derive(Serialize)]
pub struct AccountInfo {
    kind: String,
    host: String,
    login: String,
    oauth: bool,
}

#[tauri::command]
pub fn forge_account(host: String) -> CmdResult<Option<AccountInfo>> {
    let Some(e) = entry(&host) else { return Ok(None) };
    let Ok(s) = e.get_password() else { return Ok(None) };
    let a: Account = serde_json::from_str(&s).map_err(err)?;
    Ok(Some(AccountInfo { oauth: a.refresh.is_some(), kind: a.kind, host: a.host, login: a.login }))
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
    let a = fresh(&host).await?;
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
    let a = fresh(&host).await?;
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

// ---------------------------------------------------------------- OAuth

/**
 * Identificativo dell'applicazione OAuth "Alexandria" registrata su Codeberg (client pubblico, senza
 * segreto, indirizzo di ritorno `http://127.0.0.1`: Forgejo accetta qualsiasi porta per le app
 * native). Si puo' sostituire in compilazione con ALEXANDRIA_CODEBERG_CLIENT_ID (vuoto = solo token).
 */
const OAUTH_CLIENT_ID: &str = match option_env!("ALEXANDRIA_CODEBERG_CLIENT_ID") {
    Some(id) => id,
    None => "abcb9caf-7281-4bd9-a305-53db97df77f7",
};
/** Tempo concesso per autorizzare nel browser. */
const OAUTH_WAIT: std::time::Duration = std::time::Duration::from_secs(300);
/** Ogni login (o annullamento) incrementa il contatore: quello in attesa si accorge di essere superato. */
static OAUTH_GEN: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

fn now() -> i64 {
    chrono::Utc::now().timestamp()
}

fn b64url(bytes: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

fn random_b64(n: usize) -> CmdResult<String> {
    let mut buf = vec![0u8; n];
    getrandom::fill(&mut buf).map_err(err)?;
    Ok(b64url(&buf))
}

/** code_challenge S256 di PKCE (RFC 7636). */
fn pkce_challenge(verifier: &str) -> String {
    use sha2::Digest;
    b64url(&sha2::Sha256::digest(verifier.as_bytes()))
}

fn enc(s: &str) -> String {
    let mut o = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => o.push(b as char),
            _ => o.push_str(&format!("%{b:02X}")),
        }
    }
    o
}

fn dec(s: &str) -> String {
    let b = s.as_bytes();
    let mut o = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        match b[i] {
            b'+' => o.push(b' '),
            b'%' if i + 2 < b.len() && b[i + 1].is_ascii_hexdigit() && b[i + 2].is_ascii_hexdigit() => {
                let hex = |c: u8| (c as char).to_digit(16).unwrap_or(0) as u8;
                o.push(hex(b[i + 1]) * 16 + hex(b[i + 2]));
                i += 2;
            }
            c => o.push(c),
        }
        i += 1;
    }
    String::from_utf8_lossy(&o).into_owned()
}

fn form(pairs: &[(&str, &str)]) -> String {
    pairs.iter().map(|(k, v)| format!("{}={}", enc(k), enc(v))).collect::<Vec<_>>().join("&")
}

fn authorize_url(host: &str, client_id: &str, redirect: &str, challenge: &str, state: &str) -> String {
    format!(
        "https://{host}/login/oauth/authorize?{}",
        form(&[
            ("client_id", client_id),
            ("redirect_uri", redirect),
            ("response_type", "code"),
            ("state", state),
            ("code_challenge", challenge),
            ("code_challenge_method", "S256"),
        ])
    )
}

/**
 * Riga di richiesta arrivata al server di ritorno ("GET /callback?code=..&state=.. HTTP/1.1").
 * None = non e' il ritorno (favicon...), Some(Ok(code)) = autorizzato, Some(Err) = rifiutato o falso.
 */
fn parse_callback(request_line: &str, state: &str) -> Option<Result<String, String>> {
    let target = request_line.split_whitespace().nth(1)?;
    let (path, query) = target.split_once('?').unwrap_or((target, ""));
    if path != "/callback" {
        return None;
    }
    let get = |k: &str| query.split('&').filter_map(|p| p.split_once('=')).find(|(a, _)| *a == k).map(|(_, v)| dec(v));
    if get("state").as_deref() != Some(state) {
        return Some(Err("Risposta di Codeberg non valida (stato diverso): riprova".into()));
    }
    if let Some(e) = get("error") {
        return Some(Err(if e == "access_denied" { "Accesso non autorizzato su Codeberg".into() } else { format!("Codeberg: {e}") }));
    }
    Some(get("code").filter(|c| !c.is_empty()).ok_or_else(|| "Risposta di Codeberg senza codice".to_string()))
}

const PAGE_OK: &str = "Alexandria e' collegata a Codeberg. Puoi chiudere questa scheda e tornare all'app.<br><span>Alexandria is connected to Codeberg. You can close this tab and return to the app.</span>";
const PAGE_ERR: &str = "Accesso non riuscito: torna ad Alexandria e riprova.<br><span>Sign-in failed: go back to Alexandria and try again.</span>";

fn respond(stream: &mut std::net::TcpStream, status: &str, body: &str) {
    use std::io::Write;
    let html = format!(
        "<!doctype html><meta charset=utf-8><title>Alexandria</title><style>body{{font:16px/1.5 system-ui,sans-serif;max-width:32em;margin:5em auto;padding:0 1em;color:#222}}span{{color:#777}}</style><p>{body}</p>"
    );
    let _ = write!(
        stream,
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{html}",
        html.len()
    );
    let _ = stream.flush();
}

/** Aspetta sul server di ritorno il codice di autorizzazione (o l'annullamento, o il tempo scaduto). */
fn wait_for_code(listener: std::net::TcpListener, state: &str, gen: u64) -> CmdResult<String> {
    use std::io::Read;
    use std::sync::atomic::Ordering;
    listener.set_nonblocking(true).map_err(err)?;
    let deadline = std::time::Instant::now() + OAUTH_WAIT;
    loop {
        if OAUTH_GEN.load(Ordering::SeqCst) != gen {
            return Err("Accesso annullato".into());
        }
        if std::time::Instant::now() > deadline {
            return Err("Tempo scaduto: l'accesso su Codeberg non e' stato completato".into());
        }
        match listener.accept() {
            Ok((mut stream, _)) => {
                let _ = stream.set_nonblocking(false);
                let _ = stream.set_read_timeout(Some(std::time::Duration::from_secs(5)));
                let mut buf = Vec::new();
                let mut chunk = [0u8; 1024];
                while buf.len() < 16 * 1024 && !buf.windows(4).any(|w| w == b"\r\n\r\n") {
                    match stream.read(&mut chunk) {
                        Ok(0) | Err(_) => break,
                        Ok(n) => buf.extend_from_slice(&chunk[..n]),
                    }
                }
                let req = String::from_utf8_lossy(&buf);
                match parse_callback(req.lines().next().unwrap_or(""), state) {
                    None => respond(&mut stream, "404 Not Found", ""),
                    Some(Ok(code)) => {
                        respond(&mut stream, "200 OK", PAGE_OK);
                        return Ok(code);
                    }
                    Some(Err(e)) => {
                        respond(&mut stream, "400 Bad Request", PAGE_ERR);
                        return Err(e);
                    }
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => std::thread::sleep(std::time::Duration::from_millis(100)),
            Err(e) => return Err(err(e)),
        }
    }
}

/** POST all'endpoint dei token: (access_token, refresh_token, scadenza in secondi Unix). */
async fn token_request(host: &str, pairs: &[(&str, &str)]) -> CmdResult<(String, Option<String>, Option<i64>)> {
    let req = client()?
        .post(format!("https://{host}/login/oauth/access_token"))
        .header("Accept", "application/json")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(form(pairs));
    let (status, v) = send_json(req).await?;
    let tok = v.get("access_token").and_then(|x| x.as_str());
    match tok {
        Some(t) if status < 300 => Ok((
            t.to_string(),
            v.get("refresh_token").and_then(|x| x.as_str()).map(|s| s.to_string()),
            v.get("expires_in").and_then(|x| x.as_i64()).map(|s| now() + s),
        )),
        _ => Err(api_error(status, &v)),
    }
}

/** L'accesso OAuth e' disponibile solo se l'app e' stata compilata con l'identificativo del client. */
#[tauri::command]
pub fn forge_oauth_available() -> bool {
    !OAUTH_CLIENT_ID.is_empty()
}

/** Accedi con Codeberg: apre il browser, aspetta l'autorizzazione, salva l'account. Restituisce il nome utente. */
#[tauri::command]
pub async fn forge_oauth_login(app: tauri::AppHandle, host: String) -> CmdResult<String> {
    use std::sync::atomic::Ordering;
    use tauri_plugin_opener::OpenerExt;
    only_codeberg(&host)?;
    if OAUTH_CLIENT_ID.is_empty() {
        return Err("Accesso con Codeberg non disponibile in questa versione: usa un token personale".into());
    }
    let gen = OAUTH_GEN.fetch_add(1, Ordering::SeqCst) + 1;
    let listener = std::net::TcpListener::bind("127.0.0.1:0").map_err(err)?;
    let redirect = format!("http://127.0.0.1:{}/callback", listener.local_addr().map_err(err)?.port());
    let verifier = random_b64(32)?;
    let state = random_b64(16)?;
    let url = authorize_url(&host, OAUTH_CLIENT_ID, &redirect, &pkce_challenge(&verifier), &state);
    app.opener().open_url(url, None::<&str>).map_err(err)?;
    let code = tauri::async_runtime::spawn_blocking(move || wait_for_code(listener, &state, gen)).await.map_err(err)??;
    let (token, refresh, expires) = token_request(
        &host,
        &[
            ("grant_type", "authorization_code"),
            ("client_id", OAUTH_CLIENT_ID),
            ("code", &code),
            ("redirect_uri", &redirect),
            ("code_verifier", &verifier),
        ],
    )
    .await?;
    // senza refresh_token l'account resta valido finche' il token non scade: lo si segna come OAuth
    let login = store_with(&host, &token, Some(refresh.unwrap_or_default()), expires).await?;
    {
        use tauri::Manager;
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.unminimize();
            let _ = w.set_focus();
        }
    }
    Ok(login)
}

/** Annulla il login in attesa (chiusura del dialogo, pulsante Annulla). */
#[tauri::command]
pub fn forge_oauth_cancel() {
    OAUTH_GEN.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
}

/** Account con il token ancora valido: se l'accesso OAuth sta per scadere lo rinnova (e lo salva). */
async fn fresh(host: &str) -> CmdResult<Account> {
    let mut a = load(host)?;
    let (Some(refresh), Some(exp)) = (a.refresh.clone(), a.expires) else { return Ok(a) };
    if exp > now() + 60 {
        return Ok(a);
    }
    if refresh.is_empty() {
        return Err("Accesso a Codeberg scaduto: ricollega l'account".into());
    }
    let (token, new_refresh, expires) = token_request(
        host,
        &[("grant_type", "refresh_token"), ("client_id", OAUTH_CLIENT_ID), ("refresh_token", &refresh)],
    )
    .await
    .map_err(|e| format!("Accesso a Codeberg scaduto, ricollega l'account ({e})"))?;
    a.token = token;
    a.refresh = Some(new_refresh.unwrap_or(refresh));
    a.expires = expires;
    save(&a)?;
    Ok(a)
}

/** Prima di push, pull e clone su Codeberg: rinnova il token OAuth se serve (gli errori li dira' git). */
pub async fn refresh_for_url(url: &str) {
    if url.starts_with(&format!("https://{FORGE_HOST}/")) {
        let _ = fresh(FORGE_HOST).await;
    }
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

    #[test]
    fn pkce_rfc7636() {
        // esempio dell'appendice B della RFC 7636
        assert_eq!(pkce_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
        let v = random_b64(32).unwrap();
        assert_eq!(v.len(), 43);
        assert_ne!(v, random_b64(32).unwrap());
    }

    #[test]
    fn indirizzo_di_autorizzazione() {
        let u = authorize_url("codeberg.org", "abc", "http://127.0.0.1:5000/callback", "ch", "st");
        assert!(u.starts_with("https://codeberg.org/login/oauth/authorize?client_id=abc&"));
        assert!(u.contains("redirect_uri=http%3A%2F%2F127.0.0.1%3A5000%2Fcallback"));
        assert!(u.contains("code_challenge=ch&code_challenge_method=S256"));
        assert!(u.contains("state=st"));
    }

    #[test]
    fn ritorno_dal_browser() {
        assert_eq!(parse_callback("GET /callback?code=a%2Bb&state=xy HTTP/1.1", "xy"), Some(Ok("a+b".into())));
        assert_eq!(parse_callback("GET /favicon.ico HTTP/1.1", "xy"), None);
        assert!(matches!(parse_callback("GET /callback?code=a&state=zz HTTP/1.1", "xy"), Some(Err(_))));
        assert!(matches!(parse_callback("GET /callback?error=access_denied&state=xy HTTP/1.1", "xy"), Some(Err(_))));
        assert!(matches!(parse_callback("GET /callback?state=xy HTTP/1.1", "xy"), Some(Err(_))));
        assert_eq!(dec("100%25+ok%"), "100% ok%");
        assert_eq!(dec("%è%C3%A8"), "%èè");
    }

    #[test]
    fn server_di_ritorno() {
        use std::io::{Read, Write};
        let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = l.local_addr().unwrap().port();
        let gen = OAUTH_GEN.load(std::sync::atomic::Ordering::SeqCst);
        let h = std::thread::spawn(move || wait_for_code(l, "st", gen));
        let get = |path: &str| {
            let mut s = std::net::TcpStream::connect(("127.0.0.1", port)).unwrap();
            write!(s, "GET {path} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").unwrap();
            let mut out = String::new();
            let _ = s.read_to_string(&mut out);
            out
        };
        assert!(get("/favicon.ico").starts_with("HTTP/1.1 404"));
        assert!(get("/callback?code=xyz&state=st").starts_with("HTTP/1.1 200"));
        assert_eq!(h.join().unwrap(), Ok("xyz".into()));
    }

    #[test]
    fn account_vecchi_senza_oauth() {
        let a: Account = serde_json::from_str(r#"{"kind":"gitea","host":"codeberg.org","login":"m","token":"t"}"#).unwrap();
        assert!(a.refresh.is_none() && a.expires.is_none());
        assert!(!serde_json::to_string(&a).unwrap().contains("refresh"));
    }
}
