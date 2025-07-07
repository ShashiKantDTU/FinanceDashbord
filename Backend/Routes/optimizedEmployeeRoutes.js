/**
 * Updated Employee Data Management with Optimized Change Tracking
 * 
 * This endpoint demonstrates proper integration with the new optimized change tracking system
 */

const express = require('express');
const router = express.Router();
const { updateEmployeeDataOptimized } = require('../Utils/OptimizedChangeTracker');
const { authenticateToken } = require('../Middleware/auth');

/**
 * Update employee data with optimized change tracking
 * Supports updating attendance, payouts, and additional_req_pays
 * 
 * Expected frontend data structure:
 * {
 *   "empid": "EMP001",
 *   "month": 12,
 *   "year": 2024,
 *   "siteID": "site123",
 *   "remark": "Monthly update",
 *   "updateData": {
 *     "attendance": ["P", "P1", "A7", "P20"],
 *     "payouts": [
 *       {
 *         "value": 5000,
 *         "remark": "Salary payment",
 *         "date": "2024-12-15",
 *         "createdBy": "admin@company.com"
 *       }
 *     ],
 *     "additional_req_pays": [
 *       {
 *         "value": 1000,
 *         "remark": "Bonus",
 *         "date": "2024-12-20"
 *         // createdBy will be auto-added from auth context
 *       }
 *     ]
 *   }
 * }
 */
router.put('/update-optimized', authenticateToken, async (req, res) => {
    try {
        const { empid, month, year, siteID, remark, updateData } = req.body;
        
        // Validate required fields
        if (!empid || !month || !year || !siteID || !updateData) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: empid, month, year, siteID, updateData'
            });
        }

        // Get user info from auth middleware
        const changedBy = req.user?.email || req.user?.userEmail || 'unknown-user';
        
        console.log(`🔄 Updating employee ${empid} for ${month}/${year} with optimized tracking`);
        console.log('Update data:', JSON.stringify(updateData, null, 2));

        // Preprocess update data to ensure consistency
        const processedUpdateData = { ...updateData };
        
        // Add createdBy to additional_req_pays if missing (for schema consistency)
        if (processedUpdateData.additional_req_pays && Array.isArray(processedUpdateData.additional_req_pays)) {
            processedUpdateData.additional_req_pays = processedUpdateData.additional_req_pays.map(payment => ({
                ...payment,
                createdBy: payment.createdBy || changedBy
            }));
        }

        // Ensure payouts have createdBy field
        if (processedUpdateData.payouts && Array.isArray(processedUpdateData.payouts)) {
            processedUpdateData.payouts = processedUpdateData.payouts.map(payout => ({
                ...payout,
                createdBy: payout.createdBy || changedBy
            }));
        }

        // Use the optimized update function
        const result = await updateEmployeeDataOptimized(
            siteID,
            empid,
            month,
            year,
            processedUpdateData,
            changedBy,
            remark || 'Employee data update via API'
        );

        console.log(`✅ Employee ${empid} updated successfully with ${result.data.changesTracked} changes tracked`);

        return res.status(200).json({
            success: true,
            message: result.message,
            data: {
                employee: result.data.updatedEmployee,
                changeTracking: {
                    entriesCreated: result.data.changesTracked,
                    trackingEnabled: true,
                    systemType: 'optimized'
                },
                metadata: {
                    updatedBy: changedBy,
                    updateTime: new Date(),
                    fieldsUpdated: Object.keys(updateData),
                    remark: remark
                }
            }
        });

    } catch (error) {
        console.error('❌ Error updating employee with optimized tracking:', error);
        
        return res.status(500).json({
            success: false,
            error: 'Failed to update employee data',
            message: error.message,
            details: {
                empid: req.body.empid,
                month: req.body.month,
                year: req.body.year,
                siteID: req.body.siteID
            }
        });
    }
});

/**
 * Bulk update multiple employees
 * Expected data structure:
 * {
 *   "updates": [
 *     {
 *       "empid": "EMP001",
 *       "month": 12,
 *       "year": 2024,
 *       "siteID": "site123",
 *       "remark": "Bulk update",
 *       "updateData": { ... }
 *     }
 *   ]
 * }
 */
