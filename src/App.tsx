import { useState, useCallback, useEffect } from "react";
import {
  fetchRepos,
  fetchCommits,
  fetchCommitDetail,
  validateToken,
} from "./api/github";
import type { GitHubRepo, GitHubCommitSummary, GitHubCommitFile } from "./types/github";
import "./App.css";

const TOKEN_KEY = "easy_git_github_token";

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
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [commits, setCommits] = useState<GitHubCommitSummary[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<GitHubCommitSummary | null>(null);
  const [files, setFiles] = useState<GitHubCommitFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<GitHubCommitFile | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const isLoggedIn = !!token && !!userLogin;

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
