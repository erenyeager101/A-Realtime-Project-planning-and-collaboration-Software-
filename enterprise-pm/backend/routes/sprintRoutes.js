const express = require('express');
const Sprint = require('../models/Sprint');
const Task = require('../models/Task');
const { auth } = require('../middleware/auth');
const {
  requireProjectRoles,
  requireSprintProjectRoles,
} = require('../middleware/projectAccess');

const router = express.Router();

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function buildSprintSummary(sprintId) {
  const counts = await Task.aggregate([
    { $match: { sprintId } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const summary = { total: 0, todo: 0, inprogress: 0, review: 0, done: 0 };
  for (const item of counts) {
    summary[item._id] = item.count;
    summary.total += item.count;
  }
  return summary;
}

// GET /api/sprints/project/:projectId — List sprints for a project
router.get(
  '/project/:projectId',
  auth,
  requireProjectRoles(['member', 'manager', 'admin'], { source: 'params', key: 'projectId' }),
  async (req, res) => {
    try {
      const sprints = await Sprint.find({ projectId: req.params.projectId })
        .populate('createdBy', 'name email')
        .sort({ startDate: -1 });

      const withSummary = await Promise.all(
        sprints.map(async (sprint) => ({
          ...sprint.toObject(),
          summary: await buildSprintSummary(sprint._id),
        }))
      );

      res.json(withSummary);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// POST /api/sprints/project/:projectId — Create sprint
router.post(
  '/project/:projectId',
  auth,
  requireProjectRoles(['manager', 'admin'], { source: 'params', key: 'projectId' }),
  async (req, res) => {
    try {
      const { name, goal = '', startDate, endDate, status = 'planning' } = req.body;

      if (!name?.trim()) {
        return res.status(400).json({ message: 'Sprint name is required' });
      }

      const start = parseDate(startDate);
      const end = parseDate(endDate);
      if (!start || !end) {
        return res.status(400).json({ message: 'Valid sprint start and end dates are required' });
      }
      if (end < start) {
        return res.status(400).json({ message: 'Sprint end date must be after start date' });
      }

      if (status === 'active') {
        const activeExists = await Sprint.exists({
          projectId: req.params.projectId,
          status: 'active',
        });
        if (activeExists) {
          return res.status(400).json({ message: 'This project already has an active sprint' });
        }
      }

      const sprint = await Sprint.create({
        projectId: req.params.projectId,
        name: name.trim(),
        goal: goal.trim(),
        startDate: start,
        endDate: end,
        status,
        createdBy: req.user._id,
        completedAt: status === 'completed' ? new Date() : null,
      });

      await sprint.populate('createdBy', 'name email');
      res.status(201).json(sprint);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ message: 'A sprint with this name already exists in the project' });
      }
      res.status(500).json({ message: error.message });
    }
  }
);

// GET /api/sprints/:id — Get sprint details
router.get(
  '/:id',
  auth,
  requireSprintProjectRoles(['member', 'manager', 'admin']),
  async (req, res) => {
    try {
      const sprint = await Sprint.findById(req.params.id).populate('createdBy', 'name email');
      const summary = await buildSprintSummary(sprint._id);
      res.json({ ...sprint.toObject(), summary });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// PUT /api/sprints/:id — Update sprint metadata
router.put(
  '/:id',
  auth,
  requireSprintProjectRoles(['manager', 'admin']),
  async (req, res) => {
    try {
      const updates = {};
      const { name, goal, startDate, endDate } = req.body;

      if (name !== undefined) {
        if (!name.trim()) return res.status(400).json({ message: 'Sprint name cannot be empty' });
        updates.name = name.trim();
      }
      if (goal !== undefined) updates.goal = goal.trim();

      if (startDate !== undefined) {
        const parsed = parseDate(startDate);
        if (!parsed) return res.status(400).json({ message: 'Invalid startDate' });
        updates.startDate = parsed;
      }
      if (endDate !== undefined) {
        const parsed = parseDate(endDate);
        if (!parsed) return res.status(400).json({ message: 'Invalid endDate' });
        updates.endDate = parsed;
      }

      const mergedStart = updates.startDate || req.sprint.startDate;
      const mergedEnd = updates.endDate || req.sprint.endDate;
      if (mergedEnd < mergedStart) {
        return res.status(400).json({ message: 'Sprint end date must be after start date' });
      }

      const sprint = await Sprint.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
      }).populate('createdBy', 'name email');

      res.json(sprint);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ message: 'A sprint with this name already exists in the project' });
      }
      res.status(500).json({ message: error.message });
    }
  }
);

// PATCH /api/sprints/:id/status — Update sprint status
router.patch(
  '/:id/status',
  auth,
  requireSprintProjectRoles(['manager', 'admin']),
  async (req, res) => {
    try {
      const { status, moveIncompleteToBacklog = true } = req.body;
      const allowed = ['planning', 'active', 'completed', 'cancelled'];
      if (!allowed.includes(status)) {
        return res.status(400).json({ message: 'Invalid sprint status' });
      }

      if (status === 'active' && req.sprint.status !== 'active') {
        const activeExists = await Sprint.exists({
          _id: { $ne: req.sprint._id },
          projectId: req.sprint.projectId,
          status: 'active',
        });
        if (activeExists) {
          return res.status(400).json({ message: 'This project already has another active sprint' });
        }
      }

      const update = { status, completedAt: null };
      if (status === 'completed' || status === 'cancelled') {
        update.completedAt = new Date();
      }

      const sprint = await Sprint.findByIdAndUpdate(req.sprint._id, update, {
        new: true,
      }).populate('createdBy', 'name email');

      if ((status === 'completed' || status === 'cancelled') && moveIncompleteToBacklog) {
        await Task.updateMany(
          { sprintId: req.sprint._id, status: { $ne: 'done' } },
          { $set: { sprintId: null } }
        );
      }

      res.json(sprint);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// POST /api/sprints/:id/tasks — Assign/remove tasks in sprint
router.post(
  '/:id/tasks',
  auth,
  requireSprintProjectRoles(['manager', 'admin']),
  async (req, res) => {
    try {
      if (['completed', 'cancelled'].includes(req.sprint.status)) {
        return res.status(400).json({ message: 'Cannot modify tasks in a closed sprint' });
      }

      const { taskIds = [], action = 'assign' } = req.body;
      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ message: 'taskIds must be a non-empty array' });
      }
      if (!['assign', 'remove'].includes(action)) {
        return res.status(400).json({ message: 'Invalid action. Use assign or remove' });
      }

      const tasks = await Task.find({
        _id: { $in: taskIds },
        projectId: req.sprint.projectId,
      }).select('_id sprintId');

      if (tasks.length !== taskIds.length) {
        return res.status(400).json({ message: 'One or more tasks were not found in this project' });
      }

      if (action === 'assign') {
        await Task.updateMany(
          { _id: { $in: taskIds }, projectId: req.sprint.projectId },
          { $set: { sprintId: req.sprint._id } }
        );
      } else {
        await Task.updateMany(
          { _id: { $in: taskIds }, projectId: req.sprint.projectId, sprintId: req.sprint._id },
          { $set: { sprintId: null } }
        );
      }

      res.json({ message: `Tasks ${action === 'assign' ? 'assigned to' : 'removed from'} sprint` });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// DELETE /api/sprints/:id — Delete sprint
router.delete(
  '/:id',
  auth,
  requireSprintProjectRoles(['admin']),
  async (req, res) => {
    try {
      await Task.updateMany({ sprintId: req.sprint._id }, { $set: { sprintId: null } });
      await Sprint.findByIdAndDelete(req.sprint._id);
      res.json({ message: 'Sprint deleted' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;

