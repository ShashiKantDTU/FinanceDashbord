const axios = require('axios');
require('dotenv').config();

/**
 * Sends subscription webhook to merchant system
 * 
 * @param {string} userPhone - User's phone number
 * @param {number} subscriptionAmount - Subscription amount (299 or 499)
 * @param {Date|string} planExpiryDate - When the subscription plan expires
 * @param {boolean} isUpgrade - Whether this is an upgrade within same billing cycle
 * @param {string} purchaseToken - Unique Google Play purchase token for idempotency
 * @returns {Promise<Object>} Webhook response data
 */
const sendWebhook = async (userPhone, subscriptionAmount, planExpiryDate, isUpgrade = false, purchaseToken = null) => {
  try {
    // Validation
    if (!userPhone || !subscriptionAmount || !planExpiryDate) {
      throw new Error('User phone number, subscription amount, and plan expiry date are required');
    }

    // Validate subscription amount
    if (![299, 499].includes(subscriptionAmount)) {
      throw new Error('Invalid subscription amount. Must be ₹299 or ₹499');
    }

    const payload = {
      userPhone,
      subscriptionAmount,
      planExpiryDate,
      isUpgrade
    };

    // Add purchaseToken for idempotency if provided
    if (purchaseToken) {
      payload.transactionId = purchaseToken;
    }

    const response = await axios.post(
      `${process.env.MERCHANT_WEBHOOK_API}/payment-success`,
      payload,
      {
        headers: {
          "x-internal-secret": process.env.INTERNAL_API_SECRET
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error sending webhook:', error.message);
    throw error;
  }
};

/**
 * Sends subscription cancellation webhook to merchant system
 * 
 * @param {string} userPhone - User's phone number
 * @param {number} subscriptionAmount - Subscription amount (299 or 499)
 * @param {string} reason - Reason for cancellation (optional)
 * @param {string} purchaseToken - Unique Google Play purchase token for idempotency
 * @returns {Promise<Object>} Webhook response data
 */
const sendCancellationWebhook = async (userPhone, subscriptionAmount, reason = 'Subscription revoked', purchaseToken = null) => {
  try {
    // Validation
    if (!userPhone || !subscriptionAmount) {
      throw new Error('User phone number and subscription amount are required');
    }

    // Validate subscription amount
    if (![299, 499].includes(subscriptionAmount)) {
      throw new Error('Invalid subscription amount. Must be ₹299 or ₹499');
    }

    const payload = {
      userPhone,
      subscriptionAmount,
      reason
    };

    // Add purchaseToken for idempotency if provided
    if (purchaseToken) {
      payload.transactionId = purchaseToken;
    }

    const response = await axios.post(
      `${process.env.MERCHANT_WEBHOOK_API}/subscription-cancelled`,
      payload,
      {
        headers: {
          "x-internal-secret": process.env.INTERNAL_API_SECRET
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error sending cancellation webhook:', error.message);
    throw error;
  }
};

/**
 * Sends plan status change webhook to merchant system
 * 
 * @param {string} userPhone - User's phone number
 * @param {string} currentPlan - Current plan status (trial, basic-299, premium-499, expired)
 * @param {boolean} isOnTrial - Whether user is on trial
 * @param {Date|string|null} planExpiryDate - When plan expires (null for expired)
 * @param {string} reason - Reason for status change
 * @returns {Promise<Object>} Webhook response data
 */
const sendPlanStatusChangeWebhook = async (userPhone, currentPlan, isOnTrial = false, planExpiryDate = null, reason = '') => {
  try {
    // Validation
    if (!userPhone || !currentPlan) {
      throw new Error('User phone number and current plan are required');
    }

    // Validate plan status
    const validPlans = ['trial', 'basic-299', 'premium-499', 'expired', 'cancelled', 'on-hold', 'paused'];
    if (!validPlans.includes(currentPlan)) {
      throw new Error(`Invalid plan status. Must be one of: ${validPlans.join(', ')}`);
    }

    const response = await axios.post(
      `${process.env.MERCHANT_WEBHOOK_API}/plan-status-changed`,
      {
        userPhone,
        currentPlan,
        isOnTrial,
        planExpiryDate,
        reason
      },
      {
        headers: {
          "x-internal-secret": process.env.INTERNAL_API_SECRET
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error sending plan status change webhook:', error.message);
    throw error;
  }
};

module.exports = { sendWebhook, sendCancellationWebhook, sendPlanStatusChangeWebhook };
