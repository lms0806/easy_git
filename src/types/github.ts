/** GitHub API 응답 타입 */

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  description: string | null;
  default_branch: string;
}

export interface GitHubCommitSummary {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  author: { login: string } | null;
  html_url: string;
}

export interface GitHubCommitDetail {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  files?: GitHubCommitFile[];
}

export interface GitHubCommitFile {
  filename: string;
  status: "added" | "removed" | "modified" | "renamed";
  additions: number;
  deletions: number;
  changes?: number;
  patch?: string;
}
