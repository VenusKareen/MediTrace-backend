require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/database');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const reportRoutes = require('./routes/report');
const verifyRoutes = require('./routes/verify');
const scanLogRoutes = require('./routes/scanlogs');
const userRoutes = require('./routes/users');
const batchRoutes = require('./routes/batches');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Routes

app.use('/qrcodes', require('express').static(require('path').join(__dirname, '..', 'qrcodes')));
app.get('/health', (req, res) => res.json({ status: 'ok', app: 'MediTrace API' }));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/reports', reportRoutes);
app.use('/verify', verifyRoutes);
app.use('/api/scan-logs', scanLogRoutes);
app.use('/api/users', userRoutes);
app.use('/api/batches', batchRoutes);

// 404 handler

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// Global error handler

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Database + Start

pool.query('SELECT NOW()')
  .then(() => {
    console.log('PostgreSQL connected');
    app.listen(PORT, '0.0.0.0', () => console.log(`MediTrace API running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('PostgreSQL connection failed:', err.message);
    process.exit(1);
  });