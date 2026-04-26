const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
  },
  { timestamps: true }
);

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    sprintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sprint',
      default: null,
      index: true,
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['todo', 'inprogress', 'review', 'done'],
      default: 'todo',
    },
    dueDate: {
      type: Date,
    },
    comments: [commentSchema],
    dependsOn: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
      },
    ],
    order: {
      type: Number,
      default: 0,
    },
    // ── GitHub Integration ──
    github: {
      issueNumber: { type: Number },
      issueUrl: { type: String, default: '' },
      issueState: { type: String, enum: ['open', 'closed', ''], default: '' },
      linkedPRs: [{
        number: Number,
        title: String,
        url: String,
        state: { type: String, enum: ['open', 'closed', 'merged'] },
        author: String,
        updatedAt: Date,
      }],
      branchName: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

taskSchema.index({ projectId: 1, status: 1, order: 1 });
taskSchema.index({ projectId: 1, sprintId: 1, status: 1, order: 1 });

module.exports = mongoose.model('Task', taskSchema);
