require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes          = require('./routes/auth');
const jobRoutes           = require('./routes/jobs');
const driverRoutes        = require('./routes/driver');
const notificationRoutes  = require('./routes/notifications');

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Elmi Courier API', time: new Date().toISOString() });
});

// Routes
app.use('/api/auth',          authRoutes);
app.use('/api/jobs',          jobRoutes);
app.use('/api/driver',        driverRoutes);
app.use('/api/notifications', notificationRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

module.exports = app;
