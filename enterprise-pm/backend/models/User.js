const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['admin', 'manager', 'member'],
      default: 'member',
    },
    avatar: {
      type: String,
      default: '',
    },
    // ── GitHub Integration ──
    github: {
      connected: { type: Boolean, default: false },
      accessToken: { type: String, default: '' },
      username: { type: String, default: '' },
      profileUrl: { type: String, default: '' },
      avatarUrl: { type: String, default: '' },
      githubId: { type: String, default: '' },
      connectedAt: { type: Date },
    },
    // ── Onboarding Profile ──
    onboarded: { type: Boolean, default: false },
    profile: {
      profession: {
        type: String,
        enum: ['student', 'teacher', 'employee', 'freelancer', 'founder', 'other'],
        default: 'student',
      },
      organization: { type: String, default: '' },         // college / company name
      specialization: { type: String, default: '' },        // CS, IT, Mechanical, etc.
      experience: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        default: 'beginner',
      },
      teamSize: {
        type: String,
        enum: ['solo', '2-3', '4-6', '7+'],
        default: 'solo',
      },
      interests: [String],                                  // ["web dev", "AI/ML", "mobile", ...]
      goal: {
        type: String,
        enum: ['semester-project', 'hackathon', 'startup', 'freelance', 'learning', 'other'],
        default: 'semester-project',
      },
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
