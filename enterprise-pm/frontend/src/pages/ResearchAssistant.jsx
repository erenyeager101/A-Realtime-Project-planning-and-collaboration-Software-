import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { askResearch, getConversations, getConversation } from '../services/aiService';
import { getProject } from '../services/projectService';
import Navbar from '../components/Navbar';

export default function ResearchAssistant() {
  const { id: projectId } = useParams();
  const [project, setProject] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchProject();
    fetchConversations();
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchProject = async () => {
    try { const res = await getProject(projectId); setProject(res.data); } catch (err) { console.error(err); }
  };

  const fetchConversations = async () => {
    try { const res = await getConversations(projectId); setConversations(res.data); } catch (err) { console.error(err); }
  };

  const loadConversation = async (convId) => {
    setActiveConvId(convId);
    try { const res = await getConversation(projectId, convId); setMessages(res.data.messages || []); } catch (err) { console.error(err); }
  };

  const startNewChat = () => { setActiveConvId(null); setMessages([]); };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setLoading(true);
    try {
      const res = await askResearch(projectId, { question, conversationId: activeConvId });
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.answer }]);
      setActiveConvId(res.data.conversationId);
      fetchConversations();
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: '❌ Error: ' + (err.response?.data?.message || 'AI request failed') }]);
    } finally {
      setLoading(false);
    }
  };

  const quickQuestions = [
    '📚 Explain the architecture patterns for this project',
    '🔍 What are the best practices for our tech stack?',
    '📝 Help me structure the SRS document',
    '🧪 Suggest testing strategies for this project',
    '🔒 What security measures should we implement?',
    '📊 How should we design the database schema?',
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-72 bg-slate-900/80 border-r border-white/[0.06] flex flex-col shrink-0">
            <div className="p-4 border-b border-white/[0.06]">
              <button
                onClick={startNewChat}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-500 transition flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Chat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {conversations.map((conv) => (
                <button
                  key={conv._id}
                  onClick={() => loadConversation(conv._id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition truncate ${
                    activeConvId === conv._id
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      : 'text-gray-400 hover:bg-white/[0.03] border border-transparent'
                  }`}
                >
                  <p className="font-medium truncate">{conv.title}</p>
                  <p className="text-xs text-gray-600">{conv.messageCount} messages</p>
                </button>
              ))}
              {conversations.length === 0 && (
                <p className="text-xs text-gray-600 text-center py-4">No conversations yet</p>
              )}
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="bg-slate-900/60 border-b border-white/[0.06] px-6 py-3 flex items-center justify-between backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-600 hover:text-gray-300 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h2 className="font-semibold text-white flex items-center gap-2">🔍 Research Assistant</h2>
                <p className="text-xs text-gray-600">
                  Project: {project?.name || 'Loading...'} — Context-aware AI
                </p>
              </div>
            </div>
            <Link to={`/project/${projectId}`} className="text-sm text-indigo-400 hover:text-indigo-300 transition font-medium">
              Back to Project
            </Link>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="text-6xl mb-4">🤖</div>
                <h3 className="text-xl font-semibold text-gray-300 mb-2">Hi! I'm your Research Assistant</h3>
                <p className="text-gray-600 text-sm mb-6 text-center max-w-md">
                  I know about your project "{project?.name}". Ask me anything about research, architecture, documentation, or implementation.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-lg w-full">
                  {quickQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(q.replace(/^[^\s]+\s/, ''))}
                      className="text-left bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-gray-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/[0.04] border border-white/[0.08] text-gray-300'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }} />
                      ) : (
                        <p className="text-sm">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-500">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500"></div>
                        <span className="text-sm">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="bg-slate-900/60 border-t border-white/[0.06] px-6 py-4 backdrop-blur-sm">
            <form onSubmit={handleSend} className="max-w-3xl mx-auto flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about your project..."
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent outline-none transition text-sm"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-500 transition disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        </div>
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
    .replace(/^### (.+)$/gm, '<h4 class="font-semibold text-gray-200 mt-3 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-bold text-gray-200 mt-4 mb-1 text-base">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="font-bold text-gray-100 mt-4 mb-2 text-lg">$1</h2>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-sm">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 text-sm">$2</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
  return html;
}
