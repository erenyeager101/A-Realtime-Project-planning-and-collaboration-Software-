const express = require('express');
const { auth } = require('../middleware/auth');
const Project = require('../models/Project');
const Task = require('../models/Task');
const AIConversation = require('../models/AIConversation');
const GeneratedDoc = require('../models/GeneratedDoc');
const Resource = require('../models/Resource');
const {
  generateProjectPlan,
  researchAssistant,
  generateDocument,
  analyzeProjectHealth,
  breakdownTask,
  generateProjectPack,
} = require('../services/aiService');

const router = express.Router();

// ── AI PROJECT PLANNER ──────────────────────────────────────────────
// POST /api/ai/plan — Generate a full project plan from a description
router.post('/plan', auth, async (req, res) => {
  try {
    const { description, projectId } = req.body;
    if (!description) {
      return res.status(400).json({ message: 'Project description is required' });
    }

    const plan = await generateProjectPlan(description);

    // If a projectId is provided, auto-create tasks from the plan
    if (projectId) {
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      const createdTasks = [];
      for (const mod of plan.modules) {
        for (const task of mod.tasks) {
          const newTask = await Task.create({
            title: task.title,
            description: `**Module:** ${mod.name}\n\n${task.description}\n\n*Estimated: ${task.estimatedHours}h · Category: ${task.category}*`,
            projectId,
            priority: task.priority,
            status: 'todo',
          });
          createdTasks.push(newTask);
        }
      }

      // Emit real-time update
      const io = req.app.get('io');
      io.to(`project-${projectId}`).emit('tasks-bulk-created', createdTasks);

      return res.json({ plan, tasksCreated: createdTasks.length });
    }

    res.json({ plan });
  } catch (error) {
    console.error('AI Plan error:', error.message);
    res.status(500).json({ message: 'AI generation failed: ' + error.message });
  }
});

// ── AI TASK BREAKDOWN ───────────────────────────────────────────────
// POST /api/ai/breakdown — Break a high-level task into subtasks
router.post('/breakdown', auth, async (req, res) => {
  try {
    const { taskDescription, projectId } = req.body;
    if (!taskDescription) {
      return res.status(400).json({ message: 'Task description is required' });
    }

    let projectContext = {};
    if (projectId) {
      const project = await Project.findById(projectId);
      if (project) {
        projectContext.projectName = project.name;
        projectContext.techStack = project.description;
      }
    }

    const breakdown = await breakdownTask(taskDescription, projectContext);
    res.json(breakdown);
  } catch (error) {
    console.error('AI Breakdown error:', error.message);
    res.status(500).json({ message: 'AI generation failed: ' + error.message });
  }
});

// ── AI RESEARCH ASSISTANT ───────────────────────────────────────────
// POST /api/ai/research/:projectId — Ask a research question in project context
router.post('/research/:projectId', auth, async (req, res) => {
  try {
    const { question, conversationId } = req.body;
    const { projectId } = req.params;

    if (!question) {
      return res.status(400).json({ message: 'Question is required' });
    }

    // Get project context
    const project = await Project.findById(projectId).populate('members.user', 'name');
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const tasks = await Task.find({ projectId }).select('title status priority assignee');

    const projectContext = {
      projectName: project.name,
      projectDescription: project.description,
      tasks: tasks.map((t) => `${t.title} (${t.status}, ${t.priority})`).join('; '),
      teamSize: project.members?.length || 1,
    };

    // Load conversation history if continuing a conversation
    let conversation;
    if (conversationId) {
      conversation = await AIConversation.findById(conversationId);
      if (conversation) {
        projectContext.conversationHistory = conversation.messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
      }
    }

    const answer = await researchAssistant(question, projectContext);

    // Save to conversation
    if (!conversation) {
      conversation = new AIConversation({
        projectId,
        user: req.user._id,
        title: question.substring(0, 80),
        messages: [],
      });
    }
    conversation.messages.push({ role: 'user', content: question });
    conversation.messages.push({ role: 'assistant', content: answer });
    await conversation.save();

    // Optionally save as a resource
    res.json({
      answer,
      conversationId: conversation._id,
    });
  } catch (error) {
    console.error('AI Research error:', error.message);
    res.status(500).json({ message: 'AI generation failed: ' + error.message });
  }
});

