import API from './api';

export const getTasksByProject = (projectId) => API.get(`/tasks/project/${projectId}`);
export const getTask = (id) => API.get(`/tasks/${id}`);
export const createTask = (data) => API.post('/tasks', data);
export const updateTask = (id, data) => API.put(`/tasks/${id}`, data);
export const updateTaskStatus = (id, data) => API.patch(`/tasks/${id}/status`, data);
export const deleteTask = (id) => API.delete(`/tasks/${id}`);
export const addComment = (taskId, data) => API.post(`/tasks/${taskId}/comments`, data);
