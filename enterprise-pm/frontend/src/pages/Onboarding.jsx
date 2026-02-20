import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onboard } from '../services/authService';
import { useAuth } from '../context/AuthContext';

const STEPS = [
  { key: 'profession', title: 'What describes you best?', subtitle: 'This helps us personalize your experience' },
  { key: 'background', title: 'Tell us about your background', subtitle: 'So we can tailor project templates' },
  { key: 'goals', title: 'What are you building?', subtitle: 'We\'ll customize your workspace accordingly' },
];

const PROFESSIONS = [
  { value: 'student', icon: '🎓', label: 'Student', desc: 'College / University student' },
  { value: 'teacher', icon: '👨‍🏫', label: 'Teacher / Professor', desc: 'Educator or mentor' },
  { value: 'employee', icon: '💼', label: 'Employee', desc: 'Working at a company' },
  { value: 'freelancer', icon: '🚀', label: 'Freelancer', desc: 'Independent professional' },
  { value: 'founder', icon: '⚡', label: 'Founder / Startup', desc: 'Building something new' },
  { value: 'other', icon: '🌟', label: 'Other', desc: 'Something else entirely' },
];

const EXPERIENCE = [
  { value: 'beginner', icon: '🌱', label: 'Beginner', desc: 'Just getting started' },
  { value: 'intermediate', icon: '🌿', label: 'Intermediate', desc: '1-2 years experience' },
  { value: 'advanced', icon: '🌳', label: 'Advanced', desc: '3+ years experience' },
  { value: 'expert', icon: '🏆', label: 'Expert', desc: 'Senior / Lead level' },
];

const TEAM_SIZES = [
  { value: 'solo', icon: '👤', label: 'Solo' },
  { value: '2-3', icon: '👥', label: '2-3 people' },
  { value: '4-6', icon: '👨‍👩‍👧‍👦', label: '4-6 people' },
  { value: '7+', icon: '🏢', label: '7+ people' },
];

const GOALS = [
  { value: 'semester-project', icon: '📚', label: 'Semester Project', desc: 'Academic / course project' },
  { value: 'hackathon', icon: '⚡', label: 'Hackathon', desc: 'Competition or sprint' },
  { value: 'startup', icon: '🚀', label: 'Startup / Product', desc: 'Building a real product' },
  { value: 'freelance', icon: '💰', label: 'Freelance Work', desc: 'Client projects' },
  { value: 'learning', icon: '🧠', label: 'Learning / Practice', desc: 'Personal growth' },
  { value: 'other', icon: '🎯', label: 'Other', desc: 'Something different' },
];

const INTERESTS = [
  { value: 'web-dev', label: 'Web Development' },
  { value: 'mobile', label: 'Mobile Apps' },
  { value: 'ai-ml', label: 'AI / Machine Learning' },
  { value: 'data-science', label: 'Data Science' },
  { value: 'devops', label: 'DevOps / Cloud' },
  { value: 'blockchain', label: 'Blockchain / Web3' },
  { value: 'game-dev', label: 'Game Development' },
  { value: 'iot', label: 'IoT / Embedded' },
  { value: 'cybersecurity', label: 'Cybersecurity' },
  { value: 'design', label: 'UI/UX Design' },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { loginUser } = useAuth();

  const [form, setForm] = useState({
    profession: '',
    organization: '',
    specialization: '',
    experience: '',
    teamSize: 'solo',
    interests: [],
    goal: '',
  });

  const toggleInterest = (val) => {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(val)
        ? f.interests.filter((i) => i !== val)
        : [...f.interests, val],
    }));
  };

  const canNext = () => {
    if (step === 0) return !!form.profession;
    if (step === 1) return !!form.experience;
    if (step === 2) return !!form.goal;
    return true;
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const res = await onboard(form);
      // Update local user data
      const token = localStorage.getItem('token');
      loginUser(token, res.data);
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="fixed top-1/4 left-1/3 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/3 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-2xl">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex-1 flex items-center gap-2">
              <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                i <= step ? 'bg-indigo-500' : 'bg-white/10'
              }`} />
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl">
          {/* Step header */}
          <div className="mb-8">
            <p className="text-indigo-400 text-sm font-medium mb-1">Step {step + 1} of {STEPS.length}</p>
            <h1 className="text-3xl font-bold text-white mb-2">{STEPS[step].title}</h1>
            <p className="text-gray-400">{STEPS[step].subtitle}</p>
          </div>

          {/* Step 0: Profession */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {PROFESSIONS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setForm({ ...form, profession: p.value })}
                    className={`relative p-4 rounded-2xl border-2 text-left transition-all duration-200 hover:scale-[1.02] ${
                      form.profession === p.value
                        ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/20'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <span className="text-2xl block mb-2">{p.icon}</span>
                    <span className="text-white font-semibold text-sm block">{p.label}</span>
                    <span className="text-gray-500 text-xs">{p.desc}</span>
                    {form.profession === p.value && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {form.profession && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Organization / College</label>
                    <input
                      type="text"
                      value={form.organization}
                      onChange={(e) => setForm({ ...form, organization: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition"
                      placeholder="e.g. MIT, Google, Stanford..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Specialization / Field</label>
                    <input
                      type="text"
                      value={form.specialization}
                      onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition"
                      placeholder="e.g. Computer Science, Design..."
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Background */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-medium mb-3 text-sm">Experience Level</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {EXPERIENCE.map((e) => (
                    <button
                      key={e.value}
                      onClick={() => setForm({ ...form, experience: e.value })}
                      className={`p-4 rounded-2xl border-2 text-center transition-all duration-200 hover:scale-[1.02] ${
                        form.experience === e.value
                          ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/20'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <span className="text-2xl block mb-1">{e.icon}</span>
                      <span className="text-white font-semibold text-sm block">{e.label}</span>
                      <span className="text-gray-500 text-xs">{e.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-white font-medium mb-3 text-sm">Typical Team Size</h3>
                <div className="flex gap-3">
                  {TEAM_SIZES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setForm({ ...form, teamSize: t.value })}
                      className={`flex-1 p-3 rounded-xl border-2 text-center transition-all duration-200 ${
                        form.teamSize === t.value
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <span className="text-lg block">{t.icon}</span>
                      <span className="text-white text-xs font-medium">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-white font-medium mb-3 text-sm">Interests <span className="text-gray-500">(pick any)</span></h3>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((i) => (
                    <button
                      key={i.value}
                      onClick={() => toggleInterest(i.value)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                        form.interests.includes(i.value)
                          ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                          : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {i.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Goals */}
          {step === 2 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {GOALS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setForm({ ...form, goal: g.value })}
                  className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-200 hover:scale-[1.02] ${
                    form.goal === g.value
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/20'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <span className="text-3xl block mb-3">{g.icon}</span>
                  <span className="text-white font-semibold block">{g.label}</span>
                  <span className="text-gray-500 text-xs">{g.desc}</span>
                  {form.goal === g.value && (
                    <div className="absolute top-3 right-3 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-white/10">
            {step > 0 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            ) : (
              <div />
            )}

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => canNext() && setStep(step + 1)}
                disabled={!canNext()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 flex items-center gap-2"
              >
                Continue
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={!canNext() || saving}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-30 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 shadow-lg shadow-indigo-500/25"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    Launch Dashboard
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Skip */}
        <button
          onClick={handleFinish}
          className="mt-4 text-gray-600 hover:text-gray-400 text-sm mx-auto block transition"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
