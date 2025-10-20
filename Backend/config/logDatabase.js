const mongoose = require('mongoose');
require('dotenv').config();

// Get the logging database URI from your .env file
const logDbUri = process.env.MONGO_URI_LOGS;

if (!logDbUri) {
  console.error('❌ MONGO_URI_LOGS is required but not defined in .env file!');
  console.error('❌ Usage tracking will be disabled until this is configured.');
  
  // Provide no-op function when database is not configured
  const logToDatabase = async () => {
    console.warn('⚠️ logToDatabase called but MONGO_URI_LOGS not configured');
  };
  
  module.exports = { logConnection: null, logToDatabase };
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

  /**
   * Generic logging function for non-API-usage events
   * Creates a simple log entry in a separate collection
   * @param {string} eventType - Type of event (e.g., 'api_threshold_reached', 'api_call_tracked')
   * @param {object} data - Data to log
   * @returns {Promise<void>}
   */
  async function logToDatabase(eventType, data) {
    try {
      // Get or create the GenericLog model
      let GenericLog;
      try {
        GenericLog = logConnection.model('GenericLog');
      } catch (e) {
        // Model doesn't exist yet, create it
        const genericLogSchema = new mongoose.Schema({
          eventType: { type: String, required: true, index: true },
          data: { type: mongoose.Schema.Types.Mixed, required: true },
          timestamp: { type: Date, default: Date.now, expires: '90d' }
        });
        GenericLog = logConnection.model('GenericLog', genericLogSchema, 'GenericLogs');
      }

      // Create and save the log entry
      const logEntry = new GenericLog({
        eventType,
        data,
        timestamp: new Date()
      });

      await logEntry.save();
    } catch (error) {
      // Silent failure - don't break the application
      console.error(`Failed to log ${eventType}:`, error.message);
    }
  }

  // Export the connection and logging function
  module.exports = { logConnection, logToDatabase };
}