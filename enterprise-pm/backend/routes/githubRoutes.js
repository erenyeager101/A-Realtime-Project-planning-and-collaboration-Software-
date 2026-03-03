/**
 * GitHub Routes — OAuth, repos, issues, PRs, commits, branches, actions, search, webhooks
 */
const express = require('express');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const gh = require('../services/githubService');
const {
  requireProjectRoles,
  requireTaskProjectRoles,
} = require('../middleware/projectAccess');

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OAUTH: Connect / Disconnect GitHub Account
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/github/connect — Redirect user to GitHub OAuth
router.get('/connect', auth, (req, res) => {
  // Use JWT user id as state to link back after callback
  const state = Buffer.from(JSON.stringify({ userId: req.user._id })).toString('base64url');
  const url = gh.getOAuthUrl(state);
  res.json({ url });
});

// GET /api/github/callback — GitHub redirects here after OAuth
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send('Missing code or state');

    // Decode state to get user ID
    const { userId } = JSON.parse(Buffer.from(state, 'base64url').toString());

    // Exchange code for access token
    const tokenData = await gh.exchangeCodeForToken(code);
    const accessToken = tokenData.access_token;

    // Get GitHub user profile
    const ghUser = await gh.getGitHubUser(accessToken);

    // Update our user record with GitHub info
    await User.findByIdAndUpdate(userId, {
      github: {
        connected: true,
        accessToken,
        username: ghUser.login,
        profileUrl: ghUser.html_url,
        avatarUrl: ghUser.avatar_url,
        githubId: String(ghUser.id),
        connectedAt: new Date(),
      },
    });

    // Log activity
    await Activity.create({
      user: userId,
      action: 'github_connected',
      details: `Connected GitHub account: ${ghUser.login}`,
    });

    // Redirect to frontend GitHub page
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/github?connected=true`);
  } catch (error) {
    console.error('GitHub OAuth callback error:', error.message);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/github?error=${encodeURIComponent(error.message)}`);
  }
});

