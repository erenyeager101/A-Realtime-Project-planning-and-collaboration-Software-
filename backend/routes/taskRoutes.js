const express = require('express');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const Activity = require('../models/Activity');
const Sprint = require('../models/Sprint');
const { auth } = require('../middleware/auth');
const {
  requireProjectRoles,
  requireTaskProjectRoles,
} = require('../middleware/projectAccess');

const router = express.Router();

function populateTask(query) {
  return query
    .populate('assignee', 'name email')
    .populate('comments.user', 'name email')
    .populate('dependsOn', 'title status assignee sprintId')
    .populate('sprintId', 'name status startDate endDate');
}

function withDependencyState(task) {
  const raw = task.toObject ? task.toObject() : task;
  const unresolved = (raw.dependsOn || [])
    .filter((dep) => dep && dep.status !== 'done')
    .map((dep) => ({
      _id: dep._id,
      title: dep.title,
      status: dep.status,
      assignee: dep.assignee || null,
    }));

  return {
    ...raw,
    dependencyState: {
      isBlocked: unresolved.length > 0,
      unresolved,
      totalDependencies: (raw.dependsOn || []).length,
    },
  };
}

async function validateSprintForTask(projectId, sprintId) {
  if (sprintId === undefined) return null;
  if (sprintId === null || sprintId === '') return null;

  const sprint = await Sprint.findById(sprintId).select('projectId status');
  if (!sprint || sprint.projectId.toString() !== projectId.toString()) {
    throw new Error('Sprint not found in this project');
  }
  if (['completed', 'cancelled'].includes(sprint.status)) {
    throw new Error('Cannot assign tasks to a closed sprint');
  }
  return sprint._id;
}

async function validateDependencies({ projectId, taskId, dependsOn }) {
  if (dependsOn === undefined) return undefined;
  if (!Array.isArray(dependsOn)) throw new Error('dependsOn must be an array of task IDs');

  const unique = [...new Set(dependsOn.map((id) => String(id).trim()).filter(Boolean))];

  if (taskId && unique.includes(String(taskId))) {
    throw new Error('A task cannot depend on itself');
  }

  if (unique.length === 0) return [];

  const deps = await Task.find({
    _id: { $in: unique },
    projectId,
  }).select('_id');

  if (deps.length !== unique.length) {
    throw new Error('One or more dependency tasks do not exist in this project');
  }

  if (taskId) {
    const tasks = await Task.find({ projectId }).select('_id dependsOn');
    const graph = new Map();
    for (const task of tasks) {
      graph.set(String(task._id), (task.dependsOn || []).map((id) => String(id)));
    }
    graph.set(String(taskId), unique);

    const hasPath = (start, target, visited = new Set()) => {
      if (start === target) return true;
      if (visited.has(start)) return false;
      visited.add(start);

      const nextList = graph.get(start) || [];
      for (const next of nextList) {
        if (hasPath(next, target, visited)) return true;
      }
      return false;
    };

    for (const depId of unique) {
      if (hasPath(depId, String(taskId))) {
        throw new Error('Dependency cycle detected');
      }
    }
  }

  return unique;
}

async function assertDependenciesResolved(projectId, dependencyIds) {
  if (!dependencyIds || dependencyIds.length === 0) return;

  const unresolved = await Task.find({
    _id: { $in: dependencyIds },
    projectId,
    status: { $ne: 'done' },
  }).select('title status');

  if (unresolved.length > 0) {
    const names = unresolved.map((t) => `${t.title} (${t.status})`).join(', ');
    throw new Error(`Task is blocked by unresolved dependencies: ${names}`);
  }
}

