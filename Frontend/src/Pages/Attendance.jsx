import Sidebar from '../components/Sidebar';
import styles from './Attendance.module.css';
import { useState, useEffect, useRef, useCallback } from 'react';
import { FaCalendarAlt } from 'react-icons/fa';
import { api } from '../utils/api';
import { useParams } from 'react-router';
import { useToast } from '../components/ToastProvider';
import { useAuth } from '../context/AuthContext';
import CustomSpinner from '../components/CustomSpinner';
import VirtualizedAttendanceTable from '../components/VirtualizedAttendanceTable';
import SubscriptionModal from '../components/SubscriptionModal';
import { useOptimizedAttendance } from '../hooks/useOptimizedAttendance';
import { useProgressiveEditMode } from '../hooks/useProgressiveEditMode';
import { shouldShowSubscriptionModal, checkEmployeeLimit, getSubscriptionWarning } from '../utils/subscriptionUtils';

const Attendance = () => {
    // Initialize toast notifications
    const { showSuccess, showError, showWarning } = useToast();
    
    // Get user context for plan information
    const { user } = useAuth();

    // --- UTILITY FUNCTIONS ---

    // Returns the current month in YYYY-MM format.
    // Example: If today is May 30, 2024, returns "2024-05".
    const getCurrentMonth = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0'); // getMonth() is 0-indexed, so add 1.
        return `${year}-${month}`;
    };

    // Formats a YYYY-MM month string into a human-readable format.
    // Example: "2024-05" becomes "May 2024".
    const formatMonthLabel = (monthValue) => {
        if (!monthValue || !monthValue.includes('-')) return 'Invalid Date';
        const [year, month] = monthValue.split('-');
        const date = new Date(Number(year), Number(month) - 1); // Month is 0-indexed for Date constructor.
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };



    // --- STATE VARIABLES ---

    // `attendanceData`: Array holding the attendance records for the selected month.
    // Each item represents an employee and their daily attendance.
    const [attendanceData, setAttendanceData] = useState([]);

    // `originalAttendanceData`: A backup copy of `attendanceData`.
    // Used to revert changes if the user cancels an edit.
    const [originalAttendanceData, setOriginalAttendanceData] = useState([]);

    // `error`: Stores error messages, typically from API calls.
    const [error, setError] = useState(null);

    // `siteID`: The ID of the site for which attendance is being managed.
    // Obtained from the URL parameters.
    const { siteID } = useParams();

    // `selectedMonth`: The month currently selected by the user (YYYY-MM format).
    // Defaults to the current month.
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

    // `isLoading`: Boolean indicating if data is currently being fetched from the API.
    const [isLoading, setIsLoading] = useState(true);

    // `isSaving`: Boolean indicating if attendance changes are currently being saved to the API.
    const [isSaving, setIsSaving] = useState(false);

    // `showConfirmDialog`: Boolean controlling the visibility of the save confirmation dialog.
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    // `changes`: Array storing a list of modifications made during edit mode.
    // Used to display a summary in the confirmation dialog.
    const [changes, setChanges] = useState([]);

    // `showAddEmployeeModal`: Boolean controlling the visibility of the "Add Employee" modal.
    const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);

    // `newEmployee`: Object storing the name and rate for a new employee being added.
    const [newEmployee, setNewEmployee] = useState({ name: '', rate: '' });

    // `isAddingEmployee`: Boolean indicating if a new employee is currently being added via API.
    const [isAddingEmployee, setIsAddingEmployee] = useState(false);

    // `showCalendar`: Boolean controlling the visibility of the custom month picker.
    const [showCalendar, setShowCalendar] = useState(false);

    // `calendarYear`: The year currently displayed in the month picker.
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());    // `calendarRef`: A React ref attached to the calendar dropdown element.
    // Used to detect clicks outside the calendar to close it.
    const calendarRef = useRef(null);

    // `refreshTrigger`: A counter used to trigger data refresh.
    // Incrementing this value will cause the useEffect to re-run and fetch fresh data.
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // `isImportMode`: Boolean indicating if the Add Employee modal is in import mode vs manual mode.
    const [isImportMode, setIsImportMode] = useState(false);

    // `sourceMonth`: The month selected as source for importing employees (YYYY-MM format).
    const [sourceMonth, setSourceMonth] = useState(getCurrentMonth());

    // `showSourceCalendar`: Boolean controlling the visibility of the source month picker.
    const [showSourceCalendar, setShowSourceCalendar] = useState(false);

    // `sourceCalendarYear`: The year currently displayed in the source month picker.
    const [sourceCalendarYear, setSourceCalendarYear] = useState(new Date().getFullYear());

    // `sourceCalendarRef`: A React ref attached to the source calendar dropdown element.
    const sourceCalendarRef = useRef(null);

    // `availableEmployees`: Array holding employees available for import from source month.
    const [availableEmployees, setAvailableEmployees] = useState([]);

    // `isLoadingEmployees`: Boolean indicating if available employees are being fetched.
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);    // `selectedEmployees`: Set holding the IDs of employees selected for import.
    const [selectedEmployees, setSelectedEmployees] = useState(new Set());

    // `preserveCarryForward`: Boolean for preserving carry forward balances during import.
    const [preserveCarryForward, setPreserveCarryForward] = useState(true);    // `preserveAdditionalPays`: Boolean for preserving additional pays during import.
    const [preserveAdditionalPays, setPreserveAdditionalPays] = useState(false);

    // `importResults`: Object holding import summary and results data.
    const [importResults, setImportResults] = useState(null);

    // `showImportSummary`: Boolean controlling the visibility of the import summary modal.
    const [showImportSummary, setShowImportSummary] = useState(false);

    // `showEmployeeList`: Boolean controlling the visibility of the employee selection list.
    const [showEmployeeList, setShowEmployeeList] = useState(false);

    // `searchTerm`: String for filtering employees by name in the attendance table.
    const [searchTerm, setSearchTerm] = useState('');

    // `showSubscriptionModal`: Boolean controlling the visibility of the subscription modal.
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

    // --- SEARCH FUNCTIONALITY ---
    
    // Handler for search input changes
    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    // Filter attendance data based on search term
    const filteredAttendanceData = attendanceData.filter(employee => 
        employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.id.toString().includes(searchTerm)
    );

    // --- DELETE EMPLOYEE FUNCTIONALITY ---

    // `showDeleteConfirmDialog`: Boolean controlling the visibility of the delete confirmation dialog.
    const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);

    // `employeeToDelete`: Object storing the employee data for deletion.
    const [employeeToDelete, setEmployeeToDelete] = useState(null);

    // `deletePreviousMonth`: Boolean for checkbox option to delete previous month data also.
    const [deletePreviousMonth, setDeletePreviousMonth] = useState(false);

    // `isDeletingEmployee`: Boolean indicating if an employee is currently being deleted via API.
    const [isDeletingEmployee, setIsDeletingEmployee] = useState(false);


        // Initialize progressive edit mode with advanced optimizations
    const {
        isEditMode,
        isTransitioning,
        enableEditMode,
        disableEditMode,
        shouldShowInputs,
        setVisibleRows,
        enabledRowsCount
    } = useProgressiveEditMode(attendanceData.length);

    // Initialize optimized attendance management
    const { 
        handleAttendanceChange, 
        validAttendanceOptions,
        cleanup 
    } = useOptimizedAttendance(
        attendanceData, 
        setAttendanceData, 
        originalAttendanceData, 
        setChanges, 
        isEditMode
    );

    // Cleanup on unmount
    useEffect(() => {
        return cleanup;
    }, [cleanup]);

    // --- DATA FETCHING (useEffect) ---

    // This effect runs when `selectedMonth` or `siteID` changes.
    // It fetches attendance data for the specified month and site.
    useEffect(() => {
        const fetchAttendanceData = async () => {
            setIsLoading(true); // Indicate that data loading has started.
            setError(null);     // Clear any previous errors.

            try {
                // Extract year and month from the `selectedMonth` string.
                const [year, month] = selectedMonth.split('-').map(Number);
                console.log(`Fetching attendance for: month=${month}, year=${year}, siteID=${siteID}`);

                // Make an API GET request to fetch employee attendance.
                const response = await api.get(`/api/employee/allemployees?month=${month}&year=${year}&siteID=${siteID}`);

                if (response && response.success) {
                    // Transform the raw API data into the format expected by the frontend.
                    const transformedData = response.data.map(employee => ({
                        id: employee.empid,
                        name: employee.name,
                        attendance: employee.attendance || [], // Default to empty array if no attendance.
                        rate: employee.rate || 550,          // Default rate if not provided.
                        // Store additional employee details from the API.
                        _id: employee._id,
                        wage: employee.wage,
                        closing_balance: employee.closing_balance,
                        payouts: employee.payouts,
                        additional_req_pays: employee.additional_req_pays,
                        carry_forwarded: employee.carry_forwarded
                    }));

                    setAttendanceData(transformedData); // Update the main attendance data.
                    // Create a deep copy for `originalAttendanceData` to allow resetting edits.
                    setOriginalAttendanceData(JSON.parse(JSON.stringify(transformedData)));
                    console.log(`Loaded ${transformedData.length} employees.`);
                } else {
                    // If API response indicates failure or is malformed.
                    throw new Error(response?.message || 'Failed to fetch employee data from API.');
                }
            } catch (err) {
                // Handle any errors during the API call or data processing.
                console.error('Error fetching attendance data:', err);
                setError(err.message || 'An unexpected error occurred while loading attendance.');
                setAttendanceData([]); // Clear data on error.
                setOriginalAttendanceData([]);
            } finally {
                setIsLoading(false); // Indicate that data loading has finished.
                disableEditMode(); // Exit edit mode when new data is loaded.
            }
        };

        // Only fetch data if a site ID is present.
        if (siteID) {
            fetchAttendanceData();
        } else {
            setError("Site ID is missing. Cannot fetch attendance data.");
            setAttendanceData([]);
            setOriginalAttendanceData([]);
            setIsLoading(false);
        }
    }, [selectedMonth, siteID, refreshTrigger, disableEditMode]); // Dependencies: re-run if `selectedMonth`, `siteID`, or `refreshTrigger` changes.


    // --- MONTH SELECTION AND CALENDAR LOGIC ---

    // Called when the user selects a new month from the calendar or input.
    const handleMonthChange = (newMonth) => {
        setSelectedMonth(newMonth); // Update the selected month state.
        setShowCalendar(false);     // Hide the calendar dropdown.
        // The `useEffect` for data fetching will automatically trigger.
        console.log(`Month selection changed to: ${newMonth}`);
    };

    // Array of month names for the calendar display.
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Checks if a specific month in the calendar should be disabled (e.g., future months).
    const isMonthDisabled = (year, monthIndex) => {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth(); // 0-indexed.

        // Disable if the year is in the future.
        if (year > currentYear) return true;
        // Disable if the year is current, but the month is in the future.
        if (year === currentYear && monthIndex > currentMonth) return true;
        return false;
    };

    // Formats the `selectedMonth` (YYYY-MM) for display in the month selector button.
    // Uses the `formatMonthLabel` utility function.
    const formatSelectedMonthDisplay = () => {
        return formatMonthLabel(selectedMonth);
    };

    // Navigates to the previous year in the calendar picker.
    const handlePreviousYear = () => {
        setCalendarYear(prev => prev - 1);
    };

    // Navigates to the next year in the calendar picker, but not beyond the current year.
    const handleNextYear = () => {
        const currentSystemYear = new Date().getFullYear();
        if (calendarYear < currentSystemYear) {
            setCalendarYear(prev => prev + 1);
        }
    };

    // Called when a user clicks a month in the calendar grid.
    const handleMonthSelect = (monthIndex) => {
        // Do nothing if the month is disabled.
        if (isMonthDisabled(calendarYear, monthIndex)) return;

        const monthString = String(monthIndex + 1).padStart(2, '0'); // Format to MM (e.g., "05" for May).
        const newSelectedMonth = `${calendarYear}-${monthString}`;
        handleMonthChange(newSelectedMonth); // Trigger month change.
    };    // This effect handles clicks outside the calendar dropdown to close it.
    useEffect(() => {
        const handleClickOutside = (event) => {
            // If the click is outside the `calendarRef` element.
            if (calendarRef.current && !calendarRef.current.contains(event.target)) {
                // Don't close if clicking on dialog content scrollbar
                const dialogContent = event.target.closest(`.${styles.dialogContent}`);
                if (dialogContent && event.target === dialogContent) {
                    return;
                }
                setShowCalendar(false); // Hide the calendar.
            }
        };

        // Add event listener when the calendar is visible.
        if (showCalendar) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        // Cleanup: remove event listener when the component unmounts or `showCalendar` changes.
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showCalendar]); // Dependency: re-run if `showCalendar` changes.// useEffect: Handle clicks outside the source calendar to close it.
    useEffect(() => {
        const handleClickOutsideSource = (event) => {
            if (sourceCalendarRef.current && !sourceCalendarRef.current.contains(event.target)) {
                // Don't close if clicking on dialog content scrollbar
                const dialogContent = event.target.closest(`.${styles.dialogContent}`);
                if (dialogContent && event.target === dialogContent) {
                    return;
                }
                setShowSourceCalendar(false); // Hide the source calendar.
            }
        };

        // Add event listener when the source calendar is visible.
        if (showSourceCalendar) {
            document.addEventListener('mousedown', handleClickOutsideSource);
        }

        // Cleanup: remove event listener when the component unmounts or `showSourceCalendar` changes.
        return () => {
            document.removeEventListener('mousedown', handleClickOutsideSource);
        };
    }, [showSourceCalendar]); // Dependency: re-run if `showSourceCalendar` changes.


    // --- EDIT MODE ACTIONS ---

    // Activates edit mode, allowing users to modify attendance.
    const handleEditMode = async () => {
        // `originalAttendanceData` should already be set from `fetchAttendanceData`.
        // If not, ensure it's a copy of the current `attendanceData`.
        if (originalAttendanceData.length === 0 && attendanceData.length > 0) {
            setOriginalAttendanceData(JSON.parse(JSON.stringify(attendanceData)));
        }
        
        // Enable progressive edit mode
        await enableEditMode();
    };

    // Deactivates edit mode and reverts any unsaved changes.
    const handleCancelEdit = () => {
        disableEditMode();
        setShowConfirmDialog(false); // Hide confirmation dialog if open.
        setChanges([]);              // Clear any tracked changes.
        // Restore attendance data from the backup.
        setAttendanceData(JSON.parse(JSON.stringify(originalAttendanceData)));
        console.log('Edit cancelled, data restored to original state.');
    };

    // --- SAVE CHANGES ACTION ---
    // Shows confirmation dialog with summary of changes before saving
    const handleSaveChanges = async () => {
        // If no changes were made, just exit edit mode
        if (changes.length === 0) {
            disableEditMode();
            showWarning('No changes were made.');
            return;
        }
        
        // Show confirmation dialog with summary of changes
        setShowConfirmDialog(true);
    };

    // --- CONFIRM SAVE CHANGES ---
    // Actually saves the edited attendance data to the backend API after confirmation
    const confirmSaveChanges = async () => {
        setShowConfirmDialog(false);
        setIsSaving(true);
        try {
            // Prepare the request body according to API specification
            const requestBody = {
                month: selectedMonth,
                siteID: siteID,
                attendanceData: attendanceData.map(employee => ({
                    id: employee.id,
                    name: employee.name,
                    attendance: employee.attendance
                }))
            };

            console.log('Saving attendance data:', requestBody);

            // Make API call to update attendance
            const response = await api.put('/api/change-tracking/attendance/updateattendance', requestBody);

            if (response.success) {
                // Update original data to reflect saved changes
                setOriginalAttendanceData(JSON.parse(JSON.stringify(attendanceData)));
                disableEditMode();
                setChanges([]); // Clear changes after successful save
                
                const summary = response.summary;
                showSuccess(
                    `Attendance saved successfully! ${summary.successful}/${summary.totalEmployees} employees updated.`
                );
                
                // Optionally refresh data to get latest calculations
                setRefreshTrigger(prev => prev + 1);
            } else {
                throw new Error(response.message || 'Failed to save attendance data');
            }
        } catch (error) {
            console.error('Error saving attendance:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Failed to save attendance changes';
            showError(errorMessage);
            
            // If there were validation errors, show them
            if (error.response?.data?.validationErrors) {
                const validationErrors = error.response.data.validationErrors;
                validationErrors.forEach(err => {
                    showError(`${err.employeeID}: ${err.error}`);
                });
            }
        } finally {
            setIsSaving(false);
        }
    };

    // --- ADD EMPLOYEE ACTIONS ---    // Opens the modal for adding a new employee.
    const handleOpenAddEmployeeModal = () => {
        // Check subscription limits for free plan users
        const userPlan = user?.plan || 'free';
        const currentEmployeeCount = attendanceData.length;
        
        if (shouldShowSubscriptionModal(userPlan, currentEmployeeCount, 1)) {
            // Show subscription modal instead of add employee modal
            setShowSubscriptionModal(true);
            return;
        }
        
        setNewEmployee({ name: '', rate: '' }); // Reset form fields.
        setIsImportMode(false); // Default to manual mode.
        setSourceMonth(getCurrentMonth()); // Reset source month to current month.
        resetImportState(); // Reset import state.
        setShowAddEmployeeModal(true);
    };    // Closes the "Add Employee" modal.
    const handleCloseAddEmployeeModal = () => {
        setShowAddEmployeeModal(false);
        setIsAddingEmployee(false); // Reset the adding state.
        resetImportState(); // Reset import state.
    };// Updates the `newEmployee` state as the user types in the modal form.
    const handleNewEmployeeChange = (e) => {
        const { name, value } = e.target;
        setNewEmployee(prev => ({ ...prev, [name]: value }));
    };

    // Saves a new employee manually (non-import mode).
    const handleSaveNewEmployee = async () => {
        if (!newEmployee.name.trim() || !newEmployee.rate.trim()) {
            showError('Please fill in both name and rate fields.');
            return;
        }

        setIsAddingEmployee(true);

        try {
            const [year, month] = selectedMonth.split('-').map(Number);
              const employeeData = {
                name: newEmployee.name.trim(),
                wage: parseFloat(newEmployee.rate),
                month: month,
                year: year,
                siteID: siteID
            };

            console.log('Creating new employee:', employeeData);

            const response = await api.post('/api/employee/addemployee', employeeData);

            if (response.success) {
                showSuccess(`Employee "${newEmployee.name}" has been added successfully.`);
                
                // Reset form and close modal
                setNewEmployee({ name: '', rate: '' });
                setShowAddEmployeeModal(false);
                
                // Refresh the attendance data to show the new employee
                setRefreshTrigger(prev => prev + 1);
            } else {
                throw new Error(response.message || 'Failed to create employee');
            }
        } catch (error) {
            console.error('Error creating employee:', error);
            showError(error.response?.data?.message || error.message || 'Failed to create employee');
        } finally {
            setIsAddingEmployee(false);
        }
    };

    // Handles toggling between manual and import modes in the Add Employee modal.
    const handleToggleImportMode = (importMode) => {
        setIsImportMode(importMode);
        if (importMode) {
            // Reset form fields when switching to import mode
            setNewEmployee({ name: '', rate: '' });
        } else {
            // Reset import state when switching to manual mode
            resetImportState();
        }
    };

    // Handles selection of a month in the source month picker.
    const handleSourceMonthSelect = (monthIndex) => {
        const newSourceMonth = `${sourceCalendarYear}-${String(monthIndex + 1).padStart(2, '0')}`;
        setSourceMonth(newSourceMonth);
        setShowSourceCalendar(false);
        console.log(`Source month selection changed to: ${newSourceMonth}`);
    };

    // Navigation handlers for the source month picker.
    const handleSourcePreviousYear = () => {
        setSourceCalendarYear(prev => prev - 1);
    };

    const handleSourceNextYear = () => {
        setSourceCalendarYear(prev => prev + 1);
    };

    // Formats the source month for display in the source month selector button.
    const formatSourceMonthDisplay = () => {
        return formatMonthLabel(sourceMonth);
    };    // Handler for the "Check Available Employees" button.
    const handleCheckAvailableEmployees = async () => {
        // Parse source month and target month
        const [sourceYear, sourceMonthStr] = sourceMonth.split('-');
        const [targetYear, targetMonthStr] = selectedMonth.split('-');
        
        setIsLoadingEmployees(true);
        setShowEmployeeList(false);
        setAvailableEmployees([]);
        setSelectedEmployees(new Set());

        try {
            // Build query parameters
            const params = new URLSearchParams({
                sourceMonth: sourceMonthStr,
                sourceYear: sourceYear,
                targetMonth: targetMonthStr,
                targetYear: targetYear,
                siteID: siteID
            });

            console.log(`Fetching available employees with params:`, {
                sourceMonth: sourceMonthStr,
                sourceYear: sourceYear,
                targetMonth: targetMonthStr,
                targetYear: targetYear,
                siteID: siteID
            });            // Make API call
            const response = await api.get(`/api/employee/availableforimport?${params.toString()}`);
            
            if (response && response.success) {
                setAvailableEmployees(response.data || []);
                setShowEmployeeList(true);
                
                const userPlan = user?.plan || 'free';
                const currentEmployeeCount = attendanceData.length;
                const availableCount = response.data?.length || 0;
                
                let successMessage = `Found ${availableCount} employees available for import from ${formatMonthLabel(sourceMonth)}`;
                
                // Add warning for free plan users approaching limit
                const warningMessage = getSubscriptionWarning(userPlan, currentEmployeeCount);
                if (warningMessage) {
                    successMessage += `. ${warningMessage}`;
                }
                
                showSuccess(successMessage);
            } else {
                throw new Error(response?.message || 'Failed to fetch available employees');
            }
        } catch (error) {
            console.error('Error fetching available employees:', error);
            showError(error.response?.data?.message || error.message || 'Failed to fetch available employees');
            setAvailableEmployees([]);
            setShowEmployeeList(false);
        } finally {
            setIsLoadingEmployees(false);
        }
    };

    // Handler for selecting/deselecting individual employees for import.
    const handleEmployeeSelection = (empid, isSelected) => {
        setSelectedEmployees(prev => {
            const newSelected = new Set(prev);
            if (isSelected) {
                newSelected.add(empid);
            } else {
                newSelected.delete(empid);
            }
            return newSelected;
        });
    };

    // Handler for selecting/deselecting all available employees.
    const handleSelectAllEmployees = (selectAll) => {
        if (selectAll) {
            const availableIds = availableEmployees
                .filter(emp => emp.availableForImport)
                .map(emp => emp.empid);
            setSelectedEmployees(new Set(availableIds));
        } else {
            setSelectedEmployees(new Set());
        }
    };    // Reset import state when closing modal or switching modes.
    const resetImportState = () => {
        setAvailableEmployees([]);
        setIsLoadingEmployees(false);
        setSelectedEmployees(new Set());
        setShowEmployeeList(false);
        setPreserveCarryForward(true);
        setPreserveAdditionalPays(false);
        setImportResults(null);
        setShowImportSummary(false);
    };

    // Handler for closing the import summary modal.
    const handleCloseImportSummary = () => {
        setShowImportSummary(false);
        setImportResults(null);
    };

    // Handler for importing selected employees.
    const handleImportEmployees = async () => {
        if (selectedEmployees.size === 0) {
            showError('Please select at least one employee to import');
            return;
        }

        // Check subscription limits for free plan users
        const userPlan = user?.plan || 'free';
        const currentEmployeeCount = attendanceData.length;
        const selectedEmployeeCount = selectedEmployees.size;
        
        if (shouldShowSubscriptionModal(userPlan, currentEmployeeCount, selectedEmployeeCount)) {
            // Show subscription modal instead of proceeding with import
            setShowSubscriptionModal(true);
            return;
        }

        try {
            setIsAddingEmployee(true);

            const [sourceYear, sourceMonthNum] = sourceMonth.split('-');
            const [targetYear, targetMonthNum] = selectedMonth.split('-');

            const requestBody = {
                sourceMonth: parseInt(sourceMonthNum),
                sourceYear: parseInt(sourceYear),
                targetMonth: parseInt(targetMonthNum),
                targetYear: parseInt(targetYear),
                siteID: siteID,
                employeeIds: Array.from(selectedEmployees),
                preserveCarryForward: preserveCarryForward,
                preserveAdditionalPays: preserveAdditionalPays
            };            const response = await api.post('/api/employee/importemployees', requestBody);            // Store import results for summary display
            if (response.data) {
                const resultsData = {
                    summary: response.data.summary,
                    importResults: response.data.importResults,
                    sourceMonth: sourceMonth,
                    targetMonth: selectedMonth,
                    requestOptions: {
                        preserveCarryForward,
                        preserveAdditionalPays
                    }
                };
                
                setImportResults(resultsData);
                setShowImportSummary(true);
                
                // Close the import modal
                setShowAddEmployeeModal(false);
                setIsAddingEmployee(false);
                
                // Reset only the form state, keep summary data
                setAvailableEmployees([]);
                setIsLoadingEmployees(false);
                setSelectedEmployees(new Set());
                setShowEmployeeList(false);
                setPreserveCarryForward(true);
                setPreserveAdditionalPays(false);
            } else {
                // No results data, close normally
                handleCloseAddEmployeeModal();
            }

            if (response.data && response.data.message) {
                showSuccess(response.data.message);
            } else {
                showSuccess(`Successfully imported ${selectedEmployees.size} employee(s) from ${formatMonthLabel(sourceMonth)} to ${formatMonthLabel(selectedMonth)}`);
            }

            // Note: Don't reset import state here so summary modal can be shown

            // Note: No need to refresh attendance data since imported employees 
            // have no attendance records yet, only carry forward data

        } catch (error) {
            console.error('Error importing employees:', error);

            if (error.response?.status === 400) {
                showError('Missing required fields. Please check your selection and try again.');
            } else if (error.response?.status === 404) {
                showError('No employees found in the source month. Please select a different source month.');
            } else if (error.response?.status === 409) {
                const details = error.response.data?.details;
                if (details?.existingEmployeeIds && details.existingEmployeeIds.length > 0) {
                    showError(`Some employees already exist in the target month: ${details.existingEmployeeIds.join(', ')}`);
                } else {
                    showError('Some employees already exist in the target month.');
                }
            } else {
                const errorMessage = error.response?.data?.error || error.message || 'Failed to import employees';
                showError(`Import failed: ${errorMessage}`);
            }
        } finally {
            setIsAddingEmployee(false);
        }
    };

    // --- DELETE EMPLOYEE FUNCTIONALITY ---

    // Opens the delete confirmation dialog for a specific employee
    const handleDeleteEmployee = useCallback((employee) => {
        const [year, month] = selectedMonth.split('-');
        setEmployeeToDelete({
            empid: employee.id,
            name: employee.name,
            month: parseInt(month),
            year: parseInt(year)
        });
        setDeletePreviousMonth(false); // Reset checkbox
        setShowDeleteConfirmDialog(true);
    }, [selectedMonth]);

    // Closes the delete confirmation dialog and resets state
    const handleCloseDeleteDialog = () => {
        setShowDeleteConfirmDialog(false);
        setEmployeeToDelete(null);
        setDeletePreviousMonth(false);
    };    // Mock API call to delete employee with the specified body data
    const deleteEmployeeAPI = async (deleteData) => {
        try {
            console.log('Deleting employee via API:', deleteData);
            
            // Make actual API call to backend
            const response = await api.delete('/api/employee/deleteemployee', deleteData);
            
            if (response.success) {
                return {
                    success: true,
                    message: response.message,
                    data: response.data
                };
            } else {
                throw new Error(response.message || 'Failed to delete employee');
            }
        } catch (error) {
            console.error('API Error deleting employee:', error);
            throw error;
        }
    };

    // Confirms and executes the employee deletion
    const confirmDeleteEmployee = async () => {
        if (!employeeToDelete) return;

        setIsDeletingEmployee(true);

        try {
            // Prepare the payload for the API request
            const deletePayload = {
                empid: employeeToDelete.empid,
                name: employeeToDelete.name,
                month: employeeToDelete.month,
                year: employeeToDelete.year,
                deletePreviousMonth: deletePreviousMonth
            };

            console.log('Deleting employee with payload:', deletePayload);

            // Make the mock API call
            const response = await deleteEmployeeAPI(deletePayload);
              if (response.success) {
                console.log('Employee deleted successfully:', response.data);
                
                // Show success message with more details
                const deletionSummary = response.data.deletionMetadata;                const successMessage = deletionSummary.deletePreviousMonth 
                    ? `Employee ${deletionSummary.name} (${deletionSummary.empid}) completely deleted including all historical data. ${deletionSummary.totalRecordsDeleted} records deleted.`
                    : `Employee ${deletionSummary.name} (${deletionSummary.empid}) deleted for ${deletionSummary.targetMonth}/${deletionSummary.targetYear}.`;
                
                showSuccess(successMessage);
                
                // Show warnings if any change tracking failed
                if (response.warnings) {
                    console.warn('Deletion completed with warnings:', response.warnings);
                }
                
                // Close the dialog
                handleCloseDeleteDialog();
                
                // Trigger data refresh to update the table
                setRefreshTrigger(prev => prev + 1);
            } else {
                throw new Error(response.message || 'Failed to delete employee.');
            }        } catch (err) {
            console.error('Error deleting employee:', err);
            showError(`Failed to delete employee: ${err.message}`);
        } finally {
            setIsDeletingEmployee(false);
        }
    };


    // --- JSX RENDERING ---
    
    return (
        <div className={styles.attendanceContainer}>
            <Sidebar />
            <div className={styles.attendanceContent}>
                <div className={styles.pageHeader}>
                    <div className={styles.titleSection}>
                        <h1 className={styles.pageTitle}>Attendance Management</h1>
                        <p className={styles.pageSubtitle}>Track and manage employee attendance records</p>
                    </div>
                    <div className={styles.headerControls}>
                        <div className={styles.monthSelector} ref={calendarRef}>
                            <button
                                type="button"
                                className={styles.monthButton}
                                onClick={() => setShowCalendar(!showCalendar)}
                                disabled={isLoading || isEditMode}
                            >
                                <FaCalendarAlt className={styles.calendarIcon} />
                                <span>{formatSelectedMonthDisplay()}</span>
                                <svg
                                    className={`${styles.chevron} ${showCalendar ? styles.chevronUp : ''}`}
                                    width="16"
                                    height="16"
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
                                            const isSelected = selectedMonth === `${calendarYear}-${String(index + 1).padStart(2, '0')}`;
                                            const isCurrent = calendarYear === new Date().getFullYear() && index === new Date().getMonth();

                                            return (
                                                <button
                                                    key={index}
                                                    type="button"
                                                    className={`${styles.monthCell} ${disabled ? styles.monthDisabled : ''
                                                        } ${isSelected ? styles.monthSelected : ''
                                                        } ${isCurrent ? styles.monthCurrent : ''
                                                        }`}
                                                    onClick={() => handleMonthSelect(index)}
                                                    disabled={disabled}
                                                >
                                                    {monthName.slice(0, 3)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        {!isEditMode && (
                            <button
                                type="button"
                                className={`${styles.editButton} ${styles.addEmployeeButton}`} // Use general button style + specific
                                onClick={handleOpenAddEmployeeModal}
                                disabled={isLoading || isEditMode} // Disable if loading or already in edit mode
                                title={(() => {
                                    const userPlan = user?.plan || 'free';
                                    const currentCount = attendanceData.length;
                                    const limitCheck = checkEmployeeLimit(userPlan, currentCount);
                                    
                                    if (limitCheck.isApproachingLimit && limitCheck.remainingSlots !== Infinity) {
                                        return `${limitCheck.planName}: ${currentCount}/${limitCheck.maxEmployees} employees used`;
                                    }
                                    return 'Add a new employee';
                                })()}
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M8 3.5V12.5M3.5 8H12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Add Employee
                                {(() => {
                                    const userPlan = user?.plan || 'free';
                                    const currentCount = attendanceData.length;
                                    const limitCheck = checkEmployeeLimit(userPlan, currentCount);
                                    
                                    if (limitCheck.isApproachingLimit && limitCheck.remainingSlots !== Infinity) {
                                        return (
                                            <span style={{ fontSize: '0.8em', opacity: 0.8, marginLeft: '4px' }}>
                                                ({currentCount}/{limitCheck.maxEmployees})
                                            </span>
                                        );
                                    }
                                    return null;
                                })()}
                            </button>
                        )}
                        {!isEditMode ? (
                            <button
                                type="button"
                                className={styles.editButton}
                                onClick={handleEditMode}
                                disabled={isLoading || attendanceData.length === 0 || isSaving || isTransitioning}
                            >
                                {isTransitioning ? (
                                    <>
                                        <div className={styles.spinner}></div>
                                        Activating ({enabledRowsCount}/{attendanceData.length})
                                    </>
                                ) : (
                                    <>
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <path
                                                d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Z"
                                                fill="currentColor"
                                            />
                                        </svg>
                                        Edit
                                    </>
                                )}
                            </button>
                        ) : (
                            <div className={styles.editModeActions}>
                                <button
                                    type="button"
                                    className={styles.cancelButton}
                                    onClick={handleCancelEdit}
                                    disabled={isSaving}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className={styles.saveButton}
                                    onClick={handleSaveChanges}
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <>
                                            <div className={styles.spinner}></div>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                                <path
                                                    d="M12 5L6.5 10.5L4 8"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                            Save
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Search Bar Section */}
                {attendanceData.length > 0 && (
                    <div className={styles.searchSection}>
                        <div className={styles.searchContainer}>
                            <div className={styles.searchInputWrapper}>
                                <svg 
                                    className={styles.searchIcon}
                                    width="16" 
                                    height="16" 
                                    viewBox="0 0 24 24" 
                                    fill="none"
                                >
                                    <circle 
                                        cx="11" 
                                        cy="11" 
                                        r="8" 
                                        stroke="currentColor" 
                                        strokeWidth="2"
                                    />
                                    <path 
                                        d="m21 21-4.35-4.35" 
                                        stroke="currentColor" 
                                        strokeWidth="2" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round"
                                    />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search employees by name or ID..."
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    className={styles.searchInput}
                                    disabled={isLoading || isEditMode}
                                />
                                {searchTerm && (
                                    <button
                                        className={styles.clearSearchButton}
                                        onClick={() => setSearchTerm('')}
                                        title="Clear search"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </button>
                                )}
                            </div>
                            {searchTerm && (
                                <div className={styles.searchResults}>
                                    <span className={styles.searchResultsText}>
                                        {filteredAttendanceData.length} of {attendanceData.length} employees found
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                <div className={styles.tableContainer}>
                    {isTransitioning && (
                        <div className={styles.transitionMessage}>
                            <CustomSpinner size={20} color="#3b82f6" />
                            <span>Enabling edit mode ({enabledRowsCount}/{attendanceData.length} rows active)...</span>
                        </div>
                    )}
                    {error ? (
                        <div className={styles.errorState}>
                            <div className={styles.errorIcon}>⚠️</div>
                            <h3>Error Loading Attendance Data</h3>
                            <p>{error}</p>
                            <button 
                                className={styles.retryButton}
                                onClick={() => window.location.reload()}
                            >
                                Retry
                            </button>
                        </div>
                    ) : (isLoading || attendanceData.length === 0) && isLoading ? (
                        <div className={styles.loadingState}>
                            <CustomSpinner size={80} color="#3b82f6" />
                            <p>Loading attendance data...</p>
                        </div>
                    ) : attendanceData.length === 0 ? (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>📋</div>
                            <h3>No Employees Found</h3>
                            <p>No employee data found for {formatSelectedMonthDisplay()}</p>
                        </div>
                    ) : (
                        <VirtualizedAttendanceTable
                            filteredAttendanceData={filteredAttendanceData}
                            attendanceData={attendanceData}
                            selectedMonth={selectedMonth}
                            isEditMode={isEditMode}
                            shouldShowInputs={shouldShowInputs}
                            setVisibleRows={setVisibleRows}
                            onAttendanceChange={handleAttendanceChange}
                            onDeleteEmployee={handleDeleteEmployee}
                            validAttendanceOptions={validAttendanceOptions}
                        />
                    )}
                </div>
                {showConfirmDialog && (
                    <div className={styles.dialogOverlay}>
                        <div className={styles.dialogContainer}>
                            <div className={styles.dialogHeader}>
                                <h3 className={styles.dialogTitle}>Confirm Changes</h3>
                                <button
                                    className={styles.dialogCloseButton}
                                    onClick={() => setShowConfirmDialog(false)}
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                        <path
                                            d="M18 6L6 18M6 6L18 18"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </button>
                            </div>      
                            <div className={styles.dialogContent}>
                                <p className={styles.dialogMessage}>
                                    You are about to save {changes.length} attendance change{changes.length !== 1 ? 's' : ''} for {formatSelectedMonthDisplay()}.
                                </p>
                                <div className={styles.changesContainer}>
                                    <h4 className={styles.changesTitle}>Changes Summary:</h4>
                                    <div className={styles.changesList}>
                                        {changes.slice(0, 10).map((change, index) => (
                                            <div key={index} className={styles.changeItem}>
                                                <span className={styles.employeeName}>{change.employeeName}</span>
                                                <span className={styles.dayInfo}>Day {change.day}</span>
                                                <div className={styles.valueChange}>
                                                    <span className={styles.oldValue}>{change.oldValue}</span>
                                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={styles.arrow}>
                                                        <path
                                                            d="M6 4L10 8L6 12"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        />
                                                    </svg>
                                                    <span className={styles.newValue}>{change.newValue}</span>
                                                </div>
                                            </div>
                                        ))}
                                        {changes.length > 10 && (
                                            <div className={styles.moreChanges}>
                                                And {changes.length - 10} more changes...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className={styles.dialogActions}>
                                <button
                                    className={styles.dialogCancelButton}
                                    onClick={() => setShowConfirmDialog(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className={styles.dialogConfirmButton}
                                    onClick={confirmSaveChanges}
                                >
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                        <path
                                            d="M12 5L6.5 10.5L4 8"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                    Confirm Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )}                {showAddEmployeeModal && (
                    <div className={styles.dialogOverlay}>
                        <div className={`${styles.dialogContainer} ${isImportMode ? styles.importModal : ''}`}>
                            <div className={styles.dialogHeader}>
                                <h3 className={styles.dialogTitle}>Add New Employee</h3>
                                <button
                                    className={styles.dialogCloseButton}
                                    onClick={handleCloseAddEmployeeModal}
                                    disabled={isAddingEmployee}
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>                            <div className={styles.dialogContent}>
                                {/* Toggle between Manual and Import modes */}
                                <div className={styles.modeToggleContainer}>
                                    <div className={styles.modeToggle}>
                                        <button
                                            type="button"
                                            className={`${styles.toggleButton} ${!isImportMode ? styles.toggleActive : ''}`}
                                            onClick={() => handleToggleImportMode(false)}
                                            disabled={isAddingEmployee}
                                        >
                                            ➕ Manual Add Employee
                                        </button>
                                        <button
                                            type="button"
                                            className={`${styles.toggleButton} ${isImportMode ? styles.toggleActive : ''}`}
                                            onClick={() => handleToggleImportMode(true)}
                                            disabled={isAddingEmployee}
                                        >
                                            📥 Import Employee
                                        </button>
                                    </div>
                                </div>

                                {/* Conditional content based on mode */}
                                {!isImportMode ? (
                                    /* Manual Add Employee Form */
                                    <div className={styles.addEmployeeForm}>
                                        <div className={styles.formGroup}>
                                            <label htmlFor="employeeName" className={styles.formLabel}>Employee Name</label>
                                            <input
                                                type="text"
                                                id="employeeName"
                                                name="name"
                                                className={styles.formInput}
                                                value={newEmployee.name}
                                                onChange={handleNewEmployeeChange}
                                                placeholder="Enter employee's full name"
                                                disabled={isAddingEmployee}
                                            />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label htmlFor="employeeRate" className={styles.formLabel}>Daily Rate (₹)</label>
                                            <input
                                                type="number"
                                                id="employeeRate"
                                                name="rate"
                                                className={styles.formInput}
                                                value={newEmployee.rate}
                                                onChange={handleNewEmployeeChange}
                                                placeholder="Enter daily rate"
                                                min="0"
                                                step="0.01"
                                                disabled={isAddingEmployee}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    /* Import Employee Form */
                                    <div className={styles.importEmployeeForm}>                                        <div className={styles.formGroup}>
                                            <label className={styles.formLabel}>Source Month</label>
                                            <div className={`${styles.monthPickerContainer} ${showSourceCalendar ? styles.calendarOpen : ''}`} ref={sourceCalendarRef}>
                                                <button
                                                    type="button"
                                                    className={styles.monthPickerButton}
                                                    onClick={() => setShowSourceCalendar(!showSourceCalendar)}
                                                    disabled={isAddingEmployee}
                                                >
                                                    <FaCalendarAlt className={styles.calendarIcon} />
                                                    <span>{formatSourceMonthDisplay()}</span>
                                                    <svg
                                                        className={`${styles.chevron} ${showSourceCalendar ? styles.chevronUp : ''}`}
                                                        width="16"
                                                        height="16"
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
                                                {showSourceCalendar && (
                                                    <div className={styles.calendarDropdown}>
                                                        <div className={styles.calendarHeader}>
                                                            <button
                                                                type="button"
                                                                className={styles.yearNavButton}
                                                                onClick={handleSourcePreviousYear}
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
                                                            <span className={styles.yearDisplay}>{sourceCalendarYear}</span>
                                                            <button
                                                                type="button"
                                                                className={styles.yearNavButton}
                                                                onClick={handleSourceNextYear}
                                                                disabled={sourceCalendarYear >= new Date().getFullYear()}
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
                                                                const disabled = isMonthDisabled(sourceCalendarYear, index);
                                                                const isSelected = sourceMonth === `${sourceCalendarYear}-${String(index + 1).padStart(2, '0')}`;
                                                                const isCurrent = sourceCalendarYear === new Date().getFullYear() && index === new Date().getMonth();

                                                                return (
                                                                    <button
                                                                        key={index}
                                                                        type="button"
                                                                        className={`${styles.monthCell} ${disabled ? styles.monthDisabled : ''
                                                                            } ${isSelected ? styles.monthSelected : ''
                                                                            } ${isCurrent ? styles.monthCurrent : ''
                                                                            }`}
                                                                        onClick={() => handleSourceMonthSelect(index)}
                                                                        disabled={disabled}
                                                                    >
                                                                        {monthName.slice(0, 3)}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>                                        <div className={styles.formGroup}>
                                            <button
                                                type="button"
                                                className={styles.checkEmployeesButton}
                                                onClick={handleCheckAvailableEmployees}
                                                disabled={isAddingEmployee || isLoadingEmployees}
                                            >
                                                {isLoadingEmployees ? (
                                                    <>
                                                        <div className={styles.spinner}></div>
                                                        Checking...
                                                    </>
                                                ) : (
                                                    <>
                                                        🔍 Check Available Employees
                                                    </>
                                                )}
                                            </button>                                        </div>

                                        {/* Import Options */}
                                        {showEmployeeList && availableEmployees.length > 0 && (
                                            <div className={styles.importOptionsContainer}>
                                                <h5 className={styles.importOptionsTitle}>Import Options</h5>
                                                <div className={styles.importOptionsGrid}>
                                                    <div className={styles.importOption}>
                                                        <input
                                                            type="checkbox"
                                                            id="preserveCarryForward"
                                                            className={styles.checkbox}
                                                            checked={preserveCarryForward}
                                                            onChange={(e) => setPreserveCarryForward(e.target.checked)}
                                                            disabled={isAddingEmployee}
                                                        />
                                                        <label htmlFor="preserveCarryForward" className={styles.checkboxLabel}>
                                                            Preserve carry forward balances
                                                        </label>
                                                    </div>
                                                    <div className={styles.importOption}>
                                                        <input
                                                            type="checkbox"
                                                            id="preserveAdditionalPays"
                                                            className={styles.checkbox}
                                                            checked={preserveAdditionalPays}
                                                            onChange={(e) => setPreserveAdditionalPays(e.target.checked)}
                                                            disabled={isAddingEmployee}
                                                        />
                                                        <label htmlFor="preserveAdditionalPays" className={styles.checkboxLabel}>
                                                            Preserve additional pays
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>                                )}
                            </div>
                            
                            {/* Employee Selection List */}
                            {showEmployeeList && availableEmployees.length > 0 && (
                                <div className={styles.employeeListContainer}>
                                    <div className={styles.employeeListHeader}>
                                        <h4 className={styles.employeeListTitle}>Available Employees for Import</h4>
                                        <div className={styles.selectAllContainer}>
                                            <input
                                                type="checkbox"
                                                id="selectAllEmployees"
                                                className={styles.checkbox}
                                                checked={availableEmployees.filter(emp => emp.availableForImport).length > 0 && 
                                                         availableEmployees.filter(emp => emp.availableForImport).every(emp => selectedEmployees.has(emp.empid))}
                                                onChange={(e) => handleSelectAllEmployees(e.target.checked)}
                                                disabled={isLoadingEmployees || availableEmployees.filter(emp => emp.availableForImport).length === 0}
                                            />
                                            <label htmlFor="selectAllEmployees" className={styles.checkboxLabel}>
                                                Select All Available ({availableEmployees.filter(emp => emp.availableForImport).length})
                                            </label>
                                        </div>
                                    </div>
                                    
                                    <div className={styles.employeeList}>
                                        {availableEmployees.map((employee) => {
                                            const isAvailable = employee.availableForImport;
                                            const isSelected = selectedEmployees.has(employee.empid);
                                            
                                            return (
                                                <div
                                                    key={employee.empid}
                                                    className={`${styles.employeeItem} ${!isAvailable ? styles.employeeDisabled : ''}`}
                                                >
                                                    <div className={styles.employeeCheckbox}>
                                                        <input
                                                            type="checkbox"
                                                            id={`employee-${employee.empid}`}
                                                            className={styles.checkbox}
                                                            checked={isSelected}
                                                            onChange={(e) => handleEmployeeSelection(employee.empid, e.target.checked)}
                                                            disabled={!isAvailable || isLoadingEmployees}
                                                        />
                                                    </div>
                                                    
                                                    <div className={styles.employeeInfo}>
                                                        <div className={styles.employeeMainInfo}>
                                                            <div className={styles.employeeNameSection}>
                                                                <span className={styles.employeeName}>
                                                                    {employee.name}
                                                                </span>
                                                                <span className={styles.employeeId}>
                                                                    ID: {employee.empid}
                                                                </span>
                                                            </div>
                                                            <div className={styles.employeeAvailability}>
                                                                {isAvailable ? (
                                                                    <span className={styles.availableBadge}>✓ Available</span>
                                                                ) : (
                                                                    <span className={styles.unavailableBadge}>⚠ Already Exists</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        <div className={styles.employeeDetails}>
                                                            <div className={styles.employeeFinancial}>
                                                                <span className={styles.employeeRate}>
                                                                    <strong>Rate:</strong> ₹{employee.rate || 0}
                                                                </span>
                                                                <span className={styles.employeeBalance}>
                                                                    <strong>Balance:</strong> ₹{employee.closing_balance || 0}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        
                                                        {!isAvailable && (
                                                            <div className={styles.employeeStatus}>
                                                                <span className={styles.statusMessage}>
                                                                    This employee already exists in the target month ({formatMonthLabel(selectedMonth)})
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    {selectedEmployees.size > 0 && (
                                        <div className={styles.selectionSummary}>
                                            <div className={styles.summaryContent}>
                                                <span className={styles.summaryText}>
                                                    {selectedEmployees.size} employee(s) selected for import
                                                </span>
                                                <span className={styles.summaryDetails}>
                                                    From {formatMonthLabel(sourceMonth)} to {formatMonthLabel(selectedMonth)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {showEmployeeList && availableEmployees.length === 0 && (
                                <div className={styles.noEmployeesMessage}>
                                    <div className={styles.noEmployeesContent}>
                                        <div className={styles.noEmployeesIcon}>🔍</div>
                                        <h4>No Employees Found</h4>
                                        <p>No employees found available for import from {formatMonthLabel(sourceMonth)} to {formatMonthLabel(selectedMonth)}.</p>
                                        <p className={styles.suggestionText}>Try selecting a different source month that has employee data.</p>
                                    </div>
                                </div>
                            )}

                            <div className={styles.dialogActions}>
                                <button
                                    className={styles.dialogCancelButton}
                                    onClick={handleCloseAddEmployeeModal}
                                    disabled={isAddingEmployee}
                                >
                                    Cancel
                                </button>
                                {!isImportMode ? (
                                    <button
                                        className={styles.dialogConfirmButton} // Can reuse or make a specific "add" button style
                                        onClick={handleSaveNewEmployee}
                                        disabled={isAddingEmployee || !newEmployee.name.trim() || !newEmployee.rate.trim()}
                                    >
                                        {isAddingEmployee ? (
                                            <>
                                                <div className={styles.spinner}></div>
                                                Adding...
                                            </>
                                        ) : (
                                            <>
                                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                                    <path d="M8 3.5V12.5M3.5 8H12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                                Save Employee
                                            </>
                                        )}
                                    </button>                                ) : (
                                    <>
                                        {!showEmployeeList ? (
                                            <button
                                                className={styles.dialogConfirmButton}
                                                onClick={handleCheckAvailableEmployees}
                                                disabled={isAddingEmployee || isLoadingEmployees}
                                            >
                                                {isLoadingEmployees ? (
                                                    <>
                                                        <div className={styles.spinner}></div>
                                                        Checking...
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                                            <path d="M15.5 15.5L12.5 12.5M14 7A7 7 0 1 1 0 7A7 7 0 0 1 14 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                        </svg>
                                                        Check Available Employees
                                                    </>
                                                )}
                                            </button>                                        ) : (
                                            <button
                                                className={styles.dialogConfirmButton}
                                                onClick={handleImportEmployees}
                                                disabled={selectedEmployees.size === 0 || isAddingEmployee}
                                                title={selectedEmployees.size === 0 ? 'Please select at least one employee to import' : `Import ${selectedEmployees.size} selected employee(s)`}
                                            >
                                                {isAddingEmployee ? (
                                                    <>
                                                        <div className={styles.spinner}></div>
                                                        Importing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                                            <path d="M8 1V15M1 8H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                        </svg>
                                                        Import Selected ({selectedEmployees.size})
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {showDeleteConfirmDialog && employeeToDelete && (
                    <div className={styles.dialogOverlay}>
                        <div className={styles.dialogContainer} style={{ maxWidth: '400px' }}>                            <div className={styles.dialogHeader}>
                                <h3 className={styles.dialogTitle}>Delete Employee</h3>
                                <button
                                    className={styles.dialogCloseButton}
                                    onClick={handleCloseDeleteDialog}
                                    disabled={isDeletingEmployee}
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>
                            <div className={styles.dialogContent}>
                                <p className={styles.dialogMessage}>
                                    Are you sure you want to delete employee <strong>{employeeToDelete.name}</strong> (ID: {employeeToDelete.empid})?
                                </p>
                                <p className={styles.dialogSubMessage}>
                                    This action will delete the attendance data for <strong>{employeeToDelete.month}/{employeeToDelete.year}</strong>.
                                </p>
                                <div className={styles.checkboxContainer}>
                                    <input
                                        type="checkbox"
                                        id="deletePreviousMonth"
                                        className={styles.checkbox}
                                        checked={deletePreviousMonth}
                                        onChange={(e) => setDeletePreviousMonth(e.target.checked)}
                                        disabled={isDeletingEmployee}
                                    />
                                    <label htmlFor="deletePreviousMonth" className={styles.checkboxLabel}>
                                        Also delete attendance data for the previous month
                                    </label>
                                </div>
                            </div>
                            <div className={styles.dialogActions}>                                <button
                                    className={styles.dialogCancelButton}
                                    onClick={handleCloseDeleteDialog}
                                    disabled={isDeletingEmployee}
                                >
                                    Cancel
                                </button>
                                <button
                                    className={styles.dialogConfirmButton}
                                    onClick={confirmDeleteEmployee}
                                    disabled={isDeletingEmployee}
                                >
                                    {isDeletingEmployee ? (
                                        <>
                                            <div className={styles.spinner}></div>
                                            Deleting...
                                        </>
                                    ) : (                                        <>
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                                <path
                                                    d="M6.5 1H9.5A1 1 0 0 1 10.5 2V3H13A0.5 0.5 0 0 1 13 4H12V13A2 2 0 0 1 10 15H6A2 2 0 0 1 4 13V4H3A0.5 0.5 0 0 1 3 3H5.5V2A1 1 0 0 1 6.5 1ZM5.5 4V13A1 1 0 0 0 6.5 14H9.5A1 1 0 0 0 10.5 13V4H5.5ZM7 6A0.5 0.5 0 0 1 7.5 6.5V11.5A0.5 0.5 0 0 1 6.5 11.5V6.5A0.5 0.5 0 0 1 7 6ZM9 6A0.5 0.5 0 0 1 9.5 6.5V11.5A0.5 0.5 0 0 1 8.5 11.5V6.5A0.5 0.5 0 0 1 9 6Z"
                                                    fill="currentColor"
                                                />
                                            </svg>
                                            Delete Employee
                                        </>
                                    )}
                                </button>                            </div>
                        </div>
                    </div>
                )}

                {/* Import Summary Modal */}
                {showImportSummary && importResults && (
                    <div className={styles.dialogOverlay}>
                        <div className={`${styles.dialogContainer} ${styles.importSummaryModal}`}>
                            <div className={styles.dialogHeader}>
                                <h3 className={styles.dialogTitle}>Import Summary</h3>
                                <button
                                    className={styles.dialogCloseButton}
                                    onClick={handleCloseImportSummary}
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>
                            
                            <div className={styles.dialogContent}>
                                {/* Import Overview */}
                                <div className={styles.importOverview}>
                                    <div className={styles.importOverviewHeader}>
                                        <h4 className={styles.sectionTitle}>Import Overview</h4>
                                        <div className={styles.importRoute}>
                                            <span className={styles.routeText}>
                                                {formatMonthLabel(importResults.sourceMonth)} → {formatMonthLabel(importResults.targetMonth)}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {importResults.summary && (
                                        <div className={styles.summaryStats}>
                                            <div className={styles.statCard}>
                                                <div className={styles.statValue}>{importResults.summary.totalEmployeesProcessed || 0}</div>
                                                <div className={styles.statLabel}>Total Processed</div>
                                            </div>
                                            <div className={styles.statCard}>
                                                <div className={`${styles.statValue} ${styles.successValue}`}>{importResults.summary.successfulImports || 0}</div>
                                                <div className={styles.statLabel}>Successful</div>
                                            </div>
                                            <div className={styles.statCard}>
                                                <div className={`${styles.statValue} ${styles.errorValue}`}>{importResults.summary.failedImports || 0}</div>
                                                <div className={styles.statLabel}>Failed</div>
                                            </div>
                                            <div className={styles.statCard}>
                                                <div className={styles.statValue}>₹{importResults.summary.totalCarryForwardAmount || 0}</div>
                                                <div className={styles.statLabel}>Total Carry Forward</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Import Options Used */}
                                    <div className={styles.importOptionsUsed}>
                                        <h5 className={styles.optionsTitle}>Import Options Used:</h5>
                                        <div className={styles.optionsList}>
                                            <span className={`${styles.optionTag} ${importResults.requestOptions.preserveCarryForward ? styles.optionEnabled : styles.optionDisabled}`}>
                                                {importResults.requestOptions.preserveCarryForward ? '✓' : '✗'} Preserve Carry Forward
                                            </span>
                                            <span className={`${styles.optionTag} ${importResults.requestOptions.preserveAdditionalPays ? styles.optionEnabled : styles.optionDisabled}`}>
                                                {importResults.requestOptions.preserveAdditionalPays ? '✓' : '✗'} Preserve Additional Pays
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Employee Details */}
                                {importResults.importResults && importResults.importResults.length > 0 && (
                                    <div className={styles.employeeResultsList}>
                                        {importResults.importResults.map((result, index) => (
                                            <div key={index} className={`${styles.employeeResultItem} ${result.success ? styles.resultSuccess : styles.resultError}`}>
                                                <div className={styles.employeeResultHeader}>
                                                    <div className={styles.employeeResultName}>
                                                        <strong>{result.name}</strong> (ID: {result.empid})
                                                    </div>
                                                    <div className={styles.employeeResultStatus}>
                                                        {result.success ? (
                                                            <span className={styles.successBadge}>✓ Success</span>
                                                        ) : (
                                                            <span className={styles.errorBadge}>✗ Failed</span>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <div className={styles.employeeResultDetails}>
                                                    <div className={styles.resultDetailItem}>
                                                        <span className={styles.detailLabel}>Carry Forward:</span>
                                                        <span className={styles.detailValue}>₹{result.carryForwardAmount || 0}</span>
                                                    </div>
                                                    {result.changeTracking?.serialNumber && (
                                                        <div className={styles.resultDetailItem}>
                                                            <span className={styles.detailLabel}>Serial Number:</span>
                                                            <span className={styles.detailValue}>{result.changeTracking.serialNumber}</span>
                                                        </div>
                                                    )}
                                                    {!result.success && result.error && (
                                                        <div className={styles.resultDetailItem}>
                                                            <span className={styles.detailLabel}>Error:</span>
                                                            <span className={`${styles.detailValue} ${styles.errorText}`}>{result.error}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className={styles.dialogActions}>
                                <button
                                    className={styles.dialogConfirmButton}
                                    onClick={handleCloseImportSummary}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Subscription Modal */}
                <SubscriptionModal 
                    isOpen={showSubscriptionModal}
                    onClose={() => setShowSubscriptionModal(false)}
                    currentEmployeeCount={attendanceData.length}
                />
            </div>
        </div>
    );
};

export default Attendance;
