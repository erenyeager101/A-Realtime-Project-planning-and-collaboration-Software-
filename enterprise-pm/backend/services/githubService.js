/**
 * GitHub Service — Full GitHub API integration
 * Handles OAuth, repos, issues, PRs, commits, branches, actions, code search
 */

const GITHUB_API = 'https://api.github.com';

// ─── Helper: Authenticated GitHub fetch ───
async function ghFetch(endpoint, token, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${GITHUB_API}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    const error = new Error(`GitHub API ${res.status}: ${body}`);
    error.status = res.status;
    throw error;
  }

  // Handle 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

// ─── OAuth ───
function getOAuthUrl(state) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_CALLBACK_URL;
  const scope = 'repo,read:user,user:email,workflow,read:org';
  return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;
}

async function exchangeCodeForToken(code) {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`OAuth error: ${data.error_description || data.error}`);
  return data; // { access_token, token_type, scope }
}

async function getGitHubUser(token) {
  return ghFetch('/user', token);
}

// ─── Repositories ───
async function listUserRepos(token, { page = 1, perPage = 30, sort = 'updated' } = {}) {
  return ghFetch(`/user/repos?page=${page}&per_page=${perPage}&sort=${sort}&affiliation=owner,collaborator,organization_member`, token);
}

async function getRepo(token, owner, repo) {
  return ghFetch(`/repos/${owner}/${repo}`, token);
}

async function createRepo(token, { name, description, isPrivate = false, autoInit = true }) {
  return ghFetch('/user/repos', token, {
    method: 'POST',
    body: JSON.stringify({
      name,
      description,
      private: isPrivate,
      auto_init: autoInit,
    }),
  });
}

async function getRepoLanguages(token, owner, repo) {
  return ghFetch(`/repos/${owner}/${repo}/languages`, token);
}

async function getRepoContributors(token, owner, repo) {
  return ghFetch(`/repos/${owner}/${repo}/contributors?per_page=20`, token);
}

async function getRepoStats(token, owner, repo) {
  const [repo_data, languages, contributors] = await Promise.all([
    getRepo(token, owner, repo),
    getRepoLanguages(token, owner, repo),
    getRepoContributors(token, owner, repo).catch(() => []),
  ]);
  return {
    stars: repo_data.stargazers_count,
    forks: repo_data.forks_count,
    watchers: repo_data.watchers_count,
    openIssues: repo_data.open_issues_count,
    size: repo_data.size,
    defaultBranch: repo_data.default_branch,
    languages,
    contributors: contributors.map((c) => ({
      login: c.login,
      avatarUrl: c.avatar_url,
      contributions: c.contributions,
      profileUrl: c.html_url,
    })),
    visibility: repo_data.private ? 'private' : 'public',
    createdAt: repo_data.created_at,
    updatedAt: repo_data.updated_at,
    pushedAt: repo_data.pushed_at,
    description: repo_data.description,
  };
}

// ─── Issues ───
async function listIssues(token, owner, repo, { state = 'open', page = 1, perPage = 30 } = {}) {
  return ghFetch(`/repos/${owner}/${repo}/issues?state=${state}&page=${page}&per_page=${perPage}&sort=updated`, token);
}

async function createIssue(token, owner, repo, { title, body, labels = [], assignees = [] }) {
  return ghFetch(`/repos/${owner}/${repo}/issues`, token, {
    method: 'POST',
    body: JSON.stringify({ title, body, labels, assignees }),
  });
}

