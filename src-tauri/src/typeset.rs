// Impaginazione con Typst integrato: un "mondo" in memoria con il sorgente generato
// dall'interfaccia, i file allegati (immagini, formule SVG) e i font inclusi.
use crate::fsops::{err, CmdResult};
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;
use typst::diag::{FileError, FileResult, Severity};
use typst::foundations::{Bytes, Datetime, Duration};
use typst::syntax::{FileId, RootedPath, Source, VirtualPath, VirtualRoot};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::{Library, LibraryExt, World};
use typst_layout::PagedDocument;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InFile {
    path: String,
    data_b64: String,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TypstOut {
    ok: bool,
    errors: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pdf_b64: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    svg_pages: Option<Vec<String>>,
}

struct Fonts {
    book: LazyHash<FontBook>,
    fonts: Vec<Font>,
}

fn fonts() -> &'static Fonts {
    static FONTS: OnceLock<Fonts> = OnceLock::new();
    FONTS.get_or_init(|| {
        let mut fonts = Vec::new();
        for data in typst_assets::fonts() {
            let bytes = Bytes::new(data);
            for i in 0.. {
                match Font::new(bytes.clone(), i) {
                    Some(f) => fonts.push(f),
                    None => break,
                }
            }
        }
        let book = LazyHash::new(FontBook::from_fonts(&fonts));
        Fonts { book, fonts }
    })
}

fn library() -> &'static LazyHash<Library> {
    static LIB: OnceLock<LazyHash<Library>> = OnceLock::new();
    LIB.get_or_init(|| LazyHash::new(Library::builder().build()))
}

fn file_id(path: &str) -> Option<FileId> {
    let vp = VirtualPath::new(path).ok()?;
    Some(RootedPath::new(VirtualRoot::Project, vp).intern())
}

pub struct MemWorld {
    main: FileId,
    source: Source,
    files: HashMap<FileId, Bytes>,
}

impl MemWorld {
    pub fn new(text: String, files: Vec<(String, Vec<u8>)>) -> Self {
        let main = file_id("/main.typ").expect("percorso valido");
        let mut map = HashMap::new();
        for (p, data) in files {
            let p = if p.starts_with('/') { p } else { format!("/{}", p) };
            if let Some(id) = file_id(&p) {
                map.insert(id, Bytes::new(data));
            }
        }
        MemWorld { main, source: Source::new(main, text), files: map }
    }
}

impl World for MemWorld {
    fn library(&self) -> &LazyHash<Library> {
        library()
    }
    fn book(&self) -> &LazyHash<FontBook> {
        &fonts().book
    }
    fn main(&self) -> FileId {
        self.main
    }
    fn source(&self, id: FileId) -> FileResult<Source> {
        if id == self.main {
            return Ok(self.source.clone());
        }
        match self.files.get(&id) {
            Some(b) => Ok(Source::new(id, String::from_utf8_lossy(b.as_slice()).to_string())),
            None => Err(FileError::NotFound(std::path::PathBuf::from(id.vpath().get_without_slash()))),
        }
    }
    fn file(&self, id: FileId) -> FileResult<Bytes> {
        if id == self.main {
            return Ok(Bytes::from_string(self.source.text().to_string()));
        }
        self.files
            .get(&id)
            .cloned()
            .ok_or_else(|| FileError::NotFound(std::path::PathBuf::from(id.vpath().get_without_slash())))
    }
    fn font(&self, index: usize) -> Option<Font> {
        fonts().fonts.get(index).cloned()
    }
    fn today(&self, _offset: Option<Duration>) -> Option<Datetime> {
        let now = chrono::Local::now();
        use chrono::Datelike;
        Datetime::from_ymd(now.year(), now.month() as u8, now.day() as u8)
    }
}

pub fn compile(text: String, files: Vec<(String, Vec<u8>)>) -> Result<PagedDocument, Vec<String>> {
    let world = MemWorld::new(text, files);
    let warned = typst::compile::<PagedDocument>(&world);
    warned.output.map_err(|diags| {
        diags
            .iter()
            .filter(|d| d.severity == Severity::Error)
            .map(|d| {
                let line = typst::WorldExt::range(&world, d.span)
                    .map(|r| world.source.text()[..r.start.min(world.source.text().len())].lines().count())
                    .map(|l| format!(" (riga {})", l.max(1)))
                    .unwrap_or_default();
                format!("{}{}", d.message, line)
            })
            .collect()
    })
}

#[tauri::command]
pub async fn typst_compile(source: String, files: Vec<InFile>, format: String) -> CmdResult<TypstOut> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut decoded = Vec::new();
        for f in files {
            let data = base64::engine::general_purpose::STANDARD.decode(f.data_b64).map_err(err)?;
            decoded.push((f.path, data));
        }
        let doc = match compile(source, decoded) {
            Ok(d) => d,
            Err(errors) => return Ok(TypstOut { ok: false, errors, ..Default::default() }),
        };
        if format == "svg" {
            let opts = typst_svg::SvgOptions::default();
            let pages = doc.pages().iter().map(|p| typst_svg::svg(p, &opts)).collect();
            return Ok(TypstOut { ok: true, errors: vec![], svg_pages: Some(pages), ..Default::default() });
        }
        let pdf = typst_pdf::pdf(&doc, &typst_pdf::PdfOptions::default())
            .map_err(|d| d.iter().map(|x| x.message.to_string()).collect::<Vec<_>>().join("; "))?;
        Ok(TypstOut {
            ok: true,
            errors: vec![],
            pdf_b64: Some(base64::engine::general_purpose::STANDARD.encode(pdf)),
            ..Default::default()
        })
    })
    .await
    .map_err(err)?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compiles_pdf_with_line_numbers() {
        let src = r#"#set page(paper: "a4")
#set par.line(numbering: "1")
#set text(font: "Libertinus Serif", lang: "it")
= Titolo
Un paragrafo di prova con una nota#footnote[La nota.].
"#;
        let doc = compile(src.into(), vec![]).expect("compila");
        assert_eq!(doc.pages().len(), 1);
        let pdf = typst_pdf::pdf(&doc, &typst_pdf::PdfOptions::default()).unwrap();
        assert!(pdf.starts_with(b"%PDF"));
    }

    #[test]
    fn reports_errors_with_line() {
        let errs = compile("ciao\n#nonesiste()".into(), vec![]).err().unwrap();
        assert!(errs[0].contains("riga 2"), "{:?}", errs);
    }

    #[test]
    fn uses_attached_files() {
        let svg = br#"<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>"#;
        let doc = compile("#image(\"img/a.svg\", width: 2cm)".into(), vec![("img/a.svg".into(), svg.to_vec())]);
        assert!(doc.is_ok(), "{:?}", doc.err());
    }
}
