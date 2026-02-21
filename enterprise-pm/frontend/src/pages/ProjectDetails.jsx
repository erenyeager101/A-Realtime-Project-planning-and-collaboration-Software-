import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProject, addMember } from '../services/projectService';
import { getTasksByProject } from '../services/taskService';
import Navbar from '../components/Navbar';

export default function ProjectDetails() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [memberEmail, setMemberEmail] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [projRes, taskRes] = await Promise.all([
        getProject(id),
        getTasksByProject(id),
      ]);
      setProject(projRes.data);
      setTasks(taskRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      await addMember(id, { userId: memberEmail });
      setMemberEmail('');
      setShowAddMember(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add member');
    }
  };

  const tasksByStatus = {
    todo: tasks.filter((t) => t.status === 'todo'),
    inprogress: tasks.filter((t) => t.status === 'inprogress'),
    review: tasks.filter((t) => t.status === 'review'),
    done: tasks.filter((t) => t.status === 'done'),
  };

  const completionPct = tasks.length > 0 ? Math.round((tasksByStatus.done.length / tasks.length) * 100) : 0;

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

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Navbar />
        <div className="text-center py-20">
          <h2 className="text-xl text-gray-400">Project not found</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
          <Link to="/dashboard" className="hover:text-indigo-400 transition">Projects</Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-gray-300 font-medium">{project.name}</span>
        </div>

        {/* Project Header */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between flex-col sm:flex-row gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-500/20">
                {project.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{project.name}</h1>
                <p className="text-gray-500 mt-1 max-w-lg">{project.description || 'No description'}</p>
                <div className="flex items-center gap-3 mt-3">
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                    project.status === 'active' ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                    : project.status === 'completed' ? 'bg-blue-400/10 text-blue-400 border border-blue-400/20'
                    : 'bg-gray-400/10 text-gray-400 border border-gray-400/20'
                  }`}>
                    {project.status}
                  </span>
                  <span className="text-xs text-gray-600">{tasks.length} tasks</span>
                  <span className="text-xs text-gray-600">{project.members?.length || 0} members</span>
                </div>
              </div>
            </div>
            <Link
              to={`/project/${id}/board`}
              className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-500 transition text-sm flex items-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
              </svg>
              Kanban Board
            </Link>
          </div>

          {/* Progress bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">Progress</span>
              <span className="text-xs text-gray-400">{completionPct}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 mt-6">
            {[
              { label: 'Todo', count: tasksByStatus.todo.length, color: 'from-gray-500/10 to-slate-500/10 text-gray-400', dot: 'bg-gray-400' },
              { label: 'In Progress', count: tasksByStatus.inprogress.length, color: 'from-blue-500/10 to-indigo-500/10 text-blue-400', dot: 'bg-blue-400' },
              { label: 'Review', count: tasksByStatus.review.length, color: 'from-amber-500/10 to-yellow-500/10 text-amber-400', dot: 'bg-amber-400' },
              { label: 'Done', count: tasksByStatus.done.length, color: 'from-emerald-500/10 to-green-500/10 text-emerald-400', dot: 'bg-emerald-400' },
            ].map((stat) => (
              <div key={stat.label} className={`bg-gradient-to-br ${stat.color} rounded-xl p-4 border border-white/5`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${stat.dot}`} />
                  <span className="text-xs font-medium opacity-70">{stat.label}</span>
                </div>
                <p className="text-2xl font-bold">{stat.count}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { to: `/project/${id}/research`, icon: '💬', label: 'Research AI', gradient: 'from-blue-500/10 to-cyan-500/10', border: 'border-blue-500/10 hover:border-blue-500/30', text: 'text-blue-400' },
            { to: `/project/${id}/docs`, icon: '📄', label: 'Doc Generator', gradient: 'from-purple-500/10 to-pink-500/10', border: 'border-purple-500/10 hover:border-purple-500/30', text: 'text-purple-400' },
            { to: `/project/${id}/health`, icon: '🏥', label: 'Health Check', gradient: 'from-emerald-500/10 to-green-500/10', border: 'border-emerald-500/10 hover:border-emerald-500/30', text: 'text-emerald-400' },
            { to: `/project/${id}/resources`, icon: '📚', label: 'Resource Hub', gradient: 'from-orange-500/10 to-amber-500/10', border: 'border-orange-500/10 hover:border-orange-500/30', text: 'text-orange-400' },
            { to: `/project/${id}/github`, icon: '🐙', label: 'GitHub', gradient: 'from-gray-500/10 to-slate-500/10', border: 'border-gray-500/10 hover:border-gray-500/30', text: 'text-gray-300' },
            { to: '/ai/planner', icon: '🧠', label: 'AI Planner', gradient: 'from-indigo-500/10 to-violet-500/10', border: 'border-indigo-500/10 hover:border-indigo-500/30', text: 'text-indigo-400' },
          ].map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className={`bg-gradient-to-br ${item.gradient} ${item.text} border ${item.border} rounded-xl px-4 py-3 flex items-center gap-3 text-sm font-medium transition-all duration-200 hover:scale-[1.02]`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>

        {/* Members */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Team Members</h2>
            <button
              onClick={() => setShowAddMember(!showAddMember)}
              className="text-sm text-indigo-400 hover:text-indigo-300 transition font-medium"
            >
              + Add Member
            </button>
          </div>

          {showAddMember && (
            <form onSubmit={handleAddMember} className="flex gap-2 mb-4">
              <input
                type="text"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="User ID"
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
              />
              <button
                type="submit"
                className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm hover:bg-indigo-500 transition font-medium"
              >
                Add
              </button>
            </form>
          )}

          <div className="space-y-1">
            {project.members?.map((member) => (
              <div key={member._id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-white/[0.03] transition">
                <div className="w-9 h-9 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 rounded-lg flex items-center justify-center text-sm font-bold border border-indigo-500/10">
                  {member.user?.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{member.user?.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-600">{member.user?.email}</p>
                </div>
                <span className="text-xs bg-white/5 text-gray-500 px-2 py-1 rounded-lg border border-white/5">{member.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
