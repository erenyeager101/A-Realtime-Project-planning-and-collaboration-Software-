import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getResources, addResource, updateResource, togglePin, deleteResource } from '../services/resourceService';
import { getProject } from '../services/projectService';
import Navbar from '../components/Navbar';

export default function ResourceHub() {
  const { id: projectId } = useParams();
  const [project, setProject] = useState(null);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ type: 'link', title: '', content: '', url: '', tags: '' });

  useEffect(() => { fetchData(); }, [projectId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projRes, resRes] = await Promise.all([getProject(projectId), getResources(projectId)]);
      setProject(projRes.data);
      setResources(resRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) };
      if (editingId) { await updateResource(projectId, editingId, payload); }
      else { await addResource(projectId, payload); }
      setForm({ type: 'link', title: '', content: '', url: '', tags: '' });
      setShowAdd(false);
      setEditingId(null);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleEdit = (r) => {
    setForm({ type: r.type, title: r.title, content: r.content || '', url: r.url || '', tags: r.tags?.join(', ') || '' });
    setEditingId(r._id);
    setShowAdd(true);
  };

  const handlePin = async (id) => { await togglePin(projectId, id); fetchData(); };
  const handleDelete = async (id) => { if (!confirm('Delete this resource?')) return; await deleteResource(projectId, id); fetchData(); };

  const typeIcons = { link: '🔗', note: '📝', snippet: '💻', ai_summary: '🤖', file: '📎' };
  const typeColors = {
    link: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    note: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    snippet: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    ai_summary: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    file: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  };

  const filtered = resources
    .filter(r => filter === 'all' || r.type === filter)
    .filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      return r.title?.toLowerCase().includes(q) || r.content?.toLowerCase().includes(q) || r.tags?.some(t => t.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const inputClasses = "w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm";

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
          <Link to="/dashboard" className="hover:text-indigo-400 transition">Projects</Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <Link to={`/project/${projectId}`} className="hover:text-indigo-400 transition">{project?.name || 'Project'}</Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-gray-300 font-medium">Resource Hub</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">📚</span>
              <h1 className="text-2xl font-bold text-white">Resource Hub</h1>
            </div>
            <p className="text-gray-500">Centralized knowledge base for your project</p>
          </div>
          <button
            onClick={() => { setShowAdd(true); setEditingId(null); setForm({ type: 'link', title: '', content: '', url: '', tags: '' }); }}
            className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm hover:bg-indigo-500 transition flex items-center gap-2 font-medium shadow-lg shadow-indigo-500/10"
          >
            <span className="text-lg">+</span> Add Resource
          </button>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search resources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
          <div className="flex gap-2 flex-wrap">
            {['all', 'link', 'note', 'snippet', 'ai_summary', 'file'].map(t => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
                  filter === t
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-white/[0.03] border-white/[0.06] text-gray-500 hover:bg-white/[0.06]'
                }`}
              >
                {t === 'all' ? '📋 All' : `${typeIcons[t]} ${t.replace('_', ' ')}`}
              </button>
            ))}
          </div>
        </div>

        {/* Add/Edit Modal */}
        {showAdd && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => { setShowAdd(false); setEditingId(null); }}>
            <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-white mb-4">{editingId ? 'Edit Resource' : 'Add Resource'}</h2>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Type</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                    <option value="link">🔗 Link</option>
                    <option value="note">📝 Note</option>
                    <option value="snippet">💻 Code Snippet</option>
                    <option value="ai_summary">🤖 AI Summary</option>
                    <option value="file">📎 File Reference</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Title</label>
                  <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required className={inputClasses} placeholder="Resource title" />
                </div>
                {(form.type === 'link' || form.type === 'file') && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">URL</label>
                    <input type="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className={inputClasses} placeholder="https://..." />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Content / Description</label>
                  <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={form.type === 'snippet' ? 6 : 3}
                    className={`${inputClasses} ${form.type === 'snippet' ? 'font-mono' : ''}`}
                    placeholder={form.type === 'snippet' ? 'Paste your code here...' : 'Add details...'} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Tags (comma separated)</label>
                  <input type="text" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} className={inputClasses} placeholder="react, api, design" />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => { setShowAdd(false); setEditingId(null); }} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300 transition">
                    Cancel
                  </button>
                  <button type="submit" className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm hover:bg-indigo-500 transition font-medium">
                    {editingId ? 'Save Changes' : 'Add Resource'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Resource List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <p className="text-4xl mb-2">📂</p>
            <p className="text-sm">No resources yet. Add links, notes, snippets to build your project knowledge base.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(r => (
              <div
                key={r._id}
                className={`bg-white/[0.03] border rounded-xl p-4 hover:border-white/10 transition group ${
                  r.pinned ? 'ring-1 ring-amber-500/30 border-amber-500/20' : 'border-white/[0.06]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center text-sm shrink-0 ${typeColors[r.type]}`}>
                      {typeIcons[r.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {r.pinned && <span className="text-amber-500 text-xs">📌</span>}
                        <h3 className="font-semibold text-gray-200 text-sm truncate">
                          {r.url ? (
                            <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-indigo-400 transition">{r.title}</a>
                          ) : r.title}
                        </h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${typeColors[r.type]}`}>
                          {r.type.replace('_', ' ')}
                        </span>
                      </div>
                      {r.content && (
                        <p className={`text-xs text-gray-500 mt-1 ${r.type === 'snippet' ? 'font-mono bg-white/[0.03] p-2 rounded-lg border border-white/5 overflow-x-auto' : 'line-clamp-2'}`}>
                          {r.content.length > 300 ? r.content.slice(0, 300) + '...' : r.content}
                        </p>
                      )}
                      {r.tags && r.tags.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {r.tags.map((tag, i) => (
                            <span key={i} className="text-[10px] bg-white/5 text-gray-500 px-2 py-0.5 rounded-full border border-white/5">#{tag}</span>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] text-gray-700 mt-2">
                        {r.addedBy?.name} • {new Date(r.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                    <button onClick={() => handlePin(r._id)} className="p-1.5 hover:bg-white/5 rounded-lg text-sm transition" title={r.pinned ? 'Unpin' : 'Pin'}>
                      {r.pinned ? '📌' : '📍'}
                    </button>
                    <button onClick={() => handleEdit(r)} className="p-1.5 hover:bg-white/5 rounded-lg text-sm transition" title="Edit">✏️</button>
                    <button onClick={() => handleDelete(r._id)} className="p-1.5 hover:bg-red-500/10 rounded-lg text-sm transition" title="Delete">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
