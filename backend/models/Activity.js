const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: [
        'task_created',
        'task_updated',
        'task_deleted',
        'status_changed',
        'comment_added',
        'project_created',
        'member_added',
        'github_connected',
        'github_repo_linked',
        'github_issue_created',
        'github_pr_opened',
        'github_pr_merged',
        'github_push',
        'github_branch_created',
      ],
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
    },
    details: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Activity', activitySchema);
