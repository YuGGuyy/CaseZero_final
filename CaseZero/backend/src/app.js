import express from 'express';
import cors from 'cors';
import auth from './routes/auth.js';
import cases from './routes/cases.js';
import inv, { puzzles } from './routes/investigations.js';
import { isDbConnected, getDbState } from './db.js';

const app = express();

export function getAllowedOrigins() {
  const configured = (process.env.CLIENT_URL || '')
    .split(',')
    .map(s => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const defaults = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ];

  return Array.from(new Set([...configured, ...defaults]));
}

export function isOriginAllowed(origin) {
  if (!origin) return true;
  const normalized = origin.trim().replace(/\/+$/, '');
  const allowed = getAllowedOrigins();

  if (allowed.includes(normalized)) return true;
  // Local development pattern
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) return true;

  return false;
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '200kb' }));

// Health Check Endpoint
app.get(['/health', '/api/health'], (req, res) => {
  const connected = isDbConnected();
  const dbState = getDbState();
  const isStrict = req.query.ready === '1' || req.query.strict === '1';

  const statusCode = connected ? 200 : (isStrict ? 503 : 200);

  res.status(statusCode).json({
    status: connected ? 'healthy' : 'degraded',
    database: dbState,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Database readiness guard for API routes (fast-fail instead of hanging query buffers)
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || isDbConnected()) {
    return next();
  }
  return res.status(503).json({
    error: 'Database connection is currently unavailable. Please verify MongoDB Atlas cluster and Network Access settings.'
  });
});

app.use('/api/auth', auth);
app.use('/api/cases', cases);
app.use('/api/investigations', inv);
app.use('/api/puzzles', puzzles);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((e, req, res, next) => res.status(e.status || (e.name === 'CastError' ? 400 : 500)).json({ error: e.error || e.message }));

export default app;
