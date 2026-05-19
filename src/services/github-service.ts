import { invoke } from "@tauri-apps/api/core";

// --- Types ---
export interface GitHubIssue {
  number: number;
  title: string;
  state: "open" | "closed";
  author: string;
  createdAt: string;
  labels: { name: string; color: string }[];
  commentsCount: number;
  url: string;
  body?: string;
}

export interface GitHubPullRequest extends GitHubIssue {
  branchRef: string;
  isDraft: boolean;
}

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
}

// --- Helpers ---

// Parses git@github.com:owner/repo.git or https://github.com/owner/repo.git
export function parseGitHubRemote(remoteUrl: string): GitHubRepoInfo | null {
  if (!remoteUrl) return null;
  const match = remoteUrl.match(/github\.com[:/]([^\/]+)\/([^\/]+?)(\.git)?$/i);
  if (match && match.length >= 3) {
    return { owner: match[1], repo: match[2] };
  }
  return null;
}

async function getGitHubPAT(): Promise<string | null> {
  try {
    const config: any = await invoke("get_config");
    return config?.github_pat || null;
  } catch {
    return null;
  }
}

async function fetchGitHub(path: string, pat: string, method = "GET", body?: any) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${pat}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  
  if (!res.ok) {
    throw new Error(`GitHub API Error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// --- API Methods ---

export async function fetchGitHubIssues(owner: string, repo: string): Promise<GitHubIssue[]> {
  const pat = await getGitHubPAT();
  if (!pat) throw new Error("GitHub PAT is missing. Please add it in Settings.");

  // Fetch both issues and PRs, then filter for pure issues (GitHub API returns PRs as issues too)
  const data = await fetchGitHub(`/repos/${owner}/${repo}/issues?state=all&per_page=50`, pat);
  
  return data
    .filter((item: any) => !item.pull_request)
    .map((item: any) => ({
      number: item.number,
      title: item.title,
      state: item.state,
      author: item.user.login,
      createdAt: item.created_at,
      labels: item.labels.map((l: any) => ({ name: l.name, color: l.color })),
      commentsCount: item.comments,
      url: item.html_url,
      body: item.body
    }));
}

export async function fetchGitHubPullRequests(owner: string, repo: string): Promise<GitHubPullRequest[]> {
  const pat = await getGitHubPAT();
  if (!pat) throw new Error("GitHub PAT is missing. Please add it in Settings.");

  const data = await fetchGitHub(`/repos/${owner}/${repo}/pulls?state=all&per_page=50`, pat);
  
  return data.map((item: any) => ({
    number: item.number,
    title: item.title,
    state: item.state,
    author: item.user.login,
    createdAt: item.created_at,
    labels: item.labels.map((l: any) => ({ name: l.name, color: l.color })),
    commentsCount: item.comments || 0, // Note: /pulls doesn't always return comment count directly, might need GraphQL for full fidelity, but fine for now
    url: item.html_url,
    body: item.body,
    branchRef: `${item.head.ref} -> ${item.base.ref}`,
    isDraft: item.draft
  }));
}

export async function createGitHubIssueComment(owner: string, repo: string, issueNumber: number, body: string): Promise<void> {
  const pat = await getGitHubPAT();
  if (!pat) throw new Error("GitHub PAT is missing.");
  await fetchGitHub(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, pat, "POST", { body });
}
