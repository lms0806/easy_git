import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
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
  const [loginError, setLoginError] = useState("");
  const [userLogin, setUserLogin] = useState("");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [commits, setCommits] = useState<GitHubCommitSummary[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<GitHubCommitSummary | null>(null);
  const [files, setFiles] = useState<GitHubCommitFile[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const isLoggedIn = !!token && !!userLogin;

  const handleLogin = useCallback(async () => {
    setLoginError("");
    setLoading("login");
    try {
      const accessToken = await invoke<string>("github_oauth_login");
      const t = accessToken.trim();
      if (!t) throw new Error("토큰을 받지 못했습니다.");
      const user = await validateToken(t);
      setUserLogin(user.login);
      setToken(t);
      localStorage.setItem(TOKEN_KEY, t);
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
  }, []);

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
            GitHub로 로그인하면
            <br />
            본인 레포와 커밋 이력을 쉽게 볼 수 있습니다.
          </p>
          <div className="login-form">
            <button
              type="button"
              className="btn-github-login"
              onClick={handleLogin}
              disabled={loading === "login"}
            >
              {loading === "login" ? "로그인 진행 중…" : "GitHub로 로그인"}
            </button>
          </div>
          {loginError && <p className="login-error">{loginError}</p>}
          <p className="login-hint">
            로그인 시 브라우저가 열립니다. GitHub에서 앱 권한을 승인해 주세요.
            <br />
            (OAuth 앱 설정이 필요하면 README를 참고하세요.)
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
          {loading === "files" && <p className="loading">변경 파일 불러오는 중…</p>}
          <ul className="file-list">
            {files.map((f, i) => (
              <li key={f.filename + i}>
                <span className={`file-status status-${f.status}`}>
                  {f.status}
                </span>
                <span className="file-name">{f.filename}</span>
                <span className="file-diff">
                  +{f.additions} -{f.deletions}
                </span>
              </li>
            ))}
          </ul>
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
