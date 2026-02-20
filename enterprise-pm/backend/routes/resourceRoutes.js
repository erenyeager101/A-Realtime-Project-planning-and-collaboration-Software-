const express = require('express');
const Resource = require('../models/Resource');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/resources/:projectId — Get all resources for a project
router.get('/:projectId', auth, async (req, res) => {
  try {
    const { type, tag } = req.query;
    const filter = { projectId: req.params.projectId };
    if (type) filter.type = type;
    if (tag) filter.tags = tag;

    const resources = await Resource.find(filter)
      .populate('addedBy', 'name')
      .sort({ pinned: -1, createdAt: -1 });

    res.json(resources);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/resources/:projectId — Add a resource
router.post('/:projectId', auth, async (req, res) => {
  try {
    const { type, title, content, url, tags } = req.body;

    const resource = await Resource.create({
      projectId: req.params.projectId,
      addedBy: req.user._id,
      type,
      title,
      content,
      url,
      tags: tags || [],
    });

    await resource.populate('addedBy', 'name');
    res.status(201).json(resource);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/resources/:projectId/:id — Update a resource
router.put('/:projectId/:id', auth, async (req, res) => {
  try {
    const resource = await Resource.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).populate('addedBy', 'name');

    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }
    res.json(resource);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/resources/:projectId/:id/pin — Toggle pin
router.patch('/:projectId/:id/pin', auth, async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }
    resource.pinned = !resource.pinned;
    await resource.save();
    res.json(resource);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/resources/:projectId/:id — Delete a resource
router.delete('/:projectId/:id', auth, async (req, res) => {
  try {
    await Resource.findByIdAndDelete(req.params.id);
    res.json({ message: 'Resource deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
