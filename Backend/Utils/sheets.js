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

/**
 * Updates a user's name in Google Sheet by finding their row via phone number.
 * 
 * Sheet Structure:
 * Column A - blank
 * Column B - date
 * Column C - name
 * Column D - phone number
 * Column E - acquisition source
 * Column F - acquisition campaign
 * Column G - acquisition medium
 * 
 * @param {string} spreadsheetId The ID of the spreadsheet.
 * @param {string} sheetName The name of the sheet (e.g., 'Users').
 * @param {string} phoneNumber The phone number to search for (unique identifier).
 * @param {string} newName The new name to update.
 * @returns {boolean} True if update was successful, false otherwise.
 */
async function updateUserNameInSheet(spreadsheetId, sheetName, phoneNumber, newName) {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    // Step 1: Get all phone numbers from Column D to find the row
    const searchRange = `${sheetName}!D:D`; // Phone number column
    
    const searchResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: searchRange,
    });

    const rows = searchResponse.data.values || [];
    
    // Step 2: Find the row index where phone number matches
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === phoneNumber) {
        rowIndex = i + 1; // Sheets are 1-indexed
        break;
      }
    }

    if (rowIndex === -1) {
      console.log(`Phone number ${phoneNumber} not found in Google Sheet.`);
      return false;
    }

    // Step 3: Update the name in Column C for that row
    const updateRange = `${sheetName}!C${rowIndex}`; // Name is in Column C
    
    const updateResponse = await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: updateRange,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[newName]],
      },
    });

    console.log(`Successfully updated name to "${newName}" for phone ${phoneNumber} at row ${rowIndex}`);
    return true;

  } catch (err) {
    console.error('Error updating user name in Google Sheets:', err.message);
    return false;
  }
}

// Export the functions
module.exports = { appendToSheet, updateUserNameInSheet };