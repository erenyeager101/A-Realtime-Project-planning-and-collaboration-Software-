const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Import models
const User = require('./models/User');
const Project = require('./models/Project');
const Task = require('./models/Task');

// Import routes
const usercontrollerRoutes = require('./routes/usercontrollerRoutes');
const projectcontrollerRoutes = require('./routes/projectcontrollerRoutes');
const taskcontrollerRoutes = require('./routes/taskcontrollerRoutes');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173'
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Mount routes
app.use('/api/users', usercontrollerRoutes);
app.use('/api/projects', projectcontrollerRoutes);
app.use('/api/tasks', taskcontrollerRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

async function startServer() {
  try {
    if (MONGO_URI) {
      await mongoose.connect(MONGO_URI);
      console.log('✅ Connected to MongoDB');
    } else {
      console.log('⚠️ No MONGO_URI provided, starting without database');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;
