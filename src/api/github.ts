import type {
  GitHubRepo,
  GitHubCommitSummary,
  GitHubCommitDetail,
} from "../types/github";

const GITHUB_API = "https://api.github.com";

function headers(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github.v3+json",
    Authorization: `Bearer ${token}`,
  };
}

/** 로그인한 사용자의 레포 목록 조회 */
export async function fetchRepos(token: string): Promise<GitHubRepo[]> {
  const res = await fetch(`${GITHUB_API}/user/repos?per_page=100&sort=updated`, {
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `레포 목록 조회 실패 (${res.status})`);
  }
  return res.json();
}

/** 레포의 커밋 목록 조회 */
export async function fetchCommits(
  token: string,
  owner: string,
  repo: string,
  branch?: string
): Promise<GitHubCommitSummary[]> {
  const path = branch
    ? `repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=100`
    : `repos/${owner}/${repo}/commits?per_page=100`;
  const res = await fetch(`${GITHUB_API}/${path}`, {
    headers: headers(token),
    // revert 직후 등 최신 커밋이 바로 반영되도록 브라우저 캐시를 사용하지 않는다.
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `커밋 목록 조회 실패 (${res.status})`);
  }
  return res.json();
}

/** 특정 커밋 상세(변경 파일 포함) 조회 */
export async function fetchCommitDetail(
  token: string,
  owner: string,
  repo: string,
  sha: string
): Promise<GitHubCommitDetail> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/commits/${sha}`,
    {
      headers: headers(token),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `커밋 상세 조회 실패 (${res.status})`);
  }
  return res.json();
}

/** 토큰 유효성 검사 (현재 사용자 조회) */
export async function validateToken(token: string): Promise<{ login: string }> {
  const res = await fetch(`${GITHUB_API}/user`, {
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "토큰이 유효하지 않습니다.");
  }
  return res.json();
}
