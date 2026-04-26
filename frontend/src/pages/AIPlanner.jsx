import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generatePlan } from '../services/aiService';
import { createProject } from '../services/projectService';
import Navbar from '../components/Navbar';

export default function AIPlanner() {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!description.trim()) return;
    setLoading(true);
    setPlan(null);
    try {
      const res = await generatePlan({ description });
      setPlan(res.data.plan);
    } catch (err) {
      alert(err.response?.data?.message || 'AI generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!plan) return;
    setCreating(true);
    try {
      const projRes = await createProject({
        name: plan.projectName,
        description: plan.summary,
      });
      const projectId = projRes.data._id;
      await generatePlan({ description, projectId });
      navigate(`/project/${projectId}/board`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const priorityColor = {
    high: 'bg-red-500/10 text-red-400 border-red-500/20',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };

  const categoryIcon = {
    backend: '⚙️', frontend: '🎨', design: '🖌️', testing: '🧪',
    deployment: '🚀', research: '🔬', documentation: '📝',
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🤖</span>
            <h1 className="text-2xl font-bold text-white">AI Project Planner</h1>
          </div>
          <p className="text-gray-500">
            Describe your project idea and AI will generate modules, tasks, milestones, timeline, and risk analysis.
          </p>
        </div>

        {/* Input */}
        <form onSubmit={handleGenerate} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mb-8">
          <label className="block text-sm font-medium text-gray-400 mb-2">Describe your project idea</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent outline-none transition text-sm"
            placeholder="e.g. We want to build a Hospital Management System using MERN stack..."
          />
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-gray-600">The more detail you provide, the better the plan.</p>
            <button
              type="submit"
              disabled={loading || !description.trim()}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-500 transition disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Generating Plan...
                </>
              ) : (
                <>✨ Generate Plan</>
              )}
            </button>
          </div>
        </form>

        {/* Loading Animation */}
        {loading && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-12 text-center mb-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
            <h3 className="text-lg font-medium text-gray-300">AI is planning your project...</h3>
            <p className="text-sm text-gray-600 mt-1">This may take 15-30 seconds</p>
          </div>
        )}

        {/* Generated Plan */}
        {plan && !loading && (
          <div className="space-y-6">
            {/* Project Summary */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-500/10">
              <div className="flex items-center justify-between flex-col sm:flex-row gap-4">
                <div>
                  <h2 className="text-2xl font-bold">{plan.projectName}</h2>
                  <p className="mt-2 text-indigo-100">{plan.summary}</p>
                </div>
                <button
                  onClick={handleCreateProject}
                  disabled={creating}
                  className="bg-white text-indigo-700 px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-50 transition disabled:opacity-50 shrink-0"
                >
                  {creating ? 'Creating...' : '🚀 Create Project & Tasks'}
                </button>
              </div>
            </div>

            {/* Tech Stack */}
            {plan.techStack && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">🛠️ Recommended Tech Stack</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(plan.techStack).map(([category, items]) => (
                    <div key={category}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{category}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(items || []).map((item, i) => (
                          <span key={i} className="bg-white/5 text-gray-400 text-xs px-2.5 py-1 rounded-full border border-white/5">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            {plan.timeline && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-1">📅 Timeline</h3>
                <p className="text-sm text-gray-500 mb-4">Estimated {plan.timeline.totalWeeks} weeks</p>
                <div className="space-y-3">
                  {plan.timeline.phases?.map((phase, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div className="bg-indigo-500/10 text-indigo-400 text-xs font-bold px-2.5 py-1 rounded-full border border-indigo-500/20 shrink-0 mt-0.5">
                        {phase.weeks}
                      </div>
                      <div>
                        <p className="font-medium text-gray-200">{phase.name}</p>
                        <p className="text-sm text-gray-500">{phase.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modules & Tasks */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">📦 Modules & Tasks</h3>
              <div className="space-y-6">
                {plan.modules?.map((mod, mi) => (
                  <div key={mi}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-indigo-500/10 text-indigo-400 rounded-lg flex items-center justify-center text-sm font-bold border border-indigo-500/20">
                        {mi + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-200">{mod.name}</p>
                        <p className="text-xs text-gray-500">{mod.description}</p>
                      </div>
                    </div>
                    <div className="grid gap-2 ml-10">
                      {mod.tasks?.map((task, ti) => (
                        <div key={ti} className="flex items-center gap-3 bg-white/[0.03] rounded-xl px-3 py-2.5 border border-white/5">
                          <span className="text-sm">{categoryIcon[task.category] || '📋'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-300 truncate">{task.title}</p>
                            <p className="text-xs text-gray-600 truncate">{task.description}</p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${priorityColor[task.priority]}`}>
                            {task.priority}
                          </span>
                          <span className="text-xs text-gray-600 shrink-0">{task.estimatedHours}h</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Milestones */}
            {plan.milestones && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">🎯 Milestones</h3>
                <div className="space-y-3">
                  {plan.milestones.map((ms, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/20">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-gray-200">Week {ms.weekNumber} — {ms.name}</p>
                        <p className="text-sm text-gray-500">{ms.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risks */}
            {plan.risks && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">⚠️ Risk Analysis</h3>
                <div className="space-y-3">
                  {plan.risks.map((risk, i) => (
                    <div key={i} className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${priorityColor[risk.impact]}`}>
                          {risk.impact} impact
                        </span>
                        <p className="text-sm font-medium text-gray-200">{risk.risk}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        <strong className="text-gray-400">Mitigation:</strong> {risk.mitigation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom CTA */}
            <div className="text-center py-4">
              <button
                onClick={handleCreateProject}
                disabled={creating}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-indigo-500 transition disabled:opacity-50 text-lg shadow-lg shadow-indigo-500/20"
              >
                {creating ? 'Creating Project...' : '🚀 Create Project with All Tasks'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
