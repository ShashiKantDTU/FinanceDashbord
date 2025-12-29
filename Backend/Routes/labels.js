const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/Userschema');
const { Supervisor } = require('../models/supervisorSchema');
const { authenticateAndTrack } = require('../Middleware/usageTracker');

const router = express.Router();

/**
 * Helper function to get the main user ID
 * Handles both regular users and supervisors
 * For supervisors, returns the owner's user ID
 * @param {Object} reqUser - The req.user object from auth middleware
 * @returns {Promise<string>} - The main user's MongoDB _id
 */
const getMainUserId = async (reqUser) => {
  if (reqUser.role === 'Supervisor') {
    // For supervisor requests, find the owner (main user)
    const supervisor = await Supervisor.findOne({ userId: reqUser.email }).populate('owner');
    if (!supervisor || !supervisor.owner) {
      throw new Error('Supervisor owner not found');
    }
    return supervisor.owner._id;
  }
  // For regular users
  return reqUser.id;
};

/**
 * GET /api/labels - Get all labels for the authenticated user
 */
router.get('/', authenticateAndTrack, async (req, res) => {
  try {
    const mainUserId = await getMainUserId(req.user);

    const user = await User.findById(mainUserId).select('customLabels');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Transform _id to id for frontend compatibility
    const labels = (user.customLabels || []).map(label => ({
      id: label._id.toString(),
      name: label.name,
      color: label.color
    }));

    return res.status(200).json({
      success: true,
      data: labels
    });

  } catch (error) {
    console.error(`❌ [GET /api/labels] User: ${req.user?.email || req.user?.id} - Error fetching labels:`, error);
    return res.status(500).json({
      success: false,
      error: 'Error fetching labels',
      message: error.message
    });
  }
});

/**
 * POST /api/labels - Create a new label
 * Request body: { name: string, color: string }
 */
router.post('/', authenticateAndTrack, async (req, res) => {
  try {
    const { name, color } = req.body;

    // Validate required fields
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Label name is required and cannot be empty'
      });
    }

    if (name.length > 30) {
      return res.status(400).json({
        success: false,
        error: 'Label name cannot exceed 30 characters'
      });
    }

    // Validate color format if provided
    if (color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid color format. Must be a valid HEX code (e.g., #3b82f6)'
      });
    }

    const mainUserId = await getMainUserId(req.user);

    // Check for duplicate label name
    const existingUser = await User.findById(mainUserId);
    if (existingUser?.customLabels?.some(label => label.name.toLowerCase() === name.trim().toLowerCase())) {
      return res.status(409).json({
        success: false,
        error: 'A label with this name already exists'
      });
    }

    // Create the new label object
    const newLabel = {
      name: name.trim(),
      color: color || '#3b82f6' // Default blue if not provided
    };

    // Use $push to add the label to the array
    const updatedUser = await User.findByIdAndUpdate(
      mainUserId,
      { $push: { customLabels: newLabel } },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get the newly created label (last item in the array)
    const createdLabel = updatedUser.customLabels[updatedUser.customLabels.length - 1];

    return res.status(201).json({
      success: true,
      data: {
        id: createdLabel._id.toString(),
        name: createdLabel.name,
        color: createdLabel.color
      }
    });

  } catch (error) {
    console.error(`❌ [POST /api/labels] User: ${req.user?.email || req.user?.id} - Error creating label:`, error);
    return res.status(500).json({
      success: false,
      error: 'Error creating label',
      message: error.message
    });
  }
});

/**
 * PUT /api/labels/:id - Update an existing label
 * Request body: { name?: string, color?: string }
 */
router.put('/:id', authenticateAndTrack, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;

    // Validate label ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid label ID format'
      });
    }

    // At least one field must be provided for update
    if (!name && !color) {
      return res.status(400).json({
        success: false,
        error: 'At least one field (name or color) must be provided for update'
      });
    }

    // Validate name if provided
    if (name !== undefined) {
      if (name.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Label name cannot be empty'
        });
      }
      if (name.length > 30) {
        return res.status(400).json({
          success: false,
          error: 'Label name cannot exceed 30 characters'
        });
      }
    }

    // Validate color format if provided
    if (color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid color format. Must be a valid HEX code (e.g., #3b82f6)'
      });
    }

    const mainUserId = await getMainUserId(req.user);

    // First, find the user to check if label exists and check for duplicate names
    const user = await User.findById(mainUserId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if the label exists
    const labelIndex = user.customLabels.findIndex(label => label._id.toString() === id);
    if (labelIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Label not found'
      });
    }

    // Check for duplicate name if name is being updated
    if (name) {
      const duplicateExists = user.customLabels.some(
        (label, idx) => idx !== labelIndex && label.name.toLowerCase() === name.trim().toLowerCase()
      );
      if (duplicateExists) {
        return res.status(409).json({
          success: false,
          error: 'A label with this name already exists'
        });
      }
    }

    // Build the update object
    const updateFields = {};
    if (name) updateFields['customLabels.$.name'] = name.trim();
    if (color) updateFields['customLabels.$.color'] = color;

    // Update the label using positional operator
    const updatedUser = await User.findOneAndUpdate(
      { _id: mainUserId, 'customLabels._id': id },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'Label not found'
      });
    }

    // Find the updated label
    const updatedLabel = updatedUser.customLabels.find(label => label._id.toString() === id);

    return res.status(200).json({
      success: true,
      data: {
        id: updatedLabel._id.toString(),
        name: updatedLabel.name,
        color: updatedLabel.color
      }
    });

  } catch (error) {
    console.error(`❌ [PUT /api/labels/:id] User: ${req.user?.email || req.user?.id} - Error updating label ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Error updating label',
      message: error.message
    });
  }
});

/**
 * DELETE /api/labels/:id - Delete a label
 */
router.delete('/:id', authenticateAndTrack, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate label ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid label ID format'
      });
    }

    const mainUserId = await getMainUserId(req.user);

    // Use $pull to remove the label from the array
    const updatedUser = await User.findByIdAndUpdate(
      mainUserId,
      { $pull: { customLabels: { _id: id } } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Note: We can't easily tell if the label was actually deleted or just didn't exist
    // The operation succeeds either way. For better UX, we return success.

    return res.status(200).json({
      success: true,
      message: 'Label deleted successfully'
    });

  } catch (error) {
    console.error(`❌ [DELETE /api/labels/:id] User: ${req.user?.email || req.user?.id} - Error deleting label ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Error deleting label',
      message: error.message
    });
  }
});

module.exports = router;
