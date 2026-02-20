import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { generateDoc, getDocs, deleteDoc } from '../services/aiService';
import { getProject } from '../services/projectService';
import Navbar from '../components/Navbar';

const DOC_TYPES = [
  { key: 'srs', icon: '📄', label: 'Software Requirements Specification (SRS)', description: 'IEEE 830 standard SRS with functional & non-functional requirements' },
  { key: 'architecture', icon: '🏗️', label: 'Architecture Document', description: 'System architecture, component diagrams, data flow, and API design' },
  { key: 'use_cases', icon: '👤', label: 'Use Case Document', description: 'UML use cases with actors, flows, preconditions, and postconditions' },
  { key: 'ppt_outline', icon: '📊', label: 'Presentation Outline', description: 'Complete PPT structure with slide content and speaker notes' },
  { key: 'demo_script', icon: '🎬', label: 'Demo Script', description: 'Step-by-step demo script with timing and Q&A preparation' },
];

export default function DocGenerator() {
  const { id: projectId } = useParams();
  const [project, setProject] = useState(null);
  const [docs, setDocs] = useState([]);
  const [generating, setGenerating] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [projectId]);

  const fetchData = async () => {
    try {
      const [projRes, docsRes] = await Promise.all([getProject(projectId), getDocs(projectId)]);
      setProject(projRes.data);
      setDocs(docsRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleGenerate = async (type) => {
    setGenerating(type);
    try {
      const res = await generateDoc(projectId, { type });
      setDocs((prev) => [res.data, ...prev]);
      setViewingDoc(res.data);
    } catch (err) { alert(err.response?.data?.message || 'Generation failed'); }
    finally { setGenerating(null); }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await deleteDoc(projectId, docId);
      setDocs((prev) => prev.filter((d) => d._id !== docId));
      if (viewingDoc?._id === docId) setViewingDoc(null);
    } catch (err) { console.error(err); }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
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

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
          <Link to="/dashboard" className="hover:text-indigo-400 transition">Projects</Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <Link to={`/project/${projectId}`} className="hover:text-indigo-400 transition">{project?.name}</Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-gray-300 font-medium">AI Documents</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">📝</span>
            <h1 className="text-2xl font-bold text-white">AI Document Generator</h1>
          </div>
          <p className="text-gray-500">Auto-generate academic documents for your project. Click to generate, review, and export.</p>
        </div>

        {viewingDoc ? (
          <div>
            <button
              onClick={() => setViewingDoc(null)}
              className="text-sm text-indigo-400 hover:text-indigo-300 mb-4 flex items-center gap-1 transition font-medium"
            >
              ← Back to documents
            </button>

            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl">
              <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
                <div>
                  <h2 className="text-lg font-bold text-white">{viewingDoc.title}</h2>
                  <p className="text-xs text-gray-600 mt-1">
                    Generated {new Date(viewingDoc.createdAt).toLocaleString()}
                    {viewingDoc.generatedBy && ` by ${viewingDoc.generatedBy.name}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(viewingDoc.content)}
                    className="bg-white/5 text-gray-400 px-3 py-1.5 rounded-lg text-sm hover:bg-white/10 transition border border-white/5"
                  >
                    📋 Copy
                  </button>
                  <button
                    onClick={() => {
                      const blob = new Blob([viewingDoc.content], { type: 'text/markdown' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${viewingDoc.title.replace(/\s/g, '_')}.md`;
                      a.click();
                    }}
                    className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-indigo-500 transition"
                  >
                    ⬇ Download .md
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div
                  className="prose prose-sm prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(viewingDoc.content) }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Generate Panel */}
            <div className="lg:col-span-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Generate New</h3>
              <div className="grid gap-3">
                {DOC_TYPES.map((dt) => (
                  <div key={dt.key} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between hover:border-white/10 transition">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{dt.icon}</span>
                      <div>
                        <p className="font-medium text-gray-200">{dt.label}</p>
                        <p className="text-xs text-gray-600">{dt.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleGenerate(dt.key)}
                      disabled={generating !== null}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-500 transition disabled:opacity-50 shrink-0 flex items-center gap-2 shadow-lg shadow-indigo-500/10"
                    >
                      {generating === dt.key ? (
                        <>
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                          Generating...
                        </>
                      ) : (
                        <>✨ Generate</>
                      )}
                    </button>
                  </div>
                ))}
              </div>

              {generating && (
                <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-6 text-center mt-6">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mx-auto mb-3"></div>
                  <p className="text-sm font-medium text-indigo-400">AI is writing your document...</p>
                  <p className="text-xs text-gray-600 mt-1">This may take 20-40 seconds</p>
                </div>
              )}
            </div>

            {/* History Panel */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Generated Documents ({docs.length})
              </h3>
              <div className="space-y-2">
                {docs.length === 0 ? (
                  <p className="text-sm text-gray-600 text-center py-8">No documents generated yet</p>
                ) : (
                  docs.map((doc) => (
                    <div key={doc._id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 hover:border-white/10 transition">
                      <div className="flex items-start justify-between">
                        <button onClick={() => setViewingDoc(doc)} className="text-left flex-1">
                          <p className="text-sm font-medium text-gray-300 hover:text-indigo-400 transition">{doc.title}</p>
                          <p className="text-xs text-gray-600 mt-1">{new Date(doc.createdAt).toLocaleDateString()}</p>
                        </button>
                        <button onClick={() => handleDelete(doc._id)} className="text-xs text-red-400/60 hover:text-red-400 ml-2 transition">✕</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-white/5 rounded-lg p-3 text-xs overflow-x-auto my-2 border border-white/5"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-white/5 px-1 rounded text-xs text-indigo-400">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^#### (.+)$/gm, '<h5 class="font-semibold text-gray-300 mt-2 mb-1 text-sm">$1</h5>')
    .replace(/^### (.+)$/gm, '<h4 class="font-semibold text-gray-200 mt-3 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-bold text-gray-200 mt-4 mb-1 text-base">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="font-bold text-gray-100 mt-4 mb-2 text-lg">$1</h2>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-sm">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 text-sm">$2</li>')
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split('|').filter(Boolean).map(c => `<td class="border border-white/10 px-2 py-1 text-xs">${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
  return html;
}
