import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getProjects, createProject, deleteProject } from '../services/projectService';
import { createProjectPack } from '../services/aiService';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(true);

  // Project Pack state
  const [packIdea, setPackIdea] = useState('');
  const [packLoading, setPackLoading] = useState(false);
  const [packStep, setPackStep] = useState(''); // '', 'generating', 'done'

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await getProjects();
      setProjects(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createProject(form);
      setForm({ name: '', description: '' });
      setShowModal(false);
      fetchProjects();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Delete this project?')) return;
    try {
      await deleteProject(id);
      fetchProjects();
    } catch (err) {
      console.error(err);
    }
  };

  const handleProjectPack = async (e) => {
    e.preventDefault();
    if (!packIdea.trim()) return;
    setPackLoading(true);
    setPackStep('generating');
    try {
      const res = await createProjectPack({ idea: packIdea });
      setPackStep('done');
      setPackIdea('');
      fetchProjects();
      // Navigate to the newly created project
      setTimeout(() => {
        navigate(`/project/${res.data.project._id}`);
      }, 1500);
    } catch (err) {
      console.error(err);
      setPackStep('');
    } finally {
      setPackLoading(false);
    }
  };

  const firstName = user?.name?.split(' ')[0] || 'there';
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  const statusColor = {
    active: 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20',
    completed: 'bg-blue-400/10 text-blue-400 border border-blue-400/20',
    archived: 'bg-gray-400/10 text-gray-400 border border-gray-400/20',
  };

  const quickIdeas = [
    'Hospital Management System in MERN',
    'AI-powered E-commerce Platform',
    'Real-time Chat App with Video Calls',
    'Student Attendance Tracking System',
    'Food Delivery App like Zomato',
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">
            {greeting}, {firstName} <span className="inline-block animate-pulse">👋</span>
          </h1>
          <p className="text-gray-500 mt-1">Here's what's happening with your projects</p>
        </div>

        {/* ======= ONE-CLICK PROJECT PACK — HERO ======= */}
        <div className="relative mb-10 rounded-3xl overflow-hidden">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 opacity-90" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />

          <div className="relative px-8 py-10 md:px-12 md:py-14">
            <div className="flex items-start justify-between flex-col lg:flex-row gap-8">
              <div className="flex-1 max-w-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full">
                    ⚡ INSTANT LAUNCH
                  </span>
                  <span className="bg-white/10 backdrop-blur-sm text-white/70 text-xs px-3 py-1 rounded-full">
                    AI-Powered
                  </span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
                  One-Click Project Pack
                </h2>
                <p className="text-white/70 text-lg mb-6 leading-relaxed">
                  Describe your idea and get a complete project — Kanban board with tasks,
                  SRS document, presentation outline, research resources — all in one click.
                </p>

                {/* Input */}
                <form onSubmit={handleProjectPack} className="relative">
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={packIdea}
                        onChange={(e) => setPackIdea(e.target.value)}
                        disabled={packLoading}
                        className="w-full px-5 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 transition text-base disabled:opacity-50"
                        placeholder='e.g. "Hospital Management System in MERN stack"'
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={packLoading || !packIdea.trim()}
                      className="bg-white text-indigo-700 px-8 py-4 rounded-2xl font-bold hover:bg-white/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap shadow-2xl shadow-black/20"
                    >
                      {packStep === 'generating' ? (
                        <>
                          <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-700 rounded-full animate-spin" />
                          Creating...
                        </>
                      ) : packStep === 'done' ? (
                        <>
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          Done!
                        </>
                      ) : (
                        <>
                          <span className="text-lg">⚡</span>
                          Launch Project
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Quick ideas */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="text-white/40 text-xs self-center">Try:</span>
                  {quickIdeas.map((idea) => (
                    <button
                      key={idea}
                      onClick={() => setPackIdea(idea)}
                      className="text-xs bg-white/10 hover:bg-white/20 text-white/70 hover:text-white px-3 py-1.5 rounded-full transition"
                    >
                      {idea}
                    </button>
                  ))}
                </div>

                {/* Progress steps during generation */}
                {packStep === 'generating' && (
                  <div className="mt-6 space-y-2 animate-in fade-in slide-in-from-bottom-3">
                    {[
                      { icon: '🧠', text: 'AI is analyzing your idea...', done: true },
                      { icon: '📋', text: 'Creating project structure & tasks...', done: false },
                      { icon: '📄', text: 'Generating SRS & PPT outline...', done: false },
                      { icon: '📚', text: 'Building research pack...', done: false },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center gap-3 text-white/60 text-sm">
                        <span>{s.icon}</span>
                        <span>{s.text}</span>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right side illustration */}
              <div className="hidden lg:flex flex-col items-center gap-3 opacity-80">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: '📋', label: 'Kanban Board' },
                    { icon: '📄', label: 'SRS Document' },
                    { icon: '🎯', label: 'Task Deadlines' },
                    { icon: '📊', label: 'PPT Outline' },
                    { icon: '📚', label: 'Research Pack' },
                    { icon: '✅', label: 'Demo Checklist' },
                  ].map((item) => (
                    <div key={item.label} className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
                      <span className="text-2xl block mb-1">{item.icon}</span>
                      <span className="text-white/70 text-xs">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ======= PROJECTS SECTION ======= */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Your Projects</h2>
            <p className="text-gray-500 text-sm">{projects.length} project{projects.length !== 1 && 's'}</p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/ai/planner"
              className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-4 py-2 rounded-xl text-sm font-medium hover:bg-purple-500/20 transition flex items-center gap-2"
            >
              🧠 AI Planner
            </Link>
            <button
              onClick={() => setShowModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-500 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 border border-white/5 rounded-2xl bg-white/[0.02]">
            <div className="text-5xl mb-4">🚀</div>
            <h3 className="text-lg font-semibold text-gray-300">No projects yet</h3>
            <p className="text-gray-600 mt-1 mb-4 text-sm">Use the Project Pack above to create your first project instantly</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link
                key={project._id}
                to={`/project/${project._id}`}
                className="group relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300"
              >
                {/* Status dot */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold bg-gradient-to-br ${
                      project.status === 'active' ? 'from-emerald-500/20 to-teal-500/20 text-emerald-400'
                      : project.status === 'completed' ? 'from-blue-500/20 to-indigo-500/20 text-blue-400'
                      : 'from-gray-500/20 to-slate-500/20 text-gray-400'
                    }`}>
                      {project.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold group-hover:text-indigo-400 transition text-sm">
                        {project.name}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[project.status]}`}>
                        {project.status}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(project._id, e)}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <p className="text-gray-500 text-sm line-clamp-2 mb-4 min-h-[2.5rem]">
                  {project.description || 'No description'}
                </p>

                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {project.members?.length || 0}
                  </span>
                  <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-6">Create New Project</h2>
            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Project Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition"
                  placeholder="My Awesome Project"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition"
                  rows={3}
                  placeholder="Describe your project..."
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-gray-400 hover:text-white transition rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-500 transition"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
