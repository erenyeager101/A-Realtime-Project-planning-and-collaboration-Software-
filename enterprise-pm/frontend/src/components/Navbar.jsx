import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import { useState, useRef, useEffect } from 'react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showAI, setShowAI] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const aiRef = useRef(null);
  const userRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (aiRef.current && !aiRef.current.contains(e.target)) setShowAI(false);
      if (userRef.current && !userRef.current.contains(e.target)) setShowUser(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;

  return (
    <nav className="bg-slate-900/80 backdrop-blur-xl border-b border-white/[0.06] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-bold text-white text-lg tracking-tight">EnterprisePM</span>
          </Link>

          {/* Center nav links */}
          <div className="hidden md:flex items-center gap-1">
            <Link
              to="/dashboard"
              className="text-gray-400 hover:text-white hover:bg-white/5 px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Dashboard
            </Link>

            <Link
              to="/github"
              className="text-gray-400 hover:text-white hover:bg-white/5 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.333-1.754-1.333-1.754-1.089-.745.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.834 2.809 1.304 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" /></svg>
              GitHub
            </Link>

            {/* AI Tools Dropdown */}
            <div className="relative" ref={aiRef}>
              <button
                onClick={() => setShowAI(!showAI)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  showAI ? 'text-indigo-400 bg-indigo-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="text-sm">✨</span>
                AI Tools
                <svg className={`w-3.5 h-3.5 transition-transform ${showAI ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showAI && (
                <div className="absolute left-0 mt-2 w-56 bg-slate-900 border border-white/10 rounded-xl shadow-2xl shadow-black/50 py-2 z-50">
                  <Link
                    to="/ai/planner"
                    onClick={() => setShowAI(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition"
                  >
                    <span className="w-7 h-7 bg-purple-500/10 rounded-lg flex items-center justify-center text-sm">🧠</span>
                    AI Project Planner
                  </Link>
                  <div className="border-t border-white/5 my-1.5" />
                  <p className="px-4 py-1.5 text-xs text-gray-600 font-medium uppercase tracking-wider">Per-project tools</p>
                  {[
                    { icon: '💬', label: 'Research Assistant', desc: 'Ask AI about your project' },
                    { icon: '📄', label: 'Doc Generator', desc: 'SRS, PPT, Architecture' },
                    { icon: '🏥', label: 'Project Health', desc: 'AI risk analysis' },
                    { icon: '📚', label: 'Resource Hub', desc: 'Knowledge base' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 px-4 py-2 text-sm text-gray-500">
                      <span className="w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center text-sm">{item.icon}</span>
                      <div>
                        <span className="block text-gray-500 text-xs">{item.label}</span>
                        <span className="block text-gray-600 text-xs">{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <NotificationBell />

            {/* Settings (admin only) */}
            {user.role === 'admin' && (
              <Link
                to="/settings"
                className="text-gray-400 hover:text-white hover:bg-white/5 p-2 rounded-lg transition"
                title="Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
            )}

            {/* User dropdown */}
            <div className="relative" ref={userRef}>
              <button
                onClick={() => setShowUser(!showUser)}
                className="flex items-center gap-2 hover:bg-white/5 rounded-xl px-2 py-1.5 transition"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-indigo-500/20">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-gray-300 hidden sm:block font-medium">{user.name}</span>
                <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showUser && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-2xl shadow-black/50 py-2 z-50">
                  <div className="px-4 py-2 border-b border-white/5">
                    <p className="text-sm text-white font-medium">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
