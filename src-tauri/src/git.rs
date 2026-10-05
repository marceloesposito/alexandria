// Version control: git vero (libgit2) dietro un'interfaccia semplificata.
// L'intero vault e' il repository; .alexandria-cache/ resta fuori (gitignore).
use crate::fsops::{err, write_atomic, CmdResult};
use git2::{
    build::CheckoutBuilder, BranchType, Commit, Cred, DiffOptions, FetchOptions, IndexAddOption, MergeAnalysis,
    Oid, PushOptions, RemoteCallbacks, Repository, RepositoryInitOptions, Signature, Sort, Tree,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

const KEYRING_SERVICE: &str = "app.alexandria.desktop.git";

#[derive(Serialize)]
pub struct GitCommit {
    sha: String,
    parents: Vec<String>,
    message: String,
    author: String,
    time: i64,
    refs: Vec<String>,
}

#[derive(Serialize)]
pub struct BranchInfo {
    name: String,
    sha: String,
}

#[derive(Serialize)]
pub struct GitLog {
    head: Option<String>,
    branch: Option<String>,
    branches: Vec<BranchInfo>,
    commits: Vec<GitCommit>,
}

#[derive(Serialize)]
pub struct FileChange {
    path: String,
    status: String,
    binary: bool,
    before: Option<String>,
    after: Option<String>,
}

#[derive(Serialize)]
pub struct ConflictFile {
    path: String,
    base: Option<String>,
    ours: Option<String>,
    theirs: Option<String>,
    binary: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeResult {
    status: String,
    conflicts: Vec<ConflictFile>,
    theirs_sha: String,
}

#[derive(Serialize)]
pub struct GitStatus {
    dirty: bool,
    changed: Vec<String>,
    merging: bool,
}

#[derive(Deserialize)]
pub struct Resolved {
    path: String,
    content: Option<String>,
}

fn open(repo: &str) -> CmdResult<Repository> {
    let r = Repository::open(repo).map_err(err)?;
    // il testo resta byte per byte com'e' scritto: niente conversione degli a capo
    // niente bit di esecuzione: su una chiavetta exFAT non esistono e git vedrebbe file "modificati"
    if let Ok(mut cfg) = r.config() {
        if cfg.get_bool("core.autocrlf").unwrap_or(false) {
            let _ = cfg.set_bool("core.autocrlf", false);
        }
        if cfg.get_bool("core.filemode").unwrap_or(true) {
            let _ = cfg.set_bool("core.filemode", false);
        }
    }
    Ok(r)
}

fn signature(repo: &Repository) -> Signature<'static> {
    repo.signature()
        .map(|s| s.to_owned())
        .unwrap_or_else(|_| Signature::now("Alexandria", "author@alexandria.local").expect("firma valida"))
}

fn head_commit(repo: &Repository) -> Option<Commit<'_>> {
    repo.head().ok().and_then(|h| h.peel_to_commit().ok())
}

fn current_branch(repo: &Repository) -> Option<String> {
    let head = repo.find_reference("HEAD").ok()?;
    head.symbolic_target()
        .ok()
        .flatten()
        .map(|s| s.trim_start_matches("refs/heads/").to_string())
}

fn blob_text(repo: &Repository, oid: Oid) -> (Option<String>, bool) {
    if oid.is_zero() {
        return (None, false);
    }
    match repo.find_blob(oid) {
        Ok(b) if b.is_binary() => (None, true),
        Ok(b) => (Some(String::from_utf8_lossy(b.content()).to_string()), false),
        Err(_) => (None, false),
    }
}

fn stage_all(repo: &Repository) -> CmdResult<Oid> {
    let mut index = repo.index().map_err(err)?;
    index.add_all(["*"].iter(), IndexAddOption::DEFAULT, None).map_err(err)?;
    index.update_all(["*"].iter(), None).map_err(err)?;
    index.write().map_err(err)?;
    index.write_tree().map_err(err)
}

#[tauri::command]
pub fn git_init(repo: String) -> CmdResult<()> {
    if Path::new(&repo).join(".git").exists() {
        return Ok(());
    }
    let mut opts = RepositoryInitOptions::new();
    opts.initial_head("main");
    let r = Repository::init_opts(&repo, &opts).map_err(err)?;
    let mut cfg = r.config().map_err(err)?;
    cfg.set_bool("core.autocrlf", false).map_err(err)?;
    cfg.set_bool("core.filemode", false).map_err(err)?;
    let gi = Path::new(&repo).join(".gitignore");
    if !gi.exists() {
        write_atomic(&gi.to_string_lossy(), b".alexandria-cache/\n*.alexandria-tmp\n.DS_Store\nThumbs.db\n")?;
    }
    Ok(())
}

