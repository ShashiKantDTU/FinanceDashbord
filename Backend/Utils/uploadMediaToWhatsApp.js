// Utility to upload media to WhatsApp Cloud API
// Returns media ID that can be used in template messages
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

/**
 * Upload media file to WhatsApp Cloud API
 * Use the returned media ID in template messages instead of direct URLs
 * 
 * @param {string} filePath - Local path to media file OR HTTP(S) URL
 * @param {string} mediaType - MIME type: 'video/mp4', 'image/jpeg', 'image/png', 'application/pdf'
 * @returns {Promise<string>} - Media ID (h:...)
 */
async function uploadMedia(filePath, mediaType = 'video/mp4') {
  if (!process.env.META_ACCESS_TOKEN || !process.env.META_PHONE_NUMBER_ID) {
    throw new Error('META_ACCESS_TOKEN and META_PHONE_NUMBER_ID must be set');
  }

  const url = `https://graph.facebook.com/v20.0/${process.env.META_PHONE_NUMBER_ID}/media`;

  try {
    let formData = new FormData();

    // Check if it's a URL or local file
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      // Download the file first
      console.log(`📥 Downloading media from ${filePath}...`);
      const response = await axios.get(filePath, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);
      
      // Extract filename from URL or use default
      const urlPath = new URL(filePath).pathname;
      const fileName = urlPath.split('/').pop() || 'media.mp4';
      
      formData.append('file', buffer, {
        filename: fileName,
        contentType: mediaType,
      });
    } else {
      // Local file upload
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      formData.append('file', fs.createReadStream(filePath), {
        contentType: mediaType,
      });
    }

    formData.append('messaging_product', 'whatsapp');
    formData.append('type', mediaType);

    console.log(`📤 Uploading media to WhatsApp...`);
    const res = await axios.post(url, formData, {
      headers: {
        'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
        ...formData.getHeaders(),
      },
      timeout: 30000, // 30 second timeout for upload
    });

    const mediaId = res.data?.id;
    if (!mediaId) {
      throw new Error('No media ID returned from WhatsApp API');
    }

    console.log(`✅ Media uploaded successfully! Media ID: ${mediaId}`);
    return mediaId;

  } catch (err) {
    console.error('❌ Media upload failed:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Get media info from WhatsApp by media ID
 * @param {string} mediaId - Media ID returned from upload
 * @returns {Promise<Object>} - Media info with URL, MIME type, size, etc.
 */
async function getMediaInfo(mediaId) {
  if (!process.env.META_ACCESS_TOKEN) {
    throw new Error('META_ACCESS_TOKEN must be set');
  }

  const url = `https://graph.facebook.com/v20.0/${mediaId}`;

  try {
    const res = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
      },
    });

    return res.data;
  } catch (err) {
    console.error('❌ Failed to get media info:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Delete media from WhatsApp
 * @param {string} mediaId - Media ID to delete
 * @returns {Promise<boolean>} - Success status
 */
async function deleteMedia(mediaId) {
  if (!process.env.META_ACCESS_TOKEN) {
    throw new Error('META_ACCESS_TOKEN must be set');
  }

  const url = `https://graph.facebook.com/v20.0/${mediaId}`;

  try {
    await axios.delete(url, {
      headers: {
        'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
      },
    });

    console.log(`✅ Media ${mediaId} deleted successfully`);
    return true;
  } catch (err) {
    console.error('❌ Failed to delete media:', err.response?.data || err.message);
    throw err;
  }
}

module.exports = {
  uploadMedia,
  getMediaInfo,
  deleteMedia,
};
