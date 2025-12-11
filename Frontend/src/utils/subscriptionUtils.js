/**
 * Utility functions for handling subscription limits and checks
 */

// Plan limits configuration
export const PLAN_LIMITS = {
  free: {
    maxEmployees: 5,
    name: 'Free Plan'
  },
  pro: {
    maxEmployees: 50,
    name: 'Contractor Pro'
  },
  premium: {
    maxEmployees: 100,
    name: 'Haazri Automate'
  },
  enterprise: {
    maxEmployees: 300, // Default fallback, usually overridden by custom limits
    name: 'Enterprise'
  }
};

/**
 * Check if user can add more employees based on their plan
 * @param {string} userPlan - User's current plan ('free', 'pro', 'premium', 'enterprise')
 * @param {number} currentEmployeeCount - Current number of employees
 * @param {number} additionalEmployees - Number of employees to add (default: 1)
 * @param {Object} customLimits - Optional custom limits object from user profile
 * @returns {Object} - { canAdd: boolean, remainingSlots: number, isApproachingLimit: boolean }
 */
export const checkEmployeeLimit = (userPlan = 'free', currentEmployeeCount = 0, additionalEmployees = 1, customLimits = null) => {
  const plan = PLAN_LIMITS[userPlan] || PLAN_LIMITS.free;
  let maxEmployees = plan.maxEmployees;
  
  // Override with custom limits if available
  if (customLimits && customLimits.maxEmployeesPerSite) {
    maxEmployees = customLimits.maxEmployeesPerSite;
  }
  
  if (maxEmployees === Infinity) {
    return {
      canAdd: true,
      remainingSlots: Infinity,
      isApproachingLimit: false,
      planName: plan.name
    };
  }
  
  const remainingSlots = maxEmployees - currentEmployeeCount;
  const canAdd = remainingSlots >= additionalEmployees;
  const isApproachingLimit = remainingSlots <= 5; // Warning when 5 or fewer slots remain
  
  return {
    canAdd,
    remainingSlots,
    isApproachingLimit,
    planName: plan.name,
    maxEmployees
  };
};

/**
 * Get subscription warning message for UI display
 * @param {string} userPlan - User's current plan
 * @param {number} currentEmployeeCount - Current number of employees
 * @param {Object} customLimits - Optional custom limits object
 * @returns {string|null} - Warning message or null if no warning needed
 */
export const getSubscriptionWarning = (userPlan = 'free', currentEmployeeCount = 0, customLimits = null) => {
  const limitCheck = checkEmployeeLimit(userPlan, currentEmployeeCount, 1, customLimits);
  
  if (!limitCheck.isApproachingLimit || limitCheck.remainingSlots === Infinity) {
    return null;
  }
  
  if (limitCheck.remainingSlots === 0) {
    return `You've reached the maximum of ${limitCheck.maxEmployees} employees for the ${limitCheck.planName}. Upgrade to add more employees.`;
  }
  
  return `You have ${limitCheck.remainingSlots} employee slots remaining on the ${limitCheck.planName}.`;
};

/**
 * Check if user should see subscription modal
 * @param {string} userPlan - User's current plan
 * @param {number} currentEmployeeCount - Current number of employees
 * @param {number} additionalEmployees - Number of employees to add
 * @param {Object} customLimits - Optional custom limits object
 * @returns {boolean} - Whether to show subscription modal
 */
export const shouldShowSubscriptionModal = (userPlan = 'free', currentEmployeeCount = 0, additionalEmployees = 1, customLimits = null) => {
  const limitCheck = checkEmployeeLimit(userPlan, currentEmployeeCount, additionalEmployees, customLimits);
  // Show modal if they can't add, regardless of plan (unless it's infinite which is handled in checkEmployeeLimit)
  return !limitCheck.canAdd;
};