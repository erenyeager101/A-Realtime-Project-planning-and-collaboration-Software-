const express = require('express');
const Project = require('../models/Project');
const Notification = require('../models/Notification');
const Activity = require('../models/Activity');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { requireProjectRoles } = require('../middleware/projectAccess');

const router = express.Router();

// POST /api/projects — Create a new project
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, startDate, endDate } = req.body;

    const project = new Project({
      name,
      description,
      owner: req.user._id,
      members: [{ user: req.user._id, role: 'admin' }],
      startDate,
      endDate,
    });

    await project.save();
    await project.populate('owner', 'name email');
    await project.populate('members.user', 'name email');

    // Log activity
    await Activity.create({
      user: req.user._id,
      action: 'project_created',
      projectId: project._id,
      details: `Project "${name}" created`,
    });

    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/projects — Get all projects for current user
router.get('/', auth, async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [{ owner: req.user._id }, { 'members.user': req.user._id }],
    })
      .populate('owner', 'name email')
      .populate('members.user', 'name email')
      .sort({ updatedAt: -1 });

    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/projects/:id — Get project by ID
router.get('/:id', auth, requireProjectRoles(['member', 'manager', 'admin'], { source: 'params', key: 'id' }), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/projects/:id — Update project
router.put('/:id', auth, requireProjectRoles(['manager', 'admin'], { source: 'params', key: 'id' }), async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/projects/:id/members — Add member to project
router.post('/:id/members', auth, requireProjectRoles(['admin'], { source: 'params', key: 'id' }), async (req, res) => {
  try {
    const { userId, email, role } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!userId && !email) {
      return res.status(400).json({ message: 'userId or email is required' });
    }

    const targetUser = userId
      ? await User.findById(userId).select('_id')
      : await User.findOne({ email: String(email).toLowerCase().trim() }).select('_id');

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is already a member
    const isMember = project.members.some(
      (m) => m.user.toString() === targetUser._id.toString()
    );
    if (isMember) {
      return res.status(400).json({ message: 'User is already a member' });
    }

    const normalizedRole = ['member', 'manager', 'admin'].includes(role) ? role : 'member';
    project.members.push({ user: targetUser._id, role: normalizedRole });
    await project.save();
    await project.populate('owner', 'name email');
    await project.populate('members.user', 'name email');

    // Create notification for the added member
    await Notification.create({
      user: targetUser._id,
      type: 'member_added',
      message: `You were added to project "${project.name}"`,
      projectId: project._id,
    });

    // Log activity
    await Activity.create({
      user: req.user._id,
      action: 'member_added',
      projectId: project._id,
      details: `Member added to "${project.name}"`,
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`project-${project._id}`).emit('project-updated', project);

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/projects/:id — Delete project
router.delete('/:id', auth, requireProjectRoles(['admin'], { source: 'params', key: 'id' }), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Only owner can delete
    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can delete this project' });
    }

    await Project.findByIdAndDelete(req.params.id);
    res.json({ message: 'Project deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
