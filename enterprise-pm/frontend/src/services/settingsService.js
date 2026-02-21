import API from './api';

export const getSettings = () => API.get('/settings');
export const updateSettings = (data) => API.put('/settings', data);
export const getSetupStatus = () => API.get('/settings/status');
export const initialSetup = (data) => API.post('/settings/setup', data);
