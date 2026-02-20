import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProjectHealth } from '../services/aiService';
import { getProject } from '../services/projectService';
import Navbar from '../components/Navbar';

export default function ProjectHealth() {
  const { id: projectId } = useParams();
  const [project, setProject] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchData(); }, [projectId]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const projRes = await getProject(projectId);
      setProject(projRes.data);
      const healthRes = await getProjectHealth(projectId);
      setHealth(healthRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to analyze project health');
    } finally {
      setLoading(false);
    }
  };

  const healthColor = {
    healthy: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-400', badge: 'bg-emerald-500' },
    'at-risk': { bg: 'bg-amber-500/5', border: 'border-amber-500/20', text: 'text-amber-400', badge: 'bg-amber-500' },
    critical: { bg: 'bg-red-500/5', border: 'border-red-500/20', text: 'text-red-400', badge: 'bg-red-500' },
  };

  const severityColor = {
    high: 'bg-red-500/10 text-red-400 border-red-500/20',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    low: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
          <h3 className="text-lg font-medium text-gray-300">AI is analyzing your project...</h3>
          <p className="text-sm text-gray-600 mt-1">Scanning tasks, timelines, and workloads</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
          <Link to="/dashboard" className="hover:text-indigo-400 transition">Projects</Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <Link to={`/project/${projectId}`} className="hover:text-indigo-400 transition">{project?.name}</Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-gray-300 font-medium">Health Analysis</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🏥</span>
              <h1 className="text-2xl font-bold text-white">Project Health</h1>
            </div>
            <p className="text-gray-500">AI-powered analysis of your project's status and risks</p>
          </div>
          <button
            onClick={fetchData}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-indigo-500 transition font-medium shadow-lg shadow-indigo-500/10"
          >
            🔄 Re-analyze
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 text-red-400 p-4 rounded-xl mb-6 border border-red-500/20">{error}</div>
        )}

        {health && (
          <div className="space-y-6">
            {/* Overall Health Card */}
            <div className={`${healthColor[health.overallHealth]?.bg} ${healthColor[health.overallHealth]?.border} border rounded-2xl p-6`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 ${healthColor[health.overallHealth]?.badge} rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg`}>
                    {health.score}
                  </div>
                  <div>
                    <h2 className={`text-xl font-bold ${healthColor[health.overallHealth]?.text}`}>
                      {health.overallHealth?.toUpperCase()}
                    </h2>
                    <p className="text-sm text-gray-500">Health Score: {health.score}/100</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{health.issues?.length || 0} issues found</p>
                  <p className="text-sm text-gray-500">{health.recommendations?.length || 0} recommendations</p>
                </div>
              </div>
            </div>

            {/* Insights */}
            {health.insights && health.insights.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {health.insights.map((insight, i) => (
                  <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{insight.icon}</span>
                      <h3 className="font-semibold text-gray-200 text-sm">{insight.title}</h3>
                    </div>
                    <p className="text-xs text-gray-500">{insight.detail}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Issues */}
            {health.issues && health.issues.length > 0 && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">⚠️ Issues Detected</h3>
                <div className="space-y-3">
                  {health.issues.map((issue, i) => (
                    <div key={i} className={`${severityColor[issue.severity]} border rounded-xl p-4`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold uppercase">{issue.severity}</span>
                        <span className="text-xs bg-white/5 px-2 py-0.5 rounded border border-white/5">{issue.type}</span>
                      </div>
                      <p className="font-medium text-sm">{issue.title}</p>
                      <p className="text-xs mt-1 opacity-80">{issue.description}</p>
                      <div className="mt-2 bg-white/5 rounded-lg px-3 py-2 border border-white/5">
                        <p className="text-xs"><strong className="text-gray-300">💡 Suggestion:</strong> {issue.suggestion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {health.recommendations && health.recommendations.length > 0 && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">✅ Recommendations</h3>
                <div className="space-y-2">
                  {health.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-3 bg-white/[0.03] rounded-xl p-3 border border-white/5">
                      <div className="w-6 h-6 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border border-indigo-500/20">
                        {i + 1}
                      </div>
                      <p className="text-sm text-gray-400">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
