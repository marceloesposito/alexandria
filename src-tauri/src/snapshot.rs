// Anteprima di un link: la pagina si apre in una webview fuori schermo, senza focus, senza
// cookie persistenti e senza accesso ai comandi dell'app (le capability valgono solo per "main").
// A pagina caricata se ne scatta una foto (WKWebView su macOS, WebView2 su Windows) e la si chiude.
// Usata solo su azione esplicita dell'utente (import di un link).
use crate::fsops::CmdResult;
use base64::Engine;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::Duration;
use tauri::webview::PageLoadEvent;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};

static NEXT: AtomicU32 = AtomicU32::new(1);
const WIDTH: f64 = 1280.0;
const HEIGHT: f64 = 800.0;

/// Restituisce la foto della pagina in PNG (base64), oppure None se non e' stato possibile scattarla.
#[tauri::command]
pub async fn net_snapshot(app: tauri::AppHandle, url: String) -> CmdResult<Option<String>> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("Sono ammessi solo indirizzi http(s)".into());
    }
    match take(&app, &url).await {
        Ok(png) => Ok(Some(base64::engine::general_purpose::STANDARD.encode(png))),
        Err(e) => {
            eprintln!("snapshot {url}: {e}");
            Ok(None)
        }
    }
}

/// Come si apre la finestra di servizio.
#[derive(Clone, Copy, PartialEq)]
enum Mode {
    /// foto del link: fuori schermo, senza cookie
    Snapshot,
    /// lettura automatica: fuori schermo; tiene i cookie del controllo anti-bot gia' superato
    Offscreen,
    /// lettura con l'utente: finestra normale al centro, per superare a mano un controllo "sei umano?"
    Visible,
}

/// Finestra di servizio sulla pagina; il canale segnala ogni caricamento completato.
fn open_window(app: &tauri::AppHandle, url: &str, mode: Mode) -> Result<(String, tauri::WebviewWindow, UnboundedReceiver<()>), String> {
    let parsed: tauri::Url = url.parse().map_err(|e| format!("indirizzo non valido: {e}"))?;
    let label = format!("snapshot-{}", NEXT.fetch_add(1, Ordering::Relaxed));
    let (loaded_tx, loaded) = unbounded_channel::<()>();
    let mut b = WebviewWindowBuilder::new(app, &label, WebviewUrl::External(parsed))
        .inner_size(WIDTH, HEIGHT)
        .visible(true)
        .incognito(mode == Mode::Snapshot)
        .on_page_load(move |_w, p| {
            if p.event() == PageLoadEvent::Finished {
                let _ = loaded_tx.send(());
            }
        });
    b = if mode == Mode::Visible {
        b.title("Alexandria").inner_size(1000.0, 760.0).center().focused(true)
    } else {
        b.title("Alexandria snapshot").position(-32000.0, -32000.0).decorations(false).focused(false).skip_taskbar(true)
    };
    let win = b.build().map_err(|e| format!("finestra di servizio: {e}"))?;
    Ok((label, win, loaded))
}

fn close_window(app: &tauri::AppHandle, label: &str) {
    if let Some(w) = app.get_webview_window(label) {
        let _ = w.destroy();
    }
}

async fn wait_loaded(loaded: &mut UnboundedReceiver<()>) -> Result<(), String> {
    tokio::time::timeout(Duration::from_secs(20), loaded.recv())
        .await
        .map_err(|_| "la pagina non ha finito di caricarsi entro 20 s".to_string())?
        .ok_or_else(|| "canale di caricamento chiuso".to_string())
}

async fn photo(win: &tauri::WebviewWindow) -> Result<Vec<u8>, String> {
    let (tx, mut rx) = unbounded_channel::<Result<Vec<u8>, String>>();
    win.with_webview(move |wv| capture(wv, tx)).map_err(|e| format!("webview non raggiungibile: {e}"))?;
    tokio::time::timeout(Duration::from_secs(10), rx.recv())
        .await
        .map_err(|_| "la foto non e' arrivata entro 10 s".to_string())?
        .ok_or("canale della foto chiuso")?
}

/// Valuta uno script nella pagina e ne restituisce il risultato serializzato in JSON.
async fn eval_json(win: &tauri::WebviewWindow, js: &str) -> Result<String, String> {
    let (tx, mut rx) = unbounded_channel::<String>();
    win.eval_with_callback(js, move |out| {
        let _ = tx.send(out);
    })
    .map_err(|e| format!("script nella pagina: {e}"))?;
    tokio::time::timeout(Duration::from_secs(10), rx.recv())
        .await
        .map_err(|_| "lo script non ha risposto entro 10 s".to_string())?
        .ok_or_else(|| "canale dello script chiuso".to_string())
}

