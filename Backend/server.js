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

// Production URLs
allowedOrigins.push('https://app.sitehaazri.in');
allowedOrigins.push('https://sitehaazri.in'); // In case you need the marketing site to make API calls

// Add environment-specific URL if provided
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

// Development URLs
if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push('http://localhost:5173', 'http://localhost:8081', 'http://localhost:3000');
}
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      console.log(`✅ CORS: Allowed origin: ${origin}`);
      return callback(null, true);
    } else {
      console.log(`❌ CORS: Blocked origin: ${origin}`);
      console.log(`📋 CORS: Allowed origins: ${allowedOrigins.join(', ')}`);
      return callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

// Basic middleware
app.use(cors(corsOptions));

// Special middleware for Pub/Sub webhook - must come before express.json()
app.use('/api/play-purchase/notifications', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import usage tracking middleware
const { usageTracker } = require('./Middleware/usageTracker');

// Add usage tracking middleware (must be after express.json and before routes)
app.use(usageTracker);


// Import routes
const authRoutes = require('./Routes/auth');
const dashboardRoutes = require('./Routes/dashboard');
const employeeRoutes = require('./Routes/EmployeeDetails');
const changeTrackingRoutes = require('./Routes/changeTracking');
const detailedChangeTrackingRoutes = require('./Routes/detailedChangeTracking');
const playPurchaseRoutes = require('./Routes/playPurchase');
const siteFinancialRoutes = require('./Routes/SiteFinancials');
const pdfRoutes = require('./Routes/pdfRoutes');
const usageRoutes = require('./Routes/usage');
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
app.use('/api/financials', siteFinancialRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/usage', usageRoutes);
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
    console.log(`🌐 CORS: Allowed origins: ${allowedOrigins.join(', ')}`);
    console.log(`🔒 Environment: ${process.env.NODE_ENV}`);
  });
}).catch(err => {
  console.error('Error connecting to MongoDB:', err);
});


module.exports = app;