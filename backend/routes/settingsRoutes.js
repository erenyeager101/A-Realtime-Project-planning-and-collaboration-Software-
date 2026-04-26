const express = require('express');
const fs = require('fs');
const path = require('path');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();
const envPath = path.resolve(__dirname, '..', '.env');

// Env keys that are configurable via the Settings UI
const CONFIGURABLE_KEYS = [
  'PORT',
  'MONGO_URI',
  'JWT_SECRET',
  'CLIENT_URL',
  'OLLAMA_BASE_URL',
  'OLLAMA_MODEL',
  'MISTRAL_API_KEY',
  'MISTRAL_MODEL',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'AI_PROVIDER',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'GITHUB_CALLBACK_URL',
  'GITHUB_WEBHOOK_SECRET',
];

// Keys whose values should be masked in GET responses
const SECRET_KEYS = [
  'MONGO_URI',
  'JWT_SECRET',
  'MISTRAL_API_KEY',
  'GEMINI_API_KEY',
  'GITHUB_CLIENT_SECRET',
  'GITHUB_WEBHOOK_SECRET',
];

/** Parse .env file into an object */
function parseEnv() {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.substring(0, idx).trim();
    let val = trimmed.substring(idx + 1).trim();
    // Remove surrounding quotes if any
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

/** Write object back to .env file */
function writeEnv(envObj) {
  const sections = [
    { header: '# ── Core ──', keys: ['PORT', 'MONGO_URI', 'JWT_SECRET', 'CLIENT_URL'] },
    { header: '# ── AI Providers ──', keys: ['OLLAMA_BASE_URL', 'OLLAMA_MODEL', 'MISTRAL_API_KEY', 'MISTRAL_MODEL', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'AI_PROVIDER'] },
    { header: '# ── GitHub OAuth ──', keys: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_CALLBACK_URL', 'GITHUB_WEBHOOK_SECRET'] },
  ];

  let content = '';
  for (const section of sections) {
    content += `${section.header}\n`;
    for (const key of section.keys) {
      if (envObj[key] !== undefined) {
        content += `${key}=${envObj[key]}\n`;
      }
    }
    content += '\n';
  }

  // Write any remaining keys not in sections
  const covered = new Set(sections.flatMap((s) => s.keys));
  for (const [key, val] of Object.entries(envObj)) {
    if (!covered.has(key)) {
      content += `${key}=${val}\n`;
    }
  }

  fs.writeFileSync(envPath, content.trimEnd() + '\n', 'utf8');
}

/** Mask a secret value, showing only last 4 chars */
function mask(val) {
  if (!val || val.length <= 4) return '****';
  return '*'.repeat(val.length - 4) + val.slice(-4);
}

// ── GET /api/settings — Retrieve current settings (masked secrets) ──
router.get('/', auth, authorize('admin'), async (req, res) => {
  try {
    const env = parseEnv();
    const settings = {};
    for (const key of CONFIGURABLE_KEYS) {
      const val = env[key] || process.env[key] || '';
      settings[key] = SECRET_KEYS.includes(key) ? mask(val) : val;
    }
    // Also indicate whether this is a fresh install (no .env or no MONGO_URI)
    settings._isConfigured = !!(env.MONGO_URI || process.env.MONGO_URI);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── GET /api/settings/status — Public: check if app is configured ──
router.get('/status', async (req, res) => {
  try {
    const env = parseEnv();
    const isConfigured = !!(env.MONGO_URI || process.env.MONGO_URI);
    res.json({ configured: isConfigured });
  } catch (error) {
    res.status(500).json({ message: error.message, configured: false });
  }
});

// ── PUT /api/settings — Update settings (admin only) ──
router.put('/', auth, authorize('admin'), async (req, res) => {
  try {
    const updates = req.body;
    const env = parseEnv();

    for (const key of CONFIGURABLE_KEYS) {
      if (updates[key] !== undefined) {
        const val = updates[key];
        // Skip masked values (user didn't change them)
        if (val.includes('****')) continue;
        env[key] = val;
        // Also update running process env
        process.env[key] = val;
      }
    }

    writeEnv(env);
    res.json({ message: 'Settings saved successfully. Some changes may require a restart.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── POST /api/settings/setup — First-time setup (no auth required) ──
router.post('/setup', async (req, res) => {
  try {
    const env = parseEnv();

    // Only allow if not already configured
    if (env.MONGO_URI && env.JWT_SECRET) {
      return res.status(400).json({ message: 'Application is already configured. Use PUT /api/settings with admin auth.' });
    }

    const updates = req.body;
    for (const key of CONFIGURABLE_KEYS) {
      if (updates[key]) {
        env[key] = updates[key];
        process.env[key] = updates[key];
      }
    }

    // Ensure JWT_SECRET has a default if not provided
    if (!env.JWT_SECRET) {
      const crypto = require('crypto');
      env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
      process.env.JWT_SECRET = env.JWT_SECRET;
    }

    writeEnv(env);
    res.json({ message: 'Initial setup complete! Please register an admin account.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
