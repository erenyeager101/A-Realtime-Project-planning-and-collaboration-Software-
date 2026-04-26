import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { initialSetup } from '../services/settingsService';

const STEPS = [
  {
    title: 'Database',
    description: 'Connect to your MongoDB database',
    fields: [
      { key: 'MONGO_URI', label: 'MongoDB Connection URI', placeholder: 'mongodb+srv://user:pass@cluster.mongodb.net/dbname', type: 'text', required: true },
    ],
  },
  {
    title: 'AI Provider',
    description: 'Configure at least one AI provider for smart features',
    fields: [
      { key: 'AI_PROVIDER', label: 'Primary AI Provider', type: 'select', options: ['mistral', 'gemini', 'ollama'] },
      { key: 'MISTRAL_API_KEY', label: 'Mistral API Key (free at console.mistral.ai)', placeholder: 'your-mistral-key', type: 'text' },
      { key: 'GEMINI_API_KEY', label: 'Gemini API Key (free at aistudio.google.dev)', placeholder: 'your-gemini-key', type: 'text' },
      { key: 'OLLAMA_BASE_URL', label: 'Ollama URL (if running locally)', placeholder: 'http://localhost:11434', type: 'text' },
    ],
  },
  {
    title: 'GitHub (Optional)',
    description: 'Connect GitHub for repo integration',
    fields: [
      { key: 'GITHUB_CLIENT_ID', label: 'GitHub OAuth Client ID', placeholder: 'Ov23li...', type: 'text' },
      { key: 'GITHUB_CLIENT_SECRET', label: 'GitHub OAuth Client Secret', placeholder: 'your-secret', type: 'text' },
      { key: 'GITHUB_CALLBACK_URL', label: 'Callback URL', placeholder: 'http://localhost:5000/api/github/callback', type: 'text' },
    ],
  },
];

export default function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState({
    MONGO_URI: '',
    AI_PROVIDER: 'mistral',
    MISTRAL_API_KEY: '',
    GEMINI_API_KEY: '',
    OLLAMA_BASE_URL: 'http://localhost:11434',
    GITHUB_CLIENT_ID: '',
    GITHUB_CLIENT_SECRET: '',
    GITHUB_CALLBACK_URL: 'http://localhost:5000/api/github/callback',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    if (step === 0 && !config.MONGO_URI) {
      setError('MongoDB URI is required');
      return;
    }
    setError('');
    setStep((s) => s + 1);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      // Filter out empty values
      const payload = {};
      for (const [key, val] of Object.entries(config)) {
        if (val) payload[key] = val;
      }
      await initialSetup(payload);
      // Redirect to register page to create admin account
      navigate('/register');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const currentStep = STEPS[step];

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-indigo-500/20 mb-4">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to EnterprisePM</h1>
          <p className="text-gray-400 mt-1 text-sm">Let's configure your instance</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1 flex items-center gap-2">
              <div className={`flex-1 h-1.5 rounded-full transition ${i <= step ? 'bg-indigo-500' : 'bg-white/10'}`} />
            </div>
          ))}
        </div>

        {/* Step card */}
        <div className="bg-slate-900/50 border border-white/[0.06] rounded-2xl p-8">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider">Step {step + 1} of {STEPS.length}</span>
            </div>
            <h2 className="text-xl font-bold text-white">{currentStep.title}</h2>
            <p className="text-gray-400 text-sm mt-1">{currentStep.description}</p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {currentStep.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{field.label}</label>
                {field.type === 'select' ? (
                  <select
                    value={config[field.key] || ''}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={config[field.key] || ''}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder-gray-600"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-between mt-8">
            {step > 0 ? (
              <button
                onClick={() => { setStep((s) => s - 1); setError(''); }}
                className="px-5 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition"
              >
                Back
              </button>
            ) : <div />}

            {step < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Setting up...
                  </>
                ) : (
                  'Complete Setup'
                )}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          You can change these settings later from the admin Settings page.
        </p>
      </div>
    </div>
  );
}
