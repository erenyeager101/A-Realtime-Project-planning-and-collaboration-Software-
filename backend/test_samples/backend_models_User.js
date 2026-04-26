const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

/**
 * User Schema
 * @typedef {Object} User
 * @property {string} id - The unique identifier for the user
 * @property {string} email - The email address of the user
 * @property {string} name - The name of the user
 * @property {string} role - The role of the user
 * @property {Date} createdAt - The date when the user was created
 * @property {string} password - The hashed password of the user
 * @property {Array<mongoose.Schema.Types.ObjectId>} projects - The projects associated with the user
 * @property {Array<mongoose.Schema.Types.ObjectId>} tasks - The tasks associated with the user
 */

/**
 * @type {mongoose.Schema<User>}
 */
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      message: 'Invalid email address',
    },
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  role: {
    type: String,
    required: true,
    enum: ['admin', 'user'],
    default: 'user',
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false,
  },
  projects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
  }],
  tasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
  }],
}, {
  timestamps: true,
});

/**
 * Validate password
 * @param {string} password - The password to validate
 * @returns {Promise<boolean>} - Returns true if the password is valid, false otherwise
 */
userSchema.methods.validatePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

/**
 * Generate JWT token
 * @returns {string} - The generated JWT token
 */
userSchema.methods.generateToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

/**
 * Hash password before saving
 */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * User Model
 * @type {mongoose.Model<User>}
 */
const User = mongoose.model('User', userSchema);

module.exports = User;