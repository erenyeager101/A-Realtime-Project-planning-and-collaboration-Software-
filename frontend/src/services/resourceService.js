import API from './api';

export const getResources = (projectId, params) =>
  API.get(`/resources/${projectId}`, { params });
export const addResource = (projectId, data) =>
  API.post(`/resources/${projectId}`, data);
export const updateResource = (projectId, id, data) =>
  API.put(`/resources/${projectId}/${id}`, data);
export const togglePin = (projectId, id) =>
  API.patch(`/resources/${projectId}/${id}/pin`);
export const deleteResource = (projectId, id) =>
  API.delete(`/resources/${projectId}/${id}`);
