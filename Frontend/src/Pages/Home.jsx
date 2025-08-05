import React from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate for navigation
import { useAuth } from "../context/AuthContext"; // Assuming path is correct
import api from "../utils/api"; // Import the API utility
import logo from "../assets/LoginPageLogo.png"; // Import Site Haazri logo
import { useToast } from "../components/ToastProvider"; // Import toast notifications
import { trackWebAppEvents } from "../utils/analytics"; // Import analytics tracking
import { auth } from "../firebase-config"; // Import Firebase auth
import { signOut } from "firebase/auth"; // Import Firebase signOut function

// --- Reusable Icon Components ---
// Using inline SVG for icons removes external dependencies and improves performance.
const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const SiteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.4 14.4 9.6 9.6" />
    <path d="M18 22V6l-4-4H6v12" />
    <path d="M18 22h-4" />
    <path d="M10 18v-1a2 2 0 0 1 2-2h2" />
    <path d="M6 18h1" />
  </svg>
);

const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16,17 21,12 16,7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
);

// --- Custom Hook for Dashboard Logic ---
// This hook encapsulates all state and logic, keeping the main component clean.
const useModernDashboard = () => {
  const { showSuccess, showError, showInfo } = useToast(); // Toast notifications
  const [state, setState] = React.useState({
    loading: true,
    sites: [],
    userName: '',
    summary: { totalSites: 0, totalEmployees: 0 },
    searchTerm: "",
    sortBy: "sitename", // Default sort
  });
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [siteToEdit, setSiteToEdit] = React.useState(null);
  const [deleteModalState, setDeleteModalState] = React.useState({
    isOpen: false,
    site: null,
    step: 1,
    confirmationText: '',
    countdown: 5,
    isDeleting: false
  });

  // A single, safe function to update state
  const updateState = React.useCallback((updates) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Fetch all data from the new, efficient v2 endpoint
  const fetchData = React.useCallback(async () => {
    // Don't set loading to true on refetches, only on initial load.
    // The main component's loading state will handle the initial spinner.
    try {
      const response = await api.get("/api/dashboard/v2/home");

      if (response.success && response.data) {
        updateState({
          sites: response.data.sites,
          userName: response.data.userName,
          summary: response.data.summary,
        });
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      showError("Failed to load dashboard data. Please refresh the page.");
    } finally {
      updateState({ loading: false });
    }
  }, [updateState, showError]);

  React.useEffect(() => {
    fetchData();
    // Set document title for Site Haazri
    document.title = 'Site Haazri - Dashboard';
  }, [fetchData]);

  // Handlers for site actions (add, edit, delete)
  const handleAddSite = React.useCallback(async (siteName) => {
    if (!siteName.trim()) {
      showError("Please enter a site name.");
      return;
    }

    try {
      showInfo("Creating new site...");
      const response = await api.post("/api/dashboard/home/addsite", {
        sitename: siteName.trim(),
      });
      if (response && response.site) {
        fetchData(); // Refetch all data to ensure consistency
        setIsModalOpen(false);
        showSuccess(`Site "${siteName.trim()}" created successfully!`);
      } else {
        throw new Error("Failed to create site.");
      }
    } catch (error) {
      console.error("Error adding new site:", error);
      showError(error.response?.data?.message || "Failed to create site. Please try again.");
    }
  }, [fetchData, showSuccess, showError, showInfo]);

  const handleEditSite = React.useCallback(async (newName) => {
    if (!siteToEdit) return;

    if (!newName.trim()) {
      showError("Please enter a site name.");
      return;
    }

    if (newName.trim() === siteToEdit.sitename) {
      setSiteToEdit(null);
      showInfo("No changes made to site name.");
      return;
    }

    try {
      showInfo("Updating site name...");
      const response = await api.put('/api/dashboard/edit-site-name', {
        siteId: siteToEdit._id,
        newSiteName: newName.trim()
      });
      if (response && response.site) {
        fetchData(); // Refetch updated data
        setSiteToEdit(null);
        showSuccess(`Site name updated to "${newName.trim()}" successfully!`);
      } else {
        throw new Error('Failed to update site.');
      }
    } catch (error) {
      console.error("Error editing site:", error);
      showError(error.response?.data?.message || "Failed to update site name. Please try again.");
    }
  }, [siteToEdit, fetchData, showSuccess, showError, showInfo]);

  const handleDeleteSite = React.useCallback((site) => {
    setDeleteModalState({
      isOpen: true,
      site: site,
      step: 1,
      confirmationText: '',
      countdown: 5,
      isDeleting: false
    });
  }, []);

  const performActualDeletion = React.useCallback(async (site) => {
    try {
      setDeleteModalState(prev => ({ ...prev, isDeleting: true }));
      showInfo("Deleting site...");
      await api.delete("/api/dashboard/delete-site", {
        siteId: site._id,
        siteName: site.sitename,
      });
      fetchData(); // Refetch data after deletion
      showSuccess(`Site "${site.sitename}" deleted successfully!`);
      setDeleteModalState({
        isOpen: false,
        site: null,
        step: 1,
        confirmationText: '',
        countdown: 5,
        isDeleting: false
      });
    } catch (error) {
      console.error("Error deleting site:", error);
      showError(error.response?.data?.message || "Failed to delete site. Please try again.");
      setDeleteModalState(prev => ({ ...prev, isDeleting: false }));
    }
  }, [fetchData, showSuccess, showError, showInfo]);

  // Memoized filtering and sorting
  const processedSites = React.useMemo(() => {
    if (!state.sites) return [];
    return state.sites
      .filter(site => site.sitename.toLowerCase().includes(state.searchTerm.toLowerCase()))
      .sort((a, b) => {
        if (state.sortBy === 'sitename') {
          return a.sitename.localeCompare(b.sitename);
        }
        if (state.sortBy === 'createdAt') {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
        if (state.sortBy === 'employeeCount') {
          return b.employeeCount - a.employeeCount;
        }
        return 0;
      });
  }, [state.sites, state.searchTerm, state.sortBy]);

  return {
    ...state,
    processedSites,
    isModalOpen,
    siteToEdit,
    deleteModalState,
    updateState,
    setIsModalOpen,
    setSiteToEdit,
    setDeleteModalState,
    handleAddSite,
    handleEditSite,
    handleDeleteSite,
    performActualDeletion,
  };
};

// --- UI Components ---

const Header = ({ userName, onAddSiteClick }) => {
  const { logout } = useAuth();
  const { showSuccess, showError, showInfo } = useToast();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const handleLogout = async () => {
    const confirmLogout = window.confirm('Are you sure you want to logout?');
    if (confirmLogout) {
      setIsLoggingOut(true);
      showInfo('Logging out...');
      
      try {
        // Track logout event
        trackWebAppEvents.userLogout();
        
        // Check if Firebase user is logged in and sign out
        if (auth.currentUser) {
          console.log('Firebase user found, signing out from Firebase...');
          await signOut(auth);
          console.log('✅ Successfully signed out from Firebase');
          showSuccess('Successfully logged out from all services');
        } else {
          console.log('No Firebase user found, skipping Firebase logout');
          showSuccess('Successfully logged out');
        }
        
        // Logout from local auth context (clears localStorage and state)
        logout();
        
        // Navigate to login page
        navigate('/login');
      } catch (error) {
        console.error('Error during Firebase logout:', error);
        showError('Error during logout, but you have been signed out locally');
        
        // Even if Firebase logout fails, still logout locally
        logout();
        navigate('/login');
      } finally {
        setIsLoggingOut(false);
      }
    }
  };

  return (
    <header style={styles.header}>
      <div style={styles.headerLeft}>
        <div style={styles.brandContainer}>
          <img src={logo} alt="Site Haazri" style={styles.logo} />
          <div style={styles.brandText}>
            <h1 style={styles.brandTitle}>Site Haazri</h1>
            <p style={styles.brandTagline}>site ka digital manager</p>
          </div>
        </div>
        <div style={styles.welcomeSection}>
          <h2 style={styles.headerTitle}>{getGreeting()}, {userName}</h2>
          <p style={styles.headerSubtitle}>Manage your construction sites digitally with ease.</p>
        </div>
      </div>
      <div style={styles.headerActions}>
        <button style={styles.addButton} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgb(67, 56, 202)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgb(79, 70, 229)'} onClick={onAddSiteClick}>
          <PlusIcon />
          <span style={{ marginLeft: '8px' }}>New Site</span>
        </button>
        <button 
          style={{
            ...styles.logoutButton,
            opacity: isLoggingOut ? 0.6 : 1,
            cursor: isLoggingOut ? 'not-allowed' : 'pointer'
          }} 
          onClick={handleLogout} 
          title={isLoggingOut ? "Logging out..." : "Logout"}
          disabled={isLoggingOut}
          onMouseOver={(e) => {
            if (!isLoggingOut) {
              e.currentTarget.style.backgroundColor = 'rgb(239, 68, 68)';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.borderColor = 'rgb(239, 68, 68)';
            }
          }}
          onMouseOut={(e) => {
            if (!isLoggingOut) {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'rgb(107, 114, 128)';
              e.currentTarget.style.borderColor = 'rgb(229, 231, 235)';
            }
          }}
        >
          {isLoggingOut ? (
            <div style={styles.smallSpinner}></div>
          ) : (
            <LogoutIcon />
          )}
        </button>
      </div>
    </header>
  );
};

const StatCard = ({ title, value, icon, color }) => (
  <div style={{ ...styles.statCard, borderLeft: `4px solid ${color}` }}>
    <div style={{ ...styles.statIcon, backgroundColor: `${color}20`, color }}>{icon}</div>
    <div>
      <p style={styles.statValue}>{value}</p>
      <p style={styles.statTitle}>{title}</p>
    </div>
  </div>
);

const SiteCard = ({ site, onEdit, onDelete }) => {
  const navigate = useNavigate(); // Get the navigate function
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const menuRef = React.useRef(null);

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuRef]);

  const handleManageSite = (e) => {
    e.preventDefault();
    // Navigate to the site's detail page
    navigate(`/site/${site._id}`);
  };

  const cardStyle = {
    ...styles.siteCard,
    ...(isHovered && styles.siteCardHover)
  };

  return (
    <div style={cardStyle} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <div style={styles.siteCardHeader}>
        <div style={styles.siteCardIcon}>
          <SiteIcon />
        </div>
        <h3 style={styles.siteCardTitle}>{site.sitename}</h3>
        <div style={styles.menuContainer} ref={menuRef}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={styles.menuButton}>
            &#x22EE; {/* Vertical ellipsis */}
          </button>
          {isMenuOpen && (
            <div style={styles.dropdownMenu}>
              <button onClick={() => { onEdit(site); setIsMenuOpen(false); }} style={styles.dropdownItem}>Edit</button>
              <button onClick={() => { onDelete(site); setIsMenuOpen(false); }} style={{ ...styles.dropdownItem, ...styles.dropdownItemDelete }}>Delete</button>
            </div>
          )}
        </div>
      </div>
      <div style={styles.siteCardBody}>
        <div style={styles.siteCardStat}>
          <p style={styles.siteCardStatValue}>{site.employeeCount}</p>
          <p style={styles.siteCardStatLabel}>Total Labour this month</p>
        </div>
        <div style={styles.siteCardStat}>
          <p style={styles.siteCardStatValue}>{new Date(site.createdAt).toLocaleDateString()}</p>
          <p style={styles.siteCardStatLabel}>Created On</p>
        </div>
      </div>
      <button style={styles.siteCardLink} onClick={handleManageSite}>
        Manage Site &rarr;
      </button>
    </div>
  );
};

const SiteModal = ({ isOpen, onClose, onSubmit, siteToEdit }) => {
  const [siteName, setSiteName] = React.useState('');

  React.useEffect(() => {
    if (siteToEdit) {
      setSiteName(siteToEdit.sitename);
    } else {
      setSiteName('');
    }
  }, [siteToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (siteName.trim()) {
      onSubmit(siteName);
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.modalTitle}>{siteToEdit ? 'Edit Site Name' : 'Create a New Site'}</h2>
        <p style={styles.modalSubtitle}>Enter a name for your construction site to start digital management.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="e.g., Downtown Office Complex"
            style={styles.modalInput}
            autoFocus
            required
            minLength={1}
            maxLength={100}
          />
          <div style={styles.modalActions}>
            <button type="button" style={styles.modalButtonSecondary} onClick={onClose}>Cancel</button>
            <button type="submit" style={styles.modalButtonPrimary}>{siteToEdit ? 'Save Changes' : 'Create Site'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Multi-step Delete Confirmation Modal
const DeleteSiteModal = ({ deleteState, onClose, onConfirmDelete, onUpdateStep }) => {
  const [countdown, setCountdown] = React.useState(5);
  const [confirmationText, setConfirmationText] = React.useState('');

  // Reset confirmation text when step changes
  React.useEffect(() => {
    if (deleteState.step === 3) {
      setConfirmationText('');
    }
  }, [deleteState.step]);

  // Countdown timer for final step
  React.useEffect(() => {
    if (deleteState.step === 4 && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [deleteState.step, countdown]);

  if (!deleteState.isOpen || !deleteState.site) return null;

  const site = deleteState.site;
  const isConfirmationValid = confirmationText === site.sitename;

  const handleNext = () => {
    if (deleteState.step < 4) {
      const nextStep = deleteState.step + 1;
      if (nextStep === 4) {
        setCountdown(5); // Reset countdown for final step
      }
      onUpdateStep(nextStep);
    }
  };

  const handleFinalDelete = () => {
    if (countdown === 0) {
      onConfirmDelete(site);
    }
  };

  const renderStepContent = () => {
    switch (deleteState.step) {
      case 1:
        return (
          <div style={styles.deleteStep}>
            <div style={styles.deleteIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"/>
              </svg>
            </div>
            <h2 style={styles.deleteTitle}>Delete Site</h2>
            <p style={styles.deleteMessage}>
              Are you sure you want to delete <strong>"{site.sitename}"</strong>?
            </p>
            <p style={styles.deleteWarning}>
              This action cannot be undone and will permanently remove all associated data.
            </p>
          </div>
        );

      case 2:
        return (
          <div style={styles.deleteStep}>
            <div style={styles.deleteIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
              </svg>
            </div>
            <h2 style={styles.deleteTitle}>Impact Assessment</h2>
            <p style={styles.deleteMessage}>
              Deleting <strong>"{site.sitename}"</strong> will permanently remove:
            </p>
            <div style={styles.impactList}>
              <div style={styles.impactItem}>
                <span style={styles.impactIcon}>👷‍♂️</span>
                <span>{site.employeeCount} employee records</span>
              </div>
              <div style={styles.impactItem}>
                <span style={styles.impactIcon}>📊</span>
                <span>All attendance data</span>
              </div>
              <div style={styles.impactItem}>
                <span style={styles.impactIcon}>💰</span>
                <span>Financial records and payouts</span>
              </div>
              <div style={styles.impactItem}>
                <span style={styles.impactIcon}>📈</span>
                <span>Reports and analytics</span>
              </div>
              <div style={styles.impactItem}>
                <span style={styles.impactIcon}>⚙️</span>
                <span>Site configurations</span>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div style={styles.deleteStep}>
            <div style={styles.deleteIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <h2 style={styles.deleteTitle}>Confirmation Required</h2>
            <p style={styles.deleteMessage}>
              To confirm deletion, please type the site name exactly as shown:
            </p>
            <div style={styles.confirmationBox}>
              <p style={styles.siteNameDisplay}>{site.sitename}</p>
            </div>
            <input
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="Type the site name here"
              style={{
                ...styles.modalInput,
                borderColor: isConfirmationValid ? '#10b981' : '#ef4444',
                backgroundColor: isConfirmationValid ? '#f0fdf4' : '#fef2f2'
              }}
              autoFocus
            />
            {confirmationText && !isConfirmationValid && (
              <p style={styles.validationError}>Site name doesn't match. Please try again.</p>
            )}
          </div>
        );

      case 4:
        return (
          <div style={styles.deleteStep}>
            <div style={styles.deleteIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <h2 style={styles.deleteTitle}>Final Warning</h2>
            <p style={styles.deleteMessage}>
              This is your last chance to cancel. Site <strong>"{site.sitename}"</strong> and all its data will be permanently deleted.
            </p>
            <div style={styles.countdownContainer}>
              <div style={styles.countdownCircle}>
                <span style={styles.countdownNumber}>{countdown}</span>
              </div>
              <p style={styles.countdownText}>
                {countdown > 0 ? 'Deletion will be enabled in' : 'You can now delete the site'}
              </p>
            </div>
            {deleteState.isDeleting && (
              <div style={styles.deletingIndicator}>
                <div style={styles.spinner}></div>
                <p>Deleting site...</p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const renderButtons = () => {
    switch (deleteState.step) {
      case 1:
        return (
          <div style={styles.modalActions}>
            <button type="button" style={styles.modalButtonSecondary} onClick={onClose}>
              Cancel
            </button>
            <button type="button" style={styles.deleteButtonPrimary} onClick={handleNext}>
              Continue
            </button>
          </div>
        );

      case 2:
        return (
          <div style={styles.modalActions}>
            <button type="button" style={styles.modalButtonSecondary} onClick={onClose}>
              Cancel
            </button>
            <button type="button" style={styles.deleteButtonPrimary} onClick={handleNext}>
              I Understand
            </button>
          </div>
        );

      case 3:
        return (
          <div style={styles.modalActions}>
            <button type="button" style={styles.modalButtonSecondary} onClick={onClose}>
              Cancel
            </button>
            <button 
              type="button" 
              style={{
                ...styles.deleteButtonPrimary,
                opacity: isConfirmationValid ? 1 : 0.5,
                cursor: isConfirmationValid ? 'pointer' : 'not-allowed'
              }}
              onClick={isConfirmationValid ? handleNext : undefined}
              disabled={!isConfirmationValid}
            >
              Proceed to Final Step
            </button>
          </div>
        );

      case 4:
        return (
          <div style={styles.modalActions}>
            <button type="button" style={styles.modalButtonSecondary} onClick={onClose}>
              Cancel
            </button>
            <button 
              type="button" 
              style={{
                ...styles.deleteButtonDanger,
                opacity: countdown === 0 && !deleteState.isDeleting ? 1 : 0.5,
                cursor: countdown === 0 && !deleteState.isDeleting ? 'pointer' : 'not-allowed'
              }}
              onClick={countdown === 0 && !deleteState.isDeleting ? handleFinalDelete : undefined}
              disabled={countdown > 0 || deleteState.isDeleting}
            >
              {deleteState.isDeleting ? 'Deleting...' : 'Delete Forever'}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.deleteModalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.deleteStepIndicator}>
          {[1, 2, 3, 4].map(step => (
            <div 
              key={step}
              style={{
                ...styles.stepDot,
                backgroundColor: step <= deleteState.step ? '#ef4444' : '#e5e7eb'
              }}
            />
          ))}
        </div>
        
        {renderStepContent()}
        {renderButtons()}
      </div>
    </div>
  );
};

// --- Main Dashboard Component ---
export default function Home() {
  const {
    loading,
    userName,
    summary,
    processedSites,
    searchTerm,
    sortBy,
    isModalOpen,
    siteToEdit,
    deleteModalState,
    updateState,
    setIsModalOpen,
    setSiteToEdit,
    setDeleteModalState,
    handleAddSite,
    handleEditSite,
    handleDeleteSite,
    performActualDeletion,
  } = useModernDashboard();
  const { user } = useAuth(); // Can be used for role-based UI if needed

  if (loading) {
    return <div style={styles.loadingContainer}>
      <div style={styles.spinner}></div>
      <p style={{ marginTop: '20px' }}>Loading Site Haazri Dashboard...</p>
    </div>;
  }

  return (
    <div style={styles.dashboardContainer}>
      <Header userName={userName} onAddSiteClick={() => setIsModalOpen(true)} />

      <main style={styles.mainContent}>
        {/* Stats Section */}
        <section style={styles.statsGrid}>
          <StatCard title="Total Sites" value={summary.totalSites} icon="🏗️" color="#4f46e5" />
          <StatCard title="Total Labour this month" value={summary.totalEmployees} icon="👷‍♂️" color="#10b981" />
          {/* Add more stat cards as needed */}
        </section>

        {/* Sites List Section */}
        <section style={styles.sitesSection}>
          <div style={styles.sitesHeader}>
            <h2 style={styles.sectionTitle}>Your Sites ({processedSites.length})</h2>
            <div style={styles.controlsContainer}>
              <div style={styles.searchInputContainer}>
                <SearchIcon />
                <input
                  type="text"
                  placeholder="Search sites..."
                  style={styles.searchInput}
                  value={searchTerm}
                  onChange={(e) => updateState({ searchTerm: e.target.value })}
                />
              </div>
              <select
                style={styles.sortSelect}
                value={sortBy}
                onChange={(e) => updateState({ sortBy: e.target.value })}
              >
                <option value="sitename">Sort by Name</option>
                <option value="createdAt">Sort by Date</option>
                <option value="employeeCount">Sort by Labor</option>
              </select>
            </div>
          </div>

          <div style={styles.sitesGrid}>
            {processedSites.length > 0 ? (
              processedSites.map(site => (
                <SiteCard key={site._id} site={site} onEdit={setSiteToEdit} onDelete={handleDeleteSite} />
              ))
            ) : (
              <div style={styles.noSitesMessage}>
                <h3>No Sites Found</h3>
                <p>Try adjusting your search or create a new site to start managing digitally.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <SiteModal
        isOpen={isModalOpen || !!siteToEdit}
        onClose={() => { setIsModalOpen(false); setSiteToEdit(null); }}
        onSubmit={siteToEdit ? handleEditSite : handleAddSite}
        siteToEdit={siteToEdit}
      />

      <DeleteSiteModal
        deleteState={deleteModalState}
        onClose={() => setDeleteModalState({
          isOpen: false,
          site: null,
          step: 1,
          confirmationText: '',
          countdown: 5,
          isDeleting: false
        })}
        onConfirmDelete={performActualDeletion}
        onUpdateStep={(step) => setDeleteModalState(prev => ({ ...prev, step }))}
      />
    </div>
  );
}

// --- Inline CSS Styles Object ---
const styles = {
  dashboardContainer: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    backgroundColor: 'rgb(249, 250, 251)',
    minHeight: '100vh',
    color: 'rgb(31, 41, 55)',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: '24px 48px',
    borderBottom: '1px solid rgb(229, 231, 235)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
    '@media (max-width: 768px)': {
      padding: '16px 24px',
      flexDirection: 'column',
      alignItems: 'stretch',
    },
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  brandContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    height: '48px',
    width: 'auto',
  },
  brandText: {
    display: 'flex',
    flexDirection: 'column',
  },
  brandTitle: {
    fontSize: '24px',
    fontWeight: '700',
    margin: 0,
    color: 'rgb(79, 70, 229)',
  },
  brandTagline: {
    fontSize: '12px',
    color: 'rgb(107, 114, 128)',
    margin: 0,
    fontStyle: 'italic',
  },
  welcomeSection: {
    marginLeft: '60px',
  },
  headerTitle: {
    fontSize: '20px',
    fontWeight: '600',
    margin: 0,
    color: 'rgb(17, 24, 39)',
  },
  headerSubtitle: {
    fontSize: '16px',
    color: 'rgb(107, 114, 128)',
    margin: '4px 0 0',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  addButton: {
    backgroundColor: 'rgb(79, 70, 229)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease-in-out',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  },
  logoutButton: {
    backgroundColor: 'transparent',
    color: 'rgb(107, 114, 128)',
    border: '2px solid rgb(229, 231, 235)',
    borderRadius: '8px',
    padding: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    width: '44px',
    height: '44px',
  },
  mainContent: {
    padding: '32px 48px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '24px',
    marginBottom: '40px',
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    border: '1px solid rgb(229, 231, 235)',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.07), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
  },
  statIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: '700',
    margin: 0,
    color: 'rgb(17, 24, 39)',
  },
  statTitle: {
    fontSize: '14px',
    color: 'rgb(107, 114, 128)',
    margin: '0',
  },
  sitesSection: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '32px',
    border: '1px solid rgb(229, 231, 235)',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.07), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
  },
  sitesHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '600',
    margin: 0,
    color: 'rgb(17, 24, 39)',
  },
  controlsContainer: {
    display: 'flex',
    gap: '16px',
  },
  searchInputContainer: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgb(249, 250, 251)',
    border: '1px solid rgb(209, 213, 219)',
    borderRadius: '8px',
    paddingLeft: '12px',
    color: 'rgb(107, 114, 128)',
  },
  searchInput: {
    border: 'none',
    backgroundColor: 'transparent',
    padding: '10px 8px',
    fontSize: '14px',
    outline: 'none',
    width: '200px',
  },
  sortSelect: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid rgb(209, 213, 219)',
    backgroundColor: 'rgb(249, 250, 251)',
    fontSize: '14px',
    color: 'rgb(55, 65, 81)',
  },
  sitesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '24px',
  },
  siteCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid rgb(229, 231, 235)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    transition: 'box-shadow 0.2s ease-in-out, transform 0.2s ease-in-out',
  },
  siteCardHover: {
    transform: 'translateY(-4px)',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  },
  siteCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  siteCardIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    backgroundColor: 'rgb(238, 242, 255)',
    color: 'rgb(79, 70, 229)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  siteCardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    margin: 0,
    flexGrow: 1,
    color: 'rgb(31, 41, 55)',
  },
  menuContainer: {
    position: 'relative',
  },
  menuButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '50%',
    color: 'rgb(156, 163, 175)',
  },
  dropdownMenu: {
    position: 'absolute',
    top: '110%',
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid rgb(229, 231, 235)',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    zIndex: 10,
    width: '120px',
    overflow: 'hidden',
  },
  dropdownItem: {
    background: 'none',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    padding: '10px 16px',
    cursor: 'pointer',
    fontSize: '14px',
    color: 'rgb(55, 65, 81)',
  },
  dropdownItemDelete: {
    color: 'rgb(239, 68, 68)',
  },
  siteCardBody: {
    display: 'flex',
    gap: '16px',
    borderTop: '1px solid rgb(229, 231, 235)',
    paddingTop: '16px',
    marginBottom: '16px',
  },
  siteCardStat: {
    flex: 1,
  },
  siteCardStatValue: {
    fontSize: '20px',
    fontWeight: '700',
    margin: 0,
    color: 'rgb(17, 24, 39)',
  },
  siteCardStatLabel: {
    fontSize: '12px',
    color: 'rgb(107, 114, 128)',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  siteCardLink: {
    color: 'rgb(79, 70, 229)',
    fontWeight: '600',
    textDecoration: 'none',
    fontSize: '14px',
    marginTop: 'auto',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    textAlign: 'left',
  },
  noSitesMessage: {
    color: 'rgb(107, 114, 128)',
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: '40px 0',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '16px',
    color: 'rgb(107, 114, 128)',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '5px solid rgb(229, 231, 235)',
    borderBottomColor: 'rgb(79, 70, 229)',
    borderRadius: '50%',
    display: 'inline-block',
    boxSizing: 'border-box',
    animation: 'rotation 1s linear infinite',
  },
  smallSpinner: {
    width: '20px',
    height: '20px',
    border: '2px solid rgb(229, 231, 235)',
    borderBottomColor: 'rgb(107, 114, 128)',
    borderRadius: '50%',
    display: 'inline-block',
    boxSizing: 'border-box',
    animation: 'rotation 1s linear infinite',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '32px',
    width: '100%',
    maxWidth: '450px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: '600',
    margin: '0 0 8px',
  },
  modalSubtitle: {
    fontSize: '14px',
    color: 'rgb(107, 114, 128)',
    margin: '0 0 24px',
  },
  modalInput: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '16px',
    border: '1px solid rgb(209, 213, 219)',
    borderRadius: '8px',
    marginBottom: '24px',
    boxSizing: 'border-box',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  modalButtonSecondary: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: '1px solid rgb(209, 213, 219)',
    backgroundColor: '#ffffff',
    fontWeight: '600',
    cursor: 'pointer',
  },
  modalButtonPrimary: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'rgb(79, 70, 229)',
    color: '#ffffff',
    fontWeight: '600',
    cursor: 'pointer',
  },
  // Delete Modal Styles
  deleteModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '32px',
    width: '100%',
    maxWidth: '500px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    border: '2px solid #fecaca',
  },
  deleteStepIndicator: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '32px',
  },
  stepDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    transition: 'background-color 0.3s ease',
  },
  deleteStep: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  deleteIcon: {
    marginBottom: '16px',
    display: 'flex',
    justifyContent: 'center',
  },
  deleteTitle: {
    fontSize: '24px',
    fontWeight: '700',
    margin: '0 0 16px',
    color: '#dc2626',
  },
  deleteMessage: {
    fontSize: '16px',
    color: 'rgb(55, 65, 81)',
    margin: '0 0 16px',
    lineHeight: '1.5',
  },
  deleteWarning: {
    fontSize: '14px',
    color: '#f59e0b',
    margin: 0,
    fontWeight: '500',
  },
  impactList: {
    textAlign: 'left',
    maxWidth: '300px',
    margin: '0 auto',
  },
  impactItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 0',
    borderBottom: '1px solid #f3f4f6',
  },
  impactIcon: {
    fontSize: '20px',
    width: '24px',
  },
  confirmationBox: {
    backgroundColor: '#f9fafb',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
    margin: '16px 0',
  },
  siteNameDisplay: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#dc2626',
    margin: 0,
    fontFamily: 'monospace',
  },
  validationError: {
    color: '#dc2626',
    fontSize: '14px',
    margin: '8px 0 0',
    fontWeight: '500',
  },
  countdownContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  countdownCircle: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: '#fef2f2',
    border: '4px solid #fecaca',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#dc2626',
  },
  countdownText: {
    fontSize: '14px',
    color: 'rgb(107, 114, 128)',
    margin: 0,
  },
  deletingIndicator: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    marginTop: '16px',
  },
  deleteButtonPrimary: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#f59e0b',
    color: '#ffffff',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  deleteButtonDanger: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#dc2626',
    color: '#ffffff',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
};

// Add keyframes for spinner animation to the document head
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `@keyframes rotation {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}`;
document.head.appendChild(styleSheet);
