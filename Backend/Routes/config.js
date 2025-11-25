const express = require("express");
const router = express.Router();
const PLAN_LIMITS = require("../config/planLimits");

// GET /api/config/plans
router.get("/plans", (req, res) => {
  try {
    const response = {
      free: {
        maxActiveSites: PLAN_LIMITS.free.maxSites,
        maxEmployeesPerSite: PLAN_LIMITS.free.maxEmployeesPerSite,
      },
      pro: {
        maxActiveSites: PLAN_LIMITS.pro.maxSites,
        maxEmployeesPerSite: PLAN_LIMITS.pro.maxEmployeesPerSite,
      },
      premium: {
        maxActiveSites: PLAN_LIMITS.premium.maxSites,
        maxEmployeesPerSite: PLAN_LIMITS.premium.maxEmployeesPerSite,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching plan config:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