// POST /api/github/disconnect — Disconnect GitHub account
router.post('/disconnect', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      github: {
        connected: false,
        accessToken: '',
        username: '',
        profileUrl: '',
        avatarUrl: '',
        githubId: '',
        connectedAt: null,
      },
    });
    res.json({ message: 'GitHub account disconnected' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/github/status — Check GitHub connection status
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.github?.connected) {
      return res.json({ connected: false });
    }

    // Verify token is still valid
    try {
      const ghUser = await gh.getGitHubUser(user.github.accessToken);
      res.json({
        connected: true,
        username: ghUser.login,
        avatarUrl: ghUser.avatar_url,
        profileUrl: ghUser.html_url,
        publicRepos: ghUser.public_repos,
        followers: ghUser.followers,
        following: ghUser.following,
        bio: ghUser.bio,
        company: ghUser.company,
        location: ghUser.location,
        connectedAt: user.github.connectedAt,
      });
    } catch {
      // Token expired/revoked
      await User.findByIdAndUpdate(req.user._id, { 'github.connected': false, 'github.accessToken': '' });
      res.json({ connected: false, reason: 'token_expired' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REPOSITORIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Middleware: require GitHub connected
function requireGitHub(req, res, next) {
  if (!req.user.github?.connected || !req.user.github?.accessToken) {
    return res.status(403).json({ message: 'GitHub account not connected' });
  }
  req.ghToken = req.user.github.accessToken;
  next();
}

// GET /api/github/repos — List user's GitHub repos
router.get('/repos', auth, requireGitHub, async (req, res) => {
  try {
    const { page = 1, perPage = 30, sort = 'updated' } = req.query;
    const repos = await gh.listUserRepos(req.ghToken, { page: +page, perPage: +perPage, sort });

    // Mark which repos are already linked to projects
    const linkedProjects = await Project.find({
      'github.repoFullName': { $ne: '' },
      $or: [{ owner: req.user._id }, { 'members.user': req.user._id }],
    }).select('github.repoFullName name _id');

    const linkedMap = {};
    linkedProjects.forEach((p) => {
      if (p.github?.repoFullName) linkedMap[p.github.repoFullName] = { projectId: p._id, projectName: p.name };
    });

    const formatted = repos.map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      private: r.private,
      url: r.html_url,
      language: r.language,
      stars: r.stargazers_count,
      forks: r.forks_count,
      openIssues: r.open_issues_count,
      defaultBranch: r.default_branch,
      updatedAt: r.updated_at,
      pushedAt: r.pushed_at,
      linkedProject: linkedMap[r.full_name] || null,
    }));

    res.json(formatted);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

// POST /api/github/repos — Create a new GitHub repo
router.post('/repos', auth, requireGitHub, async (req, res) => {
  try {
    const { name, description, isPrivate, autoInit } = req.body;
    const repo = await gh.createRepo(req.ghToken, { name, description, isPrivate, autoInit });
    res.status(201).json({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      url: repo.html_url,
      private: repo.private,
      defaultBranch: repo.default_branch,
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

// GET /api/github/repos/:owner/:repo/stats — Detailed repo stats
router.get('/repos/:owner/:repo/stats', auth, requireGitHub, async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const stats = await gh.getRepoStats(req.ghToken, owner, repo);
    res.json(stats);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

// POST /api/github/repos/link — Link a GitHub repo to a project
router.post(
  '/repos/link',
  auth,
  requireProjectRoles(['manager', 'admin'], { source: 'body', key: 'projectId' }),
  requireGitHub,
  async (req, res) => {
  try {
    const { projectId, repoFullName } = req.body;
    const [owner, repo] = repoFullName.split('/');

    // Verify repo access
    const repoData = await gh.getRepo(req.ghToken, owner, repo);

    // Update project with GitHub repo info
    const project = await Project.findByIdAndUpdate(
      projectId,
      {
        'github.repoFullName': repoData.full_name,
        'github.repoUrl': repoData.html_url,
        'github.repoId': repoData.id,
        'github.defaultBranch': repoData.default_branch,
        'github.lastSyncedAt': new Date(),
      },
      { new: true }
    );

    // Try to set up webhook (non-blocking)
    try {
      const secret = crypto.randomBytes(20).toString('hex');
      const serverUrl = process.env.GITHUB_CALLBACK_URL?.replace('/api/github/callback', '') || 'http://localhost:5000';
      const webhook = await gh.createWebhook(req.ghToken, owner, repo, {
        webhookUrl: `${serverUrl}/api/github/webhooks`,
        secret,
      });
      await Project.findByIdAndUpdate(projectId, {
        'github.webhookId': webhook.id,
        'github.webhookSecret': secret,
      });
    } catch (webhookErr) {
      console.warn('Webhook creation failed (non-critical):', webhookErr.message);
    }

    await Activity.create({
      user: req.user._id,
      action: 'github_repo_linked',
      projectId,
      details: `Linked GitHub repo: ${repoData.full_name}`,
    });

    res.json({ project, repo: { fullName: repoData.full_name, url: repoData.html_url } });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}
);

// POST /api/github/repos/unlink — Unlink a GitHub repo from a project
router.post(
  '/repos/unlink',
  auth,
  requireProjectRoles(['manager', 'admin'], { source: 'body', key: 'projectId' }),
  requireGitHub,
  async (req, res) => {
  try {
    const { projectId } = req.body;
    const project = await Project.findById(projectId);

    // Remove webhook if exists
    if (project.github?.webhookId && project.github?.repoFullName) {
      const [owner, repo] = project.github.repoFullName.split('/');
      try {
        await gh.deleteWebhook(req.ghToken, owner, repo, project.github.webhookId);
      } catch { /* ignore */ }
    }

    await Project.findByIdAndUpdate(projectId, {
      github: { repoFullName: '', repoUrl: '', repoId: null, defaultBranch: 'main', webhookId: null, webhookSecret: '', lastSyncedAt: null },
    });

    res.json({ message: 'Repository unlinked' });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ISSUES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/github/projects/:projectId/issues — List issues for linked repo
router.get(
  '/projects/:projectId/issues',
  auth,
  requireProjectRoles(['member', 'manager', 'admin'], { source: 'params', key: 'projectId' }),
  requireGitHub,
  async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project?.github?.repoFullName) return res.status(400).json({ message: 'No GitHub repo linked' });

    const [owner, repo] = project.github.repoFullName.split('/');
    const { state = 'open', page = 1 } = req.query;
    const issues = await gh.listIssues(req.ghToken, owner, repo, { state, page: +page });

    // Filter out pull requests (GitHub API returns PRs as issues too)
    const filtered = issues.filter((i) => !i.pull_request).map((i) => ({
      number: i.number,
      title: i.title,
      state: i.state,
      body: i.body,
      url: i.html_url,
      labels: i.labels.map((l) => ({ name: l.name, color: l.color })),
      assignees: i.assignees.map((a) => ({ login: a.login, avatarUrl: a.avatar_url })),
      author: { login: i.user.login, avatarUrl: i.user.avatar_url },
      createdAt: i.created_at,
      updatedAt: i.updated_at,
      comments: i.comments,
    }));

    res.json(filtered);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}
);

// POST /api/github/tasks/:taskId/create-issue — Create GitHub issue from task
router.post(
  '/tasks/:taskId/create-issue',
  auth,
  requireTaskProjectRoles(['manager', 'admin'], { source: 'params', key: 'taskId' }),
  requireGitHub,
  async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const project = await Project.findById(task.projectId);
    if (!project?.github?.repoFullName) return res.status(400).json({ message: 'No GitHub repo linked to project' });

    const [owner, repo] = project.github.repoFullName.split('/');

    // Build issue body
    const priorityEmoji = { low: '🟢', medium: '🟡', high: '🟠', urgent: '🔴' };
    const body = [
      `## ${task.title}`,
      '',
      task.description || '_No description_',
      '',
      `---`,
      `**Priority:** ${priorityEmoji[task.priority] || '⚪'} ${task.priority}`,
      `**Status:** ${task.status}`,
      task.dueDate ? `**Due:** ${new Date(task.dueDate).toLocaleDateString()}` : '',
      '',
      `> _Synced from EnterprisePM — Task ID: ${task._id}_`,
    ].filter(Boolean).join('\n');

    // Map priority to labels
    const labels = [`priority:${task.priority}`];
    if (task.status === 'todo') labels.push('todo');

    const issue = await gh.createIssue(req.ghToken, owner, repo, {
      title: task.title,
      body,
      labels,
    });

    // Update task with GitHub issue info
    await Task.findByIdAndUpdate(task._id, {
      'github.issueNumber': issue.number,
      'github.issueUrl': issue.html_url,
      'github.issueState': issue.state,
    });

    await Activity.create({
      user: req.user._id,
      action: 'github_issue_created',
      projectId: project._id,
      taskId: task._id,
      details: `Created GitHub issue #${issue.number}: ${task.title}`,
    });

    res.status(201).json({
      issueNumber: issue.number,
      issueUrl: issue.html_url,
      issueState: issue.state,
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}
);

// POST /api/github/tasks/:taskId/sync-issue — Sync task status with GitHub issue
router.post(
  '/tasks/:taskId/sync-issue',
  auth,
  requireTaskProjectRoles(['manager', 'admin'], { source: 'params', key: 'taskId' }),
  requireGitHub,
  async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task?.github?.issueNumber) return res.status(400).json({ message: 'No linked GitHub issue' });

    const project = await Project.findById(task.projectId);
    const [owner, repo] = project.github.repoFullName.split('/');

    // Sync: if task is 'done', close the issue; otherwise open it
    const ghState = task.status === 'done' ? 'closed' : 'open';
    await gh.updateIssue(req.ghToken, owner, repo, task.github.issueNumber, { state: ghState });

    await Task.findByIdAndUpdate(task._id, { 'github.issueState': ghState });

    res.json({ synced: true, issueState: ghState });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}
);

// POST /api/github/projects/:projectId/bulk-create-issues — Create issues for all tasks
router.post(
  '/projects/:projectId/bulk-create-issues',
  auth,
  requireProjectRoles(['manager', 'admin'], { source: 'params', key: 'projectId' }),
  requireGitHub,
  async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project?.github?.repoFullName) return res.status(400).json({ message: 'No GitHub repo linked' });

    const [owner, repo] = project.github.repoFullName.split('/');
    const tasks = await Task.find({ projectId: project._id, 'github.issueNumber': { $exists: false } });

    const results = [];
    for (const task of tasks) {
      try {
        const issue = await gh.createIssue(req.ghToken, owner, repo, {
          title: task.title,
          body: task.description || '_No description_',
          labels: [`priority:${task.priority}`],
        });
        await Task.findByIdAndUpdate(task._id, {
          'github.issueNumber': issue.number,
          'github.issueUrl': issue.html_url,
          'github.issueState': issue.state,
        });
        results.push({ taskId: task._id, issueNumber: issue.number, status: 'created' });
      } catch (err) {
        results.push({ taskId: task._id, status: 'failed', error: err.message });
      }
    }

    res.json({ total: tasks.length, results });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PULL REQUESTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/github/projects/:projectId/pulls — List PRs for linked repo
router.get(
  '/projects/:projectId/pulls',
  auth,
  requireProjectRoles(['member', 'manager', 'admin'], { source: 'params', key: 'projectId' }),
  requireGitHub,
  async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project?.github?.repoFullName) return res.status(400).json({ message: 'No GitHub repo linked' });

    const [owner, repo] = project.github.repoFullName.split('/');
    const { state = 'open', page = 1 } = req.query;
    const prs = await gh.listPullRequests(req.ghToken, owner, repo, { state, page: +page });

    const formatted = prs.map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.merged_at ? 'merged' : pr.state,
      body: pr.body,
      url: pr.html_url,
      draft: pr.draft,
      author: { login: pr.user.login, avatarUrl: pr.user.avatar_url },
      head: pr.head.ref,
      base: pr.base.ref,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      reviewers: (pr.requested_reviewers || []).map((r) => ({ login: r.login, avatarUrl: r.avatar_url })),
      labels: pr.labels.map((l) => ({ name: l.name, color: l.color })),
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      mergedAt: pr.merged_at,
    }));

    res.json(formatted);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}
);

// GET /api/github/projects/:projectId/pulls/:prNumber — Detailed PR view
router.get(
  '/projects/:projectId/pulls/:prNumber',
  auth,
  requireProjectRoles(['member', 'manager', 'admin'], { source: 'params', key: 'projectId' }),
  requireGitHub,
  async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project?.github?.repoFullName) return res.status(400).json({ message: 'No GitHub repo linked' });

    const [owner, repo] = project.github.repoFullName.split('/');
    const [pr, reviews, files] = await Promise.all([
      gh.getPullRequest(req.ghToken, owner, repo, req.params.prNumber),
      gh.getPRReviews(req.ghToken, owner, repo, req.params.prNumber),
      gh.getPRFiles(req.ghToken, owner, repo, req.params.prNumber),
    ]);

    res.json({
      number: pr.number,
      title: pr.title,
      state: pr.merged_at ? 'merged' : pr.state,
      body: pr.body,
      url: pr.html_url,
      draft: pr.draft,
      author: { login: pr.user.login, avatarUrl: pr.user.avatar_url },
      head: pr.head.ref,
      base: pr.base.ref,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      mergeable: pr.mergeable,
      reviews: reviews.map((r) => ({
        user: { login: r.user.login, avatarUrl: r.user.avatar_url },
        state: r.state,
        body: r.body,
        submittedAt: r.submitted_at,
      })),
      files: files.map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch?.substring(0, 2000), // limit patch size
      })),
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMMITS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/github/projects/:projectId/commits — List commits
router.get(
  '/projects/:projectId/commits',
  auth,
  requireProjectRoles(['member', 'manager', 'admin'], { source: 'params', key: 'projectId' }),
  requireGitHub,
  async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project?.github?.repoFullName) return res.status(400).json({ message: 'No GitHub repo linked' });

    const [owner, repo] = project.github.repoFullName.split('/');
    const { branch, page = 1 } = req.query;
    const commits = await gh.listCommits(req.ghToken, owner, repo, { sha: branch, page: +page });

    const formatted = commits.map((c) => ({
      sha: c.sha,
      shortSha: c.sha.substring(0, 7),
      message: c.commit.message,
      author: {
        name: c.commit.author.name,
        email: c.commit.author.email,
        login: c.author?.login,
        avatarUrl: c.author?.avatar_url,
      },
      date: c.commit.author.date,
      url: c.html_url,
      stats: c.stats,
    }));

    res.json(formatted);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BRANCHES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/github/projects/:projectId/branches — List branches
router.get(
  '/projects/:projectId/branches',
  auth,
  requireProjectRoles(['member', 'manager', 'admin'], { source: 'params', key: 'projectId' }),
  requireGitHub,
  async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project?.github?.repoFullName) return res.status(400).json({ message: 'No GitHub repo linked' });

    const [owner, repo] = project.github.repoFullName.split('/');
    const branches = await gh.listBranches(req.ghToken, owner, repo);

    res.json(
      branches.map((b) => ({
        name: b.name,
        sha: b.commit.sha,
        protected: b.protected,
        isDefault: b.name === project.github.defaultBranch,
      }))
    );
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}
);

// POST /api/github/tasks/:taskId/create-branch — Create feature branch from task
router.post(
  '/tasks/:taskId/create-branch',
  auth,
  requireTaskProjectRoles(['manager', 'admin'], { source: 'params', key: 'taskId' }),
  requireGitHub,
  async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const project = await Project.findById(task.projectId);
    if (!project?.github?.repoFullName) return res.status(400).json({ message: 'No GitHub repo linked to project' });

    const [owner, repo] = project.github.repoFullName.split('/');

    // Generate branch name from task title
    const branchName = `feature/${task.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50)}`;

    await gh.createBranch(req.ghToken, owner, repo, {
      branchName,
      fromBranch: project.github.defaultBranch || 'main',
    });

    // Update task
    await Task.findByIdAndUpdate(task._id, { 'github.branchName': branchName });

    await Activity.create({
      user: req.user._id,
      action: 'github_branch_created',
      projectId: project._id,
      taskId: task._id,
      details: `Created branch: ${branchName}`,
    });

    res.status(201).json({ branchName });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GITHUB ACTIONS (CI/CD)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/github/projects/:projectId/actions/runs — Workflow runs
router.get(
  '/projects/:projectId/actions/runs',
  auth,
  requireProjectRoles(['member', 'manager', 'admin'], { source: 'params', key: 'projectId' }),
  requireGitHub,
  async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project?.github?.repoFullName) return res.status(400).json({ message: 'No GitHub repo linked' });

    const [owner, repo] = project.github.repoFullName.split('/');
    const { page = 1 } = req.query;
    const data = await gh.listWorkflowRuns(req.ghToken, owner, repo, { page: +page });

    const runs = (data.workflow_runs || []).map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      conclusion: r.conclusion,
      branch: r.head_branch,
      event: r.event,
      url: r.html_url,
      actor: { login: r.actor.login, avatarUrl: r.actor.avatar_url },
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      runNumber: r.run_number,
      duration: r.updated_at && r.created_at
        ? Math.round((new Date(r.updated_at) - new Date(r.created_at)) / 1000)
        : null,
    }));

    res.json({ total: data.total_count, runs });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}
);