/// Apre la pagina in una finestra di servizio, aspetta che sia disegnata e la fotografa.
/// Ogni passo che fallisce lo dice nell'errore (per l'autotest e per i log).
pub async fn take(app: &tauri::AppHandle, url: &str) -> Result<Vec<u8>, String> {
    let (label, win, mut loaded) = open_window(app, url, Mode::Snapshot)?;
    let result = async {
        wait_loaded(&mut loaded).await?;
        // immagini, font e script che arrivano dopo l'evento di caricamento
        tokio::time::sleep(Duration::from_millis(1500)).await;
        photo(&win).await
    }
    .await;
    close_window(app, &label);
    result
}

/// Pagina letta dal motore web: indirizzo finale, HTML dopo gli script, foto (facoltativa).
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Rendered {
    pub url: String,
    pub html: String,
    pub png_b64: Option<String>,
}

/// Controllo "sei un browser?" (Cloudflare e simili): si riconosce da titolo e moduli tipici.
const CHALLENGE_JS: &str = r#"(() => {
  const t = (document.title || '').toLowerCase();
  const title = /just a moment|un momento|attention required|checking your browser|verify you are human|einen moment|un instant/.test(t);
  const form = !!document.querySelector('#challenge-form, #challenge-running, #challenge-stage, #cf-challenge-running, .cf-turnstile, [name="cf-turnstile-response"]');
  return title || form;
})()"#;

const PAGE_JS: &str = r#"(() => JSON.stringify({ url: location.href, html: document.documentElement.outerHTML }))()"#;

/// Per i siti che rifiutano lo scaricamento diretto (403/429/503, controlli anti-bot): la pagina si
/// apre nel motore web dell'app, che esegue gli script del controllo; quando la pagina vera e' pronta
/// se ne prendono HTML e foto. None se il controllo non si supera da solo (serve un clic umano).
/// Con `interactive` la finestra e' visibile: l'utente supera il controllo e la finestra si chiude
/// da sola appena la pagina vera e' letta (o quando l'utente la chiude).
#[tauri::command]
pub async fn net_render(app: tauri::AppHandle, url: String, interactive: Option<bool>) -> CmdResult<Option<Rendered>> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("Sono ammessi solo indirizzi http(s)".into());
    }
    match render(&app, &url, interactive.unwrap_or(false)).await {
        Ok(r) => Ok(Some(r)),
        Err(e) => {
            eprintln!("render {url}: {e}");
            Ok(None)
        }
    }
}

pub async fn render(app: &tauri::AppHandle, url: &str, interactive: bool) -> Result<Rendered, String> {
    let mode = if interactive { Mode::Visible } else { Mode::Offscreen };
    let (label, win, mut loaded) = open_window(app, url, mode)?;
    let result = async {
        // a mano il caricamento puo' durare di piu' (controllo, poi la pagina vera)
        if interactive {
            let _ = tokio::time::timeout(Duration::from_secs(60), loaded.recv()).await;
        } else {
            wait_loaded(&mut loaded).await?;
        }
        // il controllo anti-bot ricarica la pagina quando e' superato: 25 s da solo, 3 minuti con l'utente
        let wait = if interactive { 180 } else { 25 };
        let deadline = tokio::time::Instant::now() + Duration::from_secs(wait);
        loop {
            tokio::time::sleep(Duration::from_millis(800)).await;
            if app.get_webview_window(&label).is_none() {
                return Err("finestra chiusa dall'utente".to_string());
            }
            let challenge = eval_json(&win, CHALLENGE_JS).await.map(|v| v.trim() == "true").unwrap_or(true);
            if !challenge {
                break;
            }
            if tokio::time::Instant::now() > deadline {
                return Err("controllo anti-bot non superato".to_string());
            }
            // un nuovo caricamento (la pagina vera) sveglia subito il ciclo
            let _ = tokio::time::timeout(Duration::from_millis(1200), loaded.recv()).await;
        }
        tokio::time::sleep(Duration::from_millis(1500)).await;
        let raw = eval_json(&win, PAGE_JS).await?;
        // eval_with_callback serializza il risultato: qui e' una stringa JSON che contiene un JSON
        let inner: String = serde_json::from_str(&raw).map_err(|e| format!("risposta della pagina: {e}"))?;
        #[derive(serde::Deserialize)]
        struct Page {
            url: String,
            html: String,
        }
        let page: Page = serde_json::from_str(&inner).map_err(|e| format!("risposta della pagina: {e}"))?;
        let png_b64 = photo(&win).await.ok().map(|png| base64::engine::general_purpose::STANDARD.encode(png));
        Ok(Rendered { url: page.url, html: page.html, png_b64 })
    }
    .await;
    close_window(app, &label);
    result
}

