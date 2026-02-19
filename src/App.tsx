import { useState, useCallback, useEffect, MouseEvent } from "react";
import {
  fetchRepos,
  fetchCommits,
  fetchCommitDetail,
  validateToken,
} from "./api/github";
import type { GitHubRepo, GitHubCommitSummary, GitHubCommitFile } from "./types/github";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

const TOKEN_KEY = "easy_git_github_token";
const LOCAL_REPO_KEY = "easy_git_local_repo_path";

function App() {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(TOKEN_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [tokenInput, setTokenInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [userLogin, setUserLogin] = useState("");

  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [localRepoPath, setLocalRepoPath] = useState(() => {
    try {
      return localStorage.getItem(LOCAL_REPO_KEY) ?? "";
    } catch {
      return "";
    }
  });

  // 저장된 토큰이 있으면 유효성 검사 후 로그인 상태 복원
  useEffect(() => {
    if (!token) return;
    if (userLogin) return;
    let cancelled = false;
    validateToken(token)
      .then((user) => {
        if (!cancelled) setUserLogin(user.login);
      })
      .catch(() => {
        if (!cancelled) {
          setToken("");
          try {
            localStorage.removeItem(TOKEN_KEY);
          } catch {}
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, userLogin]);

  // 세션 복원 후(토큰+userLogin만 있고 repos 비어 있음) 레포 목록 불러오기
  useEffect(() => {
    if (!token || !userLogin || repos.length > 0) return;
    let cancelled = false;
    fetchRepos(token)
      .then((list) => {
        if (!cancelled) setRepos(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, userLogin, repos.length]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [commits, setCommits] = useState<GitHubCommitSummary[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<GitHubCommitSummary | null>(null);
  const [files, setFiles] = useState<GitHubCommitFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<GitHubCommitFile | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    commit: GitHubCommitSummary | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    commit: null,
  });
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | null;
  }>({
    message: "",
    type: null,
  });

  const isLoggedIn = !!token && !!userLogin;

  // 토스트 자동 숨김
  useEffect(() => {
    if (!toast.type) return;
    const id = setTimeout(() => {
      setToast({ message: "", type: null });
    }, 3000);
    return () => clearTimeout(id);
  }, [toast.type]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleCommitContextMenu = useCallback(
    (event: MouseEvent<HTMLButtonElement>, commit: GitHubCommitSummary) => {
      event.preventDefault();
      setContextMenu({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        commit,
      });
    },
    [],
  );

  const handleCopyRevertCommand = useCallback(async () => {
    if (!contextMenu.commit || !selectedRepo || !token) return;
    const [owner] = selectedRepo.full_name.split("/");
    try {
      const output = await invoke<string>("revert_commit_via_temp_clone", {
        owner,
        repo: selectedRepo.name,
        sha: contextMenu.commit.sha,
        branch: selectedRepo.default_branch,
        token,
      });
      // 성공 여부 확인을 위해 출력은 콘솔에만 남기고, 사용자 알림에는 노출하지 않는다.
      if (output) {
        console.log("git revert via temp clone output:", output);
      }
      // revert가 성공하면 해당 레포의 커밋 목록을 다시 불러와서
      // 새로 생성된 revert 커밋까지 UI에서 바로 볼 수 있게 한다.
      try {
        setLoading("commits");
        const refreshedCommits = await fetchCommits(
          token,
          owner,
          selectedRepo.name,
          selectedRepo.default_branch,
        );
        setCommits(refreshedCommits);
      } catch (e) {
        console.error("failed to refresh commits after revert:", e);
      } finally {
        setLoading(null);
      }
      setToast({
        type: "success",
        message: `git revert + push 완료: ${selectedRepo.full_name} · ${selectedRepo.default_branch} · ${contextMenu.commit.sha.slice(0, 7)}`,
      });
    } catch (e) {
      setToast({
        type: "error",
        message: `git revert 실행 실패: ${
          e instanceof Error ? e.message : String(e)
        }`,
      });
    } finally {
      handleCloseContextMenu();
    }
  }, [contextMenu.commit, handleCloseContextMenu, selectedRepo, token]);

  const handleOpenCommitInGitHub = useCallback(async () => {
    if (!contextMenu.commit) return;
    const url = contextMenu.commit.html_url;
    try {
      await openUrl(url);
    } catch {
      window.open(url, "_blank");
    } finally {
      handleCloseContextMenu();
    }
  }, [contextMenu.commit, handleCloseContextMenu]);

  const handleLogin = useCallback(async () => {
    setLoginError("");
    const t = tokenInput.trim();
    if (!t) {
      setLoginError("Access Token을 입력해 주세요.");
      return;
    }
    setLoading("login");
    try {
      const user = await validateToken(t);
      setUserLogin(user.login);
      setToken(t);
      setTokenInput("");
      try {
        localStorage.setItem(TOKEN_KEY, t);
      } catch {}
      const list = await fetchRepos(t);
      setRepos(list);
      setSelectedRepo(null);
      setCommits([]);
      setSelectedCommit(null);
      setFiles([]);
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  }, [tokenInput]);

  const handleLogout = useCallback(() => {
    setToken("");
    setUserLogin("");
    setRepos([]);
    setSelectedRepo(null);
    setCommits([]);
    setSelectedCommit(null);
    setFiles([]);
    localStorage.removeItem(TOKEN_KEY);
  }, []);

  const handleLocalRepoPathChange = useCallback((value: string) => {
    setLocalRepoPath(value);
    try {
      localStorage.setItem(LOCAL_REPO_KEY, value);
    } catch {
      // ignore
    }
  }, []);

  const handleSelectRepo = useCallback(
    async (repo: GitHubRepo) => {
      if (!token || selectedRepo?.id === repo.id) return;
      setSelectedRepo(repo);
      setCommits([]);
      setSelectedCommit(null);
      setFiles([]);
      setLoading("commits");
      try {
        const [owner] = repo.full_name.split("/");
        const list = await fetchCommits(token, owner, repo.name, repo.default_branch);
        setCommits(list);
      } catch (e) {
        console.error(e);
        setCommits([]);
      } finally {
        setLoading(null);
      }
    },
    [token, selectedRepo]
  );

  const handleSelectCommit = useCallback(
    async (commit: GitHubCommitSummary) => {
      if (!token || !selectedRepo || selectedCommit?.sha === commit.sha) return;
      setSelectedCommit(commit);
      setFiles([]);
      setSelectedFile(null);
      setLoading("files");
      try {
        const [owner] = selectedRepo.full_name.split("/");
        const detail = await fetchCommitDetail(
          token,
          owner,
          selectedRepo.name,
          commit.sha
        );
        setFiles(detail.files ?? []);
      } catch (e) {
        console.error(e);
        setFiles([]);
      } finally {
        setLoading(null);
      }
    },
    [token, selectedRepo, selectedCommit]
  );

  if (!isLoggedIn) {
    return (
      <div className="app login-screen">
        <div className="login-box">
          <h1>Easy Git</h1>
          <p className="login-desc">
            GitHub Personal Access Token을 입력하면
            <br />
            레포와 커밋 이력을 쉽게 볼 수 있습니다.
          </p>
          <div className="login-form">
            <input
              type="password"
              className="input-token"
              placeholder="GitHub Access Token"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              disabled={loading === "login"}
              autoComplete="off"
            />
            <button
              type="button"
              className="btn-github-login"
              onClick={handleLogin}
              disabled={loading === "login"}
            >
              {loading === "login" ? "로그인 중…" : "로그인"}
            </button>
          </div>
          {loginError && <p className="login-error">{loginError}</p>}
          <p className="login-hint">
            GitHub → Settings → Developer settings → Personal access tokens 에서
            <br />
            토큰을 생성한 뒤 여기에 붙여 넣으세요. (repo 권한 필요)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app main-layout">
      <header className="header">
        <span className="header-title">Easy Git</span>
        <span className="header-user">{userLogin}</span>
        <div className="header-local-repo">
          <input
            type="text"
            className="input-local-repo"
            placeholder="로컬 Git 레포 경로 (예: C:\\work\\my-repo)"
            value={localRepoPath}
            onChange={(e) => handleLocalRepoPathChange(e.target.value)}
          />
        </div>
        <button type="button" className="btn-logout" onClick={handleLogout}>
          로그아웃
        </button>
      </header>

      <div className="panels">
        <aside className="panel panel-repos">
          <h2>레포지토리</h2>
          <ul className="repo-list">
            {repos.map((repo) => (
              <li key={repo.id}>
                <button
                  type="button"
                  className={selectedRepo?.id === repo.id ? "active" : ""}
                  onClick={() => handleSelectRepo(repo)}
                >
                  <span className="repo-name">{repo.name}</span>
                  {repo.private && <span className="badge">private</span>}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="panel panel-commits">
          <h2>
            커밋 이력
            {selectedRepo && (
              <span className="panel-sub"> — {selectedRepo.full_name}</span>
            )}
          </h2>
          {loading === "commits" && <p className="loading">커밋 목록 불러오는 중…</p>}
          <ul className="commit-list">
            {commits.map((c) => (
              <li key={c.sha}>
                <button
                  type="button"
                  className={selectedCommit?.sha === c.sha ? "active" : ""}
                  onClick={() => handleSelectCommit(c)}
                  onContextMenu={(e) => handleCommitContextMenu(e, c)}
                >
                  <span className="commit-msg">
                    {c.commit.message.split("\n")[0]}
                  </span>
                  <span className="commit-meta">
                    {c.commit.author.name} · {formatDate(c.commit.author.date)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel panel-files">
          <h2>
            변경된 파일
            {selectedCommit && (
              <span className="panel-sub"> — {selectedCommit.sha.slice(0, 7)}</span>
            )}
          </h2>
          <div className="files-content">
            <div className="file-list-wrap">
              {loading === "files" && <p className="loading">변경 파일 불러오는 중…</p>}
              <ul className="file-list">
                {files.map((f, i) => (
                  <li key={f.filename + i}>
                    <button
                      type="button"
                      className={selectedFile?.filename === f.filename ? "active" : ""}
                      onClick={() => setSelectedFile(f)}
                    >
                      <span className={`file-status status-${f.status}`}>
                        {f.status}
                      </span>
                      <span className="file-name">{f.filename}</span>
                      <span className="file-diff">
                        +{f.additions} -{f.deletions}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="diff-view">
              {selectedFile ? (
                <>
                  <div className="diff-header">{selectedFile.filename}</div>
                  {selectedFile.patch ? (
                    <pre className="diff-body">
                      {selectedFile.patch.split("\n").map((line, i) => (
                        <div
                          key={i}
                          className={
                            line.startsWith("+")
                              ? "diff-line diff-add"
                              : line.startsWith("-")
                                ? "diff-line diff-del"
                                : "diff-line diff-ctx"
                          }
                        >
                          <span className="diff-line-num">{i + 1}</span>
                          <span className="diff-line-content">
                            {line || " "}
                          </span>
                        </div>
                      ))}
                    </pre>
                  ) : (
                    <p className="diff-empty">
                      이 파일은 diff를 표시할 수 없습니다.
                      <br />
                      (바이너리 또는 비공개 diff일 수 있습니다.)
                    </p>
                  )}
                </>
              ) : (
                <p className="diff-placeholder">
                  왼쪽에서 파일을 클릭하면 diff를 볼 수 있습니다.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
      {contextMenu.visible && contextMenu.commit && (
        <div className="context-menu-backdrop" onClick={handleCloseContextMenu}>
          <div
            className="context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={handleCopyRevertCommand}>
              이 커밋을 원격에서 되돌리기 (임시 clone + push)
            </button>
            <button type="button" onClick={handleOpenCommitInGitHub}>
              GitHub에서 이 커밋 페이지 열기
            </button>
          </div>
        </div>
      )}
      {toast.type && (
        <div className={`toast toast-${toast.type}`}>
          <span className="toast-message">{toast.message}</span>
        </div>
      )}
    </div>
  );
}

function formatDate(s: string): string {
  const d = new Date(s);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) {
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 0) return `${h}시간 전`;
    if (m > 0) return `${m}분 전`;
    return "방금 전";
  }
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default App;
