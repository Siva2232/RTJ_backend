require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
require('express-async-errors');

const connectDB = require('./src/config/db');
const { globalErrorHandler, notFound } = require('./src/middleware/errorMiddleware');
const { apiLimiter, authLimiter } = require('./src/middleware/rateLimiter');

const authRoutes = require('./src/routes/authRoutes');
const carRoutes = require('./src/routes/carRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const activityRoutes = require('./src/routes/activityRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');

// ─── App Setup ─────────────────────────────────────────────────────────────────
const app = express();

// ─── Database ──────────────────────────────────────────────────────────────────
connectDB();

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet());
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://vtjmotors.netlify.app',
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
    : []),
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body Parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// ─── Logging ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ─── Health Check & Root ──────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      env: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    },
    message: 'Server is running',
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'VTJ Motors API is live',
    endpoints: {
      health: '/health',
      api: '/api'
    }
  });
});

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── Static Files ──────────────────────────────────────────────────────────────
// Override helmet's Cross-Origin-Resource-Policy for uploaded files so browsers
// on different origins (e.g. localhost:5173) can load images.
//
// Handle different deployment structures:
// - Local dev: __dirname = RTJ_backend, files at RTJ_backend/src/uploads
// - Render prod: __dirname = /opt/render/project/src, files at /opt/render/project/src/uploads
//   (because Render deploys to src folder and uploadMiddleware saves to ../uploads relative to middleware dir)
const uploadsPath = __dirname.endsWith('src')
  ? path.join(__dirname, 'uploads')  // Render: /opt/render/project/src/uploads
  : path.join(__dirname, 'src', 'uploads');  // Local: RTJ_backend/src/uploads

app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(uploadsPath));

app.use('/api', apiLimiter);

// ─── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/cars', carRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/notifications', notificationRoutes);

// ─── Error Handlers ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(globalErrorHandler);

// ─── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

process.on('unhandledRejection', (err) => {
  console.error(`💥 Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});

module.exports = app;
