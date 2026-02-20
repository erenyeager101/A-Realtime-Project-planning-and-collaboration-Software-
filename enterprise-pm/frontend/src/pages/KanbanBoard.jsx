import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getTasksByProject, createTask, updateTaskStatus } from '../services/taskService';
import { getProject } from '../services/projectService';
import { useSocket } from '../context/SocketContext';
import Navbar from '../components/Navbar';

const COLUMNS = [
  { id: 'todo', title: 'Todo', gradient: 'from-gray-500/10 to-slate-500/10', dot: 'bg-gray-400', border: 'border-gray-500/20' },
  { id: 'inprogress', title: 'In Progress', gradient: 'from-blue-500/10 to-indigo-500/10', dot: 'bg-blue-400', border: 'border-blue-500/20' },
  { id: 'review', title: 'Review', gradient: 'from-amber-500/10 to-yellow-500/10', dot: 'bg-amber-400', border: 'border-amber-500/20' },
  { id: 'done', title: 'Done', gradient: 'from-emerald-500/10 to-green-500/10', dot: 'bg-emerald-400', border: 'border-emerald-500/20' },
];

const priorityColors = {
  low: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
  medium: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  high: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  urgent: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

function TaskCard({ task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task._id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Link
        to={`/task/${task._id}`}
        className="block bg-white/[0.04] rounded-xl p-3.5 border border-white/[0.06] hover:bg-white/[0.07] hover:border-white/10 transition cursor-grab active:cursor-grabbing group"
        onClick={(e) => {
          if (isDragging) e.preventDefault();
        }}
      >
        <h4 className="text-sm font-medium text-gray-200 group-hover:text-white transition">{task.title}</h4>
        {task.description && (
          <p className="text-xs text-gray-600 mt-1.5 line-clamp-2">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-3">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priorityColors[task.priority]}`}>
            {task.priority}
          </span>
          {task.assignee && (
            <span className="w-5 h-5 bg-indigo-500/20 text-indigo-400 rounded-md flex items-center justify-center text-[10px] font-bold border border-indigo-500/10">
              {task.assignee.name?.charAt(0).toUpperCase()}
            </span>
          )}
          {task.dueDate && (
            <span className="text-[10px] text-gray-600 ml-auto">
              {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>
        {task.comments?.length > 0 && (
          <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-600">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {task.comments.length}
          </div>
        )}
      </Link>
    </div>
  );
}

function TaskOverlay({ task }) {
  if (!task) return null;
  return (
    <div className="bg-slate-800 rounded-xl p-3.5 shadow-2xl border-2 border-indigo-500/50 w-64">
      <h4 className="text-sm font-medium text-white">{task.title}</h4>
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium mt-2 inline-block ${priorityColors[task.priority]}`}>
        {task.priority}
      </span>
    </div>
  );
}

export default function KanbanBoard() {
  const { id: projectId } = useParams();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(null);
  const [newTask, setNewTask] = useState({ title: '', priority: 'medium' });
  const [activeTask, setActiveTask] = useState(null);
  const socket = useSocket();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    fetchData();
  }, [projectId]);

  useEffect(() => {
    if (socket && projectId) {
      socket.emit('join-project', projectId);
      socket.on('task-created', (task) => {
        setTasks((prev) => {
          if (prev.find((t) => t._id === task._id)) return prev;
          return [...prev, task];
        });
      });
      socket.on('task-updated', (updatedTask) => {
        setTasks((prev) => prev.map((t) => (t._id === updatedTask._id ? updatedTask : t)));
      });
      socket.on('task-deleted', ({ taskId }) => {
        setTasks((prev) => prev.filter((t) => t._id !== taskId));
      });
      return () => {
        socket.emit('leave-project', projectId);
        socket.off('task-created');
        socket.off('task-updated');
        socket.off('task-deleted');
      };
    }
  }, [socket, projectId]);

  const fetchData = async () => {
    try {
      const [projRes, taskRes] = await Promise.all([
        getProject(projectId),
        getTasksByProject(projectId),
      ]);
      setProject(projRes.data);
      setTasks(taskRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async (status) => {
    if (!newTask.title.trim()) return;
    try {
      await createTask({ title: newTask.title, priority: newTask.priority, projectId, status });
      setNewTask({ title: '', priority: 'medium' });
      setShowAddTask(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDragStart = (event) => {
    const task = tasks.find((t) => t._id === event.active.id);
    setActiveTask(task);
  };

  const handleDragEnd = async (event) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id;
    const task = tasks.find((t) => t._id === taskId);
    if (!task) return;
    let newStatus = null;
    if (COLUMNS.find((c) => c.id === over.id)) {
      newStatus = over.id;
    } else {
      const overTask = tasks.find((t) => t._id === over.id);
      if (overTask) newStatus = overTask.status;
    }
    if (newStatus && newStatus !== task.status) {
      setTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t)));
      try {
        await updateTaskStatus(taskId, { status: newStatus });
      } catch (err) {
        fetchData();
      }
    }
  };

  const getColumnTasks = (columnId) => tasks.filter((t) => t.status === columnId);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Navbar />
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <Link to="/dashboard" className="hover:text-indigo-400 transition">Projects</Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <Link to={`/project/${projectId}`} className="hover:text-indigo-400 transition">{project?.name}</Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-gray-300 font-medium">Board</span>
        </div>

        <h1 className="text-xl font-bold text-white mb-6">Kanban Board</h1>

        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {COLUMNS.map((column) => {
              const columnTasks = getColumnTasks(column.id);
              return (
                <div key={column.id} className={`rounded-2xl border ${column.border} bg-gradient-to-b ${column.gradient} p-4 min-h-[500px]`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${column.dot}`}></div>
                      <h3 className="font-semibold text-gray-300 text-sm">{column.title}</h3>
                      <span className="bg-white/5 text-gray-500 text-xs rounded-full px-2 py-0.5 font-medium border border-white/5">
                        {columnTasks.length}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowAddTask(showAddTask === column.id ? null : column.id)}
                      className="text-gray-600 hover:text-gray-300 transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>

                  {showAddTask === column.id && (
                    <div className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.08] mb-3">
                      <input
                        type="text"
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                        placeholder="Task title..."
                        className="w-full text-sm px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-indigo-500/50 outline-none mb-2"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddTask(column.id);
                          if (e.key === 'Escape') setShowAddTask(null);
                        }}
                      />
                      <div className="flex gap-2">
                        <select
                          value={newTask.priority}
                          onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                          className="text-xs px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-400 outline-none"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                        <button
                          onClick={() => handleAddTask(column.id)}
                          className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-500 transition font-medium"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}

                  <SortableContext items={columnTasks.map((t) => t._id)} strategy={verticalListSortingStrategy} id={column.id}>
                    <div className="space-y-2 min-h-[100px]" data-column={column.id}>
                      {columnTasks.map((task) => (
                        <TaskCard key={task._id} task={task} />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              );
            })}
          </div>
          <DragOverlay>
            <TaskOverlay task={activeTask} />
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
