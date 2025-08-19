const express = require("express");
const User = require("../models/Userschema");
const Site = require("../models/Siteschema");
const Employee = require("../models/EmployeeSchema");
const { authenticateAndTrack } = require("../Middleware/usageTracker");

const router = express.Router();

// Dashboard route
router.get("/home", authenticateAndTrack, async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      error: "Access denied. Authentication required.",
    });
  }
  const userdata = await User.findById(user.id).populate({
    path: "site",
    select: "sitename createdBy createdAt updatedAt owner",
  });
  if (!userdata) {
    return res.status(404).json({
      error: "User not found.",
    });
  }

  res.status(200).json({
    user: {
      name: userdata.name,
      role: userdata.role,
      sites: userdata.site,
    },
  });
});

// NEW, SEPARATE ENDPOINT FOR THE MODERN DASHBOARD
router.get("/v2/home", authenticateAndTrack, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required." });
    }

    // 1. Fetch the user and their site details in one go.
    const userdata = await User.findById(user.id).populate({
      path: "site",
      select: "sitename createdAt isActive", // Only select fields the new UI needs.
    });

    if (!userdata) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    // 2. Efficiently get employee counts for all sites.
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const siteIds = userdata.site.map((s) => s._id);

    let countMap = new Map();
    if (siteIds.length > 0) {
      const employeeCounts = await Employee.aggregate([
        {
          $match: {
            siteID: { $in: siteIds },
            month: currentMonth,
            year: currentYear,
          },
        },
        { $group: { _id: "$siteID", count: { $sum: 1 } } },
      ]);
      countMap = new Map(
        employeeCounts.map((item) => [item._id.toString(), item.count])
      );
    }

    // 3. Prepare the clean 'sites' array with counts included.
    const sitesWithCounts = userdata.site.map((site) => ({
      _id: site._id,
      sitename: site.sitename,
      createdAt: site.createdAt,
      isActive: site.isActive,
      employeeCount: countMap.get(site._id.toString()) || 0,
    }));

    // 4. Calculate summary totals.
    const totalEmployees = Array.from(countMap.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    // 5. Construct the final, clean payload.
    const responsePayload = {
      userName: userdata.name,
      userRole: userdata.role,
      sites: sitesWithCounts,
      summary: {
        totalSites: siteIds.length,
        totalEmployees: totalEmployees,
      },
    };

    res.status(200).json({ success: true, data: responsePayload });
  } catch (error) {
    console.error("Error in /v2/home route:", error);
    res
      .status(500)
      .json({ success: false, message: "An internal server error occurred." });
  }
});

// Add site route
router.post("/home/addsite", authenticateAndTrack, async (req, res) => {
  try {
    const user = req.user;
    console.log("add site route hit");

    if (!user) {
      return res.status(401).json({
        error: "Access denied. Authentication required.",
      });
    }

    const { sitename } = req.body;
    console.log(sitename);
    if (!sitename) {
      return res.status(400).json({
        error: "Site name is required.",
      });
    }

    const userdata = await User.findById(user.id);
    if (!userdata) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    // check user plan
    let plan = userdata.plan;
    if (plan === null || plan === undefined) {
      plan = "free";
    }

    // Check if user has reached the site limit based on their plan
    if (plan === "free" && userdata.site.length >= 1) {
      return res.status(403).json({
        message:
          "Haazri Basic plan has limit of 1 site only, To manage multiple sites Upgrade your plan to Contractor Pro or Haazri Automate.",
      });
    }

    // premimum plan has unlimited limits

    // Create new site using the Site model
    const newSite = new Site({
      sitename: sitename,
      CustomProfile: null, // You'll need to handle this properly
      owner: userdata._id, // Reference to the user
      createdBy: userdata.name || userdata.email || userdata.phoneNumber, // Use actual user data
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
        message: "Error linking site to user",
        details: userSaveError.message,
      });
    }

    res.status(201).json({
      message: "Site created successfully",
      site: savedSite,
    });
  } catch (error) {
    res.status(500).json({
      error: "Error creating site",
      details: error.message,
    });
  }
});

// Delete site route
router.delete("/delete-site", authenticateAndTrack, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        error: "Access denied. Authentication required.",
      });
    }

    const { siteName, siteId } = req.body;
    if (!siteName || !siteId) {
      return res.status(400).json({
        error: "Site name and site ID are required.",
      });
    }

    const userdata = await User.findById(user.id);
    if (!userdata) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    // Find the site to verify ownership or permissions
    const site = await Site.findById(siteId);
    if (!site) {
      return res.status(404).json({
        error: "Site not found.",
      });
    }

    // Check if user has permission to delete (either owner or admin)
    const canDelete =
      site.createdBy === user.name ||
      site.owner.toString() === userdata._id.toString();

    if (!canDelete) {
      return res.status(403).json({
        error: "You do not have permission to delete this site.",
      });
    }

    // Remove site from database
    await Site.findByIdAndDelete(siteId);

    // Remove site reference from user's site array
    userdata.site = userdata.site.filter((id) => id.toString() !== siteId);
    await userdata.save();

    res.status(200).json({
      message: "Site deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: "Error deleting site",
      details: error.message,
    });
  }
});

