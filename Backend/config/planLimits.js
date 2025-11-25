const PLAN_LIMITS = {
  free: {
    maxSites: 1,
    maxEmployeesPerSite: 10,
    displayName: "Haazri Basic",
  },
  pro: {
    maxSites: 3,
    maxEmployeesPerSite: 35,
    displayName: "Contractor Pro",
  },
  premium: {
    maxSites: 6,
    maxEmployeesPerSite: 70,
    displayName: "Haazri Automate",
  },
  business: {
    maxSites: 10, // Example default
    maxEmployeesPerSite: 100, // Example default
    displayName: "Business Plan",
  },
  enterprise: {
    maxSites: 15, // Default fallback
    maxEmployeesPerSite: 200, // Default fallback
    displayName: "Enterprise",
  },
};

module.exports = PLAN_LIMITS;
