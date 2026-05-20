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

export interface GitHubComment {
  id: number;
  body: string;
  author: string;
  createdAt: string;
  updatedAt?: string;
  htmlUrl: string;
}

export interface IssueDetail extends GitHubIssue {
  body: string;
  comments: GitHubComment[];
  labels: { name: string; color: string }[];
  assignees: string[];
  milestone?: string;
}

export interface PRReview {
  id: number;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "PENDING";
  author: string;
  body: string;
  submittedAt: string;
}

export interface PRDetail extends GitHubPullRequest {
  body: string;
  comments: GitHubComment[];
  reviews: PRReview[];
  assignees: string[];
  headSha: string;
  mergeable: boolean;
  mergeableState: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: {
    sha: string;
    message: string;
    author: string;
  }[];
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

export async function fetchIssueDetail(owner: string, repo: string, issueNumber: number): Promise<IssueDetail> {
  const pat = await getGitHubPAT();
  if (!pat) throw new Error("GitHub PAT is missing.");

  const [issue, comments] = await Promise.all([
    fetchGitHub(`/repos/${owner}/${repo}/issues/${issueNumber}`, pat),
    fetchGitHub(`/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`, pat),
  ]);

  return {
    number: issue.number,
    title: issue.title,
    state: issue.state,
    author: issue.user.login,
    createdAt: issue.created_at,
    body: issue.body || "",
    labels: issue.labels.map((l: any) => ({ name: l.name, color: l.color })),
    commentsCount: issue.comments,
    url: issue.html_url,
    assignees: issue.assignees.map((a: any) => a.login),
    milestone: issue.milestone?.title,
    comments: comments.map((c: any) => ({
      id: c.id,
      body: c.body,
      author: c.user.login,
      createdAt: c.created_at,
      updatedAt: c.updated_at !== c.created_at ? c.updated_at : undefined,
      htmlUrl: c.html_url,
    })),
  };
}

export async function fetchPRDetail(owner: string, repo: string, prNumber: number): Promise<PRDetail> {
  const pat = await getGitHubPAT();
  if (!pat) throw new Error("GitHub PAT is missing.");

  const [pr, comments, reviews, commits] = await Promise.all([
    fetchGitHub(`/repos/${owner}/${repo}/pulls/${prNumber}`, pat),
    fetchGitHub(`/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=100`, pat),
    fetchGitHub(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews?per_page=100`, pat),
    fetchGitHub(`/repos/${owner}/${repo}/pulls/${prNumber}/commits?per_page=50`, pat),
  ]);

  return {
    number: pr.number,
    title: pr.title,
    state: pr.state,
    author: pr.user.login,
    createdAt: pr.created_at,
    body: pr.body || "",
    labels: pr.labels.map((l: any) => ({ name: l.name, color: l.color })),
    commentsCount: pr.comments || 0,
    url: pr.html_url,
    branchRef: `${pr.head.ref} -> ${pr.base.ref}`,
    isDraft: pr.draft,
    assignees: pr.assignees.map((a: any) => a.login),
    headSha: pr.head.sha,
    mergeable: pr.mergeable ?? false,
    mergeableState: pr.mergeable_state,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changed_files,
    commits: commits.map((c: any) => ({
      sha: c.sha,
      message: c.commit.message,
      author: c.commit.author?.name || c.committer?.login || "Unknown",
    })),
    comments: comments.map((c: any) => ({
      id: c.id,
      body: c.body,
      author: c.user.login,
      createdAt: c.created_at,
      updatedAt: c.updated_at !== c.created_at ? c.updated_at : undefined,
      htmlUrl: c.html_url,
    })),
    reviews: reviews.map((r: any) => ({
      id: r.id,
      state: r.state,
      author: r.user.login,
      body: r.body,
      submittedAt: r.submitted_at,
    })),
  };
}

export async function mergePR(owner: string, repo: string, prNumber: number, commitTitle?: string, mergeMethod: "merge" | "squash" | "rebase" = "merge"): Promise<void> {
  const pat = await getGitHubPAT();
  if (!pat) throw new Error("GitHub PAT is missing.");
  await fetchGitHub(`/repos/${owner}/${repo}/pulls/${prNumber}/merge`, pat, "PUT", {
    commit_title: commitTitle || `Merge pull request #${prNumber}`,
    merge_method: mergeMethod,
  });
}

export async function updateIssueState(owner: string, repo: string, issueNumber: number, state: "open" | "closed"): Promise<void> {
  const pat = await getGitHubPAT();
  if (!pat) throw new Error("GitHub PAT is missing.");
  await fetchGitHub(`/repos/${owner}/${repo}/issues/${issueNumber}`, pat, "PATCH", { state });
}

export async function updatePRState(owner: string, repo: string, prNumber: number, state: "open" | "closed"): Promise<void> {
  const pat = await getGitHubPAT();
  if (!pat) throw new Error("GitHub PAT is missing.");
  await fetchGitHub(`/repos/${owner}/${repo}/pulls/${prNumber}`, pat, "PATCH", { state });
}

export async function createPRReview(owner: string, repo: string, prNumber: number, event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT", body: string): Promise<void> {
  const pat = await getGitHubPAT();
  if (!pat) throw new Error("GitHub PAT is missing.");
  await fetchGitHub(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, pat, "POST", {
    event,
    body,
  });
}

export async function updateIssueLabels(owner: string, repo: string, issueNumber: number, labels: string[]): Promise<void> {
  const pat = await getGitHubPAT();
  if (!pat) throw new Error("GitHub PAT is missing.");
  await fetchGitHub(`/repos/${owner}/${repo}/issues/${issueNumber}/labels`, pat, "PUT", { labels });
}

export async function addIssueLabel(owner: string, repo: string, issueNumber: number, label: string): Promise<void> {
  const pat = await getGitHubPAT();
  if (!pat) throw new Error("GitHub PAT is missing.");
  await fetchGitHub(`/repos/${owner}/${repo}/issues/${issueNumber}/labels`, pat, "POST", { labels: [label] });
}

export async function removeIssueLabel(owner: string, repo: string, issueNumber: number, label: string): Promise<void> {
  const pat = await getGitHubPAT();
  if (!pat) throw new Error("GitHub PAT is missing.");
  await fetchGitHub(`/repos/${owner}/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`, pat, "DELETE");
}

export async function fetchRepoLabels(owner: string, repo: string): Promise<{ name: string; color: string; description: string }[]> {
  const pat = await getGitHubPAT();
  if (!pat) throw new Error("GitHub PAT is missing.");
  const data = await fetchGitHub(`/repos/${owner}/${repo}/labels?per_page=100`, pat);
  return data.map((l: any) => ({ name: l.name, color: l.color, description: l.description || "" }));
}

export async function editIssueTitle(owner: string, repo: string, issueNumber: number, title: string): Promise<void> {
  const pat = await getGitHubPAT();
  if (!pat) throw new Error("GitHub PAT is missing.");
  await fetchGitHub(`/repos/${owner}/${repo}/issues/${issueNumber}`, pat, "PATCH", { title });
}

export async function editIssueBody(owner: string, repo: string, issueNumber: number, body: string): Promise<void> {
  const pat = await getGitHubPAT();
  if (!pat) throw new Error("GitHub PAT is missing.");
  await fetchGitHub(`/repos/${owner}/${repo}/issues/${issueNumber}`, pat, "PATCH", { body });
}

export async function editPRTitle(owner: string, repo: string, prNumber: number, title: string): Promise<void> {
  const pat = await getGitHubPAT();
  if (!pat) throw new Error("GitHub PAT is missing.");
  await fetchGitHub(`/repos/${owner}/${repo}/pulls/${prNumber}`, pat, "PATCH", { title });
}

export async function editPRBody(owner: string, repo: string, prNumber: number, body: string): Promise<void> {
  const pat = await getGitHubPAT();
  if (!pat) throw new Error("GitHub PAT is missing.");
  await fetchGitHub(`/repos/${owner}/${repo}/pulls/${prNumber}`, pat, "PATCH", { body });
}