// GET /api/github/projects/:projectId/actions/workflows — List workflows
router.get(
  '/projects/:projectId/actions/workflows',
  auth,
  requireProjectRoles(['member', 'manager', 'admin'], { source: 'params', key: 'projectId' }),
  requireGitHub,
  async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project?.github?.repoFullName) return res.status(400).json({ message: 'No GitHub repo linked' });

    const [owner, repo] = project.github.repoFullName.split('/');
    const data = await gh.listWorkflows(req.ghToken, owner, repo);

    res.json(
      (data.workflows || []).map((w) => ({
        id: w.id,
        name: w.name,
        path: w.path,
        state: w.state,
        url: w.html_url,
        badge: w.badge_url,
      }))
    );
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CODE SEARCH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/github/projects/:projectId/search — Search code in repo
router.get(
  '/projects/:projectId/search',
  auth,
  requireProjectRoles(['member', 'manager', 'admin'], { source: 'params', key: 'projectId' }),
  requireGitHub,
  async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project?.github?.repoFullName) return res.status(400).json({ message: 'No GitHub repo linked' });

    const [owner, repo] = project.github.repoFullName.split('/');
    const { q } = req.query;
    if (!q) return res.status(400).json({ message: 'Query parameter "q" required' });

    const results = await gh.searchCode(req.ghToken, owner, repo, q);

    res.json({
      total: results.total_count,
      items: (results.items || []).map((item) => ({
        name: item.name,
        path: item.path,
        url: item.html_url,
        repository: item.repository.full_name,
        score: item.score,
      })),
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// README & FILE CONTENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/github/projects/:projectId/readme — Get README
router.get(
  '/projects/:projectId/readme',
  auth,
  requireProjectRoles(['member', 'manager', 'admin'], { source: 'params', key: 'projectId' }),
  requireGitHub,
  async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project?.github?.repoFullName) return res.status(400).json({ message: 'No GitHub repo linked' });

    const [owner, repo] = project.github.repoFullName.split('/');
    const data = await gh.getFileContent(req.ghToken, owner, repo, 'README.md');

    res.json({ content: data.decodedContent || '', url: data.html_url });
  } catch (error) {
    if (error.status === 404) return res.json({ content: '', url: '' });
    res.status(error.status || 500).json({ message: error.message });
  }
}
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WEBHOOKS (incoming from GitHub)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

