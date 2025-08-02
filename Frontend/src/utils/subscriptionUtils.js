/**
 * Utility functions for handling subscription limits and checks
 */

// Plan limits configuration
export const PLAN_LIMITS = {
  free: {
    maxEmployees: 20,
    name: 'Free Plan'
  },
  pro: {
    maxEmployees: Infinity,
    name: 'Contractor Pro'
  },
  premium: {
    maxEmployees: Infinity,
    name: 'Haazri Automate'
  }
};

/**
 * Check if user can add more employees based on their plan
 * @param {string} userPlan - User's current plan ('free', 'pro', 'premium')
 * @param {number} currentEmployeeCount - Current number of employees
 * @param {number} additionalEmployees - Number of employees to add (default: 1)
 * @returns {Object} - { canAdd: boolean, remainingSlots: number, isApproachingLimit: boolean }
 */
export const checkEmployeeLimit = (userPlan = 'free', currentEmployeeCount = 0, additionalEmployees = 1) => {
  const plan = PLAN_LIMITS[userPlan] || PLAN_LIMITS.free;
  const maxEmployees = plan.maxEmployees;
  
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
 * @returns {string|null} - Warning message or null if no warning needed
 */
export const getSubscriptionWarning = (userPlan = 'free', currentEmployeeCount = 0) => {
  const limitCheck = checkEmployeeLimit(userPlan, currentEmployeeCount);
  
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
 * @returns {boolean} - Whether to show subscription modal
 */
export const shouldShowSubscriptionModal = (userPlan = 'free', currentEmployeeCount = 0, additionalEmployees = 1) => {
  const limitCheck = checkEmployeeLimit(userPlan, currentEmployeeCount, additionalEmployees);
  return !limitCheck.canAdd && userPlan === 'free';
};