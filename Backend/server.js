const express = require('express');
const cors = require('cors');
require('dotenv').config();
const JWT = require('jsonwebtoken');
const mongoose = require('mongoose');
// Connect to MongoDB
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/finance-dashboard';

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});


const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration for production
const corsOptions = {
  origin: [
    'http://localhost:5173', // Local development
    'https://finance-dashbord-three.vercel.app', // Replace with your actual Vercel domain
    // Add more allowed origins as needed
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

// Basic middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Import routes
const authRoutes = require('./Routes/auth');
const dashboardRoutes = require('./Routes/dashboard');
const employeeRoutes = require('./Routes/EmployeeDetails');
const changeTrackingRoutes = require('./Routes/changeTracking');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/change-tracking', changeTrackingRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Finance Dashboard API Server is running!',
    status: 'OK',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Start server

mongoose.connect(mongoURI).then(() => {
  console.log('Connected to MongoDB successfully');
  app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
}).catch(err => {
  console.error('Error connecting to MongoDB:', err);
});


module.exports = app;