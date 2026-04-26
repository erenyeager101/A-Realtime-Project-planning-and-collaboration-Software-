import API from './api';

export const getTasksByProject = (projectId, params = {}) =>
  API.get(`/tasks/project/${projectId}`, { params });
export const getTask = (id) => API.get(`/tasks/${id}`);
export const createTask = (data) => API.post('/tasks', data);
export const updateTask = (id, data) => API.put(`/tasks/${id}`, data);
export const updateTaskStatus = (id, data) => API.patch(`/tasks/${id}/status`, data);
export const updateTaskSprint = (id, data) => API.patch(`/tasks/${id}/sprint`, data);
export const updateTaskDependencies = (id, data) =>
  API.patch(`/tasks/${id}/dependencies`, data);
export const deleteTask = (id) => API.delete(`/tasks/${id}`);
export const addComment = (taskId, data) => API.post(`/tasks/${taskId}/comments`, data);