router.put('/bulk-update-optimized', authenticateToken, async (req, res) => {
    try {
        const { updates } = req.body;
        
        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Updates array is required and cannot be empty'
            });
        }

        const changedBy = req.user?.email || req.user?.userEmail || 'unknown-user';
        const results = [];
        let totalChangesTracked = 0;

        console.log(`🔄 Processing bulk update for ${updates.length} employees`);

        // Process each update
        for (const update of updates) {
            try {
                const { empid, month, year, siteID, remark, updateData } = update;
                
                if (!empid || !month || !year || !siteID || !updateData) {
                    results.push({
                        empid: empid || 'unknown',
                        success: false,
                        error: 'Missing required fields'
                    });
                    continue;
                }

                const result = await updateEmployeeDataOptimized(
                    siteID,
                    empid,
                    month,
                    year,
                    updateData,
                    changedBy,
                    remark || `Bulk update by ${changedBy}`
                );

                totalChangesTracked += result.data.changesTracked;
                
                results.push({
                    empid,
                    success: true,
                    changesTracked: result.data.changesTracked,
                    message: result.message
                });

            } catch (updateError) {
                console.error(`❌ Error updating employee ${update.empid}:`, updateError.message);
                results.push({
                    empid: update.empid || 'unknown',
                    success: false,
                    error: updateError.message
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;

        console.log(`✅ Bulk update completed: ${successCount} successful, ${failureCount} failed, ${totalChangesTracked} total changes tracked`);

        return res.status(200).json({
            success: true,
            message: `Bulk update completed: ${successCount} successful, ${failureCount} failed`,
            data: {
                results,
                summary: {
                    totalProcessed: updates.length,
                    successful: successCount,
                    failed: failureCount,
                    totalChangesTracked
                },
                metadata: {
                    updatedBy: changedBy,
                    updateTime: new Date(),
                    systemType: 'optimized'
                }
            }
        });

    } catch (error) {
        console.error('❌ Error in bulk update:', error);
        
        return res.status(500).json({
            success: false,
            error: 'Failed to process bulk update',
            message: error.message
        });
    }
});

/**
 * Get employee change history using optimized tracking
 */
router.get('/change-history/:empid', authenticateToken, async (req, res) => {
    try {
        const { empid } = req.params;
        const { siteID, month, year, field, limit = 50, page = 1 } = req.query;
        
        if (!empid) {
            return res.status(400).json({
                success: false,
                error: 'Employee ID is required'
            });
        }

        console.log(`🔍 Fetching change history for employee ${empid}`);

        // Import the function here to avoid circular dependency
        const { getFieldChangeHistory } = require('../Utils/OptimizedChangeTracker');
        
        const options = { limit: parseInt(limit), page: parseInt(page) };
        if (month && year) {
            // Add date filtering if month/year provided
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            options.fromDate = startDate;
            options.toDate = endDate;
        }

        // If specific field requested
        if (field) {
            const history = await getFieldChangeHistory(siteID, empid, field, options);
            return res.json(history);
        }

        // Get history for all critical fields
        const fields = ['attendance', 'payouts', 'additional_req_pays'];
        const allHistory = await Promise.all(
            fields.map(fieldName => 
                getFieldChangeHistory(siteID, empid, fieldName, options)
            )
        );

        const combinedHistory = {
            success: true,
            empid,
            siteID,
            fields: fields.reduce((acc, field, index) => {
                acc[field] = allHistory[index];
                return acc;
            }, {}),
            summary: {
                totalRecords: allHistory.reduce((sum, h) => sum + h.records.length, 0),
                fieldsWithChanges: allHistory.filter(h => h.records.length > 0).length
            }
        };

        return res.json(combinedHistory);

    } catch (error) {
        console.error('❌ Error fetching change history:', error);
        
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch change history',
            message: error.message
        });
    }
});

module.exports = router;
