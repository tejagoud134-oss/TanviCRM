const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const logger = require('./middlewares/logger');
const { apiLimiter } = require('./middlewares/rateLimiter');
const authRoute = require('./routes/authRoute');
const uploadRoute = require('./routes/uploadRoute');
const gatewayRoute = require('./routes/gatewayRoute');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const PORT = process.env.PORT || 3000;

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: false, // Turn off for simpler local testing/CDNs
  crossOriginResourcePolicy: false
}));
app.use(cors({ origin: '*' }));

// Logger Middleware
app.use(morgan('combined', {
  stream: { write: message => logger.info(message.trim()) }
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
app.use('/api/', apiLimiter);

// Ensure local uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve local uploaded images statically
app.use('/uploads', express.static(uploadDir));

// API Routes
app.use('/api/auth', authRoute);
app.use('/api/upload', uploadRoute);

// Proxy Gateway Route (captures all other endpoints and forwards to Python)
app.use('/api', gatewayRoute);

// Serve frontend static files as default fallback homepage for local execution
const frontendDir = path.join(__dirname, '../../frontend');
app.use(express.static(frontendDir));

// Fallback to index.html for single-page routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next(); // pass to api error handlers
  }
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// WebSocket Event Operations
io.on('connection', (socket) => {
  logger.info(`WebSocket Client Connected: ${socket.id}`);

  // Join a room for a specific boutique event
  socket.on('join_event', (eventId) => {
    socket.join(eventId);
    logger.info(`Socket ${socket.id} joined room event: ${eventId}`);
  });

  // Broadcast Live Check-in update
  socket.on('guest_checkin_update', (data) => {
    // data: { eventId, guestId, name, checkedIn, checkinTime }
    io.emit('broadcast_checkin', data);
    logger.info(`Broadcasted check-in update for guest: ${data.name} to all clients`);
  });

  // Broadcast new Event creation
  socket.on('event_created', (data) => {
    // data: { eventId, name }
    io.emit('broadcast_event_created', data);
    logger.info(`Broadcasted new event creation notice: ${data.name}`);
  });
  
  // Broadcast rules recalculation trigger
  socket.on('rules_updated', () => {
    io.emit('broadcast_rules_updated');
    logger.info('Broadcasted system rule changes notice');
  });

  socket.on('disconnect', () => {
    logger.info(`WebSocket Client Disconnected: ${socket.id}`);
  });
});

// Error Handler Middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandle Gateway Error: ${err.stack}`);
  res.status(500).json({ message: 'Internal Server Error' });
});

// Start Gateway
server.listen(PORT, () => {
  logger.info(`Express API Gateway running at http://localhost:${PORT}`);
});
