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
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};

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

/// Apre la pagina in una finestra di servizio, aspetta che sia disegnata e la fotografa.
/// Ogni passo che fallisce lo dice nell'errore (per l'autotest e per i log).
pub async fn take(app: &tauri::AppHandle, url: &str) -> Result<Vec<u8>, String> {
    let parsed: tauri::Url = url.parse().map_err(|e| format!("indirizzo non valido: {e}"))?;
    let label = format!("snapshot-{}", NEXT.fetch_add(1, Ordering::Relaxed));
    let (loaded_tx, mut loaded) = unbounded_channel::<()>();
    let win = WebviewWindowBuilder::new(app, &label, WebviewUrl::External(parsed))
        .title("Alexandria snapshot")
        .inner_size(WIDTH, HEIGHT)
        .position(-32000.0, -32000.0)
        .decorations(false)
        .focused(false)
        .skip_taskbar(true)
        .visible(true)
        .incognito(true)
        .on_page_load(move |_w, p| {
            if p.event() == PageLoadEvent::Finished {
                let _ = loaded_tx.send(());
            }
        })
        .build()
        .map_err(|e| format!("finestra di servizio: {e}"))?;

    let result = async {
        tokio::time::timeout(Duration::from_secs(20), loaded.recv())
            .await
            .map_err(|_| "la pagina non ha finito di caricarsi entro 20 s".to_string())?
            .ok_or("canale di caricamento chiuso")?;
        // immagini, font e script che arrivano dopo l'evento di caricamento
        tokio::time::sleep(Duration::from_millis(1500)).await;
        let (tx, mut rx) = unbounded_channel::<Result<Vec<u8>, String>>();
        win.with_webview(move |wv| capture(wv, tx)).map_err(|e| format!("webview non raggiungibile: {e}"))?;
        tokio::time::timeout(Duration::from_secs(10), rx.recv())
            .await
            .map_err(|_| "la foto non e' arrivata entro 10 s".to_string())?
            .ok_or("canale della foto chiuso")?
    }
    .await;

    if let Some(w) = app.get_webview_window(&label) {
        let _ = w.destroy();
    }
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
