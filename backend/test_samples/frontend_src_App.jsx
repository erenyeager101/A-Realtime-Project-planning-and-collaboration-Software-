import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import UserPage from './pages/UserPage';
import ProjectPage from './pages/ProjectPage';
import TaskPage from './pages/TaskPage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/users" element={<UserPage />} />
      <Route path="/projects" element={<ProjectPage />} />
      <Route path="/tasks" element={<TaskPage />} />
          <Route path="/" element={<Navigate to="/" />} />
          <Route path="*" element={<div className="text-center py-20">404 - Page Not Found</div>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
