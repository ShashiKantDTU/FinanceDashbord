const PLAN_LIMITS = {
  free: {
    maxSites: 1,
    maxEmployeesPerSite: 10,
    displayName: "Haazri Basic",
  },
  lite: {
    maxSites: 1,
    maxEmployeesPerSite: 17,
    displayName: "Haazri Lite",
  },
  pro: {
    maxSites: 3,
    maxEmployeesPerSite: 40,
    displayName: "Contractor Pro",
  },
  premium: {
    maxSites: 6,
    maxEmployeesPerSite: 80,
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
