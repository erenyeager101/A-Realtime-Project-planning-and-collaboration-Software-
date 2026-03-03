const Project = require('../models/Project');
const Task = require('../models/Task');
const Sprint = require('../models/Sprint');

const VALID_ROLES = ['member', 'manager', 'admin'];

function normalizeRoles(roles) {
  const list = Array.isArray(roles) ? roles : [roles];
  return list.filter((role) => VALID_ROLES.includes(role));
}

function getProjectRole(project, userId) {
  if (!project || !userId) return null;

  if (project.owner?.toString() === userId.toString()) {
    return 'admin';
  }

  const member = (project.members || []).find(
    (m) => m.user?.toString() === userId.toString()
  );

  return member?.role || null;
}

async function loadProjectAccess(projectId, userId) {
  if (!projectId) return { error: 'missing_project_id', project: null, role: null };

  const project = await Project.findById(projectId);
  if (!project) return { error: 'project_not_found', project: null, role: null };

  const role = getProjectRole(project, userId);
  if (!role) return { error: 'project_forbidden', project, role: null };

  return { error: null, project, role };
}

function requireProjectRoles(roles, options = {}) {
  const allowedRoles = normalizeRoles(roles);
  const source = options.source || 'params';
  const key = options.key || 'projectId';
  const optional = options.optional || false;

  return async (req, res, next) => {
    try {
      const projectId = req[source]?.[key];

      if (!projectId) {
        if (optional) return next();
        return res.status(400).json({ message: 'Project ID is required' });
      }

      const access = await loadProjectAccess(projectId, req.user._id);
      if (access.error === 'project_not_found') {
        return res.status(404).json({ message: 'Project not found' });
      }
      if (access.error) {
        return res.status(403).json({ message: 'You do not have access to this project' });
      }

      if (!allowedRoles.includes(access.role)) {
        return res.status(403).json({ message: 'Insufficient project permissions' });
      }

      req.project = access.project;
      req.projectRole = access.role;
      next();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
}

function requireTaskProjectRoles(roles, options = {}) {
  const allowedRoles = normalizeRoles(roles);
  const source = options.source || 'params';
  const key = options.key || 'id';

  return async (req, res, next) => {
    try {
      const taskId = req[source]?.[key];
      if (!taskId) {
        return res.status(400).json({ message: 'Task ID is required' });
      }

      const task = await Task.findById(taskId);
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }

      const access = await loadProjectAccess(task.projectId, req.user._id);
      if (access.error === 'project_not_found') {
        return res.status(404).json({ message: 'Project not found' });
      }
      if (access.error) {
        return res.status(403).json({ message: 'You do not have access to this task' });
      }
      if (!allowedRoles.includes(access.role)) {
        return res.status(403).json({ message: 'Insufficient project permissions' });
      }

      req.task = task;
      req.project = access.project;
      req.projectRole = access.role;
      next();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
}

function requireSprintProjectRoles(roles, options = {}) {
  const allowedRoles = normalizeRoles(roles);
  const source = options.source || 'params';
  const key = options.key || 'id';

  return async (req, res, next) => {
    try {
      const sprintId = req[source]?.[key];
      if (!sprintId) {
        return res.status(400).json({ message: 'Sprint ID is required' });
      }

      const sprint = await Sprint.findById(sprintId);
      if (!sprint) {
        return res.status(404).json({ message: 'Sprint not found' });
      }

      const access = await loadProjectAccess(sprint.projectId, req.user._id);
      if (access.error === 'project_not_found') {
        return res.status(404).json({ message: 'Project not found' });
      }
      if (access.error) {
        return res.status(403).json({ message: 'You do not have access to this sprint' });
      }
      if (!allowedRoles.includes(access.role)) {
        return res.status(403).json({ message: 'Insufficient project permissions' });
      }

      req.sprint = sprint;
      req.project = access.project;
      req.projectRole = access.role;
      next();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
}

module.exports = {
  getProjectRole,
  loadProjectAccess,
  requireProjectRoles,
  requireTaskProjectRoles,
  requireSprintProjectRoles,
};

