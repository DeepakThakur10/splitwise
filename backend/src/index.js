// src/index.js
// The entry point. Registers all routes and starts the server.

require('dotenv').config();
const express     = require('express');
const cors        = require('cors');

const authRoutes        = require('./routes/auth');
const groupRoutes       = require('./routes/groups');
const expenseRoutes     = require('./routes/expenses');
const balanceRoutes     = require('./routes/balances');
const settlementRoutes  = require('./routes/settlements');
const importRoutes      = require('./routes/import');
const userRoutes        = require('./routes/users');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ─────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/groups',      groupRoutes);
app.use('/api/expenses',    expenseRoutes);
app.use('/api/balances',    balanceRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/import',      importRoutes);
app.use('/api/users',       userRoutes);

// ── Health check (useful for Railway/Render deploy checks) ──
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── 404 handler ────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ 
  error: `Route ${req.method} ${req.path} not found` 
}));

// ── Global error handler ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error' 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
