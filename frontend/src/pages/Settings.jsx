import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getSettings, updateSettings } from '../services/settingsService';

const SECTIONS = [
  {
    title: 'Core',
    icon: '⚙️',
    fields: [
      { key: 'PORT', label: 'Server Port', placeholder: '5000', type: 'text' },
      { key: 'MONGO_URI', label: 'MongoDB Connection URI', placeholder: 'mongodb+srv://...', type: 'password' },
      { key: 'JWT_SECRET', label: 'JWT Secret Key', placeholder: 'auto-generated if empty', type: 'password' },
      { key: 'CLIENT_URL', label: 'Frontend URL', placeholder: 'http://localhost:5173', type: 'text' },
    ],
  },
  {
    title: 'AI Providers',
    icon: '🤖',
    fields: [
      { key: 'AI_PROVIDER', label: 'Active AI Provider', placeholder: 'ollama | mistral | gemini', type: 'select', options: ['ollama', 'mistral', 'gemini'] },
      { key: 'OLLAMA_BASE_URL', label: 'Ollama Base URL', placeholder: 'http://localhost:11434', type: 'text' },
      { key: 'OLLAMA_MODEL', label: 'Ollama Model', placeholder: 'llama3', type: 'text' },
      { key: 'MISTRAL_API_KEY', label: 'Mistral API Key', placeholder: 'your-mistral-key', type: 'password' },
      { key: 'MISTRAL_MODEL', label: 'Mistral Model', placeholder: 'mistral-small-latest', type: 'text' },
      { key: 'GEMINI_API_KEY', label: 'Gemini API Key', placeholder: 'your-gemini-key', type: 'password' },
      { key: 'GEMINI_MODEL', label: 'Gemini Model', placeholder: 'gemini-2.0-flash', type: 'text' },
    ],
  },
  {
    title: 'GitHub OAuth',
    icon: '🔗',
    fields: [
      { key: 'GITHUB_CLIENT_ID', label: 'GitHub Client ID', placeholder: 'Ov23li...', type: 'text' },
      { key: 'GITHUB_CLIENT_SECRET', label: 'GitHub Client Secret', placeholder: 'your-client-secret', type: 'password' },
      { key: 'GITHUB_CALLBACK_URL', label: 'GitHub Callback URL', placeholder: 'http://localhost:5000/api/github/callback', type: 'text' },
      { key: 'GITHUB_WEBHOOK_SECRET', label: 'GitHub Webhook Secret', placeholder: 'your-webhook-secret', type: 'password' },
    ],
  },
];

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showSecrets, setShowSecrets] = useState({});

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    loadSettings();
  }, [user, navigate]);

  const loadSettings = async () => {
    try {
      const res = await getSettings();
      setSettings(res.data);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load settings: ' + (err.response?.data?.message || err.message) });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await updateSettings(settings);
      setMessage({ type: 'success', text: res.data.message });
      // Reload to get masked values
      await loadSettings();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleSecret = (key) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
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

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <span className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-lg">⚙️</span>
              Settings
            </h1>
            <p className="text-gray-400 mt-1 text-sm">Configure API keys, database, and integrations</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Settings
              </>
            )}
          </button>
        </div>

        {/* Status message */}
        {message && (
          <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        {/* Warning banner */}
        <div className="mb-6 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
          <strong>Note:</strong> Changes to PORT or MONGO_URI require a container/server restart to take effect.
          Secret fields show masked values — leave them unchanged unless you want to update.
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {SECTIONS.map((section) => (
            <div key={section.title} className="bg-slate-900/50 border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
                <span className="text-lg">{section.icon}</span>
                <h2 className="text-white font-semibold">{section.title}</h2>
              </div>
              <div className="p-6 space-y-4">
                {section.fields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">
                      {field.label}
                      <span className="ml-2 text-xs text-gray-600 font-mono">{field.key}</span>
                    </label>
                    {field.type === 'select' ? (
                      <select
                        value={settings[field.key] || ''}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                      >
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="relative">
                        <input
                          type={field.type === 'password' && !showSecrets[field.key] ? 'password' : 'text'}
                          value={settings[field.key] || ''}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 placeholder-gray-600 pr-10"
                        />
                        {field.type === 'password' && (
                          <button
                            type="button"
                            onClick={() => toggleSecret(field.key)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
                          >
                            {showSecrets[field.key] ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
