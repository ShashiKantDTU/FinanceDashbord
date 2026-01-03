const PRICING_CONFIG = {
  // 1. BASE COSTS (To ensure minimum plan value)
  BASE_FEE: 10, // Starts the plan at a premium level immediately

  // 2. VOLUME COSTS
  COST_PER_EMPLOYEE: 1.5, // ₹1.5 per laborer
  COST_PER_SITE: 25, // ₹25 per site (Includes Supervisor Account)

  // 3. ADD-ONS
  EXCEL_FEATURE_FEE: 99, // Flat fee for "Professional Data Pack"
  WHATSAPP_FEE_PER_SITE: 25, // ₹25 per site for weekly/monthly reports

  // UI LIMITS
  MIN_SITES: 1,
  MAX_SITES: 50,
  MIN_EMPLOYEES: 18,
  MAX_EMPLOYEES: 3000,
  DEFAULT_SITES: 5,
  DEFAULT_EMPLOYEES: 100,
  SITE_STEP: 1,
  EMPLOYEE_STEP: 10,
};

module.exports = PRICING_CONFIG;
