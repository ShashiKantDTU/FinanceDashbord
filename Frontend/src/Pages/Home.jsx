import styles from "./Home.module.css";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ToastProvider";
import { useState, useEffect, useCallback, useMemo } from "react";
import LogoutButton from "../components/LogoutButton";
import api from "../utils/api";
import CustomSpinner from '../components/CustomSpinner';

const Home = () => {
  const { user } = useAuth();
  const { showSuccess, showError, showInfo } = useToast();

  // Remove recent changes related state
  const [state, setState] = useState({
    loading: true,
    sites: [],
    showAddSiteModal: false,
    newSiteName: "",
    isAddingSite: false,
    error: "",
    deletingSiteId: null,
    showDropdownId: null,
    searchTerm: "",
    sortBy: "name"
  });

  const [viewMode, setViewMode] = useState(() => {
    try {
      const storedViewMode = localStorage.getItem("viewMode");
      return storedViewMode === "list" ? "list" : "grid";
    } catch (error) {
      console.warn("Error reading viewMode from localStorage:", error);
      return "grid";
    }
  });
  const [isViewModeInitialized, setIsViewModeInitialized] = useState(false);

  // Memoized filtered and sorted sites
  const filteredAndSortedSites = useMemo(() => {
    let filtered = state.sites;
    
    // Apply search filter
    if (state.searchTerm) {
      filtered = filtered.filter(site => 
        site.sitename.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
        site.createdBy.toLowerCase().includes(state.searchTerm.toLowerCase())
      );
    }
    
    // Apply sorting
    return filtered.sort((a, b) => {
      switch (state.sortBy) {
        case "name":
          return a.sitename.localeCompare(b.sitename);
        case "date":
          return new Date(b.createdAt) - new Date(a.createdAt);
        case "creator":
          return a.createdBy.localeCompare(b.createdBy);
        default:
          return 0;
      }
    });
  }, [state.sites, state.searchTerm, state.sortBy]);

  // Memoized stats - Updated without recent changes
  const dashboardStats = useMemo(() => ({
    totalSites: state.sites.length,
    systemStatus: state.loading ? "Loading..." : "Online",
    activeSites: state.sites.filter(site => site.status !== 'inactive').length,
    filteredResults: filteredAndSortedSites.length
  }), [state.sites, state.loading, filteredAndSortedSites.length]);

  // Optimized state update helper
  const updateState = useCallback((updates) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Fetch Sites from the backend - Optimized
  const fetchSites = useCallback(async () => {
    try {
      updateState({ loading: true });
      const response = await api.get("/api/dashboard/home");

      if (response && response.user && response.user.sites) {
        updateState({ sites: response.user.sites });
        if (response.user.sites.length > 0) {
          showInfo(
            `Loaded ${response.user.sites.length} site${
              response.user.sites.length > 1 ? "s" : ""
            }`
          );
        }
      } else {
        updateState({ sites: [] });
        console.warn("No sites data received from backend");
      }
    } catch (error) {
      console.error("Error fetching sites:", error);
      showError("Failed to load sites. Please refresh the page.");
      updateState({ sites: [] });
    } finally {
      updateState({ loading: false });
    }
  }, [showInfo, showError, updateState]);

  useEffect(() => {
    setIsViewModeInitialized(true);
    fetchSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Only run when user changes

  // Close dropdown when clicking outside - Optimized
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (state.showDropdownId && !event.target.closest(`.${styles.dropdownContainer}`)) {
        updateState({ showDropdownId: null });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [state.showDropdownId, updateState]);

  useEffect(() => {
    if (isViewModeInitialized) {
      try {
        localStorage.setItem("viewMode", viewMode);
      } catch (error) {
        console.warn("Error saving viewMode to localStorage:", error);
      }
    }
  }, [viewMode, isViewModeInitialized]);

  // Add new site handler - Optimized
  const addNewSite = useCallback(async (siteName) => {
    try {
      updateState({ isAddingSite: true, error: "" });

      const response = await api.post("/api/dashboard/home/addsite", {
        sitename: siteName.trim(),
      });

      if (response && response.site) {
        // Add the new site directly to state instead of refetching
        updateState({ 
          sites: [...state.sites, response.site],
          showAddSiteModal: false, 
          newSiteName: "", 
          isAddingSite: false 
        });
        showSuccess(`Site "${siteName.trim()}" created successfully!`);
        console.log("Site created successfully:", response.site);
      } else {
        const errorMessage = "Failed to create site. Please try again.";
        updateState({ error: errorMessage, isAddingSite: false });
        showError(errorMessage);
      }
    } catch (error) {
      console.error("Error adding new site:", error);
      const errorMessage =
        error.message || "Failed to create site. Please try again.";
      updateState({ error: errorMessage, isAddingSite: false });
      showError(errorMessage);
    }
  }, [showSuccess, showError, updateState, state.sites]);

  // Delete site handler with enhanced multi-step confirmation - Optimized
  const deleteSite = useCallback(async (site) => {
    console.log("Delete function called for site:", site.sitename);
    
    const firstConfirm = window.confirm(
      `⚠️ DANGER: You are about to PERMANENTLY DELETE "${site.sitename}"\n\n` +
      `This action will:\n` +
      `• Remove ALL data associated with this site\n` +
      `• Delete ALL employee records for this site\n` +
      `• Remove ALL attendance data\n` +
      `• CANNOT BE UNDONE\n\n` +
      `Are you ABSOLUTELY CERTAIN you want to proceed?\n\n` +
      `Click OK only if you are 100% sure you want to delete this site.`
    );
    if (!firstConfirm) return;

    const siteName = window.prompt(
      `🔒 FINAL SAFETY CHECK:\n\n` +
      `To confirm this PERMANENT deletion, you must type the EXACT site name below.\n\n` +
      `Site name to delete: "${site.sitename}"\n\n` +
      `Type the site name exactly as shown above:`
    );
    
    if (siteName !== site.sitename) {
      if (siteName !== null) {
        alert(
          `❌ DELETION CANCELLED\n\n` +
          `The name you entered doesn't match exactly.\n` +
          `Expected: "${site.sitename}"\n` +
          `You entered: "${siteName}"\n\n` +
          `Deletion cancelled for your safety.`
        );
      }
      return;
    }

    const finalConfirm = window.confirm(
      `🚨 LAST CHANCE TO CANCEL\n\n` +
      `You have correctly typed the site name.\n` +
      `Site "${site.sitename}" will be PERMANENTLY DELETED.\n\n` +
      `This is your FINAL opportunity to cancel.\n\n` +
      `Click OK to DELETE FOREVER or Cancel to abort.`
    );
    if (!finalConfirm) return;

    updateState({ deletingSiteId: site._id });

    try {
      const response = await api.delete("/api/dashboard/delete-site", {
        siteName: site.sitename,
        siteId: site._id,
        createdBy: site.createdBy,
      });

      if (response) {
        // Remove the site directly from state instead of refetching
        updateState({ 
          sites: state.sites.filter(s => s._id !== site._id)
        });
        showSuccess(`Site "${site.sitename}" deleted successfully!`);
      }
    } catch (error) {
      console.error("Error deleting site:", error);
      const errorMessage =
        error.message || "Failed to delete site. Please try again.";
      updateState({ error: errorMessage });
      showError(errorMessage);
    } finally {
      updateState({ deletingSiteId: null });
    }
  }, [showSuccess, showError, updateState, state.sites]);

  const handleAddSiteSubmit = useCallback((e) => {
    e.preventDefault();
    if (state.newSiteName.trim()) {
      addNewSite(state.newSiteName);
    } else {
      const errorMessage = "Site name is required";
      updateState({ error: errorMessage });
      showError(errorMessage);
    }
  }, [state.newSiteName, addNewSite, showError, updateState]);

  const handleCloseModal = useCallback(() => {
    updateState({ 
      showAddSiteModal: false, 
      newSiteName: "", 
      error: "" 
    });
  }, [updateState]);

  return (
    <div className={styles.homeContainer}>
      {/* ENHANCED PROFESSIONAL HEADER */}
      <div className={styles.pageHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerInfo}>
            <h1 className={styles.pageTitle}>Dashboard</h1>
            <p className={styles.pageSubtitle}>
              Welcome back, {user?.name || user?.email || "User"}
            </p>
          </div>
          
          <div className={styles.headerActions}>
            {/* Search Bar */}
            <div className={styles.searchContainer}>
              <input
                type="text"
                placeholder="Search sites..."
                value={state.searchTerm}
                onChange={(e) => updateState({ searchTerm: e.target.value })}
                className={styles.searchInput}
              />
              <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>

            {/* Sort Dropdown */}
            <select 
              value={state.sortBy} 
              onChange={(e) => updateState({ sortBy: e.target.value })}
              className={styles.sortSelect}
            >
              <option value="name">Sort by Name</option>
              <option value="date">Sort by Date</option>
              <option value="creator">Sort by Creator</option>
            </select>

            <button
              className={styles.primaryButton}
              onClick={() => updateState({ showAddSiteModal: true })}
              disabled={state.loading}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 5v14m-7-7h14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Add Site
            </button>
            <LogoutButton />
          </div>
        </div>

        {/* ENHANCED QUICK STATS */}
        <div className={styles.quickStats}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statNumber}>{dashboardStats.totalSites}</span>
              <span className={styles.statLabel}>Active Sites</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2"/>
                <circle cx="8.5" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                <line x1="20" y1="8" x2="20" y2="14" stroke="currentColor" strokeWidth="2"/>
                <line x1="23" y1="11" x2="17" y2="11" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statNumber}>{dashboardStats.activeSites}</span>
              <span className={styles.statLabel}>Active Sites</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="currentColor" strokeWidth="2"/>
                <polyline points="7.5,4.21 12,6.81 16.5,4.21" stroke="currentColor" strokeWidth="2"/>
                <polyline points="7.5,19.79 7.5,14.6 3,12" stroke="currentColor" strokeWidth="2"/>
                <polyline points="21,12 16.5,14.6 16.5,19.79" stroke="currentColor" strokeWidth="2"/>
                <polyline points="12,22.08 12,17" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statNumber}>{dashboardStats.filteredResults}</span>
              <span className={styles.statLabel}>Filtered Results</span>
            </div>
          </div>
        </div>
      </div>

      {/* PROFESSIONAL SINGLE-COLUMN DASHBOARD LAYOUT */}
      <div className={styles.mainContent}>
        {/* SITES SECTION - FULL WIDTH */}
        <div className={styles.sitesSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <h2 className={styles.sectionTitle}>Your Sites</h2>
              <span className={styles.siteCount}>
                {filteredAndSortedSites.length} of {state.sites.length} sites
              </span>
            </div>
            <div className={styles.sectionControls}>
              <div className={styles.viewToggle}>
                <button
                  className={`${styles.viewButton} ${viewMode === "grid" ? styles.active : ""}`}
                  onClick={() => setViewMode("grid")}
                  title="Grid View"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M10 3H3v7h7V3zM21 3h-7v7h7V3zM21 14h-7v7h7v-7zM10 14H3v7h7v-7z" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Grid
                </button>
                <button
                  className={`${styles.viewButton} ${viewMode === "list" ? styles.active : ""}`}
                  onClick={() => setViewMode("list")}
                  title="List View"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  List
                </button>
              </div>
            </div>
          </div>

          <div className={styles.sitesContainer}>
            <div className={viewMode === "grid" ? styles.siteGrid : styles.siteList}>
              {state.loading ? (
                <div className={styles.loadingContainer}>
                  <CustomSpinner size={80} color="#3b82f6" />
                  <p className={styles.loadingText}>Loading your sites...</p>
                </div>
              ) : filteredAndSortedSites.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                  </div>
                  <h3 className={styles.emptyTitle}>
                    {state.searchTerm ? 'No sites found' : 'No sites yet'}
                  </h3>
                  <p className={styles.emptyDescription}>
                    {state.searchTerm 
                      ? `No sites match "${state.searchTerm}". Try adjusting your search.`
                      : 'Create your first site to get started'
                    }
                  </p>
                  {!state.searchTerm && (
                    <button
                      className={styles.primaryButton}
                      onClick={() => updateState({ showAddSiteModal: true })}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 5v14m-7-7h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Create Site
                    </button>
                  )}
                </div>
              ) : (
                filteredAndSortedSites.map((site, index) => (
                  <div key={site._id} className={styles.siteCard} style={{ "--i": index }}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardIcon}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                      </div>
                      <div className={styles.cardActions}>
                        <Link to={`/site/${site._id}`} className={styles.viewButton}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/>
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                          </svg>
                        </Link>
                        <div className={styles.dropdownContainer}>
                          <button
                            className={styles.moreButton}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              updateState({ 
                                showDropdownId: state.showDropdownId === site._id ? null : site._id 
                              });
                            }}
                            title="More options"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="1" fill="currentColor"/>
                              <circle cx="12" cy="5" r="1" fill="currentColor"/>
                              <circle cx="12" cy="19" r="1" fill="currentColor"/>
                            </svg>
                          </button>
                          {state.showDropdownId === site._id && (
                            <div className={styles.dropdownMenu}>
                              <button
                                className={styles.dropdownItem}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  updateState({ showDropdownId: null });
                                  window.location.href = `/site/${site._id}`;
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2"/>
                                  <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2"/>
                                </svg>
                                Edit Site
                              </button>
                              <hr className={styles.dropdownDivider} />
                              <button
                                className={styles.dropdownItemDanger}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  updateState({ showDropdownId: null });
                                  deleteSite(site);
                                }}
                                disabled={state.deletingSiteId === site._id}
                              >
                                {state.deletingSiteId === site._id ? (
                                  <div className={styles.miniSpinner}></div>
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" strokeWidth="2"/>
                                    <line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" strokeWidth="2"/>
                                    <line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" strokeWidth="2"/>
                                  </svg>
                                )}
                                Delete Site
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={styles.cardContent}>
                      <h3 className={styles.cardTitle}>{site.sitename}</h3>
                      <div className={styles.cardMeta}>
                        <span className={styles.cardDetail}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2"/>
                            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                          </svg>
                          {site.createdBy}
                        </span>
                        <span className={styles.cardDetail}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                            <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/>
                            <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/>
                            <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
                          </svg>
                          {site.createdAt ? new Date(site.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "N/A"}
                        </span>
                      </div>
                      <Link to={`/site/${site._id}`} className={styles.cardLink}>
                        View Details →
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ENHANCED ADD SITE MODAL */}
      {state.showAddSiteModal && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2>Create New Site</h2>
              <button
                className={styles.closeButton}
                onClick={handleCloseModal}
                disabled={state.isAddingSite}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddSiteSubmit} className={styles.modalForm}>
              <div className={styles.inputGroup}>
                <label htmlFor="siteName">Site Name</label>
                <input
                  id="siteName"
                  type="text"
                  value={state.newSiteName}
                  onChange={(e) => updateState({ newSiteName: e.target.value })}
                  placeholder="Enter site name (e.g., Construction Site A)"
                  className={styles.siteInput}
                  disabled={state.isAddingSite}
                  autoFocus
                  required
                />
              </div>

              {state.error && <div className={styles.errorMessage}>{state.error}</div>}

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={handleCloseModal}
                  disabled={state.isAddingSite}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={state.isAddingSite || !state.newSiteName.trim()}
                >
                  {state.isAddingSite ? (
                    <>
                      <span className={styles.spinner}></span>
                      Creating...
                    </>
                  ) : (
                    "Create Site"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
