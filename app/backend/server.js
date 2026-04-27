const express = require("express");
const http = require('http');
const { Server } = require("socket.io");
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const { connectDB } = require('./db');
const logger = require('./config/pinoLogger');
const { errorHandler } = require('./middleware/errorMiddleware');
const { socketAuth } = require('./middleware/authMiddleware');
const { apiLimiter, xss } = require('./middleware/securityMiddleware');
const requestContext = require('./middleware/requestContext');
const routes = require('./routes');
const socketHandlers = require('./socket/socketHandlers');
const socketEmitter = require('./socket/socketEmitter');
const { broadcastTriage } = require('./jobs/triageJob');
const { broadcastResourceAllocation } = require('./jobs/resourceJob');
const { slaMonitorJob } = require('./jobs/slaJob');

require("dotenv").config();

// Connect to Database
connectDB();

const app = express();

// Security Middleware
app.use(helmet());
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ["GET", "POST"],
  credentials: true
};
app.use(cors(corsOptions));

// Global Security Middleware
app.use('/api', apiLimiter);
app.use(xss());
app.use(requestContext);

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logging
app.use((req, res, next) => {
  logger.info({ 
    requestId: req.id,
    method: req.method,
    url: req.url,
    ip: req.ip
  }, 'Request received');
  next();
});

// State Management (to be moved to Redis/Postgres)
const state = {
  activeAlerts: new Map(),
  activePatients: new Map(),
  alertCooldowns: new Map(),
  clinicalExecutionLogs: new Map(),
  lastActionAtMap: new Map(),
  systemMetricsMem: { totalAlerts: 0, escalations: 0, overdueTasks: 0 },
  icuOutcomesMem: { totalSBTAttempts: 0, sbtFailures: 0, extubations: 0, extubationFailures: 0 },
  isRedisAvailable: false,
  redisClient: null
};

// Mount API Routes
app.use('/api', routes);

// Serve Frontend
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend-react/build')));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.resolve(__dirname, '../frontend-react', 'build', 'index.html'));
    }
  });
}

// Global Error Handler
app.use(errorHandler);

const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });

// Redis Setup
(async () => {
    try {
        state.redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
        await state.redisClient.connect();
        const pubClient = state.redisClient.duplicate();
        const subClient = state.redisClient.duplicate();
        await Promise.all([pubClient.connect(), subClient.connect()]);
        io.adapter(createAdapter(pubClient, subClient));
        state.isRedisAvailable = true;
        logger.info('Redis connected and Socket.IO adapter active');
    } catch (err) {
        logger.warn(`Redis unavailable - fallback active: ${err.message}`);
        state.isRedisAvailable = false;
    }
})();

// Socket.IO Setup
io.use((socket, next) => socketAuth(state)(socket, next));

const emitters = socketEmitter(io, state);
app.set('dispatchAlert', emitters.dispatchAlert);
app.set('updateActivePatient', emitters.updateActivePatient);

io.on("connection", (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  socketHandlers(io, socket, state);
  
  socket.on("disconnect", () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Background Jobs
setInterval(() => broadcastTriage(io, state), 30000);
setInterval(() => broadcastResourceAllocation(io, state), 10000);
setInterval(() => slaMonitorJob(io, state), 5000);

// Graceful Shutdown
const gracefulShutdown = () => {
  logger.info('Shutting down gracefully...');
  server.close(() => {
    logger.info('HTTP server closed');
    if (state.isRedisAvailable && state.redisClient) {
      state.redisClient.quit().then(() => {
        logger.info('Redis connection closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  logger.info(`Server running on port ${PORT}`)
);
