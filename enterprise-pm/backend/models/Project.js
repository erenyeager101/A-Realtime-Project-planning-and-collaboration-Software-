const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: {
          type: String,
          enum: ['admin', 'manager', 'member'],
          default: 'member',
        },
      },
    ],
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'archived'],
      default: 'active',
    },
    // ── GitHub Integration ──
    github: {
      repoFullName: { type: String, default: '' },
      repoUrl: { type: String, default: '' },
      repoId: { type: Number },
      defaultBranch: { type: String, default: 'main' },
      webhookId: { type: Number },
      webhookSecret: { type: String, default: '' },
      lastSyncedAt: { type: Date },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Project', projectSchema);
