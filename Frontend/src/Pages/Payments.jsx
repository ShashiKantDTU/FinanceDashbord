import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import styles from './Payments.module.css';
import Sidebar from '../components/Sidebar';
import { useParams, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { FaCalendarAlt } from 'react-icons/fa';
import { generateEmployeeReportPDF } from '../utils/pdfReportGenerator';
import CustomSpinner from '../components/CustomSpinner';

const Payments = () => {
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();
    const [employeeData, setEmployeeData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedRows, setExpandedRows] = useState({});
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' }); const [editMode, setEditMode] = useState(null); // employeeId being edited
    const [editedData, setEditedData] = useState({}); const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [pendingChanges, setPendingChanges] = useState({});
    const [remarkText, setRemarkText] = useState(''); // Add remark state
    const [isUpdating, setIsUpdating] = useState(false); // Loading state for update operation


    const { siteID } = useParams(); // Get siteID from URL parameters
    // Current date for default month/year
    const currentDate = new Date();

    // Calendar picker states
    const [showCalendar, setShowCalendar] = useState(false);
    const [calendarYear, setCalendarYear] = useState(currentDate.getFullYear());
    const calendarRef = useRef(null);

    // Month names for calendar
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1); const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

    // Default site ID - you can modify this or get from user context
    const processAttendanceData = (attendance) => {

        const attendanceArray = attendance || [];

        // This section calculates summary figures based on the employee's attendance array.

        // Calculate Total Present Days:
        // Counts entries that include "P" (e.g., "P", "P1", "P8").
        const totalPresentCount = attendanceArray.reduce((acc, status) => {
            return acc + (status && status.toUpperCase().includes('P') ? 1 : 0);
        }, 0);

        // Calculate Total Overtime Hours:
        // Sums the numeric part of entries like "P2" (2 hours), "A3" (3 hours).
        // Assumes overtime is indicated by a number following "P" or "A".
        const totalOvertimeHours = attendanceArray.reduce((acc, status) => {
            if (status && status.length > 1) {
                const overtimePart = status.substring(1); // Get character(s) after the first one.
                const hours = parseInt(overtimePart, 10);
                return acc + (isNaN(hours) ? 0 : hours);
            }
            return acc;
        }, 0);

        // Calculate Total Absent Days:
        // Counts entries that include "A" (e.g., "A", "A1").
        

        // Calculate Final Attendance Days (including overtime):
        // Overtime hours are converted to days (assuming 8 hours = 1 day).
        // Remaining overtime hours are represented as a decimal fraction of a day.
        const overtimeDaysEquivalent = Math.floor(totalOvertimeHours / 8);
        const remainingOvertimeHoursPart = totalOvertimeHours % 8;
        // Convert remaining hours to a decimal (e.g., 4 hours = 0.4, not 0.5 of a day based on current logic)
        // Note: The original logic `remainingOvertimeHours / 10` might be a specific business rule
        // or a simplification. If 4 hours should be 0.5 days, this should be `remainingOvertimeHours / 8`.
        // Sticking to original logic:
        const remainingOvertimeDecimalContribution = remainingOvertimeHoursPart / 10;
        const finalAttendanceDays = totalPresentCount + overtimeDaysEquivalent + remainingOvertimeDecimalContribution;
        return finalAttendanceDays;    };    // Function to calculate payment details
    const calculatePaymentDetails = useCallback((dailyRate, attendanceData, advances, additionalWages, previousBalance) => {
        const attendance = processAttendanceData(attendanceData);
        const grossPayment = dailyRate * attendance;
        const netBalance = grossPayment - advances + additionalWages + previousBalance;

        return {
            attendance,
            grossPayment,
            netBalance
        };
    }, []);

    // Calendar utility functions
    const formatSelectedMonthDisplay = () => {
        const date = new Date(selectedYear, selectedMonth - 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    const isMonthDisabled = (year, monthIndex) => {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();

        // Disable future months
        if (year > currentYear || (year === currentYear && monthIndex > currentMonth)) {
            return true;
        }

        return false;
    };

    const handlePreviousYear = () => {
        setCalendarYear(prev => Math.max(prev - 1, 2020)); // Don't go before 2020
    };    const handleNextYear = () => {
        const currentYear = new Date().getFullYear();
        setCalendarYear(prev => Math.min(prev + 1, currentYear));
    };

    // Close calendar when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (calendarRef.current && !calendarRef.current.contains(event.target)) {
                setShowCalendar(false);
            }
        };

        if (showCalendar) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showCalendar]);

    // Fetch employee data from API
    useEffect(() => {
        const fetchEmployeeData = async () => {
            try {
                setLoading(true);

                const response = await api.get(
                    `/api/employee/allemployees?month=${selectedMonth}&year=${selectedYear}&siteID=${siteID}`
                ); if (response.success) {
                    // console.log('🔄 Processing API response data:', response.data.length, 'employees');
                    // Transform API data to match the component's expected format
                    const transformedData = response.data.map((emp) => {
                        // console.log(`\n🔄 Processing employee ${index + 1}/${response.data.length}: ${emp.name} (${emp.empid})`);

                        // Calculate payment details using the new logic
                        const paymentDetails = calculatePaymentDetails(
                            emp.rate || 0,
                            emp.attendance,
                            emp.totalPayouts || 0,
                            emp.totalAdditionalReqPays || 0,
                            emp.carryForward || emp.carry_forwarded?.value || 0
                        );
                        //   // Debug payment calculations
                        // console.log(`💰 Payment calculation for ${emp.name}:`, {
                        //     dailyRate: emp.rate,
                        //     totalAttendance: paymentDetails.attendance,
                        //     grossPayment: paymentDetails.grossPayment,
                        //     totalAdvances: emp.totalPayouts,
                        //     additionalWages: emp.totalAdditionalReqPays,
                        //     previousBalance: emp.carryForward || emp.carry_forwarded?.value,
                        //     netBalance: paymentDetails.netBalance
                        // });

                        const transformedEmployee = {
                            id: emp.empid,
                            name: emp.name,
                            dailyRate: emp.rate,
                            attendance: paymentDetails.attendance, // Calculated total attendance
                            totalAdvances: emp.totalPayouts || 0,
                            previousBalance: emp.carryForward || emp.carry_forwarded?.value || 0,
                            totalAdditionalPayments: emp.totalAdditionalReqPays || 0,
                            grossPayment: paymentDetails.grossPayment, // Calculated gross payment
                            netBalance: paymentDetails.netBalance, // Calculated net balance
                            advances: emp.payouts?.map(payout => ({
                                value: payout.value,
                                remark: payout.remark,
                                date: new Date(payout.date).toISOString().split('T')[0]
                            })) || [],
                            additionalPayments: emp.additional_req_pays?.map(payment => ({
                                value: payment.value,
                                remark: payment.remark,
                                date: new Date(payment.date).toISOString().split('T')[0]
                            })) || [],
                            // Additional fields from API
                            hasPendingPayouts: emp.hasPendingPayouts,
                            needsRecalculation: emp.needsRecalculation,
                            siteID: emp.siteID,
                            month: emp.month,
                            year: emp.year,
                            // Raw attendance for debugging
                            rawAttendance: emp.attendance
                        };

                        // console.log(`✅ Transformed employee ${emp.name}:`, transformedEmployee);
                        return transformedEmployee;
                    });                    //  console.log('🎉 All employees processed successfully:', transformedData.length);
                    setEmployeeData(transformedData);
                } else {
                    showError('Failed to fetch employee data');
                }
            } catch (err) {
                console.error('Error fetching employee data:', err);
                showError(err.message || 'Failed to fetch employee data');
            } finally {
                setLoading(false);
            }        };

        fetchEmployeeData();
    }, [selectedMonth, selectedYear, siteID, calculatePaymentDetails, showError]);

    const filteredEmployees = employeeData.filter(emp =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatCurrency = (amount) => {
        return `₹${amount.toLocaleString('en-IN')}`;
    };

    const toggleRowExpansion = (employeeId, type) => {
        const key = `${employeeId}_${type}`;
        setExpandedRows(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedEmployees = React.useMemo(() => {
        let sortableEmployees = [...filteredEmployees];
        if (sortConfig.key) {
            sortableEmployees.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableEmployees;
    }, [filteredEmployees, sortConfig]);

    const getSortIcon = (columnName) => {
        if (sortConfig.key === columnName) {
            return sortConfig.direction === 'asc' ? '↑' : '↓';
        }
        return '↕';
    };

    // Edit mode functions
    const startEdit = (employee) => {
        setEditMode(employee.id);
        setEditedData({
            ...employee,
            advances: [...employee.advances],
            additionalPayments: [...employee.additionalPayments]
        });
    };

    const cancelEdit = () => {
        setEditMode(null);
        setEditedData({});
    }; const handleFieldChange = (field, value) => {
        const newData = { ...editedData, [field]: parseFloat(value) || 0 };
        // Recalculate totals when daily rate changes
        if (field === 'dailyRate') {
            newData.grossPayment = (newData.dailyRate || 0) * (newData.attendance || 0);
            newData.netBalance = newData.grossPayment - newData.totalAdvances + newData.totalAdditionalPayments + newData.previousBalance;
        }
        setEditedData(newData);
    };

    const addAdvance = () => {
        const newAdvances = [...editedData.advances, { value: 0, remark: '', date: new Date().toISOString().split('T')[0] }];
        const totalAdvances = newAdvances.reduce((sum, adv) => sum + (adv.value || 0), 0);
        setEditedData({
            ...editedData,
            advances: newAdvances,
            totalAdvances,
            netBalance: editedData.grossPayment - totalAdvances + editedData.totalAdditionalPayments + editedData.previousBalance
        });
    };

    const removeAdvance = (index) => {
        const newAdvances = editedData.advances.filter((_, i) => i !== index);
        const totalAdvances = newAdvances.reduce((sum, adv) => sum + (adv.value || 0), 0);
        setEditedData({
            ...editedData,
            advances: newAdvances,
            totalAdvances,
            netBalance: editedData.grossPayment - totalAdvances + editedData.totalAdditionalPayments + editedData.previousBalance
        });
    };

    const updateAdvance = (index, field, value) => {
        const newAdvances = [...editedData.advances];
        newAdvances[index] = { ...newAdvances[index], [field]: field === 'value' ? (parseFloat(value) || 0) : value };
        const totalAdvances = newAdvances.reduce((sum, adv) => sum + (adv.value || 0), 0);
        setEditedData({
            ...editedData,
            advances: newAdvances,
            totalAdvances,
            netBalance: editedData.grossPayment - totalAdvances + editedData.totalAdditionalPayments + editedData.previousBalance
        });
    };

    const addDeduction = () => {
        const newDeductions = [...editedData.additionalPayments, { value: 0, remark: '', date: new Date().toISOString().split('T')[0] }];
        const totalDeductions = newDeductions.reduce((sum, ded) => sum + (ded.value || 0), 0);
        setEditedData({
            ...editedData,
            additionalPayments: newDeductions,
            totalAdditionalPayments: totalDeductions,
            netBalance: editedData.grossPayment - editedData.totalAdvances + totalDeductions + editedData.previousBalance
        });
    };

    const removeDeduction = (index) => {
        const newDeductions = editedData.additionalPayments.filter((_, i) => i !== index);
        const totalDeductions = newDeductions.reduce((sum, ded) => sum + (ded.value || 0), 0);
        setEditedData({
            ...editedData,
            additionalPayments: newDeductions,
            totalAdditionalPayments: totalDeductions,
            netBalance: editedData.grossPayment - editedData.totalAdvances + totalDeductions + editedData.previousBalance
        });
    };

    const updateDeduction = (index, field, value) => {
        const newDeductions = [...editedData.additionalPayments];
        newDeductions[index] = { ...newDeductions[index], [field]: field === 'value' ? (parseFloat(value) || 0) : value };
        const totalDeductions = newDeductions.reduce((sum, ded) => sum + (ded.value || 0), 0);
        setEditedData({
            ...editedData,
            additionalPayments: newDeductions,
            totalAdditionalPayments: totalDeductions,
            netBalance: editedData.grossPayment - editedData.totalAdvances + totalDeductions + editedData.previousBalance
        });
    }; const getChangeSummary = () => {
        const original = employeeData.find(emp => emp.id === editMode);
        if (!original) return {};
        const changes = {};
        // Check wage changes
        if (original.dailyRate !== editedData.dailyRate) {
            changes.dailyRate = { from: original.dailyRate, to: editedData.dailyRate };
        }

        // Check advances changes
        if (JSON.stringify(original.advances) !== JSON.stringify(editedData.advances)) {
            changes.advances = {
                from: original.advances.length,
                to: editedData.advances.length,
                totalFrom: original.totalAdvances,
                totalTo: editedData.totalAdvances
            };
        }

        // Check deductions changes
        if (JSON.stringify(original.additionalPayments) !== JSON.stringify(editedData.additionalPayments)) {
            changes.deductions = {
                from: original.additionalPayments.length,
                to: editedData.additionalPayments.length,
                totalFrom: original.totalAdditionalPayments,
                totalTo: editedData.totalAdditionalPayments
            };
        }

        return changes;
    }; const confirmSave = () => {        // Validate the data before showing confirmation
        const validationErrors = validatePaymentData(editedData);

        if (validationErrors.length > 0) {
            showError(`Validation failed: ${validationErrors.join(', ')}`);
            return;
        }

        const changes = getChangeSummary();
        if (Object.keys(changes).length > 0) {
            setPendingChanges(changes);
            setShowConfirmDialog(true);
        } else {
            cancelEdit();
        }
    }; const applySave = async () => {
        try {
            setIsUpdating(true);

            // Call the update function with the formatted data
            const response = await updatePaymentData(editedData);


            const apiData = response.data;
            let successMsg = `${response.message}`;

            if (apiData?.updatedFields?.length > 0) {
                successMsg += ` (Updated: ${apiData.updatedFields.join(', ')})`;
            }

            if (apiData?.futureMonthsMarked > 0) {
                successMsg += ` - ${apiData.futureMonthsMarked} future months marked for recalculation`;
            }

            showSuccess(successMsg);
            // Close edit mode and dialogs
            setEditMode(null);
            setEditedData({});
            setShowConfirmDialog(false);
            setPendingChanges({});
            setRemarkText(''); // Clear remark after successful save

            // console.log('✅ Payment data updated successfully');
            // console.log('📊 Response data:', apiData);

            // Refresh employee data from API to get the freshest data
            await refreshEmployeeData();

        } catch (error) {
            console.error('❌ Failed to update payment data:', error);
            showError(error.message || 'Failed to update payment data. Please try again.');
        } finally {
            setIsUpdating(false);
        }
    };// Function to update payment data via API
    const updatePaymentData = async (editedEmployeeData) => {
        try {
            // Validate the data
            const validationErrors = validatePaymentData(editedEmployeeData);
            if (validationErrors.length > 0) {
                throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
            }

            // Find the original employee data to compare changes
            const originalEmployee = employeeData.find(emp => emp.id === editedEmployeeData.id);
            if (!originalEmployee) {
                throw new Error('Original employee data not found for comparison');
            }

            // Prepare updateData object with only changed fields
            const updateData = {};

            // Check if daily rate changed
            if (parseFloat(editedEmployeeData.dailyRate) !== parseFloat(originalEmployee.dailyRate)) {
                updateData.rate = parseFloat(editedEmployeeData.dailyRate);
            }            // Check if additional payments changed
            const originalAdditionalPayments = originalEmployee.additionalPayments || [];
            const newAdditionalPayments = editedEmployeeData.additionalPayments || [];

            // Only include if there are actual changes and the new data is not empty
            const additionalPaymentsChanged = JSON.stringify(originalAdditionalPayments) !== JSON.stringify(newAdditionalPayments);
            if (additionalPaymentsChanged && newAdditionalPayments.length > 0) {
                updateData.additional_req_pays = newAdditionalPayments.map(payment => ({
                    remark: payment.remark?.trim() || 'Additional Payment',
                    value: parseFloat(payment.value) || 0,
                    date: new Date(payment.date).toISOString()
                }));
            } else if (additionalPaymentsChanged && newAdditionalPayments.length === 0 && originalAdditionalPayments.length > 0) {
                // Explicitly clearing all additional payments
                updateData.additional_req_pays = [];
            }

            // Check if advances/payouts changed
            const originalAdvances = originalEmployee.advances || [];
            const newAdvances = editedEmployeeData.advances || [];

            // Only include if there are actual changes and the new data is not empty
            const advancesChanged = JSON.stringify(originalAdvances) !== JSON.stringify(newAdvances);
            if (advancesChanged && newAdvances.length > 0) {
                updateData.payouts = newAdvances.map(advance => ({
                    remark: advance.remark?.trim() || 'Advance Payment',
                    value: parseFloat(advance.value) || 0,
                    date: new Date(advance.date).toISOString(),
                    createdBy: user.email || "admin"
                }));
            } else if (advancesChanged && newAdvances.length === 0 && originalAdvances.length > 0) {
                // Explicitly clearing all advances
                updateData.payouts = [];
            }// If no fields changed, don't send API request
            if (Object.keys(updateData).length === 0) {
                console.log('🔄 No changes detected for employee:', editedEmployeeData.name, `(${editedEmployeeData.id})`);
                return {
                    success: true,
                    message: 'No changes detected',
                    data: { updatedFields: [] }
                };
            }

            console.log('🔄 Updating payment data for employee:', editedEmployeeData.name, `(${editedEmployeeData.id})`);
            console.log('📝 Changed fields:', Object.keys(updateData));
            console.log('📊 Update Data:', updateData);

            // API payload
            const apiPayload = {
                updateData,
                month: selectedMonth,
                year: selectedYear,
                siteID: siteID,
                correctedBy: user.email || "admin",
                remark: remarkText.trim() || "Employee data update"
            };

            console.log('� API Payload:', apiPayload);

            // Make the actual API call
            const response = await api.put(`/api/change-tracking/employee/${editedEmployeeData.id}/update`, apiPayload);

            if (!response.success) {
                throw new Error(response.message || 'Failed to update payment data');
            }

            // console.log('✅ API Response:', response);
            // console.log('📈 Updated fields:', response.data?.updatedFields);
            // console.log('🔄 Future months marked for recalculation:', response.data?.futureMonthsMarked);
            // console.log('📝 Change tracking ID:', response.data?.changeTrackingId);

            return response;

        } catch (error) {
            console.error('❌ Error updating payment data:', error);

            // Handle different types of API errors
            if (error.response) {
                // API returned an error response
                throw new Error(error.response.data?.message || 'Server error occurred');
            } else if (error.request) {
                // Network error
                throw new Error('Network error: Unable to connect to server');
            } else {
                // Other errors
                throw new Error(error.message || 'Failed to update payment data');
            }
        }
    };    // Helper function to refresh employee data from API
    const refreshEmployeeData = async () => {
        try {
            setLoading(true);

            const response = await api.get(
                `/api/employee/allemployees?month=${selectedMonth}&year=${selectedYear}&siteID=${siteID}`
            );

            if (response.success) {
                // console.log('🔄 Refreshing employee data after update...');

                // Transform API data to match the component's expected format
                const transformedData = response.data.map((emp) => {
                    const paymentDetails = calculatePaymentDetails(
                        emp.rate || 0,
                        emp.attendance,
                        emp.totalPayouts || 0,
                        emp.totalAdditionalReqPays || 0,
                        emp.carryForward || emp.carry_forwarded?.value || 0
                    );

                    return {
                        id: emp.empid,
                        name: emp.name,
                        dailyRate: emp.rate,
                        attendance: paymentDetails.attendance,
                        totalAdvances: emp.totalPayouts || 0,
                        previousBalance: emp.carryForward || emp.carry_forwarded?.value || 0,
                        totalAdditionalPayments: emp.totalAdditionalReqPays || 0,
                        grossPayment: paymentDetails.grossPayment,
                        netBalance: paymentDetails.netBalance,
                        advances: emp.payouts?.map(payout => ({
                            value: payout.value,
                            remark: payout.remark,
                            date: new Date(payout.date).toISOString().split('T')[0]
                        })) || [],
                        additionalPayments: emp.additional_req_pays?.map(payment => ({
                            value: payment.value,
                            remark: payment.remark,
                            date: new Date(payment.date).toISOString().split('T')[0]
                        })) || [],
                        hasPendingPayouts: emp.hasPendingPayouts,
                        needsRecalculation: emp.needsRecalculation,
                        siteID: emp.siteID,
                        month: emp.month,
                        year: emp.year,
                        rawAttendance: emp.attendance
                    };
                }); setEmployeeData(transformedData);
                // console.log('✅ Employee data refreshed successfully');
            } else {
                throw new Error('Failed to refresh employee data');
            }
        } catch (err) {
            console.error('❌ Error refreshing employee data:', err);
            showError('Failed to refresh data after update');
        } finally {
            setLoading(false);
        }
    };    // Utility function to validate payment data before submission
    const validatePaymentData = (employeeData) => {
        const errors = [];

        // Validate daily rate
        if (!employeeData.dailyRate || employeeData.dailyRate <= 0) {
            errors.push('Daily rate must be greater than 0');
        }

        // Validate advances
        if (employeeData.advances) {
            employeeData.advances.forEach((advance, index) => {
                if (advance.value < 0) {
                    errors.push(`Advance ${index + 1}: Amount must be positive`);
                }
                if (!advance.date) {
                    errors.push(`Advance ${index + 1}: Date is required`);
                }
            });
        }

        // Validate additional payments
        if (employeeData.additionalPayments) {
            employeeData.additionalPayments.forEach((payment, index) => {
                if (payment.value < 0) {
                    errors.push(`Additional payment ${index + 1}: Amount must be positive`);
                }
                if (!payment.date) {
                    errors.push(`Additional payment ${index + 1}: Date is required`);
                }
            });
        }

        return errors;
    };    // Update calendar year when selected year changes
    useEffect(() => {
        setCalendarYear(selectedYear);
    }, [selectedYear]);

    // PDF download handler
    const handleDownloadPDF = useCallback(() => {
        try {
            if (!employeeData || employeeData.length === 0) {
                showError('No employee data available to generate PDF');
                return;
            }

            // Use the existing transformed employee data
            generateEmployeeReportPDF(employeeData);
            showSuccess('PDF report generated successfully!');
        } catch (error) {
            console.error('Error generating PDF:', error);
            showError('Failed to generate PDF report. Please try again.');
        }
    }, [employeeData, showError, showSuccess]);

    if (loading) {
        return (
            <div className={styles.PaymentsContainer}>
                <Sidebar />
                <div className={styles.container}>
                    <div className={styles.headerUltraCompact}>
                        <div className={styles.titleSection}>
                            <h1 className={styles.titleCompact}>
                                💰 Employee Payments - {formatSelectedMonthDisplay()}
                            </h1>
                        </div>
                        <div className={styles.statsRowCompact}>
                            <div className={styles.statItemCompact}>
                                <span className={styles.statValueCompact}>0</span>
                                <span className={styles.statLabelCompact}>Employees</span>
                            </div>
                            <div className={styles.statItemCompact}>
                                <span className={styles.statValueCompact}>₹0</span>
                                <span className={styles.statLabelCompact}>Gross</span>
                            </div>
                            <div className={styles.statItemCompact}>
                                <span className={styles.statValueCompact}>₹0</span>
                                <span className={styles.statLabelCompact}>Net</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className={styles.loadingSpinner}>
                        <CustomSpinner size={70} color="#3b82f6" />
                        <p>Loading payment data...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.PaymentsContainer}>
            <Sidebar />
            <div className={styles.container}>            <div className={styles.headerUltraCompact}>
                <div className={styles.titleSection}>
                    <h1 className={styles.titleCompact}>
                        💰 Employee Payments - {formatSelectedMonthDisplay()}
                    </h1>
                </div>
                <div className={styles.statsRowCompact}>
                    <div className={styles.statItemCompact}>
                        <span className={styles.statValueCompact}>{employeeData.length}</span>
                        <span className={styles.statLabelCompact}>Employees</span>
                    </div>
                    <div className={styles.statItemCompact}>
                        <span className={styles.statValueCompact}>
                            {formatCurrency(employeeData.reduce((sum, emp) => sum + emp.grossPayment, 0))}
                        </span>
                        <span className={styles.statLabelCompact}>Gross</span>
                    </div>
                    <div className={styles.statItemCompact}>
                        <span className={styles.statValueCompact}>
                            {formatCurrency(employeeData.reduce((sum, emp) => sum + emp.netBalance, 0))}
                        </span>
                        <span className={styles.statLabelCompact}>Net</span>
                    </div>
                </div>
            </div>            <div className={styles.controlsMini}>
                    <div className={styles.monthSelectorMini} ref={calendarRef}>
                        <button
                            type="button"
                            className={styles.monthButtonMini}
                            onClick={() => setShowCalendar(!showCalendar)}
                            disabled={loading}
                        >
                            <FaCalendarAlt className={styles.calendarIconMini} />
                            <span>{formatSelectedMonthDisplay()}</span>
                            <svg
                                className={`${styles.chevronMini} ${showCalendar ? styles.chevronUp : ''}`}
                                width="12"
                                height="12"
                                viewBox="0 0 16 16"
                                fill="none"
                            >
                                <path
                                    d="M4 6L8 10L12 6"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>
                        {showCalendar && (
                            <>
                                <div className={styles.calendarBackdrop} onClick={() => setShowCalendar(false)}></div>
                                <div className={styles.calendarDropdown}>
                                    <div className={styles.calendarHeader}>
                                        <button
                                            type="button"
                                            className={styles.yearNavButton}
                                            onClick={handlePreviousYear}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                                <path
                                                    d="M10 12L6 8L10 4"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        </button>
                                        <span className={styles.yearDisplay}>{calendarYear}</span>
                                        <button
                                            type="button"
                                            className={styles.yearNavButton}
                                            onClick={handleNextYear}
                                            disabled={calendarYear >= new Date().getFullYear()}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                                <path
                                                    d="M6 4L10 8L6 12"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className={styles.monthGrid}>
                                        {monthNames.map((monthName, index) => {
                                            const disabled = isMonthDisabled(calendarYear, index);
                                            const isSelected = selectedMonth === (index + 1) && selectedYear === calendarYear;
                                            const isCurrent = calendarYear === new Date().getFullYear() && index === new Date().getMonth();

                                            return (
                                                <button
                                                    key={index}
                                                    type="button"
                                                    className={`${styles.monthCell} ${disabled ? styles.monthDisabled : ''
                                                        } ${isSelected ? styles.monthSelected : ''
                                                        } ${isCurrent ? styles.monthCurrent : ''
                                                        }`}
                                                    onClick={() => {
                                                        setSelectedMonth(index + 1);
                                                        setSelectedYear(calendarYear);
                                                        setShowCalendar(false);
                                                    }}
                                                    disabled={disabled}
                                                >
                                                    {monthName.slice(0, 3)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                        {loading && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px' }}>
                                <CustomSpinner size={40} color="#3b82f6" />
                            </div>
                        )}
                    </div>
                    <div className={styles.searchBoxMini}>
                        <input
                            type="text"
                            placeholder="Search employees..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={styles.searchInputMini}
                        />
                        <span className={styles.searchIconMini}>🔍</span>
                    </div>                    <div className={styles.resultCountMini}>
                        {sortedEmployees.length}/{employeeData.length}
                    </div>
                    <button
                        type="button"
                        onClick={handleDownloadPDF}
                        disabled={loading || employeeData.length === 0}
                        className={styles.pdfDownloadButton}
                        title="Download PDF Report"
                    >
                        📄 PDF
                    </button>
                </div>

                <div className={styles.tableContainer}>
                    <table className={styles.paymentsTable}>
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('id')} className={styles.sortable}>Employee ID {getSortIcon('id')}</th>
                                <th onClick={() => handleSort('name')} className={styles.sortable}>Name {getSortIcon('name')}</th>
                                <th onClick={() => handleSort('dailyRate')} className={styles.sortable}>Daily Rate {getSortIcon('dailyRate')}</th>
                                <th onClick={() => handleSort('attendance')} className={styles.sortable}>Attendance {getSortIcon('attendance')}</th>
                                <th onClick={() => handleSort('grossPayment')} className={styles.sortable}>Gross Payment {getSortIcon('grossPayment')}</th>
                                <th onClick={() => handleSort('totalAdvances')} className={styles.sortable}>Advances {getSortIcon('totalAdvances')}</th>
                                <th onClick={() => handleSort('totalAdditionalPayments')} className={styles.sortable}>Bonus {getSortIcon('totalAdditionalPayments')}</th>
                                <th onClick={() => handleSort('previousBalance')} className={styles.sortable}>Previous Balance {getSortIcon('previousBalance')}</th>
                                <th onClick={() => handleSort('netBalance')} className={styles.sortable}>Net Balance {getSortIcon('netBalance')}</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedEmployees.map((employee) => (
                                <React.Fragment key={employee.id}>
                                    <tr className={styles.employeeRow}>
                                        <td className={styles.employeeId}>{employee.id}</td>
                                        <td className={styles.employeeName}>{employee.name}</td>
                                        <td>
                                            {editMode === employee.id ? (
                                                <input
                                                    type="number"
                                                    value={editedData.dailyRate}
                                                    onChange={(e) => handleFieldChange('dailyRate', e.target.value)}
                                                    className={styles.editInput}
                                                    min="0"
                                                    step="10"
                                                />
                                            ) : (
                                                formatCurrency(employee.dailyRate)
                                            )}
                                        </td>
                                        <td>
                                            <span className={styles.attendanceBadge}>
                                                {employee.attendance.toFixed(1)} days
                                            </span>
                                        </td>
                                        <td className={styles.positiveAmount}>
                                            {formatCurrency(editMode === employee.id ? editedData.grossPayment : employee.grossPayment)}
                                        </td>
                                        <td className={styles.advanceCell}>
                                            <div className={styles.cellWithDetails}>
                                                <span className={styles.negativeAmount}>
                                                    {formatCurrency(editMode === employee.id ? editedData.totalAdvances : employee.totalAdvances)}
                                                </span>
                                                <button
                                                    className={`${styles.detailBtn} ${expandedRows[`${employee.id}_advances`] ? styles.active : ''
                                                        }`}
                                                    onClick={() => toggleRowExpansion(employee.id, 'advances')}
                                                    title="View Advances Details"
                                                >
                                                    📋 {editMode === employee.id ? editedData.advances.length : employee.advances.length}
                                                </button>
                                            </div>
                                        </td>
                                        <td className={styles.deductionCell}>
                                            <div className={styles.cellWithDetails}>
                                                <span className={styles.positiveAmount}>
                                                    {formatCurrency(editMode === employee.id ? editedData.totalAdditionalPayments : employee.totalAdditionalPayments)}
                                                </span>
                                                <button
                                                    className={`${styles.detailBtn} ${expandedRows[`${employee.id}_deductions`] ? styles.active : ''
                                                        }`}
                                                    onClick={() => toggleRowExpansion(employee.id, 'deductions')}
                                                    title="View Bonus Details"
                                                >
                                                    📋 {editMode === employee.id ? editedData.additionalPayments.length : employee.additionalPayments.length}
                                                </button>
                                            </div>
                                        </td>
                                        <td className={styles.neutralAmount}>{formatCurrency(employee.previousBalance)}</td>
                                        <td className={`${styles.netBalance} ${employee.netBalance > 0 ? styles.positiveAmount : employee.netBalance < 0 ? styles.negativeAmount : styles.neutralAmount}`}>
                                            {formatCurrency(editMode === employee.id ? editedData.netBalance : employee.netBalance)}
                                        </td>
                                        <td className={styles.actions}>
                                            {editMode === employee.id ? (
                                                <div className={styles.editActions}>
                                                    <button onClick={confirmSave} className={styles.saveBtn} title="Save Changes">
                                                        💾
                                                    </button>
                                                    <button onClick={cancelEdit} className={styles.cancelBtn} title="Cancel Edit">
                                                        ❌
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => startEdit(employee)}
                                                    className={styles.editBtn}
                                                    disabled={editMode !== null}
                                                    title="Edit Employee"
                                                >
                                                    ✏️
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                    {expandedRows[`${employee.id}_advances`] && (
                                        <tr className={styles.expandedRow}><td colSpan="10">
                                            <div className={styles.expandedContent}>
                                                <div className={styles.expandedHeader}>
                                                    <h4 className={styles.expandedTitle}>💰 Advances Details for {employee.name}</h4>
                                                    {editMode === employee.id && (
                                                        <button onClick={addAdvance} className={styles.addBtn} title="Add Advance">
                                                            ➕ Add Advance
                                                        </button>
                                                    )}
                                                </div>
                                                <div className={styles.detailsGrid}>
                                                    {(editMode === employee.id ? editedData.advances : employee.advances).map((advance, index) => (
                                                        <div key={index} className={styles.detailItem}>
                                                            {editMode === employee.id ? (
                                                                <div className={styles.editDetailItem}>
                                                                    <div className={styles.editDetailHeader}>
                                                                        <input
                                                                            type="number"
                                                                            value={advance.value}
                                                                            onChange={(e) => updateAdvance(index, 'value', e.target.value)}
                                                                            className={styles.editDetailInput}
                                                                            placeholder="Amount"
                                                                            min="0"
                                                                        />
                                                                        <input
                                                                            type="date"
                                                                            value={advance.date}
                                                                            onChange={(e) => updateAdvance(index, 'date', e.target.value)}
                                                                            className={styles.editDetailDate}
                                                                        />
                                                                        <button
                                                                            onClick={() => removeAdvance(index)}
                                                                            className={styles.removeBtn}
                                                                            title="Remove Advance"
                                                                        >
                                                                            🗑️
                                                                        </button>
                                                                    </div>
                                                                    <input
                                                                        type="text"
                                                                        value={advance.remark}
                                                                        onChange={(e) => updateAdvance(index, 'remark', e.target.value)}
                                                                        className={styles.editDetailRemark}
                                                                        placeholder="Remark"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className={styles.detailHeader}>
                                                                        <span className={styles.detailAmountNegative}>-{formatCurrency(advance.value)}</span>
                                                                        <span className={styles.detailDate}>{advance.date}</span>
                                                                    </div>
                                                                    <div className={styles.detailRemark}>{advance.remark}</div>
                                                                </>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className={styles.detailSummary}>
                                                    <strong>Total Advances: {formatCurrency(editMode === employee.id ? editedData.totalAdvances : employee.totalAdvances)}</strong>                        </div>
                                            </div>
                                        </td>
                                        </tr>
                                    )}
                                    {expandedRows[`${employee.id}_deductions`] && (
                                        <tr className={styles.expandedRow}><td colSpan="10">
                                            <div className={styles.expandedContent}>                                        
                                            <div className={styles.expandedHeader}>
                                                <h4 className={styles.expandedTitle}>📋 Additional Wages Details for {employee.name}</h4>
                                                {editMode === employee.id && (
                                                    <button onClick={addDeduction} className={styles.addBtn} title="Add Additional Wage">
                                                        ➕ Add Additional Wage
                                                    </button>
                                                )}
                                            </div>
                                                <div className={styles.detailsGrid}>
                                                    {(editMode === employee.id ? editedData.additionalPayments : employee.additionalPayments).map((payment, index) => (
                                                        <div key={index} className={styles.detailItem}>
                                                            {editMode === employee.id ? (
                                                                <div className={styles.editDetailItem}>
                                                                    <div className={styles.editDetailHeader}>
                                                                        <input
                                                                            type="number"
                                                                            value={payment.value}
                                                                            onChange={(e) => updateDeduction(index, 'value', e.target.value)}
                                                                            className={styles.editDetailInput}
                                                                            placeholder="Amount"
                                                                            min="0"
                                                                        />
                                                                        <input
                                                                            type="date"
                                                                            value={payment.date}
                                                                            onChange={(e) => updateDeduction(index, 'date', e.target.value)}
                                                                            className={styles.editDetailDate}
                                                                        />                                                                <button
                                                                            onClick={() => removeDeduction(index)}
                                                                            className={styles.removeBtn}
                                                                            title="Remove Additional Wage"
                                                                        >
                                                                            🗑️
                                                                        </button>
                                                                    </div>
                                                                    <input
                                                                        type="text"
                                                                        value={payment.remark}
                                                                        onChange={(e) => updateDeduction(index, 'remark', e.target.value)}
                                                                        className={styles.editDetailRemark}
                                                                        placeholder="Remark"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <>                                                            
                                                                <div className={styles.detailHeader}>
                                                                    <span className={styles.detailAmountPositive}>+{formatCurrency(payment.value)}</span>
                                                                    <span className={styles.detailDate}>{payment.date}</span>
                                                                </div>
                                                                    <div className={styles.detailRemark}>{payment.remark}</div>
                                                                </>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>                                        
                                                <div className={styles.detailSummary}>
                                                    <strong>Total Additional Wages: {formatCurrency(editMode === employee.id ? editedData.totalAdditionalPayments : employee.totalAdditionalPayments)}</strong>
                                                </div>
                                            </div>
                                        </td>
                                        </tr>
                                    )}
                                </React.Fragment>))}
                        </tbody>
                    </table>
                </div>            {/* Confirmation Dialog */}
                {showConfirmDialog && (
                    <div className={styles.dialogOverlay}>
                        <div className={styles.confirmDialog}>
                            <div className={styles.dialogHeader}>
                                <h3>🔍 Confirm Changes</h3>
                                <p>Review changes for <strong>{editedData.name}</strong>:</p>
                            </div>

                            <div className={styles.dialogContent}>
                                {Object.entries(pendingChanges).map(([field, change]) => (
                                    <div key={field} className={styles.changeItem}>
                                        {field === 'dailyRate' && (
                                            <span>💰 Daily Rate: ₹{change.from} → ₹{change.to}</span>
                                        )}
                                        {field === 'advances' && (
                                            <span>💳 Advances: {change.from} items (₹{change.totalFrom}) → {change.to} items (₹{change.totalTo})</span>
                                        )}
                                        {field === 'deductions' && (
                                            <span>📋 Additional Wages: {change.from} items (₹{change.totalFrom}) → {change.to} items (₹{change.totalTo})</span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Remark Section */}
                            <div className={styles.remarkSection}>
                                <label htmlFor="remarkInput" className={styles.remarkLabel}>
                                    💬 Reason for Changes (Required):
                                </label>
                                <textarea
                                    id="remarkInput"
                                    value={remarkText}
                                    onChange={(e) => setRemarkText(e.target.value)}
                                    placeholder="Please provide a reason for these changes..."
                                    className={styles.remarkTextarea}
                                    rows={3}
                                    maxLength={500}
                                    required
                                />
                                <div className={styles.remarkCounter}>
                                    {remarkText.length}/500 characters
                                </div>
                            </div>

                            <div className={styles.dialogActions}>
                                <button
                                    onClick={applySave}
                                    className={styles.confirmBtn}
                                    disabled={isUpdating || !remarkText.trim()}
                                >
                                    {isUpdating ? '⏳ Updating...' : '✅ Save Changes'}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowConfirmDialog(false);
                                        setRemarkText(''); // Clear remark when canceling
                                    }}
                                    className={styles.cancelDialogBtn}
                                    disabled={isUpdating}
                                >
                                    ❌ Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {sortedEmployees.length === 0 && (
                    <div className={styles.noResults}>
                        <div className={styles.noResultsContent}>
                            <span className={styles.noResultsIcon}>🔍</span>
                            <h3>No employees found</h3>
                            <p>Try adjusting your search criteria</p>
                        </div>
                    </div>
                )}
            </div>
        </div>

    );
};

export default Payments;