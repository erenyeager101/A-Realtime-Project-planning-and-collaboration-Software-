import API from './api';

// ── OAuth ──
export const getConnectUrl = () => API.get('/github/connect');
export const disconnectGitHub = () => API.post('/github/disconnect');
export const getGitHubStatus = () => API.get('/github/status');

// ── Repositories ──
export const listRepos = (params) => API.get('/github/repos', { params });
export const createRepo = (data) => API.post('/github/repos', data);
export const getRepoStats = (owner, repo) => API.get(`/github/repos/${owner}/${repo}/stats`);
export const linkRepo = (data) => API.post('/github/repos/link', data);
export const unlinkRepo = (data) => API.post('/github/repos/unlink', data);

// ── Issues ──
export const listIssues = (projectId, params) => API.get(`/github/projects/${projectId}/issues`, { params });
export const createIssueFromTask = (taskId) => API.post(`/github/tasks/${taskId}/create-issue`);
export const syncTaskIssue = (taskId) => API.post(`/github/tasks/${taskId}/sync-issue`);
export const bulkCreateIssues = (projectId) => API.post(`/github/projects/${projectId}/bulk-create-issues`);

// ── Pull Requests ──
export const listPullRequests = (projectId, params) => API.get(`/github/projects/${projectId}/pulls`, { params });
export const getPullRequest = (projectId, prNumber) => API.get(`/github/projects/${projectId}/pulls/${prNumber}`);

// ── Commits ──
export const listCommits = (projectId, params) => API.get(`/github/projects/${projectId}/commits`, { params });

// ── Branches ──
export const listBranches = (projectId) => API.get(`/github/projects/${projectId}/branches`);
export const createBranchFromTask = (taskId) => API.post(`/github/tasks/${taskId}/create-branch`);

// ── GitHub Actions ──
export const listWorkflowRuns = (projectId, params) => API.get(`/github/projects/${projectId}/actions/runs`, { params });
export const listWorkflows = (projectId) => API.get(`/github/projects/${projectId}/actions/workflows`);

// ── Code Search ──
export const searchCode = (projectId, q) => API.get(`/github/projects/${projectId}/search`, { params: { q } });

// ── README ──
export const getReadme = (projectId) => API.get(`/github/projects/${projectId}/readme`);

// ── Activity ──
export const getGitHubActivity = (projectId) => API.get(`/github/projects/${projectId}/activity`);
