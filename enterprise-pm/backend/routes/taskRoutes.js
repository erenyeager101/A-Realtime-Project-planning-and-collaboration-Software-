const express = require('express');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const Activity = require('../models/Activity');
const { auth } = require('../middleware/auth');

const router = express.Router();

// POST /api/tasks — Create a new task
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, projectId, assignee, priority, status, dueDate } = req.body;

    const task = new Task({
      title,
      description,
      projectId,
      assignee,
      priority,
      status: status || 'todo',
      dueDate,
    });

    await task.save();
    await task.populate('assignee', 'name email');

    // Create notification if assigned
    if (assignee) {
      await Notification.create({
        user: assignee,
        type: 'task_assigned',
        message: `You were assigned task "${title}"`,
        projectId,
        taskId: task._id,
      });
    }

    // Log activity
    await Activity.create({
      user: req.user._id,
      action: 'task_created',
      projectId,
      taskId: task._id,
      details: `Task "${title}" created`,
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`project-${projectId}`).emit('task-created', task);

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/tasks/project/:projectId — Get tasks by project
router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ projectId: req.params.projectId })
      .populate('assignee', 'name email')
      .populate('comments.user', 'name email')
      .sort({ order: 1, createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/tasks/:id — Get single task
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignee', 'name email')
      .populate('comments.user', 'name email');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/tasks/:id — Update task
router.put('/:id', auth, async (req, res) => {
  try {
    const oldTask = await Task.findById(req.params.id);
    if (!oldTask) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const task = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    })
      .populate('assignee', 'name email')
      .populate('comments.user', 'name email');

    // If status changed, log it and notify
    if (req.body.status && req.body.status !== oldTask.status) {
      await Activity.create({
        user: req.user._id,
        action: 'status_changed',
        projectId: task.projectId,
        taskId: task._id,
        details: `Task "${task.title}" moved from ${oldTask.status} to ${req.body.status}`,
      });

      if (task.assignee) {
        await Notification.create({
          user: task.assignee._id || task.assignee,
          type: 'task_updated',
          message: `Task "${task.title}" status changed to ${req.body.status}`,
          projectId: task.projectId,
          taskId: task._id,
        });
      }
    }

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`project-${task.projectId}`).emit('task-updated', task);

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/tasks/:id/status — Update task status (for Kanban drag-drop)
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status, order } = req.body;
    const oldTask = await Task.findById(req.params.id);

    if (!oldTask) {
      return res.status(404).json({ message: 'Task not found' });
    }

    oldTask.status = status;
    if (order !== undefined) oldTask.order = order;
    await oldTask.save();

    const task = await Task.findById(req.params.id)
      .populate('assignee', 'name email')
      .populate('comments.user', 'name email');

    // Log activity
    await Activity.create({
      user: req.user._id,
      action: 'status_changed',
      projectId: task.projectId,
      taskId: task._id,
      details: `Task "${task.title}" moved to ${status}`,
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`project-${task.projectId}`).emit('task-updated', task);

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/tasks/:id/comments — Add comment to task
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    task.comments.push({ user: req.user._id, text: req.body.text });
    await task.save();

    const updatedTask = await Task.findById(req.params.id)
      .populate('assignee', 'name email')
      .populate('comments.user', 'name email');

    // Log activity
    await Activity.create({
      user: req.user._id,
      action: 'comment_added',
      projectId: task.projectId,
      taskId: task._id,
      details: `Comment added to "${task.title}"`,
    });

    // Notify assignee of new comment
    if (task.assignee && task.assignee.toString() !== req.user._id.toString()) {
      await Notification.create({
        user: task.assignee,
        type: 'comment_added',
        message: `New comment on task "${task.title}"`,
        projectId: task.projectId,
        taskId: task._id,
      });
    }

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`project-${task.projectId}`).emit('task-updated', updatedTask);

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/tasks/:id — Delete task
router.delete('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await Task.findByIdAndDelete(req.params.id);

    // Log activity
    await Activity.create({
      user: req.user._id,
      action: 'task_deleted',
      projectId: task.projectId,
      taskId: task._id,
      details: `Task "${task.title}" deleted`,
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`project-${task.projectId}`).emit('task-deleted', { taskId: req.params.id });

    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
