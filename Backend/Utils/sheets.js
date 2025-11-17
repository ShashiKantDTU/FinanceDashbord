require('dotenv').config(); // Add this to the top
const { google } = require('googleapis');

// --- CONFIGURATION ---
// 1. Parse the key from the environment variable
const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');

// 2. Define the scopes
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// 3. Create the auth client using 'credentials' instead of 'keyFile'
const auth = new google.auth.GoogleAuth({
  credentials: credentials, // Pass the parsed JSON object here
  scopes: SCOPES,
});
// --- END CONFIGURATION ---


/**
 * Appends a new row of data to your Google Sheet.
 * (This function is the same as before)
 * @param {string} spreadsheetId The ID of the spreadsheet.
 * @param {string} range The A1 notation of the range to append to (e.g., 'Users!A:D').
 * @param {Array<Array<any>>} values The data to append (must be an array of rows).
 */
async function appendToSheet(spreadsheetId, range, values) {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const request = {
      spreadsheetId: spreadsheetId,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: values,
      },
    };

    const response = await sheets.spreadsheets.values.append(request);
    console.log(`Successfully appended ${response.data.updates.updatedRows} row(s).`);
    return response.data;

  } catch (err) {
    console.error('Error appending data to Google Sheets:', err);
    // Do not re-throw - we don't want sheet logging failures to break user registration
  }
}

// Export the function
module.exports = { appendToSheet };