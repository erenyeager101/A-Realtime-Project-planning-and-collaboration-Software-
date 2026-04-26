import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import ProjectDetails from './pages/ProjectDetails';
import KanbanBoard from './pages/KanbanBoard';
import TaskDetail from './pages/TaskDetail';
import AIPlanner from './pages/AIPlanner';
import ResearchAssistant from './pages/ResearchAssistant';
import DocGenerator from './pages/DocGenerator';
import ProjectHealth from './pages/ProjectHealth';
import ResourceHub from './pages/ResourceHub';
import GitHubDashboard from './pages/GitHubDashboard';
import ProjectGitHub from './pages/ProjectGitHub';
import DiagramCodeGenerator from './pages/DiagramCodeGenerator';
import Settings from './pages/Settings';
import Setup from './pages/Setup';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            <Route path="/setup" element={<Setup />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/onboarding" element={<PrivateRoute><Onboarding /></PrivateRoute>} />
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/project/:id" element={<PrivateRoute><ProjectDetails /></PrivateRoute>} />
            <Route path="/project/:id/board" element={<PrivateRoute><KanbanBoard /></PrivateRoute>} />
            <Route path="/task/:id" element={<PrivateRoute><TaskDetail /></PrivateRoute>} />

            {/* AI Features */}
            <Route path="/ai/planner" element={<PrivateRoute><AIPlanner /></PrivateRoute>} />
            <Route path="/project/:id/research" element={<PrivateRoute><ResearchAssistant /></PrivateRoute>} />
            <Route path="/project/:id/docs" element={<PrivateRoute><DocGenerator /></PrivateRoute>} />
            <Route path="/project/:id/health" element={<PrivateRoute><ProjectHealth /></PrivateRoute>} />
            <Route path="/project/:id/resources" element={<PrivateRoute><ResourceHub /></PrivateRoute>} />
        <Route path="/ai/code-generator" element={<PrivateRoute><DiagramCodeGenerator /></PrivateRoute>} />
        <Route path="/project/:id/code-generator" element={<PrivateRoute><DiagramCodeGenerator /></PrivateRoute>} />

            {/* GitHub Integration */}
            <Route path="/github" element={<PrivateRoute><GitHubDashboard /></PrivateRoute>} />
            <Route path="/project/:id/github" element={<PrivateRoute><ProjectGitHub /></PrivateRoute>} />

            {/* Admin Settings */}
            <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />

            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
