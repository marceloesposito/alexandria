// Indice full-text (SQLite FTS5) per risorse del vault e Library.
// Il file del database vive in .alexandria-cache/ (vault) o nella cartella della Library.
use crate::fsops::{err, CmdResult};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Deserialize, Serialize, Clone)]
pub struct IndexDoc {
    id: String,
    title: String,
    authors: String,
    year: String,
    kind: String,
    tags: String,
    text: String,
}

#[derive(Serialize)]
pub struct SearchHit {
    id: String,
    title: String,
    snippet: String,
    score: f64,
}

fn conn(db: &str) -> CmdResult<Connection> {
    if let Some(p) = Path::new(db).parent() {
        std::fs::create_dir_all(p).map_err(err)?;
    }
    let c = Connection::open(db).map_err(err)?;
    c.execute_batch(
        "CREATE VIRTUAL TABLE IF NOT EXISTS docs USING fts5(
            id UNINDEXED, title, authors, year, kind, tags, text,
            tokenize = 'unicode61 remove_diacritics 2'
        );",
    )
    .map_err(err)?;
    Ok(c)
}

/// Trasforma il testo libero in una query FTS5 sicura: ogni parola tra virgolette, prefisso sull'ultima.
pub fn to_fts_query(q: &str) -> String {
    let words: Vec<String> = q
        .split_whitespace()
        .map(|w| w.replace('"', ""))
        .filter(|w| !w.is_empty())
        .collect();
    let n = words.len();
    words
        .into_iter()
        .enumerate()
        .map(|(i, w)| if i + 1 == n { format!("\"{}\"*", w) } else { format!("\"{}\"", w) })
        .collect::<Vec<_>>()
        .join(" ")
}

#[tauri::command]
pub fn index_upsert(db: String, docs: Vec<IndexDoc>) -> CmdResult<()> {
    let mut c = conn(&db)?;
    let tx = c.transaction().map_err(err)?;
    for d in docs {
        tx.execute("DELETE FROM docs WHERE id = ?1", params![d.id]).map_err(err)?;
        tx.execute(
            "INSERT INTO docs (id, title, authors, year, kind, tags, text) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![d.id, d.title, d.authors, d.year, d.kind, d.tags, d.text],
        )
        .map_err(err)?;
    }
    tx.commit().map_err(err)
}

#[tauri::command]
pub fn index_remove(db: String, ids: Vec<String>) -> CmdResult<()> {
    let c = conn(&db)?;
    for id in ids {
        c.execute("DELETE FROM docs WHERE id = ?1", params![id]).map_err(err)?;
    }
    Ok(())
}

#[tauri::command]
pub fn index_search(db: String, query: String, limit: u32) -> CmdResult<Vec<SearchHit>> {
    let q = to_fts_query(&query);
    if q.is_empty() {
        return Ok(vec![]);
    }
    let c = conn(&db)?;
    let mut st = c
        .prepare(
            "SELECT id, title, snippet(docs, 6, '«', '»', '…', 16), bm25(docs, 0.0, 8.0, 4.0, 1.0, 1.0, 3.0, 1.0)
             FROM docs WHERE docs MATCH ?1 ORDER BY 4 LIMIT ?2",
        )
        .map_err(err)?;
    let rows = st
        .query_map(params![q, limit], |r| {
            Ok(SearchHit { id: r.get(0)?, title: r.get(1)?, snippet: r.get(2)?, score: -r.get::<_, f64>(3)? })
        })
        .map_err(err)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(err)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn query_is_quoted() {
        assert_eq!(to_fts_query("memoria  coll\"ettiva"), "\"memoria\" \"collettiva\"*");
        assert_eq!(to_fts_query("   "), "");
    }

    #[test]
    fn upsert_and_search() {
        let dir = tempfile::tempdir().unwrap();
        let db = dir.path().join("i.sqlite").to_string_lossy().to_string();
        let doc = |id: &str, title: &str, text: &str| IndexDoc {
            id: id.into(),
            title: title.into(),
            authors: "Halbwachs".into(),
            year: "1950".into(),
            kind: "pdf".into(),
            tags: "fonte".into(),
            text: text.into(),
        };
        index_upsert(db.clone(), vec![doc("a", "La memoria collettiva", "Il ricordo è sociale"), doc("b", "Altro", "Città e memorie")]).unwrap();
        let hits = index_search(db.clone(), "memor".into(), 10).unwrap();
        assert_eq!(hits.len(), 2);
        assert_eq!(hits[0].id, "a"); // il titolo pesa di piu'
        let hits = index_search(db.clone(), "citta".into(), 10).unwrap(); // senza accento
        assert_eq!(hits.len(), 1);
        index_upsert(db.clone(), vec![doc("a", "Nuovo titolo", "niente")]).unwrap();
        assert_eq!(index_search(db.clone(), "collettiva".into(), 10).unwrap().len(), 0);
        index_remove(db.clone(), vec!["b".into()]).unwrap();
        assert_eq!(index_search(db, "memorie".into(), 10).unwrap().len(), 0);
    }
}
