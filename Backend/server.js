const express = require('express');
const cors = require('cors');
require('dotenv').config();
const JWT = require('jsonwebtoken');
const mongoose = require('mongoose');
const { testEmailConnection } = require('./Utils/emailService');

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

// CORS configuration for production and development
const allowedOrigins = [];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}
if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push('http://localhost:5173' , 'http://localhost:8081'); // Add your development frontend URL
}
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
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
const detailedChangeTrackingRoutes = require('./Routes/detailedChangeTracking');
const playPurchaseRoutes = require('./Routes/playPurchase');
// const optimizedEmployeeRoutes = require('./Routes/optimizedEmployeeRoutes');


if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        setTimeout(next, 500);
    });
}

if( process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    // Log backend ip address
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    const ipAddresses = [];
    for (const interfaceName in networkInterfaces) {
        const addresses = networkInterfaces[interfaceName];
        for (const address of addresses) {
            if (address.family === 'IPv4' && !address.internal) {
                ipAddresses.push(address.address);
            }
        }
    }
    console.log(`Backend IP Addresses: ${ipAddresses.join(', ')}`);
}


// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/change-tracking', changeTrackingRoutes);
app.use('/api/detailed-change-tracking', detailedChangeTrackingRoutes);
app.use('/api/play-purchase', playPurchaseRoutes);
// app.use('/api/employee-optimized', optimizedEmployeeRoutes);

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

mongoose.connect(mongoURI).then(async () => {
  console.log('Connected to MongoDB successfully');
  
  // Test email configuration if credentials are provided
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log('Testing email configuration...');
    const emailWorking = await testEmailConnection();
    if (emailWorking) {
      console.log('✅ Email service is configured and ready');
    } else {
      console.log('⚠️  Email service configuration failed - password reset emails will not work');
      console.log('Please check your EMAIL_USER and EMAIL_PASS in .env file');
    }
  } else {
    console.log('⚠️  Email credentials not configured - password reset emails will not work');
    console.log('Please set EMAIL_USER and EMAIL_PASS in .env file');
  }
  
  app.listen(PORT,'0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
  });
}).catch(err => {
  console.error('Error connecting to MongoDB:', err);
});


module.exports = app;