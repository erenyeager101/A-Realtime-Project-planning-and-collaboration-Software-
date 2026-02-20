import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getTask, updateTask, deleteTask, addComment } from '../services/taskService';
import { createIssueFromTask, createBranchFromTask, syncTaskIssue } from '../services/githubService';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const statusLabels = { todo: 'Todo', inprogress: 'In Progress', review: 'Review', done: 'Done' };
const statusColors = {
  todo: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  inprogress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  review: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  done: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};
const priorityColors = {
  low: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  medium: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  urgent: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [comment, setComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => { fetchTask(); }, [id]);

  const fetchTask = async () => {
    try {
      const res = await getTask(id);
      setTask(res.data);
      setForm({
        title: res.data.title,
        description: res.data.description,
        status: res.data.status,
        priority: res.data.priority,
        dueDate: res.data.dueDate ? res.data.dueDate.split('T')[0] : '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await updateTask(id, form);
      setTask(res.data);
      setEditing(false);
    } catch (err) { console.error(err); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this task?')) return;
    try { await deleteTask(id); navigate(-1); } catch (err) { console.error(err); }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await addComment(id, { text: comment });
      setTask(res.data);
      setComment('');
    } catch (err) { console.error(err); }
    finally { setSubmittingComment(false); }
  };

  const timeAgo = (date) => {
    const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Navbar />
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Navbar />
        <div className="text-center py-20">
          <h2 className="text-xl text-gray-400">Task not found</h2>
        </div>
      </div>
    );
  }

  const inputClasses = "w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm";
  const selectClasses = "w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-300 outline-none text-sm";

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
          <Link to="/dashboard" className="hover:text-indigo-400 transition">Projects</Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <Link to={`/project/${task.projectId}/board`} className="hover:text-indigo-400 transition">Board</Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-gray-300 font-medium">{task.title}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              {editing ? (
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Title</label>
                    <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClasses} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
                    <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClasses} rows={4} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
                      <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={selectClasses}>
                        <option value="todo">Todo</option>
                        <option value="inprogress">In Progress</option>
                        <option value="review">Review</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Priority</label>
                      <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={selectClasses}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Due Date</label>
                      <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={inputClasses} />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="submit" className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm hover:bg-indigo-500 transition font-medium">
                      Save Changes
                    </button>
                    <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 text-gray-500 text-sm hover:text-gray-300 transition">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <h1 className="text-xl font-bold text-white">{task.title}</h1>
                    <div className="flex gap-3">
                      <button onClick={() => setEditing(true)} className="text-sm text-indigo-400 hover:text-indigo-300 transition font-medium">Edit</button>
                      <button onClick={handleDelete} className="text-sm text-red-400 hover:text-red-300 transition font-medium">Delete</button>
                    </div>
                  </div>
                  <p className="text-gray-500 mt-3 text-sm leading-relaxed">{task.description || 'No description'}</p>
                </>
              )}
            </div>

            {/* Comments */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Comments ({task.comments?.length || 0})
              </h2>

              <form onSubmit={handleAddComment} className="mb-6">
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-indigo-500/20 text-indigo-400 rounded-lg flex items-center justify-center text-sm font-bold border border-indigo-500/10 shrink-0 mt-1">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Write a comment..."
                      className={`${inputClasses} resize-none`}
                      rows={2}
                    />
                    <button
                      type="submit"
                      disabled={submittingComment || !comment.trim()}
                      className="mt-2 bg-indigo-600 text-white px-4 py-1.5 rounded-xl text-sm hover:bg-indigo-500 disabled:opacity-50 transition font-medium"
                    >
                      {submittingComment ? 'Posting...' : 'Post Comment'}
                    </button>
                  </div>
                </div>
              </form>

              <div className="space-y-4">
                {task.comments?.map((c) => (
                  <div key={c._id} className="flex gap-3">
                    <div className="w-8 h-8 bg-white/5 text-gray-400 rounded-lg flex items-center justify-center text-sm font-bold border border-white/5 shrink-0">
                      {c.user?.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-200">{c.user?.name || 'Unknown'}</span>
                        <span className="text-xs text-gray-600">{timeAgo(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wider">Details</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-600 mb-1.5">Status</p>
                  <span className={`inline-block text-xs px-3 py-1 rounded-full font-medium border ${statusColors[task.status]}`}>
                    {statusLabels[task.status]}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1.5">Priority</p>
                  <span className={`inline-block text-xs px-3 py-1 rounded-full font-medium border ${priorityColors[task.priority]}`}>
                    {task.priority}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1.5">Assignee</p>
                  <p className="text-sm text-gray-300">{task.assignee?.name || 'Unassigned'}</p>
                </div>
                {task.dueDate && (
                  <div>
                    <p className="text-xs text-gray-600 mb-1.5">Due Date</p>
                    <p className="text-sm text-gray-300">{new Date(task.dueDate).toLocaleDateString()}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-600 mb-1.5">Created</p>
                  <p className="text-sm text-gray-300">{new Date(task.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* GitHub Actions */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wider flex items-center gap-2">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.333-1.754-1.333-1.754-1.089-.745.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.834 2.809 1.304 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" /></svg>
                GitHub
              </h3>
              <div className="space-y-2">
                {task.github?.issueNumber ? (
                  <div>
                    <a href={task.github.issueUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition">
                      <span className={task.github.issueState === 'open' ? 'text-emerald-400' : 'text-purple-400'}>●</span>
                      Issue #{task.github.issueNumber}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                    <button
                      onClick={async () => { try { await syncTaskIssue(task._id); fetchTask(); } catch(e) { console.error(e); } }}
                      className="mt-1.5 text-xs text-gray-500 hover:text-gray-300 transition"
                    >
                      🔄 Sync Status
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={async () => { try { await createIssueFromTask(task._id); fetchTask(); } catch(e) { alert(e.response?.data?.message || 'Failed'); } }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-gray-400 hover:text-white hover:bg-white/[0.06] transition"
                  >
                    📋 Create GitHub Issue
                  </button>
                )}
                {task.github?.branchName ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="text-emerald-400">🌿</span>
                    <code className="font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded text-[11px]">{task.github.branchName}</code>
                  </div>
                ) : (
                  <button
                    onClick={async () => { try { await createBranchFromTask(task._id); fetchTask(); } catch(e) { alert(e.response?.data?.message || 'Failed'); } }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-gray-400 hover:text-white hover:bg-white/[0.06] transition"
                  >
                    🌿 Create Feature Branch
                  </button>
                )}
                {task.github?.linkedPRs?.length > 0 && (
                  <div className="pt-2 border-t border-white/[0.06]">
                    <p className="text-xs text-gray-600 mb-1.5">Linked PRs</p>
                    {task.github.linkedPRs.map((pr) => (
                      <a key={pr.number} href={pr.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-gray-400 hover:text-indigo-400 transition py-0.5">
                        <span className={pr.state === 'merged' ? 'text-purple-400' : pr.state === 'open' ? 'text-emerald-400' : 'text-red-400'}>🔀</span>
                        #{pr.number} {pr.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