// Edit site name route
router.put("/edit-site-name", authenticateAndTrack, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        error: "Access denied. Authentication required.",
      });
    }

    const { siteId, newSiteName } = req.body;
    if (!siteId || !newSiteName) {
      return res.status(400).json({
        error: "Site ID and new site name are required.",
      });
    }

    // Find the site
    const site = await Site.findById(siteId);
    if (!site) {
      return res.status(404).json({
        error: "Site not found.",
      });
    }

    // Check if user is the creator or admin
    const isCreator =
      site.createdBy === user.name || site.createdBy === user.email;
    const isAdmin = user.role && user.role.toLowerCase() === "admin";
    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        error: "You do not have permission to edit this site name.",
      });
    }

    // Only admins can edit site name (additional condition)
    if (!isAdmin) {
      return res.status(403).json({
        error: "Only admins can edit a site name.",
      });
    }

    // Update the site name
    site.sitename = newSiteName.trim();
    await site.save();

    res.status(200).json({
      message: "Site name updated successfully",
      site: site,
    });
  } catch (error) {
    res.status(500).json({
      error: "Error updating site name",
      details: error.message,
    });
  }
});

router.post("/sites/activate", authenticateAndTrack, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Access denied. Authentication required." });
    }

    const { createSites, selectedExistingSiteIds } = req.body || {};
    if (!Array.isArray(createSites) || !Array.isArray(selectedExistingSiteIds)) {
      return res.status(400).json({ error: "Invalid site data." });
    }

    const userdata = await User.findById(user.id);
    if (!userdata) {
      return res.status(404).json({ error: "User not found." });
    }

    // Plan limits
    const plan = userdata.plan || "free";
    const planLimits = { free: 1, pro: 10, premium: 20 };
    const limit = planLimits[plan] ?? 1;

    // Normalize inputs
    const toCreateNames = createSites.map((s) => (typeof s === "string" ? s.trim() : s)).filter(Boolean);
    const selectedIds = [...new Set(selectedExistingSiteIds.map(String))];

    // Enforce that the number of sites that will be active after this call <= plan limit
    const requestedActiveCount = selectedIds.length + toCreateNames.length;
    if (requestedActiveCount > limit) {
      return res.status(403).json({
        message:
          plan === "free"
            ? "Haazri Basic plan allows only 1 active site. Upgrade to manage more."
            : `Your ${plan} plan allows only ${limit} active sites.`,
      });
    }

    // Make sure all selected existing sites belong to the user
    if (selectedIds.length > 0) {
      const countOwned = await Site.countDocuments({ _id: { $in: selectedIds }, owner: userdata._id });
      if (countOwned !== selectedIds.length) {
        return res.status(403).json({ error: "One or more selected sites are not owned by this user." });
      }
    }

    // Create any new sites requested
    let savedSites = [];
    if (toCreateNames.length > 0) {
      const newSites = toCreateNames.map((siteName) =>
        new Site({
          sitename: siteName,
          owner: userdata._id,
          createdBy: userdata.name || userdata.email || userdata.phoneNumber,
        })
      );
      savedSites = await Site.insertMany(newSites);

      // Attach newly created site IDs to the user document
      const createdIds = savedSites.map((s) => s._id);
      await User.updateOne(
        { _id: userdata._id },
        { $addToSet: { site: { $each: createdIds } } }
      );
    }

    const createdIds = savedSites.map((s) => String(s._id));
    const keepActiveIds = [...new Set([...selectedIds, ...createdIds])];

    // Deactivate all user's other sites, activate the selected + newly created
    await Site.updateMany(
      { owner: userdata._id, _id: { $nin: keepActiveIds } },
      { $set: { isActive: false } }
    );
    if (keepActiveIds.length > 0) {
      await Site.updateMany(
        { owner: userdata._id, _id: { $in: keepActiveIds } },
        { $set: { isActive: true } }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Active sites updated successfully.",
      data: {
        plan,
        limit,
        activatedSiteIds: keepActiveIds,
        createdSiteIds: createdIds,
      },
    });
  } catch (error) {
    console.error("/sites/activate error:", error);
    return res.status(500).json({ error: "Error toggling sites", details: error.message });
  }
});

module.exports = router;
