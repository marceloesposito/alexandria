// Lettura degli appunti di sistema per "incolla nella Bookshelf" quando la webview non genera
// l'evento paste (WKWebView fuori dai campi di testo): file copiati dal Finder, immagini, testo.
use base64::Engine;
use serde::Serialize;

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardData {
    text: Option<String>,
    files: Vec<String>,
    image_png_b64: Option<String>,
}

#[tauri::command]
pub fn clipboard_read() -> ClipboardData {
    read()
}

#[cfg(target_os = "macos")]
fn read() -> ClipboardData {
    use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSPasteboard, NSPasteboardTypeFileURL, NSPasteboardTypePNG, NSPasteboardTypeString, NSPasteboardTypeTIFF};
    use objc2_foundation::{NSDictionary, NSURL};

    let pb = NSPasteboard::generalPasteboard();
    let mut out = ClipboardData::default();
    // file copiati dal Finder: un URL file:// per elemento
    if let Some(items) = pb.pasteboardItems() {
        for item in items.iter() {
            let Some(s) = (unsafe { item.stringForType(NSPasteboardTypeFileURL) }) else { continue };
            if let Some(path) = NSURL::URLWithString(&s).and_then(|u| u.path()) {
                out.files.push(path.to_string());
            }
        }
    }
    if out.files.is_empty() {
        // immagine (screenshot copiato, immagine da un'altra app): PNG, o TIFF convertito
        let png = unsafe { pb.dataForType(NSPasteboardTypePNG) }.map(|d| d.to_vec()).or_else(|| {
            let tiff = unsafe { pb.dataForType(NSPasteboardTypeTIFF) }?;
            let rep = NSBitmapImageRep::imageRepWithData(&tiff)?;
            let data = unsafe { rep.representationUsingType_properties(NSBitmapImageFileType::PNG, &NSDictionary::new()) }?;
            Some(data.to_vec())
        });
        out.image_png_b64 = png.map(|b| base64::engine::general_purpose::STANDARD.encode(b));
        out.text = unsafe { pb.stringForType(NSPasteboardTypeString) }.map(|s| s.to_string());
    }
    out
}

#[cfg(not(target_os = "macos"))]
fn read() -> ClipboardData {
    // su Windows WebView2 genera l'evento paste anche fuori dai campi: non serve
    ClipboardData::default()
}
