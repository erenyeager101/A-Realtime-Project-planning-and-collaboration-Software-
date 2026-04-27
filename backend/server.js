const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const aiRoutes = require('./routes/aiRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const githubRoutes = require('./routes/githubRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const sprintRoutes = require('./routes/sprintRoutes');
const diagramRoutes = require('./routes/diagramRoutes');

const app = express();
const server = http.createServer(app);

const DEFAULT_CLIENT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:5173',
  'https://a-realtime-project-planning-and-col.vercel.app'
];

const parseAllowedOrigins = () => {
  const configured = [
    process.env.CLIENT_URL,
    ...(process.env.CLIENT_URLS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  ].filter(Boolean);

  return [...new Set([...DEFAULT_CLIENT_ORIGINS, ...configured])];
};

const allowedOrigins = parseAllowedOrigins();

const corsOriginHandler = (origin, callback) => {
  // Allow server-to-server and local tools without Origin header
  if (!origin) {
    callback(null, true);
    return;
  }

  if (allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`CORS blocked for origin: ${origin}`));
};

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: corsOriginHandler,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  },
});

// Make io accessible in routes
app.set('io', io);

// Middleware
app.use(cors({ origin: corsOriginHandler }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/sprints', sprintRoutes);
app.use('/api/diagrams', diagramRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Enterprise PM API is running' });
});

// ── Serve frontend build in production / Docker ──
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
const fs = require('fs');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA catch-all: any non-API route serves index.html
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a project room for real-time updates
  socket.on('join-project', (projectId) => {
    socket.join(`project-${projectId}`);
    console.log(`Socket ${socket.id} joined project-${projectId}`);
  });

  socket.on('leave-project', (projectId) => {
    socket.leave(`project-${projectId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log('Connected to MongoDB');
      server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('MongoDB connection error:', err.message);
      // Still start the server so /setup page is accessible
      console.log('Starting server without DB — visit /setup to configure');
      server.listen(PORT, () => {
        console.log(`Server running on port ${PORT} (no database)`);
      });
    });
} else {
  // No MONGO_URI — first-time setup mode
  console.log('No MONGO_URI configured — starting in setup mode');
  console.log('Visit http://localhost:' + PORT + '/setup to configure');
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (setup mode)`);
  });
}
