const express = require('express');
const User = require('../models/Userschema');
const Site = require('../models/Siteschema');
const { authenticateToken } = require('../Middleware/auth');

const router = express.Router();


// Dashboard route
router.get('/home', authenticateToken, async (req, res) => {

    const user = req.user; 
    if (!user) {
        return res.status(401).json({ 
            error: 'Access denied. Authentication required.' 
        });
    }    const userdata = await User.findById(user.id).populate({
        path: 'site',
        select: 'sitename createdBy createdAt updatedAt owner'
    })
    if (!userdata) {
        return res.status(404).json({ 
            error: 'User not found.' 
        });
    }

    res.status(200).json({ 
        user: {
            name: userdata.name,
            role: userdata.role,
            sites: userdata.site
        } 
    });

})


// Add site route
router.post('/home/addsite', authenticateToken, async (req, res) => {
    try {
        const user = req.user; 
        if (!user) {
            return res.status(401).json({ 
                error: 'Access denied. Authentication required.' 
            });
        }
        
        const { sitename } = req.body;
        if (!sitename) {
            return res.status(400).json({ 
                error: 'Site name is required.' 
            });
        }
        
        const userdata = await User.findById(user.id);
        if (!userdata) {
            return res.status(404).json({ 
                error: 'User not found.' 
            });
        }        // Create new site using the Site model
        const newSite = new Site({
            sitename: sitename,
            CustomProfile: null, // You'll need to handle this properly
            owner: userdata._id,  // Reference to the user
            createdBy: user.name // name of creator
        });

        // Save the site to the database
        const savedSite = await newSite.save();
        
        try {
            // Add site reference to user's site array
            userdata.site.push(savedSite._id);
            await userdata.save();
        } catch (userSaveError) {
            // If updating user fails, remove the orphaned site
            await Site.findByIdAndDelete(savedSite._id);
            return res.status(500).json({
                error: 'Error linking site to user',
                details: userSaveError.message
            });
        }

        res.status(201).json({
            message: 'Site created successfully',
            site: savedSite
        });

    } catch (error) {
        res.status(500).json({
            error: 'Error creating site',
            details: error.message
        });
    }
});

// Delete site route
router.delete('/delete-site', authenticateToken, async (req, res) => {
    try {
        const user = req.user; 
        if (!user) {
            return res.status(401).json({ 
                error: 'Access denied. Authentication required.' 
            });
        }
        
        const { siteName, siteId, createdBy } = req.body;
        if (!siteName || !siteId || !createdBy) {
            return res.status(400).json({ 
                error: 'Site name, site ID, and created by are required.' 
            });
        }
        
        const userdata = await User.findById(user.id);
        if (!userdata) {
            return res.status(404).json({ 
                error: 'User not found.' 
            });
        }

        // Find the site to verify ownership or permissions
        const site = await Site.findById(siteId);
        if (!site) {
            return res.status(404).json({ 
                error: 'Site not found.' 
            });
        }

        // Check if user has permission to delete (either owner or admin)
        const canDelete = site.createdBy === user.name || 
                         site.owner.toString() === userdata._id.toString()
        
        if (!canDelete) {
            return res.status(403).json({ 
                error: 'You do not have permission to delete this site.' 
            });
        }

        // Remove site from database
        await Site.findByIdAndDelete(siteId);
        
        // Remove site reference from user's site array
        userdata.site = userdata.site.filter(id => id.toString() !== siteId);
        await userdata.save();

        res.status(200).json({
            message: 'Site deleted successfully'
        });

    } catch (error) {
        res.status(500).json({
            error: 'Error deleting site',
            details: error.message
        });
    }
});

// Edit site name route
router.put('/edit-site-name', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({
                error: 'Access denied. Authentication required.'
            });
        }

        const { siteId, newSiteName } = req.body;
        if (!siteId || !newSiteName) {
            return res.status(400).json({
                error: 'Site ID and new site name are required.'
            });
        }

        // Find the site
        const site = await Site.findById(siteId);
        if (!site) {
            return res.status(404).json({
                error: 'Site not found.'
            });
        }

        // Check if user is the creator or admin
        const isCreator = (site.createdBy === user.name || site.createdBy === user.email);
        const isAdmin = user.role && user.role.toLowerCase() === 'admin';
        if (!isCreator && !isAdmin) {
            return res.status(403).json({
                error: 'You do not have permission to edit this site name.'
            });
        }

        // Only admins can edit site name (additional condition)
        if (!isAdmin) {
            return res.status(403).json({
                error: 'Only admins can edit a site name.'
            });
        }

        // Update the site name
        site.sitename = newSiteName.trim();
        await site.save();

        res.status(200).json({
            message: 'Site name updated successfully',
            site: site
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error updating site name',
            details: error.message
        });
    }
});

module.exports = router;

