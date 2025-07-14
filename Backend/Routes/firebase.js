// firebase.js
require("dotenv").config();
const admin = require("firebase-admin");

// Parse Firebase service account from environment variable
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
