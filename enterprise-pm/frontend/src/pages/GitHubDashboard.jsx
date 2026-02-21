import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import {
  getGitHubStatus,
  getConnectUrl,
  disconnectGitHub,
  listRepos,
  createRepo,
  linkRepo,
  unlinkRepo,
} from '../services/githubService';
import { getProjects } from '../services/projectService';

export default function GitHubDashboard() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [repos, setRepos] = useState([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [linkModal, setLinkModal] = useState(null);
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', isPrivate: false });
  const [search, setSearch] = useState('');
  const [notification, setNotification] = useState('');

  useEffect(() => {
    fetchStatus();
    fetchProjects();
    if (searchParams.get('connected') === 'true') {
      setNotification('GitHub account connected successfully!');
      setTimeout(() => setNotification(''), 4000);
    }
    if (searchParams.get('error')) {
      setNotification(`Error: ${searchParams.get('error')}`);
      setTimeout(() => setNotification(''), 6000);
    }
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await getGitHubStatus();
      setStatus(res.data);
      if (res.data.connected) fetchRepos();
    } catch { setStatus({ connected: false }); }
    finally { setLoading(false); }
  };

  const fetchRepos = async () => {
    setReposLoading(true);
    try {
      const res = await listRepos();
      setRepos(res.data);
    } catch (err) { console.error(err); }
    finally { setReposLoading(false); }
  };

  const fetchProjects = async () => {
    try {
      const res = await getProjects();
      setProjects(res.data);
    } catch (err) { console.error(err); }
  };

  const handleConnect = async () => {
    try {
      const res = await getConnectUrl();
      window.location.href = res.data.url;
    } catch (err) { console.error(err); }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect your GitHub account? Linked repos will remain but syncing will stop.')) return;
    try {
      await disconnectGitHub();
      setStatus({ connected: false });
      setRepos([]);
    } catch (err) { console.error(err); }
  };

  const handleLinkRepo = async (repo) => {
    setLinkModal(repo);
  };

  const confirmLink = async (projectId) => {
    try {
      await linkRepo({ projectId, repoFullName: linkModal.fullName });
      setLinkModal(null);
      fetchRepos();
      setNotification(`Linked ${linkModal.fullName} to project!`);
      setTimeout(() => setNotification(''), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to link');
    }
  };

  const handleUnlink = async (projectId) => {
    if (!window.confirm('Unlink this repository?')) return;
    try {
      await unlinkRepo({ projectId });
      fetchRepos();
    } catch (err) { console.error(err); }
  };

  const handleCreateRepo = async (e) => {
    e.preventDefault();
    try {
      await createRepo(createForm);
      setCreateModal(false);
      setCreateForm({ name: '', description: '', isPrivate: false });
      fetchRepos();
      setNotification('Repository created successfully!');
      setTimeout(() => setNotification(''), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create repo');
    }
  };

  const filteredRepos = repos.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.fullName.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />

      {/* Notification toast */}
      {notification && (
        <div className="fixed top-20 right-4 z-50 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-5 py-3 rounded-xl text-sm font-medium backdrop-blur-lg animate-[fadeIn_0.3s]">
          {notification}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.333-1.754-1.333-1.754-1.089-.745.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.834 2.809 1.304 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">GitHub Integration</h1>
              <p className="text-gray-500 text-sm">
                {status?.connected
                  ? `Connected as @${status.username}`
                  : 'Connect your GitHub account to supercharge your workflow'}
              </p>
            </div>
          </div>

          {status?.connected ? (
            <div className="flex items-center gap-3">
              <a
                href={status.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-gray-300 hover:bg-white/[0.06] transition"
              >
                <img src={status.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                @{status.username}
              </a>
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl hover:bg-red-500/20 transition"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              className="flex items-center gap-2 px-6 py-2.5 bg-white text-black font-semibold text-sm rounded-xl hover:bg-gray-200 transition shadow-lg"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.333-1.754-1.333-1.754-1.089-.745.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.834 2.809 1.304 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" />
              </svg>
              Connect GitHub
            </button>
          )}
        </div>

        {/* Not connected state */}
        {!status?.connected && (
          <div className="mt-16">
            <div className="max-w-2xl mx-auto text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-gray-700 to-gray-900 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.333-1.754-1.333-1.754-1.089-.745.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.834 2.809 1.304 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-white mb-3">Connect GitHub to EnterprisePM</h2>
              <p className="text-gray-400 text-lg mb-8">
                Link your repositories, sync issues with tasks, track pull requests, monitor CI/CD pipelines, and more — all from one place.
              </p>

              {/* Feature grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left mb-10">
                {[
                  { icon: '🔗', title: 'Link Repos to Projects', desc: 'Connect any GitHub repo to your EnterprisePM projects' },
                  { icon: '📋', title: 'Sync Issues & Tasks', desc: 'Create GitHub issues from tasks, auto-sync statuses' },
                  { icon: '🔀', title: 'Pull Request Tracking', desc: 'View PRs, reviews, and merge status in real-time' },
                  { icon: '📝', title: 'Commit History', desc: 'Browse commits, track who changed what and when' },
                  { icon: '🌿', title: 'Branch Management', desc: 'Create feature branches directly from tasks' },
                  { icon: '⚡', title: 'CI/CD Pipeline Status', desc: 'Monitor GitHub Actions workflow runs and builds' },
                  { icon: '🔍', title: 'Code Search', desc: 'Search code across your linked repositories' },
                  { icon: '🔔', title: 'Real-time Webhooks', desc: 'Get instant updates on pushes, PRs, and deployments' },
                ].map((f) => (
                  <div key={f.title} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-start gap-3">
                    <span className="text-xl mt-0.5">{f.icon}</span>
                    <div>
                      <h3 className="text-white font-medium text-sm">{f.title}</h3>
                      <p className="text-gray-500 text-xs mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleConnect}
                className="inline-flex items-center gap-3 px-8 py-3.5 bg-white text-black font-bold rounded-2xl hover:bg-gray-200 transition shadow-xl text-lg"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.333-1.754-1.333-1.754-1.089-.745.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.834 2.809 1.304 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" />
                </svg>
                Connect with GitHub
              </button>
            </div>
          </div>
        )}

        {/* Connected state */}
        {status?.connected && (
          <>
            {/* GitHub Profile Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Public Repos', value: status.publicRepos || 0, icon: '📦' },
                { label: 'Followers', value: status.followers || 0, icon: '👥' },
                { label: 'Following', value: status.following || 0, icon: '👤' },
                { label: 'Linked Repos', value: repos.filter((r) => r.linkedProject).length, icon: '🔗' },
              ].map((s) => (
                <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">{s.label}</p>
                      <p className="text-2xl font-bold text-white mt-1">{s.value}</p>
                    </div>
                    <span className="text-2xl">{s.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions bar */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-md">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search repositories..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
                  />
                </div>
                <button
                  onClick={fetchRepos}
                  className="p-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-gray-400 hover:text-white hover:bg-white/[0.06] transition"
                  title="Refresh"
                >
                  <svg className={`w-4 h-4 ${reposLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => setCreateModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-medium rounded-xl hover:from-emerald-500 hover:to-green-500 transition shadow-lg shadow-emerald-500/20"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Repository
              </button>
            </div>

            {/* Repository grid */}
            {reposLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRepos.map((repo) => (
                  <div
                    key={repo.id}
                    className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.05] transition group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <a
                            href={repo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 font-semibold text-sm truncate"
                          >
                            {repo.name}
                          </a>
                          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${repo.private ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                            {repo.private ? 'Private' : 'Public'}
                          </span>
                        </div>
                        <p className="text-gray-500 text-xs mt-1 line-clamp-2">{repo.description || 'No description'}</p>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                      {repo.language && (
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                          {repo.language}
                        </span>
                      )}
                      <span className="flex items-center gap-1">⭐ {repo.stars}</span>
                      <span className="flex items-center gap-1">🔀 {repo.forks}</span>
                      <span className="flex items-center gap-1">🔴 {repo.openIssues}</span>
                    </div>

                    {/* Link/Unlink actions */}
                    {repo.linkedProject ? (
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06]">
                        <Link
                          to={`/project/${repo.linkedProject.projectId}`}
                          className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300"
                        >
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                          Linked to: {repo.linkedProject.projectName}
                        </Link>
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/project/${repo.linkedProject.projectId}/github`}
                            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                          >
                            View →
                          </Link>
                          <button
                            onClick={() => handleUnlink(repo.linkedProject.projectId)}
                            className="text-xs text-gray-500 hover:text-red-400 transition"
                          >
                            Unlink
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleLinkRepo(repo)}
                        className="w-full mt-3 pt-3 border-t border-white/[0.06] text-xs text-gray-400 hover:text-indigo-400 transition text-center font-medium"
                      >
                        + Link to a Project
                      </button>
                    )}
                  </div>
                ))}

                {filteredRepos.length === 0 && (
                  <div className="col-span-full py-20 text-center">
                    <p className="text-gray-500 text-sm">
                      {search ? 'No repositories match your search' : 'No repositories found'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Link to Project Modal */}
      {linkModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-white/[0.06]">
              <h3 className="text-lg font-bold text-white">Link Repository</h3>
              <p className="text-gray-500 text-sm mt-1">
                Link <span className="text-indigo-400">{linkModal.fullName}</span> to a project
              </p>
            </div>
            <div className="p-6 space-y-2 max-h-80 overflow-y-auto">
              {projects.filter((p) => !repos.some((r) => r.linkedProject?.projectId === p._id)).length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">All projects are already linked to repos</p>
              ) : (
                projects
                  .filter((p) => !repos.some((r) => r.linkedProject?.projectId === p._id))
                  .map((p) => (
                    <button
                      key={p._id}
                      onClick={() => confirmLink(p._id)}
                      className="w-full text-left p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-indigo-500/10 hover:border-indigo-500/30 transition"
                    >
                      <p className="text-white text-sm font-medium">{p.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5 truncate">{p.description || 'No description'}</p>
                    </button>
                  ))
              )}
            </div>
            <div className="p-4 border-t border-white/[0.06] flex justify-end">
              <button
                onClick={() => setLinkModal(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Repo Modal */}
      {createModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <form onSubmit={handleCreateRepo}>
              <div className="p-6 border-b border-white/[0.06]">
                <h3 className="text-lg font-bold text-white">Create New Repository</h3>
                <p className="text-gray-500 text-sm mt-1">Create a new GitHub repository</p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs text-gray-400 font-medium mb-1.5 block">Repository Name</label>
                  <input
                    type="text"
                    required
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-indigo-500/50"
                    placeholder="my-awesome-project"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium mb-1.5 block">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-indigo-500/50 resize-none"
                    placeholder="A short description..."
                  />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createForm.isPrivate}
                    onChange={(e) => setCreateForm({ ...createForm, isPrivate: e.target.checked })}
                    className="w-4 h-4 rounded bg-white/5 border-white/10 text-indigo-500 focus:ring-indigo-500/30"
                  />
                  <span className="text-sm text-gray-300">Private repository</span>
                </label>
              </div>
              <div className="p-4 border-t border-white/[0.06] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateModal(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-500 transition"
                >
                  Create Repository
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