// GET /api/ai/conversations/:projectId — List conversations for a project
router.get('/conversations/:projectId', auth, async (req, res) => {
  try {
    const conversations = await AIConversation.find({
      projectId: req.params.projectId,
    })
      .select('title updatedAt messages')
      .sort({ updatedAt: -1 });

    res.json(
      conversations.map((c) => ({
        _id: c._id,
        title: c.title,
        updatedAt: c.updatedAt,
        messageCount: c.messages.length,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/ai/conversations/:projectId/:conversationId — Get full conversation
router.get('/conversations/:projectId/:conversationId', auth, async (req, res) => {
  try {
    const conversation = await AIConversation.findById(req.params.conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── AI DOCUMENT GENERATOR ───────────────────────────────────────────
// POST /api/ai/generate-doc/:projectId — Generate an academic document
router.post('/generate-doc/:projectId', auth, async (req, res) => {
  try {
    const { type } = req.body; // srs | ppt_outline | demo_script | architecture | use_cases
    const { projectId } = req.params;

    if (!type) {
      return res.status(400).json({ message: 'Document type is required' });
    }

    const project = await Project.findById(projectId).populate('members.user', 'name');
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const tasks = await Task.find({ projectId }).select('title status');

    const projectContext = {
      projectName: project.name,
      projectDescription: project.description,
      techStack: project.description,
      modules: tasks.map((t) => t.title).join(', '),
      teamSize: project.members?.length || 1,
    };

    const content = await generateDocument(type, projectContext);

    const docTypeNames = {
      srs: 'Software Requirements Specification',
      ppt_outline: 'Presentation Outline',
      demo_script: 'Demo Script',
      architecture: 'Architecture Document',
      use_cases: 'Use Case Document',
    };

    // Check for existing doc of same type and bump version
    const existingDoc = await GeneratedDoc.findOne({ projectId, type }).sort({ version: -1 });
    const version = existingDoc ? existingDoc.version + 1 : 1;

    const doc = await GeneratedDoc.create({
      projectId,
      generatedBy: req.user._id,
      type,
      title: `${docTypeNames[type] || type} - v${version}`,
      content,
      version,
    });

    res.json(doc);
  } catch (error) {
    console.error('AI Doc error:', error.message);
    res.status(500).json({ message: 'AI generation failed: ' + error.message });
  }
});

// GET /api/ai/docs/:projectId — List generated docs for a project
router.get('/docs/:projectId', auth, async (req, res) => {
  try {
    const docs = await GeneratedDoc.find({ projectId: req.params.projectId })
      .populate('generatedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/ai/docs/:projectId/:docId — Get single document
router.get('/docs/:projectId/:docId', auth, async (req, res) => {
  try {
    const doc = await GeneratedDoc.findById(req.params.docId).populate('generatedBy', 'name');
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/ai/docs/:projectId/:docId — Delete a document
router.delete('/docs/:projectId/:docId', auth, async (req, res) => {
  try {
    await GeneratedDoc.findByIdAndDelete(req.params.docId);
    res.json({ message: 'Document deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── PROJECT HEALTH ANALYSIS ─────────────────────────────────────────
// GET /api/ai/health/:projectId — Analyze project health
router.get('/health/:projectId', auth, async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId)
      .populate('owner', 'name')
      .populate('members.user', 'name');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const tasks = await Task.find({ projectId })
      .populate('assignee', 'name')
      .select('title status priority assignee dueDate createdAt updatedAt');

    const now = new Date();
    const projectData = {
      name: project.name,
      description: project.description,
      status: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
      members: project.members.map((m) => ({
        name: m.user?.name || 'Unknown',
        role: m.role,
      })),
      taskSummary: {
        total: tasks.length,
        todo: tasks.filter((t) => t.status === 'todo').length,
        inprogress: tasks.filter((t) => t.status === 'inprogress').length,
        review: tasks.filter((t) => t.status === 'review').length,
        done: tasks.filter((t) => t.status === 'done').length,
      },
      tasks: tasks.map((t) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        assignee: t.assignee?.name || 'Unassigned',
        dueDate: t.dueDate,
        createdAt: t.createdAt,
        lastUpdated: t.updatedAt,
        overdue: t.dueDate && new Date(t.dueDate) < now && t.status !== 'done',
        daysSinceUpdate: Math.floor((now - new Date(t.updatedAt)) / (1000 * 60 * 60 * 24)),
      })),
    };

    const analysis = await analyzeProjectHealth(projectData);
    res.json(analysis);
  } catch (error) {
    console.error('AI Health error:', error.message);
    res.status(500).json({ message: 'AI analysis failed: ' + error.message });
  }
});

// ── ONE-CLICK PROJECT PACK ──────────────────────────────────────────
// POST /api/ai/project-pack — Generate full project pack + create project & tasks
router.post('/project-pack', auth, async (req, res) => {
  try {
    const { idea } = req.body;
    if (!idea) {
      return res.status(400).json({ message: 'Project idea is required' });
    }

    // User profile is already on req.user from auth middleware
    const userProfile = req.user?.profile || {};

    // Generate the full pack
    const pack = await generateProjectPack(idea, userProfile);

    // Auto-create the project
    const project = await Project.create({
      name: pack.projectName || idea.slice(0, 50),
      description: pack.description || idea,
      owner: req.user._id,
      members: [{ user: req.user._id, role: 'admin' }],
      status: 'active',
    });

    // Auto-create all tasks (defensive: ensure modules/tasks are arrays)
    const createdTasks = [];
    let order = 0;
    const modules = Array.isArray(pack.modules) ? pack.modules : [];
    for (const mod of modules) {
      const tasks = Array.isArray(mod.tasks) ? mod.tasks : [];
      for (const task of tasks) {
        try {
          const newTask = await Task.create({
            title: task.title || 'Untitled Task',
            description: `**Module:** ${mod.name || 'General'}\n\n${task.description || ''}\n\n*Estimated: ${task.estimatedHours || '?'}h · Category: ${task.category || 'general'}*`,
            projectId: project._id,
            priority: ['low', 'medium', 'high', 'urgent'].includes(task.priority) ? task.priority : 'medium',
            status: task.status || 'todo',
            order: order++,
          });
          createdTasks.push(newTask);
        } catch (taskErr) {
          console.warn('Failed to create task:', task.title, taskErr.message);
        }
      }
    }

    // Auto-create SRS doc
    if (pack.srsOutline && typeof pack.srsOutline === 'string') {
      await GeneratedDoc.create({
        projectId: project._id,
        generatedBy: req.user._id,
        type: 'srs',
        title: 'Software Requirements Specification - v1',
        content: pack.srsOutline,
        version: 1,
      });
    }

    // Auto-create PPT outline doc (defensive: check array)
    if (Array.isArray(pack.pptOutline) && pack.pptOutline.length > 0) {
      try {
        const pptContent = pack.pptOutline
          .map((s) => {
            const bullets = Array.isArray(s.bullets) ? s.bullets.map((b) => `- ${b}`).join('\n') : '';
            return `## Slide ${s.slide || '?'}: ${s.title || ''}\n${bullets}\n\n> **Speaker Notes:** ${s.speakerNotes || ''}`;
          })
          .join('\n\n---\n\n');
        await GeneratedDoc.create({
          projectId: project._id,
          generatedBy: req.user._id,
          type: 'ppt_outline',
          title: 'Presentation Outline - v1',
          content: pptContent,
          version: 1,
        });
      } catch (pptErr) {
        console.warn('Failed to create PPT doc:', pptErr.message);
      }
    }

    // Auto-create research resources
    const researchPack = Array.isArray(pack.researchPack) ? pack.researchPack : [];
    for (const r of researchPack) {
      try {
        await Resource.create({
          projectId: project._id,
          addedBy: req.user._id,
          type: r.url ? 'link' : 'ai_summary',
          title: r.title || 'Research Resource',
          content: r.summary || '',
          url: r.url || '',
          tags: [r.type || 'resource', 'ai-generated'],
        });
      } catch (resErr) {
        console.warn('Failed to create resource:', r.title, resErr.message);
      }
    }

    res.json({
      project,
      pack,
      tasksCreated: createdTasks.length,
    });
  } catch (error) {
    console.error('Project Pack error:', error.message, error.stack?.split('\n').slice(0, 3).join('\n'));
    res.status(500).json({ message: 'AI generation failed: ' + error.message });
  }
});

module.exports = router;
