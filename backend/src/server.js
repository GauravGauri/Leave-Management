const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const apiRoutes = require('./routes/api');
const { startCronJobs } = require('./cron/allocationCron');

const app = express();
const server = http.createServer(app);

// Configure Socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// Store socket io instance on app for use in controllers
app.set('socketio', io);

// ==========================================
// MIDDLEWARES
// ==========================================

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: false // Allows loading assets dynamically
}));

// CORS Configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per window
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Request Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads in development
app.use('/uploads', express.static('uploads'));

// ==========================================
// ROUTES
// ==========================================
app.use('/api', apiRoutes);

// Base route health check
app.get('/', (req, res) => {
  res.json({ message: 'HRMS Leave Management System API is active.' });
});

// ==========================================
// REAL-TIME SOCKET.IO HANDLER
// ==========================================
io.on('connection', (socket) => {
  console.log(`[Socket] New connection established: ${socket.id}`);

  // User joins a room named after their unique database ID
  socket.on('join', (userId) => {
    if (userId) {
      socket.join(userId);
      console.log(`[Socket] User ${userId} joined their personal room.`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] User disconnected: ${socket.id}`);
  });
});

// ==========================================
// DATABASE AND SERVER STARTUP
// ==========================================
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('[Error] MONGODB_URI is not defined in the environment variables.');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('[Mongoose] Connected to MongoDB Atlas successfully.');
    
    // Auto-seed database if it contains no user records
    try {
      const { User } = require('./models');
      const { autoSeedDatabase } = require('./scripts/autoSeed');
      const count = await User.countDocuments({});
      if (count === 0) {
        await autoSeedDatabase();
      }
    } catch (seedErr) {
      console.error('[Mongoose] Auto-seed failed:', seedErr.message);
    }

    // Start Cron Jobs
    startCronJobs();

    // Start Server
    server.listen(PORT, () => {
      console.log(`[Server] running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[Mongoose] Connection failed:', err.message);
    console.log('Ensure you have configured the MONGODB_URI correctly in backend/.env with your actual password.');
    // Keep process alive to allow testing or manual configuration changes
  });
