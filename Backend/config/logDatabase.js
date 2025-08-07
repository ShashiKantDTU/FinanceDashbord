const mongoose = require('mongoose');
require('dotenv').config();

// Get the logging database URI from your .env file
const logDbUri = process.env.MONGO_URI_LOGS;

if (!logDbUri) {
  console.error('❌ MONGO_URI_LOGS is required but not defined in .env file!');
  console.error('❌ Usage tracking will be disabled until this is configured.');
  module.exports = { logConnection: null };
} else {
  // Create a new, separate connection for logging
  const logConnection = mongoose.createConnection(logDbUri);

  logConnection.on('connected', () => {
    console.log('✅ Connected to Logging MongoDB successfully');
    console.log(`📊 Using database: ${logConnection.db.databaseName}`);
    console.log('📁 Usage logs will be saved to collection: Sitehaazrilogs');
  });

  logConnection.on('error', (err) => {
    console.error('❌ Error connecting to Logging MongoDB:', err);
  });

  logConnection.on('disconnected', () => {
    console.log('📤 Disconnected from Logging MongoDB');
  });

  // Export the new connection
  module.exports = { logConnection };
}