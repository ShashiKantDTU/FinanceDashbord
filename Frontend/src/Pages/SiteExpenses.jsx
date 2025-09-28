import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from '../components/ToastProvider';
import CustomSpinner from '../components/CustomSpinner';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import { 
  FaCalendarAlt, 
  FaPlus, 
  FaMoneyBillWave, 
  FaChartLine, 
  FaWallet, 
  FaUsers, 
  FaReceipt, 
  FaArrowUp, 
  FaArrowDown,
  FaFilter,
  FaFileInvoiceDollar,
  FaHardHat,
  FaUtensils,
  FaTools,
  FaCar,
  FaBoxes,
  FaUserTie,
  FaHandshake,
  FaEllipsisH,
  FaTimes,
  FaCheckCircle,
  FaExclamationTriangle,
  FaInfoCircle,
  FaChartPie,
  FaEye,
  FaTrash,
  FaEdit,
  FaSpinner
} from 'react-icons/fa';
import { HiOutlineTrash } from 'react-icons/hi2';
import styles from './SiteExpenses.module.css';

// Enhanced Confirmation Dialog Component with loading states
const ConfirmationDialog = ({ isOpen, onClose, onConfirm, title, message, type = 'danger' }) => {
  const [isLoading, setIsLoading] = useState(false);
  
  // Handle escape key - MUST be called before any conditional returns
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, isLoading, onClose]);

  const typeStyles = {
    danger: {
      icon: <FaExclamationTriangle />,
      iconColor: '#EF4444',
      buttonColor: '#EF4444'
    },
    warning: {
      icon: <FaExclamationTriangle />,
      iconColor: '#F59E0B',
      buttonColor: '#F59E0B'
    },
    info: {
      icon: <FaInfoCircle />,
      iconColor: '#3B82F6',
      buttonColor: '#3B82F6'
    }
  };
  
  const currentType = typeStyles[type] || typeStyles.danger;
  
  const handleConfirm = async () => {
    if (onConfirm && !isLoading) {
      setIsLoading(true);
      try {
        await onConfirm();
        onClose();
      } catch {
        console.error('Error in confirmation action');
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (!isOpen) return null;
  
  return (
    <div className={styles.confirmationOverlay} onClick={isLoading ? undefined : onClose}>
      <div className={styles.confirmationDialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.confirmationHeader}>
          <div className={styles.confirmationIcon} style={{ color: currentType.iconColor }}>
            {currentType.icon}
          </div>
          <h3 className={styles.confirmationTitle}>{title}</h3>
        </div>
        <div className={styles.confirmationBody}>
          <p className={styles.confirmationMessage}>{message}</p>
          {isLoading && (
            <div className={styles.confirmationLoading}>
              <FaSpinner className={styles.spinner} />
              <span>Processing...</span>
            </div>
          )}
        </div>
        <div className={styles.confirmationActions}>
          <button 
            className={styles.confirmationCancel}
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button 
            className={`${styles.confirmationConfirm} ${isLoading ? styles.loading : ''}`}
            style={{ backgroundColor: currentType.buttonColor }}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <FaSpinner className={styles.spinner} />
                Deleting...
              </>
            ) : (
              'Confirm'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const SiteExpenses = () => {
  const { siteID } = useParams();
  const { showSuccess: originalShowSuccess, showError: originalShowError } = useToast();
  
  // Create stable references for toast functions to prevent re-renders
  const showSuccess = useCallback((message, duration) => {
    originalShowSuccess(message, duration);
  }, [originalShowSuccess]);
  
  const showError = useCallback((message, duration) => {
    originalShowError(message, duration);
  }, [originalShowError]);
  const [loading, setLoading] = useState(true);
  const [expenseData, setExpenseData] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  
  // View mode states
  const [viewMode, setViewMode] = useState('overview'); // 'overview', 'expenses', 'payments', 'employees'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  
  // Modal states for detailed views
  const [showTotalCostsModal, setShowTotalCostsModal] = useState(false);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [showAdvancesModal, setShowAdvancesModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showSiteExpensesModal, setShowSiteExpensesModal] = useState(false);
  const [showEmployeesModal, setShowEmployeesModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  
  // Add modal states
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  
  // Current date for default month/year
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // Calendar picker states
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarYear, setCalendarYear] = useState(currentDate.getFullYear());
  const calendarRef = useRef(null);

  // Month names for calendar
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Expense categories with icons and colors
  const expenseCategories = [
    { name: 'Food', icon: FaUtensils, color: '#FF6B6B', bgColor: '#FFE5E5' },
    { name: 'Tools Purchase', icon: FaTools, color: '#4ECDC4', bgColor: '#E5F9F8' },
    { name: 'Travel', icon: FaCar, color: '#45B7D1', bgColor: '#E5F6FB' },
    { name: 'Material', icon: FaBoxes, color: '#96CEB4', bgColor: '#EBF7F0' },
    { name: 'Supervisor Expense', icon: FaUserTie, color: '#FECA57', bgColor: '#FFF9E5' },
    { name: 'Contractor Expense', icon: FaHandshake, color: '#9B59B6', bgColor: '#F3EBFF' },
    { name: 'Others', icon: FaEllipsisH, color: '#95A5A6', bgColor: '#F0F3F4' }
  ];

  // Get category icon and color
  const getCategoryDetails = (categoryName) => {
    const category = expenseCategories.find(cat => 
      cat.name.toLowerCase() === categoryName?.toLowerCase() ||
      (cat.name === 'Tools Purchase' && categoryName?.toLowerCase() === 'tools purchase') ||
      (cat.name === 'Supervisor Expense' && categoryName?.toLowerCase() === 'supervisor expense') ||
      (cat.name === 'Contractor Expense' && categoryName?.toLowerCase() === 'contractor expense')
    );
    return category || expenseCategories.find(cat => cat.name === 'Others');
  };

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
  };

  const handleNextYear = () => {
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

  // Update calendar year when selected year changes
  useEffect(() => {
    setCalendarYear(selectedYear);
  }, [selectedYear]);

  // Fetch expense data from API
  const fetchExpenseData = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch financial summary from backend
      const response = await api.get(`/api/financials/sites/${siteID}/financial-summary`, {
        params: {
          month: selectedMonth,
          year: selectedYear
        }
      });
      
      if (response?.success) {
        setExpenseData(response.data);
      } else {
        showError('Failed to fetch financial data');
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching expense data:', err);
      showError(err.message || 'Failed to fetch expense data');
      setLoading(false);
    }
  }, [siteID, selectedMonth, selectedYear, showError]);

  useEffect(() => {
    if (siteID) {
      fetchExpenseData();
    }
  }, [siteID, fetchExpenseData]);

  // State for confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'danger'
  });
  
  // Loading states for delete operations
  const [deletingItems, setDeletingItems] = useState(new Set());
  
  // Delete expense function with improved UX
  const handleDeleteExpense = useCallback(async (expenseId, expenseDetails = {}) => {
    if (!expenseId) return;
    
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Expense',
      message: `Are you sure you want to delete this ${expenseDetails.category || 'expense'} of ₹${(expenseDetails.value || 0).toLocaleString()}? This action cannot be undone.`,
      type: 'danger',
      onConfirm: async () => {
        // Add item to deleting set for loading state
        setDeletingItems(prev => new Set(prev).add(expenseId));
        
        try {
          const response = await api.delete(`/api/financials/expenses/${expenseId}`);
          
          if (response?.success) {
            showSuccess(response.message || 'Expense deleted successfully');
            // Only refresh data on successful deletion
            await fetchExpenseData();
          } else {
            throw new Error(response?.error || 'Failed to delete expense');
          }
        } catch (error) {
          console.error('Error deleting expense:', error);
          showError(`Failed to delete expense: ${error.message || 'Unknown error'}`);
        } finally {
          // Remove item from deleting set
          setDeletingItems(prev => {
            const newSet = new Set(prev);
            newSet.delete(expenseId);
            return newSet;
          });
        }
      }
    });
  }, [showSuccess, showError, fetchExpenseData]);
  
  // Delete payment function with improved UX
  const handleDeletePayment = useCallback(async (paymentId, paymentDetails = {}) => {
    if (!paymentId) return;
    
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Payment',
      message: `Are you sure you want to delete this payment of ₹${(paymentDetails.value || 0).toLocaleString()}? This action cannot be undone.`,
      type: 'danger',
      onConfirm: async () => {
        // Add item to deleting set for loading state
        setDeletingItems(prev => new Set(prev).add(paymentId));
        
        try {
          const response = await api.delete(`/api/financials/payments/${paymentId}`);
          
          if (response?.success) {
            showSuccess(response.message || 'Payment deleted successfully');
            // Only refresh data on successful deletion
            await fetchExpenseData();
          } else {
            throw new Error(response?.error || 'Failed to delete payment');
          }
        } catch (error) {
          console.error('Error deleting payment:', error);
          showError(`Failed to delete payment: ${error.message || 'Unknown error'}`);
        } finally {
          // Remove item from deleting set
          setDeletingItems(prev => {
            const newSet = new Set(prev);
            newSet.delete(paymentId);
            return newSet;
          });
        }
      }
    });
  }, [showSuccess, showError, fetchExpenseData]);


  // Enhanced utility functions for robust data handling - memoized to prevent re-renders
  const formatCurrency = useCallback((amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '₹0';
    }
    return `₹${Number(amount).toLocaleString('en-IN')}`;
  }, []);

  const safePercentage = useCallback((numerator, denominator, defaultValue = '0') => {
    if (!numerator || !denominator || denominator === 0) {
      return `${defaultValue}%`;
    }
    return `${(numerator / denominator * 100).toFixed(1)}%`;
  }, []);

  const safeAverage = useCallback((total, count) => {
    if (!total || !count || count === 0) {
      return 0;
    }
    return total / count;
  }, []);

  const formatDateSafe = useCallback((date) => {
    try {
      if (!date) return 'Date not available';
      return new Date(date).toLocaleDateString('en-IN', {
        weekday: 'short',
        year: 'numeric', 
        month: 'short', 
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  }, []);

  const hasData = useCallback((data) => {
    return data && Object.keys(data).length > 0;
  }, []);

  const getEmptyStateMessage = useCallback((type) => {
    const messages = {
      expenses: 'No expenses recorded for this month',
      payments: 'No payments received this month', 
      employees: 'No active employees found',
      advances: 'No advances paid this month',
      categories: 'No expense categories available'
    };
    return messages[type] || 'No data available';
  }, []);

  // Loading and Error State Components - memoized to prevent re-renders
  const LoadingSpinner = React.memo(({ message = 'Loading...', size = 40 }) => (
    <div className={styles.loadingContainer}>
      <CustomSpinner size={size} color="#059669" />
      <p className={styles.loadingMessage}>{message}</p>
    </div>
  ));
  


  const ErrorState = React.memo(({ message = 'Something went wrong', onRetry }) => (
    <div className={styles.errorState}>
      <FaExclamationTriangle className={styles.errorIcon} />
      <h3>Error</h3>
      <p>{message}</p>
      {onRetry && (
        <button className={styles.retryButton} onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  ));

  // eslint-disable-next-line no-unused-vars
  const EmptyState = ({ icon: IconComponent = FaInfoCircle, title, message, actionLabel, onAction }) => (
    <div className={styles.emptyState}>
      <IconComponent className={styles.emptyIcon} />
      <h3>{title}</h3>
      <p>{message}</p>
      {onAction && (
        <button className={styles.emptyActionButton} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );

  // Enhanced Modal Wrapper with accessibility improvements
  const ModalWrapper = ({ isOpen, onClose, children, className = '' }) => {
    // Focus trapping
    useEffect(() => {
      if (isOpen) {
        // Set focus on modal when opened
        const modal = document.querySelector('.modal-content');
        if (modal) modal.focus();
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Handle ESC key
        const handleEsc = (e) => {
          if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEsc);
        
        return () => {
          document.body.style.overflow = 'unset';
          document.removeEventListener('keydown', handleEsc);
        };
      }
    }, [isOpen, onClose]);
    
    if (!isOpen) return null;

    return (
      <div 
        className={styles.modalOverlay} 
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div 
          className={`${styles.modalContent} ${className} modal-content`} 
          onClick={(e) => e.stopPropagation()}
          tabIndex="-1"
        >
          {children}
        </div>
      </div>
    );
  };

  const TotalCostsModal = ({ isOpen, onClose }) => {
    const totalCosts = expenseData.summary?.totalCosts || 0;
    const wages = expenseData.summary?.wages || 0;
    const expenses = expenseData.summary?.expenses || 0;
    const employeeCount = expenseData.breakdown?.employeeCount || 0;
    const categoryCount = expenseData.breakdown?.siteExpenses?.categoryBreakdown?.length || 0;
    const topCategory = expenseData.breakdown?.siteExpenses?.categoryBreakdown?.[0]?._id || null;
    
    return (
      <ModalWrapper isOpen={isOpen} onClose={onClose} className={styles.costsModal} title="Monthly Costs Breakdown">
        <div className={styles.modalHeader}>
          <h2 id="modal-title" className={styles.modalTitle}>📊 Monthly Costs Breakdown</h2>
          <button 
            className={styles.modalCloseButton} 
            onClick={onClose}
            aria-label="Close modal"
            title="Close"
          >
            ✕
          </button>
        </div>
        <div className={styles.modalBody}>
          {!hasData(expenseData.summary) ? (
            <EmptyState 
              icon={FaChartLine}
              title="No Cost Data"
              message={getEmptyStateMessage('expenses')}
            />
          ) : (
            <>
              <div className={styles.costsBreakdown}>
                <div className={styles.costCard} tabIndex="0">
                  <div className={styles.costIcon} aria-hidden="true">👷</div>
                  <h3>Calculated Labour Payments</h3>
                  <div className={styles.costAmount}>{formatCurrency(wages)}</div>
                  <div className={styles.costPercentage}>
                    {safePercentage(wages, totalCosts)} of total costs
                  </div>
                  <div className={styles.costDetails}>
                    <p>Monthly wages for {employeeCount} {employeeCount === 1 ? 'employee' : 'employees'}</p>
                    <p>Average per employee: {formatCurrency(safeAverage(wages, employeeCount))}</p>
                    {employeeCount === 0 && (
                      <div className={styles.warningNote}>
                        <FaExclamationTriangle className={styles.warningIcon} />
                        No employees with calculated wages
                      </div>
                    )}
                  </div>
                  <button 
                    className={styles.drillDownBtn} 
                    onClick={() => { onClose(); setShowPayrollModal(true); }}
                    disabled={employeeCount === 0}
                    aria-label="View detailed employee list"
                  >
                    View Employee List →
                  </button>
                </div>

                <div className={styles.costCard} tabIndex="0">
                  <div className={styles.costIcon} aria-hidden="true">🏗️</div>
                  <h3>Site Expenses</h3>
                  <div className={styles.costAmount}>{formatCurrency(expenses)}</div>
                  <div className={styles.costPercentage}>
                    {safePercentage(expenses, totalCosts)} of total costs
                  </div>
                  <div className={styles.costDetails}>
                    <p>{categoryCount} expense {categoryCount === 1 ? 'category' : 'categories'}</p>
                    <p>Highest: {topCategory || 'No categories available'}</p>
                    {expenses === 0 && (
                      <div className={styles.infoNote}>
                        <FaInfoCircle className={styles.infoIcon} />
                        No expenses recorded this month
                      </div>
                    )}
                  </div>
                  <button 
                    className={styles.drillDownBtn} 
                    onClick={() => { onClose(); setShowSiteExpensesModal(true); }}
                    disabled={categoryCount === 0}
                    aria-label="View detailed expenses breakdown"
                  >
                    View All Expenses →
                  </button>
                </div>
              </div>
              
              <div className={styles.totalSummary}>
                <h3>Total Monthly Costs</h3>
                <div className={styles.totalAmount}>{formatCurrency(totalCosts)}</div>
                <div className={styles.costFormula}>
                  Labour Payments ({formatCurrency(wages)}) + 
                  Site Expenses ({formatCurrency(expenses)}) = 
                  Total Costs ({formatCurrency(totalCosts)})
                </div>
                <div className={styles.profitCalculation}>
                  Payments Received: {formatCurrency(expenseData.summary?.payments || 0)} - 
                  Total Costs: {formatCurrency(totalCosts)} = 
                  <span className={(expenseData.summary?.finalProfit || 0) >= 0 ? styles.profit : styles.loss}>
                    {formatCurrency(Math.abs(expenseData.summary?.finalProfit || 0))} 
                    {(expenseData.summary?.finalProfit || 0) >= 0 ? 'Net Profit' : 'Net Loss'}
                  </span>
                  <span className={styles.marginInfo}>
                    (Margin: {safePercentage(Math.abs(expenseData.summary?.finalProfit || 0), expenseData.summary?.payments || 0, 'N/A')})
                  </span>
                </div>
                <div className={styles.advanceNote} role="note">
                  <FaInfoCircle className={styles.noteIcon} />
                  <span>
                    <strong>Note:</strong> Advances paid ({formatCurrency(expenseData.summary?.advances || 0)}) 
                    are pre-payments to employees and not included in monthly costs. 
                    <button 
                      className={styles.infoButton}
                      onClick={() => { onClose(); setShowAdvancesModal(true); }}
                      title="View advances details"
                    >
                      View Details
                    </button>
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </ModalWrapper>
    );
  };

  const PaymentsModal = ({ isOpen, onClose }) => {
    const payments = expenseData.breakdown?.recentPayments || [];
    const totalPayments = expenseData.summary?.payments || 0;
    
    return (
      <ModalWrapper isOpen={isOpen} onClose={onClose} className={styles.paymentsModal} title="Payments Received">
        <div className={styles.modalHeader}>
          <h2 id="modal-title" className={styles.modalTitle}>💰 Payments Received</h2>
          <div className={styles.modalStats}>
            Total Received: {formatCurrency(totalPayments)} 
            ({payments.length} {payments.length === 1 ? 'transaction' : 'transactions'})
          </div>
          <button 
            className={styles.modalCloseButton} 
            onClick={onClose}
            aria-label="Close modal"
            title="Close"
          >
            ✕
          </button>
        </div>
        <div className={styles.modalBody}>
          {payments.length === 0 ? (
            <EmptyState 
              icon={FaMoneyBillWave}
              title="No Payments Received"
              message={getEmptyStateMessage('payments')}
              actionLabel="Add Payment"
              onAction={() => {
                onClose();
                setShowAddPaymentModal(true);
              }}
            />
          ) : (
            <div className={styles.paymentsList} role="list">
              {payments.map((payment, index) => (
                <div 
                  key={payment._id || index} 
                  className={styles.paymentCard}
                  role="listitem"
                  tabIndex="0"
                >
                  <div className={styles.paymentHeader}>
                    <div className={styles.paymentAmount}>
                      {formatCurrency(payment.value || 0)}
                    </div>
                    <div className={styles.headerActions}>
                      <div className={styles.paymentDate}>
                        {formatDateSafe(payment.date)}
                      </div>
                      {payment._id && (
                        <button 
                          className={`${styles.deleteButtonSmall} ${deletingItems.has(payment._id) ? styles.deleting : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePayment(payment._id, payment);
                          }}
                          title="Delete payment"
                          aria-label="Delete payment"
                          disabled={deletingItems.has(payment._id)}
                        >
                          {deletingItems.has(payment._id) ? (
                            <FaSpinner className={styles.spinner} />
                          ) : (
                            <HiOutlineTrash />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={styles.paymentBody}>
                    <div className={styles.paymentRemark}>
                      {payment.remark || 'No description provided'}
                    </div>
                    <div className={styles.paymentMeta}>
                      <span>Received by: {payment.receivedBy || 'Unknown'}</span>
                      {payment._id && (
                        <span className={styles.paymentId} title="Payment ID">
                          ID: {payment._id}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Summary footer when payments exist */}
          {payments.length > 0 && (
            <div className={styles.paymentsSummary}>
              <div className={styles.summaryItem}>
                <span>Average Payment:</span>
                <span>{formatCurrency(safeAverage(totalPayments, payments.length))}</span>
              </div>
              <div className={styles.summaryItem}>
                <span>Latest Payment:</span>
                <span>{payments.length > 0 ? formatDateSafe(payments[0]?.date) : 'N/A'}</span>
              </div>
            </div>
          )}
        </div>
      </ModalWrapper>
    );
  };

  const AdvancesModal = ({ isOpen, onClose }) => {
    const [expandedEmployees, setExpandedEmployees] = useState({});
    
    const employeesWithAdvances = expenseData.breakdown?.employeeBreakdown
      ?.filter(emp => emp.totalAdvances > 0) || [];
    const totalAdvances = expenseData.summary?.advances || 0;
    
    const toggleExpanded = (empId) => {
      setExpandedEmployees(prev => ({
        ...prev,
        [empId]: !prev[empId]
      }));
    };
    
    // Handle keyboard navigation for expand/collapse
    const handleKeyDown = (e, empId) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleExpanded(empId);
      }
    };
    
    return (
      <ModalWrapper isOpen={isOpen} onClose={onClose} className={styles.advancesModal} title="Employee Advances">
        <div className={styles.modalHeader}>
          <h2 id="modal-title" className={styles.modalTitle}>
            💸 Employee Advances
            <span className={styles.advanceDisclaimer} title="Advances are not included in monthly cost calculations">
              (Not in Monthly Costs)
            </span>
          </h2>
          <div className={styles.modalStats}>
            Total Advances Paid: {formatCurrency(totalAdvances)}
            {employeesWithAdvances.length > 0 && (
              <span className={styles.employeeCount}>
                • {employeesWithAdvances.length} {employeesWithAdvances.length === 1 ? 'employee' : 'employees'}
              </span>
            )}
          </div>
          <button 
            className={styles.modalCloseButton} 
            onClick={onClose}
            aria-label="Close modal"
            title="Close"
          >
            ✕
          </button>
        </div>
        <div className={styles.modalBody}>
          {employeesWithAdvances.length === 0 ? (
            <EmptyState 
              icon={FaWallet}
              title="No Advances Paid"
              message={getEmptyStateMessage('advances')}
            />
          ) : (
            <>
              <div className={styles.advanceExplanation} role="note">
                <FaInfoCircle className={styles.infoIcon} />
                <span>
                  Advances are pre-payments made to employees and are deducted from their final wages. 
                  They do not affect monthly cost calculations.
                </span>
              </div>
              
              <div className={styles.simpleList} role="list">
                {employeesWithAdvances.map((employee, index) => {
                  const isExpanded = expandedEmployees[employee.empid];
                  const payouts = employee.payouts || [];
                  
                  return (
                    <div 
                      key={employee.empid || index} 
                      className={styles.advanceItemContainer}
                      role="listitem"
                    >
                      <div 
                        className={styles.advanceMainRow} 
                        onClick={() => toggleExpanded(employee.empid)}
                        onKeyDown={(e) => handleKeyDown(e, employee.empid)}
                        tabIndex="0"
                        role="button"
                        aria-expanded={isExpanded}
                        aria-label={`Toggle ${employee.name} advance details`}
                      >
                        <div className={styles.employeeBasicInfo}>
                          <span className={styles.employeeName}>
                            {employee.name || 'Unknown Employee'}
                          </span>
                          <span className={styles.employeeId}>
                            ID: {employee.empid || 'N/A'}
                          </span>
                        </div>
                        <div className={styles.advanceAmount}>
                          {formatCurrency(employee.totalAdvances || 0)}
                          <button 
                            className={styles.expandButton}
                            aria-hidden="true"
                            tabIndex="-1"
                          >
                            {isExpanded ? '▲' : '▼'}
                          </button>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className={styles.advanceExpandedDetails}>
                          {payouts.length === 0 ? (
                            <div className={styles.noPayouts}>
                              <FaExclamationTriangle className={styles.warningIcon} />
                              <span>No payout details available</span>
                            </div>
                          ) : (
                            payouts.map((payout, idx) => (
                              <div 
                                key={idx} 
                                className={styles.advanceDetailItem}
                                tabIndex="0"
                              >
                                <span className={styles.payoutAmount}>
                                  {formatCurrency(payout.value || 0)}
                                </span>
                                <span className={styles.payoutRemark}>
                                  {payout.remark || 'No description'}
                                </span>
                                <span className={styles.payoutDate}>
                                  {formatDateSafe(payout.date)}
                                </span>
                              </div>
                            ))
                          )}
                          
                          {payouts.length > 1 && (
                            <div className={styles.payoutSummary}>
                              <span>Total: {formatCurrency(employee.totalAdvances)}</span>
                              <span>{payouts.length} payments</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </ModalWrapper>
    );
  };

  const PayrollModal = ({ isOpen, onClose }) => (
    <ModalWrapper isOpen={isOpen} onClose={onClose} className={styles.payrollModal}>
      <div className={styles.modalHeader}>
        <h2 className={styles.modalTitle}>👷 Labour Payments This Month</h2>
        <div className={styles.modalStats}>
          Total Calculated Wages: {formatCurrency(expenseData.summary?.wages || 0)}
        </div>
        <button className={styles.modalCloseButton} onClick={onClose}>✕</button>
      </div>
      <div className={styles.modalBody}>
        <div className={styles.simpleList}>
          {expenseData.breakdown?.employeeBreakdown
            ?.filter(emp => emp.wage > 0)
            ?.map((employee, index) => (
            <div key={index} className={styles.simplePayrollItem}>
              <div className={styles.employeeBasicInfo}>
                <span className={styles.employeeName}>{employee.name}</span>
                <span className={styles.employeeId}>ID: {employee.empid}</span>
              </div>
              <div className={styles.wageAmount}>{formatCurrency(employee.wage)}</div>
            </div>
          ))}
          {!expenseData.breakdown?.employeeBreakdown?.some(emp => emp.wage > 0) && (
            <div className={styles.emptyState}>
              <p>No employees with calculated wages this month</p>
            </div>
          )}
        </div>
      </div>
    </ModalWrapper>
  );

  const SiteExpensesModal = ({ isOpen, onClose }) => (
    <ModalWrapper isOpen={isOpen} onClose={onClose} className={styles.siteExpensesModal}>
      <div className={styles.modalHeader}>
        <h2 className={styles.modalTitle}>🏗️ Site Operating Expenses</h2>
        <div className={styles.modalStats}>
          Total Expenses: {formatCurrency(expenseData.summary?.expenses || 0)} • 
          {expenseData.breakdown?.siteExpenses?.categoryBreakdown?.length || 0} categories
        </div>
        <button className={styles.modalCloseButton} onClick={onClose}>✕</button>
      </div>
      <div className={styles.modalBody}>
        <div className={styles.categoriesGrid}>
          {expenseData.breakdown?.siteExpenses?.categoryBreakdown?.map((category, index) => (
            <div key={index} className={styles.categoryCard}>
              <div className={styles.categoryHeader}>
                <h4>{category._id}</h4>
                <div className={styles.categoryAmount}>{formatCurrency(category.total)}</div>
              </div>
              <div className={styles.categoryStats}>
                <span>{category.count} item(s)</span>
                <span>{(category.total / (expenseData.summary?.expenses || 1) * 100).toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.expenseDetails}>
          <h3>Individual Expenses</h3>
          <div className={styles.expensesList}>
            {expenseData.breakdown?.siteExpenses?.expenseDetails?.map((expense, index) => (
              <div key={expense._id || index} className={styles.expenseCard}>
                <div className={styles.expenseHeader}>
                  <div className={styles.expenseCategory}>{expense.category}</div>
                  <div className={styles.expenseHeaderActions}>
                    <div className={styles.expenseAmount}>{formatCurrency(expense.value)}</div>
                    {expense._id && (
                      <button 
                        className={`${styles.deleteButtonSmall} ${deletingItems.has(expense._id) ? styles.deleting : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteExpense(expense._id, expense);
                        }}
                        title="Delete expense"
                        aria-label="Delete expense"
                        disabled={deletingItems.has(expense._id)}
                      >
                        {deletingItems.has(expense._id) ? (
                          <FaSpinner className={styles.spinner} />
                        ) : (
                          <HiOutlineTrash />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <div className={styles.expenseBody}>
                  <div className={styles.expenseRemark}>{expense.remark || 'No description'}</div>
                  <div className={styles.expenseMeta}>
                    <span>By: {expense.createdBy || 'Unknown'}</span>
                    <span>{formatDateSafe(expense.date)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalWrapper>
  );

  const EmployeesModal = ({ isOpen, onClose }) => (
    <ModalWrapper isOpen={isOpen} onClose={onClose} className={styles.employeesModal}>
      <div className={styles.modalHeader}>
        <h2 className={styles.modalTitle}>👥 Employee Directory</h2>
        <div className={styles.modalStats}>
          {expenseData.breakdown?.employeeCount || 0} active employees
        </div>
        <button className={styles.modalCloseButton} onClick={onClose}>✕</button>
      </div>
      <div className={styles.modalBody}>
        <div className={styles.employeesGrid}>
          {expenseData.breakdown?.employeeBreakdown?.map((employee, index) => (
            <div key={index} className={styles.employeeCard}>
              <div className={styles.employeeHeader}>
                <div className={styles.employeeInfo}>
                  <div className={styles.employeeName}>{employee.name}</div>
                  <div className={styles.employeeId}>ID: {employee.empid}</div>
                </div>
                <div className={styles.employeeStatus}>
                  {employee.totalAdvances > 0 ? (
                    <span className={styles.hasAdvances}>Has Advances</span>
                  ) : (
                    <span className={styles.noAdvances}>Clear</span>
                  )}
                </div>
              </div>
              <div className={styles.employeeMetrics}>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Daily Rate</span>
                  <span className={styles.metricValue}>₹{employee.rate}</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>This Month</span>
                  <span className={styles.metricValue}>{formatCurrency(employee.wage)}</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Balance</span>
                  <span className={`${styles.metricValue} ${employee.closing_balance < 0 ? styles.negative : styles.positive}`}>
                    {formatCurrency(employee.closing_balance)}
                  </span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Attendance</span>
                  <span className={styles.metricValue}>{employee.totalAttendance} days</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ModalWrapper>
  );

  // Add Expense Modal Component
  const AddExpenseModal = ({ isOpen, onClose }) => {
    const [expenseForm, setExpenseForm] = useState({
      value: '',
      category: '',
      remark: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [formErrors, setFormErrors] = useState({});

    // Reset form when modal opens/closes
    useEffect(() => {
      if (isOpen) {
        setExpenseForm({
          value: '',
          category: '',
          remark: ''
        });
        setFormErrors({});
      }
    }, [isOpen]);

    // Validation functions
    const validateForm = () => {
      const errors = {};
      
      if (!expenseForm.value || expenseForm.value <= 0) {
        errors.value = 'Amount must be greater than 0';
      } else if (parseFloat(expenseForm.value) > 10000000) { // 1 crore limit
        errors.value = 'Amount seems unusually large. Please verify.';
      }
      
      if (!expenseForm.category) {
        errors.category = 'Please select a category';
      }
      
      setFormErrors(errors);
      return Object.keys(errors).length === 0;
    };

    const handleExpenseSubmit = async (e) => {
      e.preventDefault();
      
      if (!validateForm()) {
        showError('Please fix the form errors before submitting');
        return;
      }

      try {
        setSubmitting(true);
        
        // Automatically use current day within the selected month/year
        const today = new Date();
        const currentDay = today.getDate();
        
        // If current day doesn't exist in selected month (e.g., 31st in Feb), use last day
        const lastDayOfSelectedMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        const dayToUse = Math.min(currentDay, lastDayOfSelectedMonth);
        
        // Format the date for the API (YYYY-MM-DD)
        const autoDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(dayToUse).padStart(2, '0')}`;
        
        const response = await api.post('/api/financials/expenses', {
          siteID,
          value: parseFloat(expenseForm.value),
          category: expenseForm.category,
          date: autoDate,  // Use automatic date within selected month
          remark: expenseForm.remark.trim()
        });

        if (response?.success) {
          showSuccess(`Expense added successfully to ${monthNames[selectedMonth - 1]} ${selectedYear}`);
          setExpenseForm({
            value: '',
            category: '',
            remark: ''
          });
          setFormErrors({});
          onClose();
          fetchExpenseData(); // Refresh the data
        } else {
          const errorMessage = response?.error || response?.message || 'Failed to add expense';
          showError(errorMessage);
        }
      } catch (error) {
        console.error('Error adding expense:', error);
        const errorMessage = error.response?.data?.message || error.message || 'Network error. Please try again.';
        showError(errorMessage);
      } finally {
        setSubmitting(false);
      }
    };
    
    const handleInputChange = (field, value) => {
      setExpenseForm(prev => ({ ...prev, [field]: value }));
      // Clear error for this field when user starts typing
      if (formErrors[field]) {
        setFormErrors(prev => ({ ...prev, [field]: null }));
      }
    };

    return (
      <ModalWrapper isOpen={isOpen} onClose={onClose} className={styles.addModal} title="Add New Expense">
        <div className={styles.modalHeader}>
          <h2 id="modal-title" className={styles.modalTitle}>➡ Add New Expense</h2>
          <button 
            className={styles.modalCloseButton} 
            onClick={onClose}
            aria-label="Close modal"
            disabled={submitting}
          >
            ✕
          </button>
        </div>
        
        {/* Month indicator to show where expense will be added */}
        <div className={styles.monthIndicator}>
          <FaInfoCircle className={styles.infoIcon} />
          <span>
            Expense will be recorded in <strong>{monthNames[selectedMonth - 1]} {selectedYear}</strong> with today's date
          </span>
        </div>
        
        {submitting && (
          <div className={styles.submittingOverlay}>
            <LoadingSpinner message="Adding expense..." />
          </div>
        )}
        
        <form onSubmit={handleExpenseSubmit} className={styles.modalBody} noValidate>
          <div className={styles.formGroup}>
            <label htmlFor="expense-amount" className={styles.formLabel}>
              Amount *
            </label>
            <input
              id="expense-amount"
              type="number"
              className={`${styles.formInput} ${formErrors.value ? styles.inputError : ''}`}
              value={expenseForm.value}
              onChange={(e) => handleInputChange('value', e.target.value)}
              placeholder="Enter amount (e.g., 1500.00)"
              step="0.01"
              min="0.01"
              max="10000000"
              required
              disabled={submitting}
              aria-describedby={formErrors.value ? 'amount-error' : undefined}
            />
            {formErrors.value && (
              <div id="amount-error" className={styles.fieldError} role="alert">
                <FaExclamationTriangle /> {formErrors.value}
              </div>
            )}
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Category *
            </label>
            <div 
              className={styles.categorySelector}
              role="radiogroup"
              aria-labelledby="category-label"
              aria-describedby={formErrors.category ? 'category-error' : undefined}
            >
              {expenseCategories.map((category) => {
                const Icon = category.icon;
                const isSelected = expenseForm.category === category.name;
                return (
                  <div
                    key={category.name}
                    className={`${styles.categoryOption} ${isSelected ? styles.categorySelected : ''} ${
                      formErrors.category ? styles.categoryError : ''
                    }`}
                    onClick={() => !submitting && handleInputChange('category', category.name)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !submitting) {
                        e.preventDefault();
                        handleInputChange('category', category.name);
                      }
                    }}
                    tabIndex={submitting ? -1 : 0}
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`Select ${category.name} category`}
                    style={{
                      borderColor: isSelected ? category.color : (formErrors.category ? '#EF4444' : 'transparent'),
                      backgroundColor: isSelected ? category.bgColor : 'transparent',
                      opacity: submitting ? 0.6 : 1,
                      cursor: submitting ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Icon 
                      className={styles.categoryIcon} 
                      style={{ color: isSelected ? category.color : '#6B7280' }}
                      aria-hidden="true"
                    />
                    <span className={styles.categoryName}>{category.name}</span>
                  </div>
                );
              })}
            </div>
            {formErrors.category && (
              <div id="category-error" className={styles.fieldError} role="alert">
                <FaExclamationTriangle /> {formErrors.category}
              </div>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="expense-remark" className={styles.formLabel}>
              Description
            </label>
            <textarea
              id="expense-remark"
              className={styles.formTextarea}
              value={expenseForm.remark}
              onChange={(e) => handleInputChange('remark', e.target.value)}
              placeholder="Enter additional details (optional)"
              rows="3"
              maxLength="500"
              disabled={submitting}
            />
            <div className={styles.charCount}>
              {expenseForm.remark.length}/500 characters
            </div>
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`${styles.submitButton} ${submitting ? styles.submitting : ''}`}
              disabled={submitting}
              aria-describedby="submit-status"
            >
              {submitting ? (
                <>
                  <LoadingSpinner size={16} />
                  Adding...
                </>
              ) : (
                <>
                  <FaPlus /> Add Expense
                </>
              )}
            </button>
          </div>
          
          <div id="submit-status" className={styles.submitStatus} aria-live="polite" aria-atomic="true">
            {submitting && 'Adding expense, please wait...'}
          </div>
        </form>
      </ModalWrapper>
    );
  };

  // Add Payment Modal Component
  const AddPaymentModal = ({ isOpen, onClose }) => {
    const [paymentForm, setPaymentForm] = useState({
      value: '',
      remark: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [formErrors, setFormErrors] = useState({});

    // Reset form when modal opens/closes
    useEffect(() => {
      if (isOpen) {
        setPaymentForm({
          value: '',
          remark: ''
        });
        setFormErrors({});
      }
    }, [isOpen]);

    // Validation functions
    const validateForm = () => {
      const errors = {};
      
      if (!paymentForm.value || paymentForm.value <= 0) {
        errors.value = 'Amount must be greater than 0';
      } else if (parseFloat(paymentForm.value) > 100000000) { // 10 crore limit
        errors.value = 'Amount seems unusually large. Please verify.';
      }
      
      setFormErrors(errors);
      return Object.keys(errors).length === 0;
    };

    const handleInputChange = (field, value) => {
      setPaymentForm(prev => ({ ...prev, [field]: value }));
      // Clear error for this field when user starts typing
      if (formErrors[field]) {
        setFormErrors(prev => ({ ...prev, [field]: null }));
      }
    };

    const handlePaymentSubmit = async (e) => {
      e.preventDefault();
      
      if (!validateForm()) {
        showError('Please fix the form errors before submitting');
        return;
      }

      try {
        setSubmitting(true);
        
        // Automatically use current day within the selected month/year
        const today = new Date();
        const currentDay = today.getDate();
        
        // If current day doesn't exist in selected month (e.g., 31st in Feb), use last day
        const lastDayOfSelectedMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        const dayToUse = Math.min(currentDay, lastDayOfSelectedMonth);
        
        // Format the date for the API (YYYY-MM-DD)
        const autoDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(dayToUse).padStart(2, '0')}`;
        
        const response = await api.post('/api/financials/payments', {
          siteID,
          value: parseFloat(paymentForm.value),
          date: autoDate,  // Use automatic date within selected month
          remark: paymentForm.remark.trim()
        });

        if (response?.success) {
          showSuccess(`Payment added successfully to ${monthNames[selectedMonth - 1]} ${selectedYear}`);
          setPaymentForm({
            value: '',
            remark: ''
          });
          setFormErrors({});
          onClose();
          fetchExpenseData(); // Refresh the data
        } else {
          const errorMessage = response?.error || response?.message || 'Failed to add payment';
          showError(errorMessage);
        }
      } catch (error) {
        console.error('Error adding payment:', error);
        const errorMessage = error.response?.data?.message || error.message || 'Network error. Please try again.';
        showError(errorMessage);
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <ModalWrapper isOpen={isOpen} onClose={onClose} className={styles.addModal} title="Add New Payment">
        <div className={styles.modalHeader}>
          <h2 id="modal-title" className={styles.modalTitle}>
            💰 Add New Payment
          </h2>
          <button 
            className={styles.modalCloseButton} 
            onClick={onClose}
            aria-label="Close modal"
            disabled={submitting}
          >
            ✕
          </button>
        </div>
        
        {/* Month indicator to show where payment will be added */}
        <div className={styles.monthIndicator}>
          <FaInfoCircle className={styles.infoIcon} />
          <span>
            Payment will be recorded in <strong>{monthNames[selectedMonth - 1]} {selectedYear}</strong> with today's date
          </span>
        </div>
        
        {submitting && (
          <div className={styles.submittingOverlay}>
            <LoadingSpinner message="Adding payment..." />
          </div>
        )}
        
        <form onSubmit={handlePaymentSubmit} className={styles.modalBody} noValidate>
          <div className={styles.formGroup}>
            <label htmlFor="payment-amount" className={styles.formLabel}>
              Amount *
            </label>
            <input
              id="payment-amount"
              type="number"
              className={`${styles.formInput} ${formErrors.value ? styles.inputError : ''}`}
              value={paymentForm.value}
              onChange={(e) => handleInputChange('value', e.target.value)}
              placeholder="Enter amount received (e.g., 50000.00)"
              step="0.01"
              min="0.01"
              max="100000000"
              required
              disabled={submitting}
              aria-describedby={formErrors.value ? 'amount-error' : undefined}
            />
            {formErrors.value && (
              <div id="amount-error" className={styles.fieldError} role="alert">
                <FaExclamationTriangle /> {formErrors.value}
              </div>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="payment-remark" className={styles.formLabel}>
              Description / Reference
            </label>
            <textarea
              id="payment-remark"
              className={styles.formTextarea}
              value={paymentForm.remark}
              onChange={(e) => handleInputChange('remark', e.target.value)}
              placeholder="Enter payment details, invoice number, or reference (optional)"
              rows="3"
              maxLength="500"
              disabled={submitting}
            />
            <div className={styles.charCount}>
              {paymentForm.remark.length}/500 characters
            </div>
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`${styles.submitButton} ${submitting ? styles.submitting : ''}`}
              disabled={submitting}
              aria-describedby="submit-status"
            >
              {submitting ? (
                <>
                  <LoadingSpinner size={16} />
                  Adding...
                </>
              ) : (
                <>
                  <FaPlus /> Add Payment
                </>
              )}
            </button>
          </div>
          
          <div id="submit-status" className={styles.submitStatus} aria-live="polite" aria-atomic="true">
            {submitting && 'Adding payment, please wait...'}
          </div>
        </form>
      </ModalWrapper>
    );
  };

  // Category Modal Component - Modern design for category-wise expense viewing
  const CategoryModal = ({ isOpen, onClose }) => {
    const categoryData = selectedCategory ? 
      expenseData.breakdown?.siteExpenses?.categoryBreakdown?.find(cat => cat._id === selectedCategory) : null;
    const categoryExpenses = selectedCategory ? 
      expenseData.breakdown?.siteExpenses?.expenseDetails?.filter(exp => exp.category === selectedCategory) : [];
    const categoryDetails = getCategoryDetails(selectedCategory);
    const CategoryIcon = categoryDetails?.icon || FaReceipt;

    return (
      <ModalWrapper isOpen={isOpen} onClose={onClose} className={styles.categoryModal}>
        <div className={styles.modalHeader} style={{ borderLeft: `4px solid ${categoryDetails?.color}` }}>
          <div className={styles.categoryModalTitle}>
            <div className={styles.categoryIconWrapper} style={{ backgroundColor: categoryDetails?.bgColor }}>
              <CategoryIcon style={{ color: categoryDetails?.color }} />
            </div>
            <div>
              <h2 className={styles.modalTitle}>{selectedCategory} Expenses</h2>
              <div className={styles.modalSubtitle}>
                {categoryExpenses.length} transaction{categoryExpenses.length !== 1 ? 's' : ''} • 
                Total: {formatCurrency(categoryData?.total || 0)}
              </div>
            </div>
          </div>
          <button className={styles.modalCloseButton} onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.categoryStats}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Total Amount</div>
              <div className={styles.statValue} style={{ color: categoryDetails?.color }}>
                {formatCurrency(categoryData?.total || 0)}
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Transactions</div>
              <div className={styles.statValue}>{categoryExpenses.length}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Average</div>
              <div className={styles.statValue}>
                {formatCurrency((categoryData?.total || 0) / (categoryExpenses.length || 1))}
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>% of Total</div>
              <div className={styles.statValue}>
                {((categoryData?.total || 0) / (expenseData.summary?.expenses || 1) * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className={styles.expensesList}>
            <h3 className={styles.sectionTitle}>Transaction Details</h3>
            {categoryExpenses.length === 0 ? (
              <div className={styles.emptyState}>
                <CategoryIcon className={styles.emptyIcon} />
                <p>No expenses in this category</p>
              </div>
            ) : (
              <div className={styles.transactionsList}>
                {categoryExpenses.map((expense, index) => (
                  <div key={expense._id || index} className={styles.transactionCard}>
                    <div className={styles.transactionHeader}>
                      <div className={styles.transactionAmount}>
                        {formatCurrency(expense.value)}
                      </div>
                      <div className={styles.transactionActions}>
                        <div className={styles.transactionDate}>
                          {formatDateSafe(expense.date)}
                        </div>
                        {expense._id && (
                          <button 
                            className={`${styles.deleteButtonSmall} ${deletingItems.has(expense._id) ? styles.deleting : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteExpense(expense._id, expense);
                            }}
                            title="Delete expense"
                            aria-label="Delete expense"
                            disabled={deletingItems.has(expense._id)}
                          >
                            {deletingItems.has(expense._id) ? (
                              <FaSpinner className={styles.spinner} />
                            ) : (
                              <HiOutlineTrash />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={styles.transactionBody}>
                      <div className={styles.transactionRemark}>
                        {expense.remark || 'No description provided'}
                      </div>
                      <div className={styles.transactionMeta}>
                        <span>Added by: {expense.createdBy || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ModalWrapper>
    );
  };

  const ActivityModal = ({ isOpen, onClose }) => (
    <ModalWrapper isOpen={isOpen} onClose={onClose} className={styles.activityModal}>
      <div className={styles.modalHeader}>
        <h2 className={styles.modalTitle}>📈 Recent Activity</h2>
        <div className={styles.modalStats}>
          {(expenseData.breakdown?.recentPayments?.length || 0) + 
           (expenseData.breakdown?.siteExpenses?.expenseDetails?.length || 0)} transactions
        </div>
        <button className={styles.modalCloseButton} onClick={onClose}>✕</button>
      </div>
      <div className={styles.modalBody}>
        <div className={styles.activityTimeline}>
          <div className={styles.activitySection}>
            <h3>💰 Recent Payments</h3>
            {expenseData.breakdown?.recentPayments?.map((payment, index) => (
              <div key={index} className={styles.activityItem}>
                <div className={styles.activityIcon}>💰</div>
                <div className={styles.activityContent}>
                  <div className={styles.activityTitle}>Payment Received</div>
                  <div className={styles.activityAmount}>+{formatCurrency(payment.value)}</div>
                  <div className={styles.activityDescription}>{payment.remark}</div>
                  <div className={styles.activityMeta}>
                    Received by {payment.receivedBy} • {new Date(payment.date).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className={styles.activitySection}>
            <h3>🏗️ Recent Expenses</h3>
            {expenseData.breakdown?.siteExpenses?.expenseDetails?.map((expense, index) => (
              <div key={index} className={styles.activityItem}>
                <div className={styles.activityIcon}>🏗️</div>
                <div className={styles.activityContent}>
                  <div className={styles.activityTitle}>{expense.category}</div>
                  <div className={styles.activityAmount}>-{formatCurrency(expense.value)}</div>
                  <div className={styles.activityDescription}>{expense.remark}</div>
                  <div className={styles.activityMeta}>
                    Created by {expense.createdBy} • {new Date(expense.date).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalWrapper>
  );

  if (loading) {
    return (
      <div className={styles.SiteExpensesContainer}>
        <Sidebar activeSection="Site Expenses" />
        <div className={styles.container}>
          <div className={styles.headerUltraCompact}>
            <div className={styles.titleSection}>
              <h1 className={styles.titleCompact}>
                💰 Site Expenses - {formatSelectedMonthDisplay()}
              </h1>
            </div>
            <div className={styles.statsRowCompact}>
              <div className={styles.statItemCompact}>
                <span className={styles.statValueCompact}>0</span>
                <span className={styles.statLabelCompact}>Expenses</span>
              </div>
              <div className={styles.statItemCompact}>
                <span className={styles.statValueCompact}>₹0</span>
                <span className={styles.statLabelCompact}>Total</span>
              </div>
            </div>
          </div>
          
          <div className={styles.loadingSpinner}>
            <CustomSpinner size={70} color="#059669" />
            <p>Loading expense data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.SiteExpensesContainer}>
      <Sidebar activeSection="Site Expenses" />
      <div className={styles.scrollableContent}>
        <div className={styles.container}>
          <div className={styles.headerUltraCompact}>
            <div className={styles.titleSection}>
              <h1 className={styles.titleCompact}>
                💰 Site Expenses - {formatSelectedMonthDisplay()}
              </h1>
            </div>
            <div className={styles.statsRowCompact}>
              <div className={styles.statItemCompact}>
                <span className={styles.statValueCompact}>
                  {formatCurrency(expenseData?.summary?.payments || 0)}
                </span>
                <span className={styles.statLabelCompact}>Received</span>
              </div>
              <div className={styles.statItemCompact}>
                <span className={styles.statValueCompact}>
                  {formatCurrency(expenseData?.summary?.totalCosts || 0)}
                </span>
                <span className={styles.statLabelCompact}>Total Costs</span>
              </div>
              <div className={styles.statItemCompact}>
                <span className={styles.statValueCompact}>
                  {formatCurrency(Math.abs(expenseData?.summary?.finalProfit || 0))}
                </span>
                <span className={styles.statLabelCompact}>
                  {(expenseData?.summary?.finalProfit || 0) >= 0 ? 'Profit' : 'Loss'}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.controlsMini}>
          <div className={styles.actionButtons}>
            <button
              className={styles.addButton}
              onClick={() => setShowAddPaymentModal(true)}
              title="Add Payment"
            >
              <FaPlus /> Add Payment
            </button>
            <button
              className={styles.addButton}
              onClick={() => setShowAddExpenseModal(true)}
              title="Add Expense"
            >
              <FaPlus /> Add Expense
            </button>
          </div>
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
                <CustomSpinner size={40} color="#059669" />
              </div>
            )}
          </div>
          <div className={styles.searchBoxMini}>
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInputMini}
            />
            <span className={styles.searchIconMini}>🔍</span>
          </div>
          <div className={styles.resultCountMini}>
            {expenseData?.breakdown?.siteExpenses?.expenseDetails?.length || 0} items
          </div>
        </div>

        <div className={styles.contentArea}>
          <div className={styles.body}>
            {!hasData(expenseData?.summary) ? (
              <div className={styles.noResults}>
                <div className={styles.noResultsContent}>
                  <span className={styles.noResultsIcon}>📏</span>
                  <h3>No Financial Data Available</h3>
                  <p>No expenses or payments recorded for {formatSelectedMonthDisplay()}</p>
                  <div className={styles.quickActions}>
                    <button 
                      className={styles.quickActionButton}
                      onClick={() => setShowAddExpenseModal(true)}
                      title="Add your first expense"
                    >
                      <FaPlus /> Add Expense
                    </button>
                    <button 
                      className={styles.quickActionButton}
                      onClick={() => setShowAddPaymentModal(true)}
                      title="Record a payment received"
                    >
                      <FaPlus /> Add Payment
                    </button>
                  </div>
                  <div className={styles.helpText}>
                    <FaInfoCircle />
                    <span>Start by adding some expenses or recording payments to see your financial dashboard.</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.modernDashboard}>
                {/* Modern Hero Section with Key Metrics */}
                <div className={styles.heroContainer}>
                  <div className={`${styles.profitCard} ${(expenseData.summary?.finalProfit || 0) >= 0 ? styles.profit : styles.loss}`}>
                    <div className={styles.profitHeader}>
                      <div className={styles.profitLabel}>
                        {(expenseData.summary?.finalProfit || 0) >= 0 ? (
                          <><FaArrowUp className={styles.profitIcon} /> This Month's Profit</>
                        ) : (
                          <><FaArrowDown className={styles.lossIcon} /> This Month's Loss</>
                        )}
                      </div>
                    <div className={styles.profitBadge} title="Profit margin as percentage of total payments received">
                        {safePercentage(Math.abs(expenseData.summary?.finalProfit || 0), expenseData.summary?.payments || 0, 'N/A')} margin
                      </div>
                    </div>
                    <div className={styles.profitAmount}>
                      {formatCurrency(Math.abs(expenseData.summary?.finalProfit || 0))}
                    </div>
                    <div className={styles.profitFormula}>
                      <span className={styles.formulaItem}>
                        <FaArrowUp style={{ color: '#10B981' }} /> {formatCurrency(expenseData.summary?.payments || 0)}
                      </span>
                      <span className={styles.formulaOperator}>-</span>
                      <span className={styles.formulaItem}>
                        <FaArrowDown style={{ color: '#EF4444' }} /> {formatCurrency(expenseData.summary?.totalCosts || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Modern Overview Tabs */}
                <div className={styles.overviewTabs}>
                  <div className={styles.tabButtons}>
                    <button 
                      className={`${styles.tabButton} ${viewMode === 'overview' ? styles.active : ''}`}
                      onClick={() => setViewMode('overview')}
                    >
                      <FaChartPie /> Overview
                    </button>
                    <button 
                      className={`${styles.tabButton} ${viewMode === 'expenses' ? styles.active : ''}`}
                      onClick={() => setViewMode('expenses')}
                    >
                      <FaReceipt /> Expenses
                    </button>
                    <button 
                      className={`${styles.tabButton} ${viewMode === 'payments' ? styles.active : ''}`}
                      onClick={() => setViewMode('payments')}
                    >
                      <FaMoneyBillWave /> Payments
                    </button>
                    <button 
                      className={`${styles.tabButton} ${viewMode === 'employees' ? styles.active : ''}`}
                      onClick={() => setViewMode('employees')}
                    >
                      <FaUsers /> Employees
                    </button>
                  </div>
                </div>

                {/* Tab Content */}
                {viewMode === 'overview' && (
                  <div className={styles.overviewContent}>
                    {/* Summary Metrics Grid */}
                    <div className={styles.metricsGrid}>
                      <div className={styles.metricCard} onClick={() => setShowPaymentsModal(true)}>
                        <div className={styles.metricHeader}>
                          <FaMoneyBillWave className={styles.metricIcon} style={{ color: '#10B981' }} />
                          <span className={styles.metricLabel}>Payments Received</span>
                        </div>
                        <div className={styles.metricValue}>{formatCurrency(expenseData.summary?.payments || 0)}</div>
                        <div className={styles.metricFooter}>
                          <span className={styles.metricStat}>
                            {expenseData.breakdown?.recentPayments?.length || 0} transactions
                          </span>
                          <FaEye className={styles.viewIcon} />
                        </div>
                      </div>

                      <div className={styles.metricCard} onClick={() => setShowTotalCostsModal(true)}>
                        <div className={styles.metricHeader}>
                          <FaChartLine className={styles.metricIcon} style={{ color: '#EF4444' }} />
                          <span className={styles.metricLabel}>Total Costs</span>
                        </div>
                        <div className={styles.metricValue}>{formatCurrency(expenseData.summary?.totalCosts || 0)}</div>
                        <div className={styles.metricFooter}>
                          <span className={styles.metricStat}>
                            Wages + Expenses
                          </span>
                          <FaEye className={styles.viewIcon} />
                        </div>
                      </div>

                      <div className={styles.metricCard} onClick={() => setShowPayrollModal(true)}>
                        <div className={styles.metricHeader}>
                          <FaUsers className={styles.metricIcon} style={{ color: '#3B82F6' }} />
                          <span className={styles.metricLabel}>Calculated Labour Payments</span>
                        </div>
                        <div className={styles.metricValue}>{formatCurrency(expenseData.summary?.wages || 0)}</div>
                        <div className={styles.metricFooter}>
                          <span className={styles.metricStat}>
                            {expenseData.breakdown?.employeeCount || 0} employees this month
                          </span>
                          <FaEye className={styles.viewIcon} />
                        </div>
                      </div>

                      <div className={styles.metricCard} onClick={() => setShowSiteExpensesModal(true)}>
                        <div className={styles.metricHeader}>
                          <FaReceipt className={styles.metricIcon} style={{ color: '#F59E0B' }} />
                          <span className={styles.metricLabel}>Site Expenses</span>
                        </div>
                        <div className={styles.metricValue}>{formatCurrency(expenseData.summary?.expenses || 0)}</div>
                        <div className={styles.metricFooter}>
                          <span className={styles.metricStat}>
                            {expenseData.breakdown?.siteExpenses?.categoryBreakdown?.length || 0} categories
                          </span>
                          <FaEye className={styles.viewIcon} />
                        </div>
                      </div>

                      <div className={styles.metricCard} onClick={() => setShowAdvancesModal(true)}>
                        <div className={styles.metricHeader}>
                          <FaWallet className={styles.metricIcon} style={{ color: '#F59E0B' }} />
                          <span className={styles.metricLabel}>Advances Paid (Not in costs)</span>
                        </div>
                        <div className={styles.metricValue}>{formatCurrency(expenseData.summary?.advances || 0)}</div>
                        <div className={styles.metricFooter}>
                          <span className={styles.metricStat}>
                            Pre-payments to employees
                          </span>
                          <FaEye className={styles.viewIcon} />
                        </div>
                      </div>
                    </div>

                    {/* Category Breakdown */}
                    <div className={styles.categorySection}>
                      <h3 className={styles.sectionTitle}>
                        <FaChartPie /> Expense Categories
                      </h3>
                      <div className={styles.categoryGrid}>
                        {expenseData.breakdown?.siteExpenses?.categoryBreakdown?.map((category, index) => {
                          const categoryDetails = getCategoryDetails(category._id);
                          const Icon = categoryDetails?.icon || FaReceipt;
                          return (
                            <div 
                              key={index} 
                              className={styles.categoryCard}
                              onClick={() => {
                                setSelectedCategory(category._id);
                                setShowCategoryModal(true);
                              }}
                              style={{ borderLeft: `3px solid ${categoryDetails?.color}` }}
                            >
                              <div className={styles.categoryIcon} style={{ backgroundColor: categoryDetails?.bgColor }}>
                                <Icon style={{ color: categoryDetails?.color }} />
                              </div>
                              <div className={styles.categoryContent}>
                                <div className={styles.categoryName}>{category._id}</div>
                                <div className={styles.categoryAmount}>{formatCurrency(category.total)}</div>
                                <div className={styles.categoryMeta}>
                                  <span>{category.count} items</span>
                                  <span className={styles.categoryPercentage} title={`${category._id} represents ${safePercentage(category.total, expenseData.summary?.expenses || 0)} of total expenses`}>
                                    {safePercentage(category.total, expenseData.summary?.expenses || 0)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {(!expenseData.breakdown?.siteExpenses?.categoryBreakdown || 
                          expenseData.breakdown?.siteExpenses?.categoryBreakdown.length === 0) && (
                          <div className={styles.emptyCategory}>
                            <FaInfoCircle className={styles.emptyIcon} />
                            <p>No expense categories found</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Expenses Tab */}
                {viewMode === 'expenses' && (
                  <div className={styles.expensesContent}>
                    <div className={styles.contentHeader}>
                      <h3 className={styles.contentTitle}>Site Expenses</h3>
                      <div className={styles.filterGroup}>
                        <select 
                          className={styles.filterSelect}
                          value={filterCategory}
                          onChange={(e) => setFilterCategory(e.target.value)}
                        >
                          <option value="all">All Categories</option>
                          {expenseCategories.map(cat => (
                            <option key={cat.name} value={cat.name}>{cat.name}</option>
                          ))}
                      </select>
                      </div>
                    </div>
                    
                    <div className={styles.expensesGrid}>
                      {(() => {
                        const allExpenses = expenseData.breakdown?.siteExpenses?.expenseDetails || [];
                        const filteredExpenses = allExpenses.filter(expense => 
                          filterCategory === 'all' || expense.category === filterCategory
                        );
                        
                        if (allExpenses.length === 0) {
                          return (
                            <EmptyState 
                              icon={FaReceipt}
                              title="No Expenses"
                              message={getEmptyStateMessage('expenses')}
                              actionLabel="Add First Expense"
                              onAction={() => setShowAddExpenseModal(true)}
                            />
                          );
                        }
                        
                        if (filteredExpenses.length === 0) {
                          return (
                            <EmptyState 
                              icon={FaFilter}
                              title="No Matching Expenses"
                              message={`No expenses found in the "${filterCategory}" category`}
                              actionLabel="Clear Filter"
                              onAction={() => setFilterCategory('all')}
                            />
                          );
                        }
                        
                        return filteredExpenses.map((expense, index) => {
                          const categoryDetails = getCategoryDetails(expense.category);
                          const Icon = categoryDetails?.icon || FaReceipt;
                          return (
                            <div key={expense._id || index} className={styles.expenseCard} tabIndex="0">
                              <div className={styles.expenseHeader}>
                                <div className={styles.expenseCategory}>
                                  <div 
                                    className={styles.expenseCategoryIcon} 
                                    style={{ backgroundColor: categoryDetails?.bgColor }}
                                    title={`Category: ${expense.category}`}
                                  >
                                    <Icon style={{ color: categoryDetails?.color, fontSize: '14px' }} aria-hidden="true" />
                                  </div>
                                  <span>{expense.category || 'Uncategorized'}</span>
                                </div>
                                <div className={styles.expenseActions}>
                                  <div className={styles.expenseAmount}>
                                    {formatCurrency(expense.value || 0)}
                                  </div>
                                  {expense._id && (
                                    <button 
                                      className={`${styles.deleteButton} ${deletingItems.has(expense._id) ? styles.deleting : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteExpense(expense._id, expense);
                                      }}
                                      title="Delete expense"
                                      aria-label="Delete expense"
                                      disabled={deletingItems.has(expense._id)}
                                    >
                                      {deletingItems.has(expense._id) ? (
                                        <FaSpinner className={styles.spinner} />
                                      ) : (
                                        <HiOutlineTrash />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className={styles.expenseBody}>
                                <p className={styles.expenseDescription}>
                                  {expense.remark || 'No description provided'}
                                </p>
                                <div className={styles.expenseMeta}>
                                  <span title="Expense date">
                                    <FaCalendarAlt aria-hidden="true" /> {formatDateSafe(expense.date)}
                                  </span>
                                  <span title="Added by">
                                    By: {expense.createdBy || 'Unknown'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()
                      }
                    </div>
                  </div>
                )}

                {/* Payments Tab */}
                {viewMode === 'payments' && (
                  <div className={styles.paymentsContent}>
                    <div className={styles.contentHeader}>
                      <h3 className={styles.contentTitle}>Payment History</h3>
                    </div>
                    
                    <div className={styles.paymentsTimeline}>
                      {(() => {
                        const payments = expenseData.breakdown?.recentPayments || [];
                        
                        if (payments.length === 0) {
                          return (
                            <EmptyState 
                              icon={FaMoneyBillWave}
                              title="No Payments Received"
                              message={getEmptyStateMessage('payments')}
                              actionLabel="Add First Payment"
                              onAction={() => setShowAddPaymentModal(true)}
                            />
                          );
                        }
                        
                        return payments.map((payment, index) => (
                          <div key={payment._id || index} className={styles.timelineItem} tabIndex="0">
                            <div className={styles.timelineMarker} aria-hidden="true">
                              <FaCheckCircle style={{ color: '#10B981' }} />
                            </div>
                            <div className={styles.timelineContent}>
                              <div className={styles.paymentHeader}>
                                <div className={styles.paymentAmount}>
                                  +{formatCurrency(payment.value || 0)}
                                </div>
                                <div className={styles.paymentActions}>
                                  <div className={styles.paymentDate} title="Payment received date">
                                    {formatDateSafe(payment.date)}
                                  </div>
                                  {payment._id && (
                                    <button 
                                      className={`${styles.deleteButton} ${deletingItems.has(payment._id) ? styles.deleting : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeletePayment(payment._id, payment);
                                      }}
                                      title="Delete payment"
                                      aria-label="Delete payment"
                                      disabled={deletingItems.has(payment._id)}
                                    >
                                      {deletingItems.has(payment._id) ? (
                                        <FaSpinner className={styles.spinner} />
                                      ) : (
                                        <HiOutlineTrash />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className={styles.paymentDescription}>
                                {payment.remark || 'Payment received - no description provided'}
                              </div>
                              <div className={styles.paymentMeta}>
                                <span title="Received by">Received by: {payment.receivedBy || 'Unknown'}</span>
                                {payment._id && (
                                  <span className={styles.paymentId} title="Payment ID">
                                    ID: {payment._id}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ));
                      })()
                      }
                    </div>
                  </div>
                )}

                {/* Employees Tab */}
                {viewMode === 'employees' && (
                  <div className={styles.employeesContent}>
                    <div className={styles.contentHeader}>
                      <h3 className={styles.contentTitle}>Employee Overview</h3>
                      <div className={styles.employeeStats}>
                        <span>{expenseData.breakdown?.employeeCount || 0} Active Employees</span>
                        <span>Total Wages: {formatCurrency(expenseData.summary?.wages || 0)}</span>
                      </div>
                    </div>
                    
                    <div className={styles.employeesGrid}>
                      {(() => {
                        const employees = expenseData.breakdown?.employeeBreakdown || [];
                        
                        if (employees.length === 0) {
                          return (
                            <EmptyState 
                              icon={FaUsers}
                              title="No Employees Found"
                              message={getEmptyStateMessage('employees')}
                            />
                          );
                        }
                        
                        return employees.map((employee, index) => {
                          const hasAdvances = (employee.totalAdvances || 0) > 0;
                          const isNegativeBalance = (employee.closing_balance || 0) < 0;
                          
                          return (
                            <div 
                              key={employee.empid || index} 
                              className={styles.employeeCard}
                              tabIndex="0"
                              role="article"
                              aria-label={`Employee: ${employee.name || 'Unknown'}`}
                            >
                              <div className={styles.employeeHeader}>
                                <div className={styles.employeeInfo}>
                                  <h4 className={styles.employeeName}>
                                    {employee.name || 'Unknown Employee'}
                                  </h4>
                                  <span className={styles.employeeId}>
                                    ID: {employee.empid || 'N/A'}
                                  </span>
                                </div>
                                <div className={styles.employeeStatus}>
                                  {hasAdvances && (
                                    <span className={styles.advanceBadge} title="This employee has received advances">
                                      Has Advances
                                    </span>
                                  )}
                                  {isNegativeBalance && (
                                    <span className={styles.negativeBadge} title="Negative balance - employee owes money">
                                      Negative Balance
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className={styles.employeeMetrics}>
                                <div className={styles.metric}>
                                  <span className={styles.metricLabel}>Daily Rate</span>
                                  <span className={styles.metricValue} title="Daily wage rate">
                                    ₹{employee.rate || 0}/day
                                  </span>
                                </div>
                                <div className={styles.metric}>
                                  <span className={styles.metricLabel}>Monthly Wage</span>
                                  <span className={styles.metricValue} title="Calculated wage for this month">
                                    {formatCurrency(employee.wage || 0)}
                                  </span>
                                </div>
                                <div className={styles.metric}>
                                  <span className={styles.metricLabel}>Days Worked</span>
                                  <span className={styles.metricValue} title="Total days attendance this month">
                                    {employee.totalAttendance || employee.totalDays || 0}
                                  </span>
                                </div>
                                <div className={styles.metric}>
                                  <span className={styles.metricLabel}>Balance</span>
                                  <span 
                                    className={`${styles.metricValue} ${isNegativeBalance ? styles.negative : styles.positive}`}
                                    title={isNegativeBalance ? 'Employee owes this amount' : 'Amount due to employee'}
                                  >
                                    {formatCurrency(employee.closing_balance || 0)}
                                  </span>
                                </div>
                                {hasAdvances && (
                                  <div className={styles.metric}>
                                    <span className={styles.metricLabel}>Advances</span>
                                    <span className={styles.metricValue} title="Total advances paid">
                                      {formatCurrency(employee.totalAdvances || 0)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()
                      }
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Focused Modal Components */}
        <TotalCostsModal 
          isOpen={showTotalCostsModal} 
          onClose={() => setShowTotalCostsModal(false)} 
        />

        <PaymentsModal 
          isOpen={showPaymentsModal} 
          onClose={() => setShowPaymentsModal(false)} 
        />

        <AdvancesModal 
          isOpen={showAdvancesModal} 
          onClose={() => setShowAdvancesModal(false)} 
        />

        <PayrollModal 
          isOpen={showPayrollModal} 
          onClose={() => setShowPayrollModal(false)} 
        />

        <SiteExpensesModal 
          isOpen={showSiteExpensesModal} 
          onClose={() => setShowSiteExpensesModal(false)} 
        />

        <EmployeesModal 
          isOpen={showEmployeesModal} 
          onClose={() => setShowEmployeesModal(false)} 
        />

        <ActivityModal 
          isOpen={showActivityModal} 
          onClose={() => setShowActivityModal(false)} 
        />
        
        <CategoryModal
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
        />
        
        <AddExpenseModal
          isOpen={showAddExpenseModal}
          onClose={() => setShowAddExpenseModal(false)}
        />
        
        <AddPaymentModal
          isOpen={showAddPaymentModal}
          onClose={() => setShowAddPaymentModal(false)}
        />
        
        {/* Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          message={confirmDialog.message}
          type={confirmDialog.type}
        />
        </div>
      </div>
    </div>
  );

};

export default SiteExpenses;