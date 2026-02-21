import API from './api';

// AI Project Planner
export const generatePlan = (data) => API.post('/ai/plan', data);
export const breakdownTask = (data) => API.post('/ai/breakdown', data);

// AI Research Assistant
export const askResearch = (projectId, data) => API.post(`/ai/research/${projectId}`, data);
export const getConversations = (projectId) => API.get(`/ai/conversations/${projectId}`);
export const getConversation = (projectId, conversationId) =>
  API.get(`/ai/conversations/${projectId}/${conversationId}`);

// AI Document Generator
export const generateDoc = (projectId, data) => API.post(`/ai/generate-doc/${projectId}`, data);
export const getDocs = (projectId) => API.get(`/ai/docs/${projectId}`);
export const getDoc = (projectId, docId) => API.get(`/ai/docs/${projectId}/${docId}`);
export const deleteDoc = (projectId, docId) => API.delete(`/ai/docs/${projectId}/${docId}`);

// Project Health
export const getProjectHealth = (projectId) => API.get(`/ai/health/${projectId}`);

// One-Click Project Pack
export const createProjectPack = (data) => API.post('/ai/project-pack', data);
