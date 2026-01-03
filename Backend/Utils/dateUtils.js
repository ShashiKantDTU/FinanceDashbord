/**
 * Centralized Date Utilities for Application Timezone (IST)
 * 
 * PURPOSE:
 * All date operations that involve month/year comparison for business logic
 * MUST use functions from this module to ensure consistent timezone handling.
 * 
 * WHY THIS EXISTS:
 * JavaScript's Date object uses the server's local timezone for methods like
 * getMonth(), getDate(), getFullYear(). If the server is in UTC but users are
 * in IST, there's a 5.5-hour window each day where the server's "current month"
 * differs from the user's - causing bugs in counters, trial expiry, etc.
 * 
 * HOW IT WORKS:
 * 1. We define a single APP_TIMEZONE constant
 * 2. All date functions convert to this timezone before extracting values
 * 3. This works regardless of server location or TZ environment variable
 * 
 * USAGE:
 * const { getAppDate, getCurrentMonthYear, isCurrentMonth } = require('./dateUtils');
 * 
 * @module Utils/dateUtils
 */

// Application timezone - all business logic uses IST (India Standard Time)
const APP_TIMEZONE = 'Asia/Kolkata';

/**
 * Get current date/time in application timezone (IST)
 * 
 * NOTE: This returns a Date object where getMonth(), getDate(), etc.
 * return values as they would be in IST, regardless of server timezone.
 * 
 * @returns {Date} Current date/time normalized to IST
 */
function getAppDate() {
    // toLocaleString with timeZone option gives us a string in IST
    // Parsing it back gives us a Date where getters return IST values
    return new Date(new Date().toLocaleString('en-US', { timeZone: APP_TIMEZONE }));
}

/**
 * Get current month (1-12) and year in application timezone
 * 
 * @returns {{ month: number, year: number }} Current month (1-12) and year in IST
 */
function getCurrentMonthYear() {
    const d = getAppDate();
    return {
        month: d.getMonth() + 1, // Convert from 0-indexed to 1-12
        year: d.getFullYear()
    };
}

/**
 * Get current day, month (1-12), and year in application timezone
 * 
 * @returns {{ day: number, month: number, year: number }} Current day (1-31), month (1-12), and year in IST
 */
function getCurrentDayMonthYear() {
    const d = getAppDate();
    return {
        day: d.getDate(),
        month: d.getMonth() + 1,
        year: d.getFullYear()
    };
}

/**
 * Check if given month/year matches the current month in application timezone
 * 
 * CRITICAL: Use this for all "is current month" checks to ensure
 * counters, plan limits, and other business logic work correctly.
 * 
 * @param {number|string} month - Month to check (1-12)
 * @param {number|string} year - Year to check
 * @returns {boolean} True if the given month/year is the current month in IST
 */
function isCurrentMonth(month, year) {
    const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
    return parseInt(month) === currentMonth && parseInt(year) === currentYear;
}

/**
 * Check if a given month/year is in the future relative to current IST date
 * 
 * @param {number|string} month - Month to check (1-12)
 * @param {number|string} year - Year to check
 * @returns {boolean} True if the given month/year is after the current month
 */
function isFutureMonth(month, year) {
    const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
    const m = parseInt(month);
    const y = parseInt(year);
    return y > currentYear || (y === currentYear && m > currentMonth);
}

/**
 * Check if a given month/year is in the past relative to current IST date
 * 
 * @param {number|string} month - Month to check (1-12)
 * @param {number|string} year - Year to check
 * @returns {boolean} True if the given month/year is before the current month
 */
function isPastMonth(month, year) {
    const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
    const m = parseInt(month);
    const y = parseInt(year);
    return y < currentYear || (y === currentYear && m < currentMonth);
}

/**
 * Log timezone information for debugging/verification
 * Called at server startup to verify timezone configuration
 */
function logTimezoneInfo() {
    const appDate = getAppDate();
    const serverDate = new Date();
    
    console.log(`🌍 Application Timezone: ${APP_TIMEZONE}`);
    console.log(`🕐 App Time (IST): ${appDate.toLocaleString('en-IN')}`);
    console.log(`🖥️  Server TZ Env: ${process.env.TZ || '(not set)'}`);
    console.log(`📊 Current Month/Year (IST): ${getCurrentMonthYear().month}/${getCurrentMonthYear().year}`);
    
    // Warn if TZ is not set to match APP_TIMEZONE
    if (process.env.TZ !== APP_TIMEZONE) {
        console.warn(`⚠️  NOTICE: TZ environment variable is "${process.env.TZ || 'not set'}".`);
        console.warn(`   For best results, set TZ=${APP_TIMEZONE} in your hosting environment.`);
        console.warn(`   The app will still work correctly using our timezone conversion.`);
    }
}

module.exports = {
    APP_TIMEZONE,
    getAppDate,
    getCurrentMonthYear,
    getCurrentDayMonthYear,
    isCurrentMonth,
    isFutureMonth,
    isPastMonth,
    logTimezoneInfo
};