router.post('/webhooks', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const event = req.headers['x-github-event'];
    const signature = req.headers['x-hub-signature-256'];
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // Find the project by repo
    const repoFullName = payload.repository?.full_name;
    if (!repoFullName) return res.status(200).send('ok');

    const project = await Project.findOne({ 'github.repoFullName': repoFullName });
    if (!project) return res.status(200).send('ok');

    // Verify webhook signature if secret is configured
    if (project.github.webhookSecret && signature) {
      const hmac = crypto.createHmac('sha256', project.github.webhookSecret);
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const digest = 'sha256=' + hmac.update(rawBody).digest('hex');
      if (signature !== digest) return res.status(401).send('Invalid signature');
    }

    const io = req.app.get('io');

    // Handle different event types
    switch (event) {
      case 'push': {
        const commits = payload.commits || [];
        const branch = payload.ref?.replace('refs/heads/', '');
        io?.to(`project-${project._id}`).emit('github-push', {
          branch,
          commits: commits.map((c) => ({
            sha: c.id?.substring(0, 7),
            message: c.message,
            author: c.author?.name,
            url: c.url,
          })),
          pusher: payload.pusher?.name,
        });

        // Find the project owner for activity logging
        await Activity.create({
          user: project.owner,
          action: 'github_push',
          projectId: project._id,
          details: `${commits.length} commit(s) pushed to ${branch} by ${payload.pusher?.name}`,
        });
        break;
      }

      case 'pull_request': {
        const pr = payload.pull_request;
        const action = payload.action; // opened, closed, merged, etc.

        // If PR was merged, check if it closes any tasks
        if (action === 'closed' && pr.merged) {
          io?.to(`project-${project._id}`).emit('github-pr-merged', {
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
            author: pr.user.login,
          });

          await Activity.create({
            user: project.owner,
            action: 'github_pr_merged',
            projectId: project._id,
            details: `PR #${pr.number} merged: ${pr.title}`,
          });

          // Update linked tasks
          const tasks = await Task.find({
            projectId: project._id,
            'github.branchName': pr.head.ref,
          });
          for (const task of tasks) {
            await Task.findByIdAndUpdate(task._id, {
              $push: {
                'github.linkedPRs': {
                  number: pr.number,
                  title: pr.title,
                  url: pr.html_url,
                  state: 'merged',
                  author: pr.user.login,
                  updatedAt: new Date(),
                },
              },
            });
          }
        } else if (action === 'opened') {
          io?.to(`project-${project._id}`).emit('github-pr-opened', {
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
            author: pr.user.login,
            draft: pr.draft,
          });

          await Activity.create({
            user: project.owner,
            action: 'github_pr_opened',
            projectId: project._id,
            details: `PR #${pr.number} opened: ${pr.title}`,
          });
        }
        break;
      }

      case 'issues': {
        const issue = payload.issue;
        const action = payload.action;

        // Sync issue state changes back to task
        if (action === 'closed' || action === 'reopened') {
          const task = await Task.findOne({
            projectId: project._id,
            'github.issueNumber': issue.number,
          });
          if (task) {
            const newStatus = action === 'closed' ? 'done' : 'todo';
            await Task.findByIdAndUpdate(task._id, {
              status: newStatus,
              'github.issueState': issue.state,
            });
            io?.to(`project-${project._id}`).emit('task-updated', { taskId: task._id, status: newStatus });
          }
        }
        break;
      }

      case 'workflow_run': {
        const run = payload.workflow_run;
        io?.to(`project-${project._id}`).emit('github-action', {
          name: run.name,
          status: run.status,
          conclusion: run.conclusion,
          branch: run.head_branch,
          url: run.html_url,
        });
        break;
      }
    }

    res.status(200).send('ok');
  } catch (error) {
    console.error('Webhook processing error:', error.message);
    res.status(200).send('ok'); // Always 200 so GitHub doesn't disable the webhook
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ACTIVITY FEED (GitHub-specific)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/github/projects/:projectId/activity — GitHub repo events
router.get(
  '/projects/:projectId/activity',
  auth,
  requireProjectRoles(['member', 'manager', 'admin'], { source: 'params', key: 'projectId' }),
  requireGitHub,
  async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project?.github?.repoFullName) return res.status(400).json({ message: 'No GitHub repo linked' });

    const [owner, repo] = project.github.repoFullName.split('/');
    const events = await gh.getRepoEvents(req.ghToken, owner, repo);

    const formatted = events.slice(0, 30).map((e) => ({
      type: e.type,
      actor: { login: e.actor.login, avatarUrl: e.actor.avatar_url },
      createdAt: e.created_at,
      payload: summarizeEvent(e),
    }));

    res.json(formatted);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}
);

// Helper: Summarize GitHub event for display
function summarizeEvent(event) {
  switch (event.type) {
    case 'PushEvent':
      return {
        action: 'pushed',
        branch: event.payload.ref?.replace('refs/heads/', ''),
        commits: event.payload.commits?.length || 0,
        message: event.payload.commits?.[0]?.message || '',
      };
    case 'PullRequestEvent':
      return {
        action: event.payload.action,
        number: event.payload.pull_request?.number,
        title: event.payload.pull_request?.title,
      };
    case 'IssuesEvent':
      return {
        action: event.payload.action,
        number: event.payload.issue?.number,
        title: event.payload.issue?.title,
      };
    case 'CreateEvent':
      return { action: 'created', refType: event.payload.ref_type, ref: event.payload.ref };
    case 'DeleteEvent':
      return { action: 'deleted', refType: event.payload.ref_type, ref: event.payload.ref };
    case 'WatchEvent':
      return { action: 'starred' };
    case 'ForkEvent':
      return { action: 'forked', forkUrl: event.payload.forkee?.html_url };
    default:
      return { action: event.type };
  }
}

module.exports = router;
