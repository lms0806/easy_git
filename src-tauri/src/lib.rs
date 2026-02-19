// Access Token은 프론트에서 입력받아 GitHub API 호출에 사용합니다.
// 백엔드에서는 별도 OAuth/환경 변수 없이 동작합니다.

use std::{env, fs, path::PathBuf, process::Command};

#[tauri::command]
async fn revert_commit(sha: String, local_path: Option<String>) -> Result<String, String> {
    // local_path가 있으면 해당 디렉터리에서, 없으면 현재 작업 디렉터리에서 실행
    let mut cmd = Command::new("git");
    cmd.arg("revert").arg(&sha);
    if let Some(path) = local_path {
        cmd.current_dir(path);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("git 실행 실패: {e}"))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(if stderr.is_empty() {
            format!("git revert 실패 (code {:?})", output.status.code())
        } else {
            stderr
        })
    }
}

#[tauri::command]
async fn revert_commit_via_temp_clone(
    owner: String,
    repo: String,
    sha: String,
    branch: String,
    token: Option<String>,
) -> Result<String, String> {
    // 1) OS 공용 임시 디렉터리 하위에 전용 temp 디렉터리 생성
    // 프로젝트 루트가 아니라, dev 서버의 파일 감시에 영향이 없도록 시스템 temp 사용
    let base_dir = env::temp_dir().join("easy_git_revert");
    let temp_root = base_dir;
    if !temp_root.exists() {
        fs::create_dir_all(&temp_root)
            .map_err(|e| format!("temp 디렉터리 생성 실패: {e}"))?;
    }

    // owner_repo_revert 형태의 하위 폴더 사용, 기존에 있으면 삭제 후 재사용
    let dir_name = format!("{}_{}_revert", owner.replace('/', "_"), repo);
    let work_dir: PathBuf = temp_root.join(dir_name);
    if work_dir.exists() {
        let _ = fs::remove_dir_all(&work_dir);
    }

    // 2) partial clone (--filter=blob:none --no-checkout)
    // 토큰이 있는 경우 GitHub 권장 방식인 x-access-token 사용자명을 사용
    let remote = if let Some(t) = token.clone() {
        format!(
            "https://x-access-token:{}@github.com/{}/{}.git",
            t, owner, repo
        )
    } else {
        format!("https://github.com/{}/{}.git", owner, repo)
    };

    let clone_output = Command::new("git")
        .arg("clone")
        .arg("--filter=blob:none")
        .arg("--no-checkout")
        .arg(&remote)
        .arg(&work_dir)
        .output()
        .map_err(|e| format!("git clone 실행 실패: {e}"))?;

    if !clone_output.status.success() {
        let stderr = String::from_utf8_lossy(&clone_output.stderr).to_string();
        let _ = fs::remove_dir_all(&work_dir);
        return Err(if stderr.is_empty() {
            "git clone 실패".to_string()
        } else {
            stderr
        });
    }

    // 3) 대상 브랜치 체크아웃
    let checkout_output = Command::new("git")
        .current_dir(&work_dir)
        .arg("checkout")
        .arg(&branch)
        .output()
        .map_err(|e| format!("git checkout 실행 실패: {e}"))?;

    if !checkout_output.status.success() {
        let stderr = String::from_utf8_lossy(&checkout_output.stderr).to_string();
        let _ = fs::remove_dir_all(&work_dir);
        return Err(if stderr.is_empty() {
            format!("브랜치 체크아웃 실패: {}", branch)
        } else {
            stderr
        });
    }

    // 4) revert 실행
    let revert_output = Command::new("git")
        .current_dir(&work_dir)
        .arg("revert")
        .arg(&sha)
        .output()
        .map_err(|e| format!("git revert 실행 실패: {e}"))?;

    if !revert_output.status.success() {
        let stderr = String::from_utf8_lossy(&revert_output.stderr).to_string();
        let _ = fs::remove_dir_all(&work_dir);
        return Err(if stderr.is_empty() {
            format!("git revert 실패: {}", sha)
        } else {
            stderr
        });
    }

    // 5) origin으로 push (기본 브랜치)
    let push_output = Command::new("git")
        .current_dir(&work_dir)
        .arg("push")
        .arg("origin")
        .arg(&branch)
        .output()
        .map_err(|e| format!("git push 실행 실패: {e}"))?;

    // work_dir 정리 시도 (실패해도 무시)
    let _ = fs::remove_dir_all(&work_dir);

    if push_output.status.success() {
        let stdout = String::from_utf8_lossy(&push_output.stdout).to_string();
        Ok(format!(
            "임시 클론에서 git revert + push 완료\n레포: {}/{}\n브랜치: {}\n커밋: {}\n\n{}",
            owner, repo, branch, sha, stdout
        ))
    } else {
        let stderr = String::from_utf8_lossy(&push_output.stderr).to_string();
        Err(if stderr.is_empty() {
            "git push 실패".to_string()
        } else {
            stderr
        })
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            revert_commit,
            revert_commit_via_temp_clone
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
