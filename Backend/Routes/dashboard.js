const express = require("express");
const User = require("../models/Userschema");
const Site = require("../models/Siteschema");
const Employee = require("../models/EmployeeSchema");
const { authenticateAndTrack } = require("../Middleware/usageTracker");
const { Supervisor } = require("../models/supervisorSchema");
const PLAN_LIMITS = require("../config/planLimits");
const { updateEmployeeCounts } = require("../Utils/EmployeeUtils");
// const { sendWeeklyReport } = require("../scripts/whatsappReport");

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
// [Calculate-on-Write] OPTIMIZED: Now uses cached counters instead of expensive aggregation
router.get("/v2/home", authenticateAndTrack, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required." });
    }

    // 1. Fetch the user (with stats) and their site details (with stats) in one go.
    // [Calculate-on-Write] We now select 'stats' fields which are pre-calculated
    const userdata = await User.findById(user.id)
      .select("name role site stats") // Include user stats
      .populate({
        path: "site",
        select: "sitename createdAt isActive stats", // Include site stats with cached employeeCount
      });

    if (!userdata) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    // 2. [Calculate-on-Write] NO MORE AGGREGATION NEEDED!
    // Employee counts are now cached in site.stats.employeeCount
    // This reduces database load from O(N) aggregation to O(1) reads

    // 3. Prepare the clean 'sites' array reading counts directly from cache
    const sitesWithCounts = userdata.site.map((site) => ({
      _id: site._id,
      sitename: site.sitename,
      createdAt: site.createdAt,
      isActive: site.isActive,
      // READ DIRECTLY FROM CACHE - no more aggregation!
      employeeCount: site.stats?.employeeCount || 0,
    }));

    // 4. Construct the final, clean payload.
    // [Calculate-on-Write] Total employees read directly from user stats cache
    const responsePayload = {
      userName: userdata.name,
      userRole: userdata.role,
      sites: sitesWithCounts,
      summary: {
        totalSites: userdata.site.length,
        // READ DIRECTLY FROM CACHE - no more aggregation!
        totalEmployees: userdata.stats?.totalActiveLabors || 0,
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
        message: `Free plan has limit of 1 active site(s) only. To manage multiple sites, please upgrade your plan.`,
      });
    }

    

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
      console.log(userSaveError);
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
    console.log(error);
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

    // [Calculate-on-Write] Read the cached employee count BEFORE deleting the site
    const countToRemove = site.stats?.employeeCount || 0;

    // Remove site from database
    await Site.findByIdAndDelete(siteId);

    // Remove site reference from user's site array
    userdata.site = userdata.site.filter((id) => id.toString() !== siteId);
    await userdata.save();

    // remove all employees associated with this site
    await Employee.deleteMany({ siteID: siteId });

    // remove all supervisors associated with this site
    await Supervisor.deleteMany({ site: siteId });

    // [Calculate-on-Write] Update User's Total Count
    // We directly update here instead of using updateEmployeeCounts
    // because the site is already deleted (no site counter to update)
    if (countToRemove > 0) {
      await User.findByIdAndUpdate(user.id, { 
        $inc: { "stats.totalActiveLabors": -countToRemove } 
      });
    }

    res.status(200).json({
      message: "Site deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting site:", error);
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
    // get current date
    // Use IST (Indian Standard Time) for all date checks
    const currentDate = new Date();
    // Convert to IST
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(currentDate.getTime() + istOffset);

  // Note: gating checks will be applied after loading user record, and only if lastSiteUpdated was within 30 days
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

    // Apply gating only if user updated sites within last 30 days
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const lastUpdate = userdata.lastSiteUpdated ? new Date(userdata.lastSiteUpdated) : null;
    const updatedWithin30Days = lastUpdate && (istDate - lastUpdate < THIRTY_DAYS_MS);

    if (updatedWithin30Days) {
      const isFirstOfMonth = istDate.getDate() === 1;
      const planActivatedAt = userdata.planActivatedAt || user.planActivatedAt;
      const isRecentPurchase = planActivatedAt && (istDate - new Date(planActivatedAt) < 24 * 60 * 60 * 1000);

      if (!isFirstOfMonth && !isRecentPurchase) {
        return res.status(403).json({
          error:
            "Site activation is only allowed within 24 hours of purchase or on the 1st of the month (IST).",
        });
      }
    }

    // Plan limits
    const plan = userdata.plan || "free";
    const currentPlanLimits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
    let limit = currentPlanLimits.maxSites;

    if (plan === 'enterprise') {
      limit = userdata.enterpriseLimits?.maxActiveSites || PLAN_LIMITS.enterprise.maxSites;
    }

    // Normalize inputs
    const toCreateNames = createSites.map((s) => (typeof s === "string" ? s.trim() : s)).filter(Boolean);
    const selectedIds = [...new Set(selectedExistingSiteIds.map(String))];

    // Enforce that the number of sites that will be active after this call <= plan limit
    const requestedActiveCount = selectedIds.length + toCreateNames.length;
    if (requestedActiveCount > limit) {
      return res.status(403).json({
        message: `Your ${currentPlanLimits.displayName} plan allows only ${limit} active sites.`,
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
        {
          $addToSet: { site: { $each: createdIds } },
          $set: { lastSiteUpdated: new Date() },
        }
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

    // Track when user last updated site active status via API
    // If we already set it during site creation above, skip redundant write
    if (toCreateNames.length === 0) {
      await User.updateOne({ _id: userdata._id }, { $set: { lastSiteUpdated: new Date() } });
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


router.put("/toggle-whatsapp-reports" , authenticateAndTrack, async (req, res) => {
  const user = req.user;
  if (!user || !req.body || typeof req.body.enabled !== 'boolean') {
    return res.status(401).json({
      error: "Access denied. Authentication required.",
    });
  }

  // Fetch user settings information
  const UpdateData = req.body.enabled;

  const update = await User.findByIdAndUpdate(
    user.id,
    { whatsAppReportsEnabled: UpdateData },
    { new: true }
  );

  return res.status(200).json({
    success: true,
  });
});



router.put("/update-whatsapp-phone" , authenticateAndTrack, async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      error: "Access denied. Authentication required.",
    });
  }

  const { phone } = req.body;
  if (!phone || typeof phone !== 'string' || phone.trim() === '') {
    return res.status(400).json({
      error: "Valid phone number is required.",
    });
  }

  // Update user's WhatsApp report phone number
  const update = await User.findByIdAndUpdate(
    user.id,
    { whatsAppReportPhone: phone.trim() },
    { new: true }
  );

  return res.status(200).json({
    success: true,
  });
});

// router.post('/demoreport' , async (req, rest) => {
//   try {
//     const testUser = {
//       "name": "Sunny Poddar",
//       "phoneNumber": "+919354739451",
//       "calculationType": "default"
//       };
//     const testSiteId = "6870f208c36ebbb9064d6649";
//     const testMonth = 8; // August
//     const testYear = 2025;
//     const testWeek = 2; // Week 2

//     const result = await sendWeeklyReport(testUser, testSiteId, testMonth, testYear, testWeek);
//     console.log("Demo report result:", result);
//     return rest.status(200).json({ success: true, result });
//   } catch (error) {
//     console.error("Error sending demo report:", error);
//     return rest.status(500).json({ success: false, message: "Failed to send demo report", error: error.message });
//   }
// })


module.exports = router;