#[cfg(target_os = "macos")]
fn capture(wv: tauri::webview::PlatformWebview, tx: UnboundedSender<Result<Vec<u8>, String>>) {
    use block2::RcBlock;
    use objc2::MainThreadMarker;
    use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSImage};
    use objc2_foundation::{NSDictionary, NSError};
    use objc2_web_kit::{WKSnapshotConfiguration, WKWebView};

    let Some(mtm) = MainThreadMarker::new() else {
        let _ = tx.send(Err("non sul thread principale".into()));
        return;
    };
    // SAFETY: su macOS inner() e' il WKWebView della finestra, vivo finche' la finestra esiste
    let webview: &WKWebView = unsafe { &*(wv.inner() as *const WKWebView) };
    let config = unsafe { WKSnapshotConfiguration::new(mtm) };
    let block = RcBlock::new(move |image: *mut NSImage, e: *mut NSError| {
        if image.is_null() {
            let why = unsafe { e.as_ref() }.map(|e| e.localizedDescription().to_string()).unwrap_or_else(|| "immagine vuota".into());
            let _ = tx.send(Err(format!("WKWebView: {why}")));
            return;
        }
        let png = (|| {
            // SAFETY: l'immagine, se presente, e' valida per la durata del blocco
            let image = unsafe { image.as_ref() }?;
            let tiff = image.TIFFRepresentation()?;
            let rep = NSBitmapImageRep::imageRepWithData(&tiff)?;
            let data = unsafe { rep.representationUsingType_properties(NSBitmapImageFileType::PNG, &NSDictionary::new()) }?;
            Some(data.to_vec())
        })();
        let _ = tx.send(png.ok_or_else(|| "conversione in PNG non riuscita".to_string()));
    });
    unsafe { webview.takeSnapshotWithConfiguration_completionHandler(Some(&config), &block) };
}

#[cfg(windows)]
fn capture(wv: tauri::webview::PlatformWebview, tx: UnboundedSender<Result<Vec<u8>, String>>) {
    use webview2_com::CapturePreviewCompletedHandler;
    use webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG;
    use windows::Win32::UI::Shell::SHCreateMemStream;

    let run = || -> Option<()> {
        let core = unsafe { wv.controller().CoreWebView2() }.ok()?;
        let stream = unsafe { SHCreateMemStream(None) }?;
        let reader = stream.clone();
        let done = tx.clone();
        let handler = CapturePreviewCompletedHandler::create(Box::new(move |res| {
            let _ = done.send(res.map_err(|e| format!("WebView2: {e}")).and_then(|_| read_stream(&reader).ok_or_else(|| "lettura dello stream non riuscita".to_string())));
            Ok(())
        }));
        unsafe { core.CapturePreview(COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG, &stream, &handler) }.ok()
    };
    if run().is_none() {
        let _ = tx.send(Err("WebView2: CapturePreview non avviato".into()));
    }
}

#[cfg(windows)]
fn read_stream(s: &windows::Win32::System::Com::IStream) -> Option<Vec<u8>> {
    use windows::Win32::System::Com::{STATFLAG_NONAME, STATSTG, STREAM_SEEK_SET};
    unsafe {
        let mut stat = STATSTG::default();
        s.Stat(&mut stat, STATFLAG_NONAME).ok()?;
        s.Seek(0, STREAM_SEEK_SET, None).ok()?;
        let mut buf = vec![0u8; stat.cbSize as usize];
        let mut read = 0u32;
        s.Read(buf.as_mut_ptr().cast(), buf.len() as u32, Some(&mut read)).ok().ok()?;
        buf.truncate(read as usize);
        Some(buf)
    }
}

#[cfg(not(any(target_os = "macos", windows)))]
fn capture(_wv: tauri::webview::PlatformWebview, tx: UnboundedSender<Result<Vec<u8>, String>>) {
    let _ = tx.send(Err("non disponibile su questo sistema".into()));
}