async function updateIssue(token, owner, repo, issueNumber, { state, title, body, labels, assignees }) {
  const payload = {};
  if (state) payload.state = state;
  if (title) payload.title = title;
  if (body !== undefined) payload.body = body;
  if (labels) payload.labels = labels;
  if (assignees) payload.assignees = assignees;

  return ghFetch(`/repos/${owner}/${repo}/issues/${issueNumber}`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

async function getIssue(token, owner, repo, issueNumber) {
  return ghFetch(`/repos/${owner}/${repo}/issues/${issueNumber}`, token);
}

// ─── Pull Requests ───
async function listPullRequests(token, owner, repo, { state = 'open', page = 1, perPage = 30 } = {}) {
  return ghFetch(`/repos/${owner}/${repo}/pulls?state=${state}&page=${page}&per_page=${perPage}&sort=updated`, token);
}

async function getPullRequest(token, owner, repo, prNumber) {
  return ghFetch(`/repos/${owner}/${repo}/pulls/${prNumber}`, token);
}

async function getPRReviews(token, owner, repo, prNumber) {
  return ghFetch(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, token);
}

async function getPRFiles(token, owner, repo, prNumber) {
  return ghFetch(`/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`, token);
}

// ─── Commits ───
async function listCommits(token, owner, repo, { sha, page = 1, perPage = 30 } = {}) {
  let url = `/repos/${owner}/${repo}/commits?page=${page}&per_page=${perPage}`;
  if (sha) url += `&sha=${sha}`;
  return ghFetch(url, token);
}

async function getCommit(token, owner, repo, commitSha) {
  return ghFetch(`/repos/${owner}/${repo}/commits/${commitSha}`, token);
}

// ─── Branches ───
async function listBranches(token, owner, repo) {
  return ghFetch(`/repos/${owner}/${repo}/branches?per_page=100`, token);
}

async function createBranch(token, owner, repo, { branchName, fromBranch = 'main' }) {
  // Get the SHA of the source branch
  const ref = await ghFetch(`/repos/${owner}/${repo}/git/ref/heads/${fromBranch}`, token);
  const sha = ref.object.sha;

  // Create the new branch
  return ghFetch(`/repos/${owner}/${repo}/git/refs`, token, {
    method: 'POST',
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha,
    }),
  });
}

// ─── GitHub Actions (Workflow Runs) ───
async function listWorkflowRuns(token, owner, repo, { page = 1, perPage = 10 } = {}) {
  return ghFetch(`/repos/${owner}/${repo}/actions/runs?page=${page}&per_page=${perPage}`, token);
}

async function getWorkflowRun(token, owner, repo, runId) {
  return ghFetch(`/repos/${owner}/${repo}/actions/runs/${runId}`, token);
}

async function listWorkflows(token, owner, repo) {
  return ghFetch(`/repos/${owner}/${repo}/actions/workflows`, token);
}

// ─── Code Search ───
async function searchCode(token, owner, repo, query) {
  const q = `${query}+repo:${owner}/${repo}`;
  return ghFetch(`/search/code?q=${encodeURIComponent(q)}&per_page=20`, token);
}

// ─── Webhooks ───
async function createWebhook(token, owner, repo, { webhookUrl, secret }) {
  return ghFetch(`/repos/${owner}/${repo}/hooks`, token, {
    method: 'POST',
    body: JSON.stringify({
      name: 'web',
      active: true,
      events: ['push', 'pull_request', 'issues', 'workflow_run', 'create', 'delete'],
      config: {
        url: webhookUrl,
        content_type: 'json',
        secret,
        insecure_ssl: '0',
      },
    }),
  });
}

async function deleteWebhook(token, owner, repo, hookId) {
  return ghFetch(`/repos/${owner}/${repo}/hooks/${hookId}`, token, { method: 'DELETE' });
}

// ─── File Content (README, etc.) ───
async function getFileContent(token, owner, repo, path = 'README.md', branch) {
  let url = `/repos/${owner}/${repo}/contents/${path}`;
  if (branch) url += `?ref=${branch}`;
  const data = await ghFetch(url, token);
  if (data.content) {
    data.decodedContent = Buffer.from(data.content, 'base64').toString('utf8');
  }
  return data;
}

// ─── Notifications / Events ───
async function getRepoEvents(token, owner, repo, { perPage = 30 } = {}) {
  return ghFetch(`/repos/${owner}/${repo}/events?per_page=${perPage}`, token);
}

module.exports = {
  // OAuth
  getOAuthUrl,
  exchangeCodeForToken,
  getGitHubUser,
  // Repos
  listUserRepos,
  getRepo,
  createRepo,
  getRepoLanguages,
  getRepoContributors,
  getRepoStats,
  // Issues
  listIssues,
  createIssue,
  updateIssue,
  getIssue,
  // Pull Requests
  listPullRequests,
  getPullRequest,
  getPRReviews,
  getPRFiles,
  // Commits
  listCommits,
  getCommit,
  // Branches
  listBranches,
  createBranch,
  // GitHub Actions
  listWorkflowRuns,
  getWorkflowRun,
  listWorkflows,
  // Code Search
  searchCode,
  // Webhooks
  createWebhook,
  deleteWebhook,
  // File Content
  getFileContent,
  // Events
  getRepoEvents,
};