// POST /api/tasks — Create a new task
router.post(
  '/',
  auth,
  requireProjectRoles(['manager', 'admin'], { source: 'body', key: 'projectId' }),
  async (req, res) => {
    try {
      const { title, description, projectId, assignee, priority, status, dueDate, sprintId, dependsOn } =
        req.body;

      const normalizedSprintId = await validateSprintForTask(projectId, sprintId);
      const normalizedDependencies = await validateDependencies({
        projectId,
        taskId: null,
        dependsOn,
      });

      const task = new Task({
        title,
        description,
        projectId,
        assignee,
        priority,
        status: status || 'todo',
        dueDate,
        sprintId: normalizedSprintId,
        dependsOn: normalizedDependencies || [],
      });

      await task.save();
      const hydrated = await populateTask(Task.findById(task._id));

      if (assignee) {
        await Notification.create({
          user: assignee,
          type: 'task_assigned',
          message: `You were assigned task "${title}"`,
          projectId,
          taskId: task._id,
        });
      }

      await Activity.create({
        user: req.user._id,
        action: 'task_created',
        projectId,
        taskId: task._id,
        details: `Task "${title}" created`,
      });

      const io = req.app.get('io');
      io.to(`project-${projectId}`).emit('task-created', withDependencyState(hydrated));

      res.status(201).json(withDependencyState(hydrated));
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

// GET /api/tasks/project/:projectId — Get tasks by project
router.get(
  '/project/:projectId',
  auth,
  requireProjectRoles(['member', 'manager', 'admin'], { source: 'params', key: 'projectId' }),
  async (req, res) => {
    try {
      const { scope = 'all', sprintId, blockedOnly = 'false' } = req.query;
      const filter = { projectId: req.params.projectId };

      if (scope === 'backlog') {
        filter.sprintId = null;
      } else if (scope === 'sprint') {
        if (!sprintId) {
          return res.status(400).json({ message: 'sprintId query param is required for scope=sprint' });
        }
        filter.sprintId = sprintId;
      } else if (sprintId) {
        filter.sprintId = sprintId;
      }

      const tasks = await populateTask(
        Task.find(filter).sort({ order: 1, createdAt: -1 })
      );

      let payload = tasks.map((task) => withDependencyState(task));
      if (blockedOnly === 'true') {
        payload = payload.filter((task) => task.dependencyState.isBlocked);
      }

      res.json(payload);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// GET /api/tasks/:id — Get single task
router.get('/:id', auth, requireTaskProjectRoles(['member', 'manager', 'admin']), async (req, res) => {
  try {
    const task = await populateTask(Task.findById(req.params.id));
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json(withDependencyState(task));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/tasks/:id — Update task
router.put('/:id', auth, requireTaskProjectRoles(['manager', 'admin']), async (req, res) => {
  try {
    const oldTask = await Task.findById(req.params.id);
    if (!oldTask) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const updates = { ...req.body };
    if (Object.prototype.hasOwnProperty.call(req.body, 'sprintId')) {
      updates.sprintId = await validateSprintForTask(oldTask.projectId, req.body.sprintId);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'dependsOn')) {
      updates.dependsOn = await validateDependencies({
        projectId: oldTask.projectId,
        taskId: oldTask._id,
        dependsOn: req.body.dependsOn,
      });
    }

    const nextDependencies =
      updates.dependsOn !== undefined
        ? updates.dependsOn
        : (oldTask.dependsOn || []).map((id) => String(id));

    const nextStatus = updates.status || oldTask.status;
    if (nextStatus === 'done') {
      await assertDependenciesResolved(oldTask.projectId, nextDependencies);
    }

    const task = await populateTask(
      Task.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
      })
    );

    if (updates.status && updates.status !== oldTask.status) {
      await Activity.create({
        user: req.user._id,
        action: 'status_changed',
        projectId: task.projectId,
        taskId: task._id,
        details: `Task "${task.title}" moved from ${oldTask.status} to ${updates.status}`,
      });

      if (task.assignee) {
        await Notification.create({
          user: task.assignee._id || task.assignee,
          type: 'task_updated',
          message: `Task "${task.title}" status changed to ${updates.status}`,
          projectId: task.projectId,
          taskId: task._id,
        });
      }
    }

    const io = req.app.get('io');
    io.to(`project-${task.projectId}`).emit('task-updated', withDependencyState(task));

    res.json(withDependencyState(task));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PATCH /api/tasks/:id/status — Update task status
router.patch('/:id/status', auth, requireTaskProjectRoles(['member', 'manager', 'admin']), async (req, res) => {
  try {
    const { status, order } = req.body;
    const oldTask = await Task.findById(req.params.id);

    if (!oldTask) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (status === 'done') {
      await assertDependenciesResolved(oldTask.projectId, oldTask.dependsOn || []);
    }

    oldTask.status = status;
    if (order !== undefined) oldTask.order = order;
    await oldTask.save();

    const task = await populateTask(Task.findById(req.params.id));

    await Activity.create({
      user: req.user._id,
      action: 'status_changed',
      projectId: task.projectId,
      taskId: task._id,
      details: `Task "${task.title}" moved to ${status}`,
    });

    const io = req.app.get('io');
    io.to(`project-${task.projectId}`).emit('task-updated', withDependencyState(task));

    res.json(withDependencyState(task));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PATCH /api/tasks/:id/sprint — Move task to sprint/backlog
router.patch('/:id/sprint', auth, requireTaskProjectRoles(['manager', 'admin']), async (req, res) => {
  try {
    const { sprintId = null } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    task.sprintId = await validateSprintForTask(task.projectId, sprintId);
    await task.save();

    const updatedTask = await populateTask(Task.findById(task._id));
    const io = req.app.get('io');
    io.to(`project-${task.projectId}`).emit('task-updated', withDependencyState(updatedTask));

    res.json(withDependencyState(updatedTask));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PATCH /api/tasks/:id/dependencies — Update dependencies
router.patch('/:id/dependencies', auth, requireTaskProjectRoles(['manager', 'admin']), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const dependsOn = await validateDependencies({
      projectId: task.projectId,
      taskId: task._id,
      dependsOn: req.body.dependsOn,
    });

    if (task.status === 'done') {
      await assertDependenciesResolved(task.projectId, dependsOn);
    }

    task.dependsOn = dependsOn;
    await task.save();

    const updatedTask = await populateTask(Task.findById(task._id));
    const io = req.app.get('io');
    io.to(`project-${task.projectId}`).emit('task-updated', withDependencyState(updatedTask));

    res.json(withDependencyState(updatedTask));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// POST /api/tasks/:id/comments — Add comment to task
router.post('/:id/comments', auth, requireTaskProjectRoles(['member', 'manager', 'admin']), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    task.comments.push({ user: req.user._id, text: req.body.text });
    await task.save();

    const updatedTask = await populateTask(Task.findById(req.params.id));

    await Activity.create({
      user: req.user._id,
      action: 'comment_added',
      projectId: task.projectId,
      taskId: task._id,
      details: `Comment added to "${task.title}"`,
    });

    if (task.assignee && task.assignee.toString() !== req.user._id.toString()) {
      await Notification.create({
        user: task.assignee,
        type: 'comment_added',
        message: `New comment on task "${task.title}"`,
        projectId: task.projectId,
        taskId: task._id,
      });
    }

    const io = req.app.get('io');
    io.to(`project-${task.projectId}`).emit('task-updated', withDependencyState(updatedTask));

    res.json(withDependencyState(updatedTask));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/tasks/:id — Delete task
router.delete('/:id', auth, requireTaskProjectRoles(['manager', 'admin']), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await Task.findByIdAndDelete(req.params.id);

    await Activity.create({
      user: req.user._id,
      action: 'task_deleted',
      projectId: task.projectId,
      taskId: task._id,
      details: `Task "${task.title}" deleted`,
    });

    const io = req.app.get('io');
    io.to(`project-${task.projectId}`).emit('task-deleted', { taskId: req.params.id });

    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