/// Nome dell'autore dei commit del vault (configurazione locale del repository).
#[tauri::command]
pub fn git_set_author(repo: String, name: String) -> CmdResult<()> {
    let r = open(&repo)?;
    let cfg = r.config().map_err(err)?;
    let mut local = match cfg.open_level(git2::ConfigLevel::Local) {
        Ok(c) => c,
        Err(_) => return Ok(()),
    };
    if name.trim().is_empty() {
        let _ = local.remove("user.name");
    } else {
        local.set_str("user.name", name.trim()).map_err(err)?;
        if cfg.get_string("user.email").is_err() {
            local.set_str("user.email", "author@alexandria.local").map_err(err)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn git_status(repo: String) -> CmdResult<GitStatus> {
    let r = open(&repo)?;
    let mut opts = git2::StatusOptions::new();
    opts.include_untracked(true).recurse_untracked_dirs(true).include_ignored(false);
    let statuses = r.statuses(Some(&mut opts)).map_err(err)?;
    let changed: Vec<String> = statuses.iter().filter_map(|s| s.path().ok().map(|p| p.to_string())).collect();
    Ok(GitStatus {
        dirty: !changed.is_empty(),
        changed,
        merging: r.state() == git2::RepositoryState::Merge,
    })
}

pub fn commit_all(r: &Repository, message: &str, amend_checkpoints: bool) -> CmdResult<Option<String>> {
    let tree_oid = stage_all(r)?;
    let tree = r.find_tree(tree_oid).map_err(err)?;
    let head = head_commit(r);
    let merging = r.state() == git2::RepositoryState::Merge;

    let mut parent = head.clone();
    if amend_checkpoints && !merging {
        while let Some(c) = parent.clone() {
            let msg = c.message().unwrap_or("");
            if msg.starts_with("checkpoint:") && c.parent_count() == 1 {
                parent = c.parent(0).ok();
            } else {
                break;
            }
        }
    }
    let same_parent = parent.as_ref().map(|c| c.id()) == head.as_ref().map(|c| c.id());
    if !merging && same_parent {
        if let Some(p) = &parent {
            if p.tree_id() == tree_oid {
                return Ok(None);
            }
        }
    }
    let mut parents: Vec<Commit> = parent.into_iter().collect();
    if merging {
        let mh = r.find_reference("MERGE_HEAD").map_err(err)?.peel_to_commit().map_err(err)?;
        parents.push(mh);
    }
    let sig = signature(r);
    let refs: Vec<&Commit> = parents.iter().collect();
    let oid = r.commit(None, &sig, &sig, message, &tree, &refs).map_err(err)?;
    let branch = current_branch(r).unwrap_or_else(|| "main".into());
    r.reference(&format!("refs/heads/{}", branch), oid, true, message)
        .map_err(err)?;
    if merging {
        r.cleanup_state().map_err(err)?;
    }
    Ok(Some(oid.to_string()))
}

#[tauri::command]
pub fn git_commit(repo: String, message: String, amend_checkpoints: bool) -> CmdResult<Option<String>> {
    let r = open(&repo)?;
    commit_all(&r, &message, amend_checkpoints)
}

#[tauri::command]
pub fn git_log(repo: String) -> CmdResult<GitLog> {
    let r = open(&repo)?;
    let mut branches = Vec::new();
    let mut refs: HashMap<Oid, Vec<String>> = HashMap::new();
    for b in r.branches(Some(BranchType::Local)).map_err(err)? {
        let (b, _) = b.map_err(err)?;
        if let (Some(name), Some(oid)) = (b.name().ok().flatten(), b.get().target()) {
            refs.entry(oid).or_default().push(name.to_string());
            branches.push(BranchInfo { name: name.to_string(), sha: oid.to_string() });
        }
    }
    let mut commits = Vec::new();
    if !branches.is_empty() {
        let mut walk = r.revwalk().map_err(err)?;
        walk.set_sorting(Sort::TOPOLOGICAL | Sort::TIME).map_err(err)?;
        for b in &branches {
            walk.push(Oid::from_str(&b.sha).map_err(err)?).map_err(err)?;
        }
        for oid in walk {
            let oid = oid.map_err(err)?;
            let c = r.find_commit(oid).map_err(err)?;
            commits.push(GitCommit {
                sha: oid.to_string(),
                parents: c.parent_ids().map(|p| p.to_string()).collect(),
                message: c.message().unwrap_or("").trim_end().to_string(),
                author: c.author().name().unwrap_or("").to_string(),
                time: c.time().seconds(),
                refs: refs.get(&oid).cloned().unwrap_or_default(),
            });
        }
    }
    Ok(GitLog {
        head: head_commit(&r).map(|c| c.id().to_string()),
        branch: current_branch(&r),
        branches,
        commits,
    })
}

fn diff_trees(r: &Repository, a: Option<&Tree>, b: Option<&Tree>) -> CmdResult<Vec<FileChange>> {
    let mut opts = DiffOptions::new();
    let diff = r.diff_tree_to_tree(a, b, Some(&mut opts)).map_err(err)?;
    collect(r, &diff, None)
}

fn collect(r: &Repository, diff: &git2::Diff, workdir: Option<&Path>) -> CmdResult<Vec<FileChange>> {
    let mut out = Vec::new();
    for d in diff.deltas() {
        let status = match d.status() {
            git2::Delta::Added | git2::Delta::Untracked => "added",
            git2::Delta::Deleted => "deleted",
            git2::Delta::Renamed => "renamed",
            _ => "modified",
        };
        let path = d
            .new_file()
            .path()
            .or_else(|| d.old_file().path())
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();
        let (before, b1) = blob_text(r, d.old_file().id());
        let (mut after, mut b2) = blob_text(r, d.new_file().id());
        if let Some(wd) = workdir {
            if status != "deleted" {
                match std::fs::read(wd.join(&path)) {
                    Ok(bytes) if bytes.iter().take(8000).any(|b| *b == 0) => {
                        b2 = true;
                        after = None;
                    }
                    Ok(bytes) => after = Some(String::from_utf8_lossy(&bytes).to_string()),
                    Err(_) => {}
                }
            }
        }
        out.push(FileChange { path, status: status.into(), binary: b1 || b2, before, after });
    }
    Ok(out)
}

#[tauri::command]
pub fn git_changes(repo: String, sha: String) -> CmdResult<Vec<FileChange>> {
    let r = open(&repo)?;
    let c = r.find_commit(Oid::from_str(&sha).map_err(err)?).map_err(err)?;
    let tree = c.tree().map_err(err)?;
    let parent_tree = c.parent(0).ok().and_then(|p| p.tree().ok());
    diff_trees(&r, parent_tree.as_ref(), Some(&tree))
}

#[tauri::command]
pub fn git_compare(repo: String, from_sha: String, to_sha: String) -> CmdResult<Vec<FileChange>> {
    let r = open(&repo)?;
    let from = r.find_commit(Oid::from_str(&from_sha).map_err(err)?).map_err(err)?.tree().map_err(err)?;
    if to_sha == "WORKTREE" {
        let mut opts = DiffOptions::new();
        opts.include_untracked(true).recurse_untracked_dirs(true);
        let diff = r.diff_tree_to_workdir_with_index(Some(&from), Some(&mut opts)).map_err(err)?;
        return collect(&r, &diff, r.workdir());
    }
    let to = r.find_commit(Oid::from_str(&to_sha).map_err(err)?).map_err(err)?.tree().map_err(err)?;
    diff_trees(&r, Some(&from), Some(&to))
}

#[tauri::command]
pub fn git_read_at(repo: String, sha: String, path: String) -> CmdResult<Option<String>> {
    let r = open(&repo)?;
    let c = r.find_commit(Oid::from_str(&sha).map_err(err)?).map_err(err)?;
    let tree = c.tree().map_err(err)?;
    let entry = match tree.get_path(Path::new(&path)) {
        Ok(e) => e,
        Err(_) => return Ok(None),
    };
    Ok(blob_text(&r, entry.id()).0)
}

#[tauri::command]
pub fn git_create_branch(repo: String, name: String, from_sha: Option<String>) -> CmdResult<()> {
    let r = open(&repo)?;
    let target = match from_sha {
        Some(s) => r.find_commit(Oid::from_str(&s).map_err(err)?).map_err(err)?,
        None => head_commit(&r).ok_or("Serve almeno un commit")?,
    };
    r.branch(&name, &target, false).map_err(err)?;
    Ok(())
}

#[tauri::command]
pub fn git_checkout(repo: String, branch: String) -> CmdResult<()> {
    let r = open(&repo)?;
    let refname = format!("refs/heads/{}", branch);
    let obj = r.revparse_single(&refname).map_err(err)?;
    let mut co = CheckoutBuilder::new();
    co.force().remove_untracked(false);
    r.checkout_tree(&obj, Some(&mut co)).map_err(err)?;
    r.set_head(&refname).map_err(err)
}

#[tauri::command]
pub fn git_restore(repo: String, sha: String) -> CmdResult<()> {
    let r = open(&repo)?;
    let obj = r.find_commit(Oid::from_str(&sha).map_err(err)?).map_err(err)?.into_object();
    let mut co = CheckoutBuilder::new();
    co.force();
    r.checkout_tree(&obj, Some(&mut co)).map_err(err)
}

fn merge_oid(r: &Repository, theirs: Oid) -> CmdResult<MergeResult> {
    let annotated = r.find_annotated_commit(theirs).map_err(err)?;
    let (analysis, _) = r.merge_analysis(&[&annotated]).map_err(err)?;
    let theirs_sha = theirs.to_string();
    if analysis.contains(MergeAnalysis::ANALYSIS_UP_TO_DATE) {
        return Ok(MergeResult { status: "up-to-date".into(), conflicts: vec![], theirs_sha });
    }
    if analysis.contains(MergeAnalysis::ANALYSIS_FASTFORWARD) || analysis.contains(MergeAnalysis::ANALYSIS_UNBORN) {
        let branch = current_branch(r).unwrap_or_else(|| "main".into());
        r.reference(&format!("refs/heads/{}", branch), theirs, true, "fast-forward").map_err(err)?;
        let mut co = CheckoutBuilder::new();
        co.force();
        r.checkout_head(Some(&mut co)).map_err(err)?;
        return Ok(MergeResult { status: "fast-forward".into(), conflicts: vec![], theirs_sha });
    }
    r.merge(&[&annotated], None, None).map_err(err)?;
    let index = r.index().map_err(err)?;
    if !index.has_conflicts() {
        commit_all(r, &format!("Merge {}", &theirs_sha[..7]), false)?;
        return Ok(MergeResult { status: "merged".into(), conflicts: vec![], theirs_sha });
    }
    let mut conflicts = Vec::new();
    for c in index.conflicts().map_err(err)? {
        let c = c.map_err(err)?;
        let path = [&c.our, &c.their, &c.ancestor]
            .iter()
            .find_map(|e| e.as_ref().map(|e| String::from_utf8_lossy(&e.path).replace('\\', "/")))
            .unwrap_or_default();
        let text = |e: &Option<git2::IndexEntry>| e.as_ref().map(|e| blob_text(r, e.id)).unwrap_or((None, false));
        let (base, b0) = text(&c.ancestor);
        let (ours, b1) = text(&c.our);
        let (theirs, b2) = text(&c.their);
        conflicts.push(ConflictFile { path, base, ours, theirs, binary: b0 || b1 || b2 });
    }
    Ok(MergeResult { status: "conflicts".into(), conflicts, theirs_sha })
}

#[tauri::command]
pub fn git_merge(repo: String, branch: String) -> CmdResult<MergeResult> {
    let r = open(&repo)?;
    let oid = r
        .find_branch(&branch, BranchType::Local)
        .map_err(err)?
        .get()
        .target()
        .ok_or("Branch senza commit")?;
    merge_oid(&r, oid)
}

#[tauri::command]
pub fn git_complete_merge(repo: String, resolved: Vec<Resolved>, message: String) -> CmdResult<String> {
    let r = open(&repo)?;
    let root = r.workdir().ok_or("Repository senza cartella di lavoro")?.to_path_buf();
    for f in resolved {
        let p = root.join(&f.path);
        match f.content {
            Some(text) => write_atomic(&p.to_string_lossy(), text.as_bytes())?,
            None => {
                let _ = std::fs::remove_file(&p);
            }
        }
    }
    let sha = commit_all(&r, &message, false)?;
    Ok(sha.unwrap_or_else(|| head_commit(&r).map(|c| c.id().to_string()).unwrap_or_default()))
}

#[tauri::command]
pub fn git_abort_merge(repo: String) -> CmdResult<()> {
    let r = open(&repo)?;
    if let Some(h) = head_commit(&r) {
        r.reset(h.as_object(), git2::ResetType::Hard, None).map_err(err)?;
    }
    r.cleanup_state().map_err(err)
}

fn token_entry(url: &str) -> Option<keyring::Entry> {
    keyring::Entry::new(KEYRING_SERVICE, url).ok()
}

#[tauri::command]
pub fn git_set_remote(repo: String, url: String, token: Option<String>) -> CmdResult<()> {
    let r = open(&repo)?;
    if r.find_remote("origin").is_ok() {
        r.remote_set_url("origin", &url).map_err(err)?;
    } else {
        r.remote("origin", &url).map_err(err)?;
    }
    if let (Some(t), Some(e)) = (token, token_entry(&url)) {
        if t.is_empty() {
            let _ = e.delete_credential();
        } else {
            e.set_password(&t).map_err(err)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn git_remote(repo: String) -> CmdResult<Option<String>> {
    let r = open(&repo)?;
    let url = r.find_remote("origin").ok().and_then(|rm| rm.url().ok().map(|s| s.to_string()));
    Ok(url)
}

fn callbacks(url: String) -> RemoteCallbacks<'static> {
    let mut cb = RemoteCallbacks::new();
    cb.credentials(move |_u, username, allowed| {
        if allowed.contains(git2::CredentialType::USER_PASS_PLAINTEXT) {
            if let Some(t) = token_entry(&url).and_then(|e| e.get_password().ok()) {
                return Cred::userpass_plaintext(username.unwrap_or("x-access-token"), &t);
            }
        }
        Cred::default()
    });
    cb
}

#[tauri::command]
pub async fn git_push(repo: String) -> CmdResult<String> {
    tauri::async_runtime::spawn_blocking(move || {
        let r = open(&repo)?;
        let branch = current_branch(&r).ok_or("Nessun branch attivo")?;
        let mut remote = r.find_remote("origin").map_err(|_| "Remoto non configurato".to_string())?;
        let url = remote.url().unwrap_or("").to_string();
        let mut po = PushOptions::new();
        po.remote_callbacks(callbacks(url));
        let spec = format!("refs/heads/{0}:refs/heads/{0}", branch);
        remote.push(&[spec.as_str()], Some(&mut po)).map_err(err)?;
        Ok(branch)
    })
    .await
    .map_err(err)?
}

#[tauri::command]
pub async fn git_pull(repo: String) -> CmdResult<MergeResult> {
    tauri::async_runtime::spawn_blocking(move || {
        let r = open(&repo)?;
        let branch = current_branch(&r).ok_or("Nessun branch attivo")?;
        let mut remote = r.find_remote("origin").map_err(|_| "Remoto non configurato".to_string())?;
        let url = remote.url().unwrap_or("").to_string();
        let mut fo = FetchOptions::new();
        fo.remote_callbacks(callbacks(url));
        remote.fetch(&[branch.as_str()], Some(&mut fo), None).map_err(err)?;
        let oid = r
            .find_reference(&format!("refs/remotes/origin/{}", branch))
            .ok()
            .and_then(|rf| rf.target())
            .or_else(|| r.find_reference("FETCH_HEAD").ok().and_then(|rf| rf.target()))
            .ok_or("Niente da scaricare")?;
        merge_oid(&r, oid)
    })
    .await
    .map_err(err)?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup() -> (tempfile::TempDir, String) {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().to_string_lossy().replace('\\', "/");
        git_init(p.clone()).unwrap();
        (dir, p)
    }

    fn write(repo: &str, path: &str, text: &str) {
        let full = format!("{}/{}", repo, path);
        fs::create_dir_all(Path::new(&full).parent().unwrap()).unwrap();
        fs::write(full, text).unwrap();
    }

    #[test]
    fn commit_log_and_changes() {
        let (_d, repo) = setup();
        write(&repo, "documents/a.md", "uno\ndue\n");
        let c1 = git_commit(repo.clone(), "primo".into(), false).unwrap().unwrap();
        // nessuna modifica: nessun commit
        assert!(git_commit(repo.clone(), "vuoto".into(), false).unwrap().is_none());
        write(&repo, "documents/a.md", "uno\ntre\n");
        let c2 = git_commit(repo.clone(), "secondo".into(), false).unwrap().unwrap();
        let log = git_log(repo.clone()).unwrap();
        assert_eq!(log.commits.len(), 2);
        assert_eq!(log.commits[0].sha, c2);
        assert_eq!(log.commits[1].sha, c1);
        assert_eq!(log.branch.as_deref(), Some("main"));
        let ch = git_changes(repo.clone(), c2).unwrap();
        let md: Vec<_> = ch.iter().filter(|c| c.path == "documents/a.md").collect();
        assert_eq!(md.len(), 1);
        assert_eq!(md[0].before.as_deref(), Some("uno\ndue\n"));
        assert_eq!(md[0].after.as_deref(), Some("uno\ntre\n"));
    }

    #[test]
    fn checkpoints_are_squashed() {
        let (_d, repo) = setup();
        write(&repo, "a.md", "1\n");
        git_commit(repo.clone(), "base".into(), false).unwrap();
        write(&repo, "a.md", "2\n");
        git_commit(repo.clone(), "checkpoint: auto".into(), false).unwrap();
        write(&repo, "a.md", "3\n");
        git_commit(repo.clone(), "checkpoint: auto".into(), false).unwrap();
        write(&repo, "a.md", "4\n");
        git_commit(repo.clone(), "vero".into(), true).unwrap();
        let log = git_log(repo).unwrap();
        let msgs: Vec<_> = log.commits.iter().map(|c| c.message.as_str()).collect();
        assert_eq!(msgs, vec!["vero", "base"]);
    }

    #[test]
    fn branch_merge_with_conflict() {
        let (_d, repo) = setup();
        write(&repo, "a.md", "alfa\nbeta\ngamma\n");
        git_commit(repo.clone(), "base".into(), false).unwrap();
        git_create_branch(repo.clone(), "idea".into(), None).unwrap();
        write(&repo, "a.md", "alfa\nBETA mia\ngamma\n");
        git_commit(repo.clone(), "mia".into(), false).unwrap();
        git_checkout(repo.clone(), "idea".into()).unwrap();
        assert_eq!(fs::read_to_string(format!("{}/a.md", repo)).unwrap(), "alfa\nbeta\ngamma\n");
        write(&repo, "a.md", "alfa\nbeta loro\ngamma\n");
        write(&repo, "b.md", "nuovo\n");
        git_commit(repo.clone(), "loro".into(), false).unwrap();
        git_checkout(repo.clone(), "main".into()).unwrap();
        let m = git_merge(repo.clone(), "idea".into()).unwrap();
        assert_eq!(m.status, "conflicts");
        assert_eq!(m.conflicts.len(), 1);
        assert_eq!(m.conflicts[0].ours.as_deref(), Some("alfa\nBETA mia\ngamma\n"));
        assert_eq!(m.conflicts[0].theirs.as_deref(), Some("alfa\nbeta loro\ngamma\n"));
        assert!(git_status(repo.clone()).unwrap().merging);
        git_complete_merge(
            repo.clone(),
            vec![Resolved { path: "a.md".into(), content: Some("alfa\nBETA mia e loro\ngamma\n".into()) }],
            "Unione".into(),
        )
        .unwrap();
        let log = git_log(repo.clone()).unwrap();
        assert_eq!(log.commits[0].parents.len(), 2);
        assert_eq!(fs::read_to_string(format!("{}/b.md", repo)).unwrap(), "nuovo\n");
        assert!(!git_status(repo).unwrap().merging);
    }

    #[test]
    fn fast_forward_and_restore() {
        let (_d, repo) = setup();
        write(&repo, "a.md", "1\n");
        let c1 = git_commit(repo.clone(), "1".into(), false).unwrap().unwrap();
        git_create_branch(repo.clone(), "x".into(), None).unwrap();
        git_checkout(repo.clone(), "x".into()).unwrap();
        write(&repo, "a.md", "2\n");
        git_commit(repo.clone(), "2".into(), false).unwrap();
        git_checkout(repo.clone(), "main".into()).unwrap();
        assert_eq!(git_merge(repo.clone(), "x".into()).unwrap().status, "fast-forward");
        assert_eq!(fs::read_to_string(format!("{}/a.md", repo)).unwrap(), "2\n");
        git_restore(repo.clone(), c1).unwrap();
        assert_eq!(fs::read_to_string(format!("{}/a.md", repo)).unwrap(), "1\n");
        let cmp = git_compare(repo.clone(), git_log(repo.clone()).unwrap().head.unwrap(), "WORKTREE".into()).unwrap();
        assert_eq!(cmp.len(), 1);
        assert_eq!(cmp[0].after.as_deref(), Some("1\n"));
    }
}
