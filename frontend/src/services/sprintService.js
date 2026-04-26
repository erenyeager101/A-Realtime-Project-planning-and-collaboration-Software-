import API from './api';

export const getSprintsByProject = (projectId) => API.get(`/sprints/project/${projectId}`);
export const getSprint = (id) => API.get(`/sprints/${id}`);
export const createSprint = (projectId, data) => API.post(`/sprints/project/${projectId}`, data);
export const updateSprint = (id, data) => API.put(`/sprints/${id}`, data);
export const updateSprintStatus = (id, data) => API.patch(`/sprints/${id}/status`, data);
export const updateSprintTasks = (id, data) => API.post(`/sprints/${id}/tasks`, data);
export const deleteSprint = (id) => API.delete(`/sprints/${id}`);

