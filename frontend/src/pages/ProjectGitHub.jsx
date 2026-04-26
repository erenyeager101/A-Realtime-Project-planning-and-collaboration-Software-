import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getProject } from '../services/projectService';
import {
  listIssues,
  listPullRequests,
  listCommits,
  listBranches,
  listWorkflowRuns,
  searchCode,
  getRepoStats,
  getReadme,
  getGitHubActivity,
  bulkCreateIssues,
} from '../services/githubService';

const TABS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'issues', label: 'Issues', icon: '📋' },
  { id: 'pulls', label: 'Pull Requests', icon: '🔀' },
  { id: 'commits', label: 'Commits', icon: '📝' },
  { id: 'branches', label: 'Branches', icon: '🌿' },
  { id: 'actions', label: 'Actions', icon: '⚡' },
  { id: 'search', label: 'Code Search', icon: '🔍' },
];

export default function ProjectGitHub() {
  const { id: projectId } = useParams();
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Tab data
  const [stats, setStats] = useState(null);
  const [readme, setReadme] = useState('');
  const [issues, setIssues] = useState([]);
  const [pulls, setPulls] = useState([]);
  const [commits, setCommits] = useState([]);
  const [branches, setBranches] = useState([]);
  const [runs, setRuns] = useState({ total: 0, runs: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [activity, setActivity] = useState([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [issueState, setIssueState] = useState('open');
  const [prState, setPrState] = useState('open');
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  useEffect(() => {
    if (project?.github?.repoFullName) loadTab(tab);
  }, [tab, project, issueState, prState]);

  const fetchProject = async () => {
    try {
      const res = await getProject(projectId);
      setProject(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadTab = async (t) => {
    if (!project?.github?.repoFullName) return;
    const [owner, repo] = project.github.repoFullName.split('/');
    setTabLoading(true);
    try {
      switch (t) {
        case 'overview': {
          const [s, r, a] = await Promise.all([
            getRepoStats(owner, repo).then((r) => r.data),
            getReadme(projectId).then((r) => r.data),
            getGitHubActivity(projectId).then((r) => r.data).catch(() => []),
          ]);
          setStats(s);
          setReadme(r.content || '');
          setActivity(a);
          break;
        }
        case 'issues':
          setIssues((await listIssues(projectId, { state: issueState })).data);
          break;
        case 'pulls':
          setPulls((await listPullRequests(projectId, { state: prState })).data);
          break;
        case 'commits':
          setCommits((await listCommits(projectId)).data);
          break;
        case 'branches':
          setBranches((await listBranches(projectId)).data);
          break;
        case 'actions':
          setRuns((await listWorkflowRuns(projectId)).data);
          break;
      }
    } catch (err) { console.error(err); }
    finally { setTabLoading(false); }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setTabLoading(true);
    try {
      const res = await searchCode(projectId, searchQuery);
      setSearchResults(res.data);
    } catch (err) { console.error(err); }
    finally { setTabLoading(false); }
  };

  const handleBulkIssues = async () => {
    if (!window.confirm('Create GitHub issues for all tasks without linked issues?')) return;
    setBulkLoading(true);
    try {
      const res = await bulkCreateIssues(projectId);
      alert(`Created ${res.data.results.filter((r) => r.status === 'created').length} issues!`);
      loadTab('issues');
    } catch (err) { console.error(err); }
    finally { setBulkLoading(false); }
  };

  const timeAgo = (date) => {
    const s = Math.floor((Date.now() - new Date(date)) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

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

  if (!project?.github?.repoFullName) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-gray-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.333-1.754-1.333-1.754-1.089-.745.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.834 2.809 1.304 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" /></svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No Repository Linked</h2>
          <p className="text-gray-500 text-sm mb-6">Link a GitHub repository to this project to enable code tracking, issue sync, PR monitoring, and more.</p>
          <Link to="/github" className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-black font-semibold text-sm rounded-xl hover:bg-gray-200 transition">
            Go to GitHub Settings →
          </Link>
        </div>
      </div>
    );
  }

  const [owner, repoName] = project.github.repoFullName.split('/');

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 text-sm text-gray-500 mb-1">
              <Link to={`/project/${projectId}`} className="hover:text-indigo-400 transition">{project.name}</Link>
              <span>/</span>
              <span className="text-gray-400">GitHub</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white">{project.github.repoFullName}</h1>
              <a href={project.github.repoUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-indigo-400 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-white/[0.06] pb-0.5 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition whitespace-nowrap ${tab === t.id ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'}`}
            >
              <span className="text-sm">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tabLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ═══ OVERVIEW TAB ═══ */}
            {tab === 'overview' && stats && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Repo Stats */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Stats cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Stars', value: stats.stars, icon: '⭐' },
                      { label: 'Forks', value: stats.forks, icon: '🔀' },
                      { label: 'Open Issues', value: stats.openIssues, icon: '🔴' },
                      { label: 'Size', value: `${(stats.size / 1024).toFixed(1)} MB`, icon: '💾' },
                    ].map((s) => (
                      <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                        <span className="text-lg">{s.icon}</span>
                        <p className="text-lg font-bold text-white mt-1">{s.value}</p>
                        <p className="text-gray-500 text-xs">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Languages */}
                  {stats.languages && Object.keys(stats.languages).length > 0 && (
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                      <h3 className="text-white font-semibold text-sm mb-3">Languages</h3>
                      <div className="flex rounded-full overflow-hidden h-2.5 mb-3">
                        {(() => {
                          const total = Object.values(stats.languages).reduce((a, b) => a + b, 0);
                          const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500', 'bg-cyan-500', 'bg-pink-500', 'bg-teal-500'];
                          return Object.entries(stats.languages).map(([lang, bytes], i) => (
                            <div key={lang} className={`${colors[i % colors.length]}`} style={{ width: `${(bytes / total) * 100}%` }} title={`${lang}: ${((bytes / total) * 100).toFixed(1)}%`} />
                          ));
                        })()}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {(() => {
                          const total = Object.values(stats.languages).reduce((a, b) => a + b, 0);
                          const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500', 'bg-cyan-500', 'bg-pink-500', 'bg-teal-500'];
                          return Object.entries(stats.languages).map(([lang, bytes], i) => (
                            <span key={lang} className="flex items-center gap-1.5 text-xs text-gray-400">
                              <span className={`w-2 h-2 rounded-full ${colors[i % colors.length]}`} />
                              {lang} <span className="text-gray-600">{((bytes / total) * 100).toFixed(1)}%</span>
                            </span>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {/* README */}
                  {readme && (
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                      <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">📄 README.md</h3>
                      <div className="prose prose-invert prose-sm max-w-none text-gray-300">
                        <pre className="text-xs bg-white/[0.03] rounded-xl p-4 overflow-x-auto whitespace-pre-wrap">{readme.substring(0, 3000)}</pre>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  {/* Contributors */}
                  {stats.contributors?.length > 0 && (
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                      <h3 className="text-white font-semibold text-sm mb-3">Contributors ({stats.contributors.length})</h3>
                      <div className="space-y-2">
                        {stats.contributors.slice(0, 10).map((c) => (
                          <a key={c.login} href={c.profileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition">
                            <img src={c.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-300 text-xs font-medium truncate">{c.login}</p>
                              <p className="text-gray-600 text-[10px]">{c.contributions} commits</p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Activity */}
                  {activity.length > 0 && (
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                      <h3 className="text-white font-semibold text-sm mb-3">Recent Activity</h3>
                      <div className="space-y-3">
                        {activity.slice(0, 8).map((e, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <img src={e.actor.avatarUrl} alt="" className="w-5 h-5 rounded-full mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-400 text-xs">
                                <span className="text-gray-300 font-medium">{e.actor.login}</span>{' '}
                                {e.payload.action === 'pushed' && `pushed ${e.payload.commits} commit(s) to ${e.payload.branch}`}
                                {e.payload.action === 'opened' && `opened PR #${e.payload.number}`}
                                {e.payload.action === 'closed' && `closed #${e.payload.number}`}
                                {e.payload.action === 'created' && `created ${e.payload.refType} ${e.payload.ref || ''}`}
                                {e.payload.action === 'starred' && 'starred the repo'}
                                {!['pushed', 'opened', 'closed', 'created', 'starred'].includes(e.payload.action) && e.payload.action}
                              </p>
                              <p className="text-gray-600 text-[10px]">{timeAgo(e.createdAt)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Info */}
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                    <h3 className="text-white font-semibold text-sm mb-3">Info</h3>
                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between"><span className="text-gray-500">Visibility</span><span className="text-gray-300">{stats.visibility}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Default Branch</span><span className="text-gray-300">{stats.defaultBranch}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Created</span><span className="text-gray-300">{new Date(stats.createdAt).toLocaleDateString()}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Last Push</span><span className="text-gray-300">{timeAgo(stats.pushedAt)}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ ISSUES TAB ═══ */}
            {tab === 'issues' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {['open', 'closed', 'all'].map((s) => (
                      <button key={s} onClick={() => setIssueState(s)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${issueState === s ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-gray-500 hover:text-gray-300 bg-white/[0.03] border border-white/[0.06]'}`}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleBulkIssues} disabled={bulkLoading} className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium rounded-xl hover:bg-emerald-600/30 transition disabled:opacity-50">
                    {bulkLoading ? '⏳ Creating...' : '📋 Sync All Tasks → Issues'}
                  </button>
                </div>
                <div className="space-y-2">
                  {issues.map((issue) => (
                    <a key={issue.number} href={issue.url} target="_blank" rel="noopener noreferrer" className="block bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] transition">
                      <div className="flex items-start gap-3">
                        <span className={`mt-1 ${issue.state === 'open' ? 'text-emerald-400' : 'text-purple-400'}`}>
                          {issue.state === 'open' ? (
                            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><path d="M8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/><path fillRule="evenodd" d="M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z"/></svg>
                          ) : (
                            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><path d="M11.28 6.78a.75.75 0 00-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l3.5-3.5z"/><path fillRule="evenodd" d="M16 8A8 8 0 110 8a8 8 0 0116 0zm-1.5 0a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"/></svg>
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white text-sm font-medium">{issue.title}</span>
                            {issue.labels.map((l) => (
                              <span key={l.name} className="px-2 py-0.5 text-[10px] rounded-full border" style={{ borderColor: `#${l.color}40`, color: `#${l.color}`, backgroundColor: `#${l.color}15` }}>
                                {l.name}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span>#{issue.number}</span>
                            <span>opened {timeAgo(issue.createdAt)}</span>
                            <span>by {issue.author.login}</span>
                            {issue.comments > 0 && <span>💬 {issue.comments}</span>}
                          </div>
                        </div>
                        {issue.assignees.length > 0 && (
                          <div className="flex -space-x-1.5">
                            {issue.assignees.map((a) => (
                              <img key={a.login} src={a.avatarUrl} alt="" className="w-5 h-5 rounded-full border border-slate-900" title={a.login} />
                            ))}
                          </div>
                        )}
                      </div>
                    </a>
                  ))}
                  {issues.length === 0 && <p className="text-gray-500 text-sm text-center py-12">No {issueState} issues</p>}
                </div>
              </div>
            )}

            {/* ═══ PULL REQUESTS TAB ═══ */}
            {tab === 'pulls' && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  {['open', 'closed', 'all'].map((s) => (
                    <button key={s} onClick={() => setPrState(s)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${prState === s ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-gray-500 hover:text-gray-300 bg-white/[0.03] border border-white/[0.06]'}`}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {pulls.map((pr) => (
                    <a key={pr.number} href={pr.url} target="_blank" rel="noopener noreferrer" className="block bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] transition">
                      <div className="flex items-start gap-3">
                        <span className={`mt-1 ${pr.state === 'merged' ? 'text-purple-400' : pr.state === 'open' ? 'text-emerald-400' : 'text-red-400'}`}>
                          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                            {pr.state === 'merged'
                              ? <path d="M5.45 5.154A4.25 4.25 0 004.75 6.5a4.254 4.254 0 002.08 3.387l-.008.002c.027.013.04.032.04.053v1.808a.75.75 0 01-1.5 0v-1.563A5.753 5.753 0 012.25 6.5a5.755 5.755 0 01.537-2.408.75.75 0 011.134-.32l1.414 1.414a.75.75 0 01-1.06 1.06L4.154 5.154z M10.55 10.846a4.254 4.254 0 00.7-1.346 4.254 4.254 0 00-2.08-3.387l.008-.002a.058.058 0 01-.04-.053V4.25a.75.75 0 011.5 0V5.813A5.753 5.753 0 0113.75 9.5a5.758 5.758 0 01-.537 2.408.75.75 0 01-1.134.32l-1.414-1.414a.75.75 0 011.06-1.06l.825.825v.267z"/>
                              : <path d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z"/>
                            }
                          </svg>
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white text-sm font-medium">{pr.title}</span>
                            {pr.draft && <span className="px-2 py-0.5 text-[10px] bg-gray-500/10 text-gray-400 border border-gray-500/20 rounded-full">Draft</span>}
                            {pr.labels.map((l) => (
                              <span key={l.name} className="px-2 py-0.5 text-[10px] rounded-full border" style={{ borderColor: `#${l.color}40`, color: `#${l.color}`, backgroundColor: `#${l.color}15` }}>
                                {l.name}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span>#{pr.number}</span>
                            <span>{pr.head} → {pr.base}</span>
                            <span>by {pr.author.login}</span>
                            {pr.state === 'merged' && pr.mergedAt && <span className="text-purple-400">merged {timeAgo(pr.mergedAt)}</span>}
                            {pr.additions !== undefined && (
                              <span>
                                <span className="text-emerald-400">+{pr.additions}</span>{' '}
                                <span className="text-red-400">-{pr.deletions}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {pr.reviewers.length > 0 && (
                            <div className="flex -space-x-1.5">
                              {pr.reviewers.map((r) => (
                                <img key={r.login} src={r.avatarUrl} alt="" className="w-5 h-5 rounded-full border border-slate-900" title={r.login} />
                              ))}
                            </div>
                          )}
                          <img src={pr.author.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                        </div>
                      </div>
                    </a>
                  ))}
                  {pulls.length === 0 && <p className="text-gray-500 text-sm text-center py-12">No {prState} pull requests</p>}
                </div>
              </div>
            )}

            {/* ═══ COMMITS TAB ═══ */}
            {tab === 'commits' && (
              <div className="space-y-1">
                {commits.map((c, i) => {
                  const dateStr = new Date(c.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  const prevDate = i > 0 ? new Date(commits[i - 1].date).toLocaleDateString() : null;
                  const curDate = new Date(c.date).toLocaleDateString();
                  const showDate = i === 0 || curDate !== prevDate;

                  return (
                    <div key={c.sha}>
                      {showDate && (
                        <div className="flex items-center gap-3 py-3 mt-2">
                          <div className="h-px bg-white/[0.06] flex-1" />
                          <span className="text-gray-500 text-xs font-medium">{dateStr}</span>
                          <div className="h-px bg-white/[0.06] flex-1" />
                        </div>
                      )}
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition group">
                        {c.author.avatarUrl ? (
                          <img src={c.author.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-[10px] font-bold">
                            {c.author.name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-300 text-sm truncate">{c.message.split('\n')[0]}</p>
                        </div>
                        <code className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded font-mono group-hover:bg-indigo-500/20">
                          {c.shortSha}
                        </code>
                      </a>
                    </div>
                  );
                })}
                {commits.length === 0 && <p className="text-gray-500 text-sm text-center py-12">No commits found</p>}
              </div>
            )}

            {/* ═══ BRANCHES TAB ═══ */}
            {tab === 'branches' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {branches.map((b) => (
                  <div key={b.name} className={`bg-white/[0.03] border rounded-xl p-4 ${b.isDefault ? 'border-emerald-500/30' : 'border-white/[0.06]'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400">🌿</span>
                        <span className="text-white text-sm font-medium">{b.name}</span>
                        {b.isDefault && <span className="px-2 py-0.5 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">default</span>}
                        {b.protected && <span className="px-2 py-0.5 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">protected</span>}
                      </div>
                      <code className="text-xs text-gray-500 font-mono">{b.sha.substring(0, 7)}</code>
                    </div>
                  </div>
                ))}
                {branches.length === 0 && <p className="text-gray-500 text-sm text-center py-12 col-span-full">No branches found</p>}
              </div>
            )}

            {/* ═══ ACTIONS TAB ═══ */}
            {tab === 'actions' && (
              <div>
                {runs.total > 0 && <p className="text-gray-500 text-xs mb-4">{runs.total} workflow runs total</p>}
                <div className="space-y-2">
                  {runs.runs?.map((run) => {
                    const statusColor = {
                      success: 'text-emerald-400',
                      failure: 'text-red-400',
                      cancelled: 'text-gray-400',
                      in_progress: 'text-amber-400',
                      queued: 'text-blue-400',
                    };
                    const statusIcon = {
                      success: '✅',
                      failure: '❌',
                      cancelled: '⚪',
                      in_progress: '🔄',
                      queued: '⏳',
                    };
                    return (
                      <a key={run.id} href={run.url} target="_blank" rel="noopener noreferrer" className="block bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] transition">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{statusIcon[run.conclusion || run.status] || '⚪'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{run.name}</p>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                              <span className={statusColor[run.conclusion || run.status] || ''}>{run.conclusion || run.status}</span>
                              <span>#{run.runNumber}</span>
                              <span>🌿 {run.branch}</span>
                              <span>{run.event}</span>
                              {run.duration && <span>⏱ {run.duration}s</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <img src={run.actor.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                            <span className="text-gray-500 text-xs">{timeAgo(run.createdAt)}</span>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                  {(!runs.runs || runs.runs.length === 0) && <p className="text-gray-500 text-sm text-center py-12">No workflow runs found. Set up GitHub Actions to see CI/CD status here.</p>}
                </div>
              </div>
            )}

            {/* ═══ CODE SEARCH TAB ═══ */}
            {tab === 'search' && (
              <div>
                <form onSubmit={handleSearch} className="flex items-center gap-3 mb-6">
                  <div className="relative flex-1">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search code in this repository..."
                      className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
                    />
                  </div>
                  <button type="submit" className="px-6 py-3 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-500 transition">
                    Search
                  </button>
                </form>

                {searchResults && (
                  <div>
                    <p className="text-gray-500 text-xs mb-4">{searchResults.total} results found</p>
                    <div className="space-y-2">
                      {searchResults.items.map((item, i) => (
                        <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] transition">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-indigo-400">📄</span>
                            <span className="text-white text-sm font-medium">{item.name}</span>
                          </div>
                          <p className="text-gray-500 text-xs font-mono">{item.path}</p>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {!searchResults && (
                  <div className="text-center py-16">
                    <span className="text-4xl mb-4 block">🔍</span>
                    <p className="text-gray-500 text-sm">Search for code, functions, variables, or any text in the repository</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
