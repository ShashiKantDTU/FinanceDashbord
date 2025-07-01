import styles from "./Home.module.css";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ToastProvider";
import { useState, useEffect, useCallback } from "react";
import LogoutButton from "../components/LogoutButton";
import api from "../utils/api";

const Home = () => {
  const { user } = useAuth();
  const { showSuccess, showError, showInfo } = useToast();

  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState([]);
  const [showAddSiteModal, setShowAddSiteModal] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [error, setError] = useState("");
  const [deletingSiteId, setDeletingSiteId] = useState(null);
  const [showDropdownId, setShowDropdownId] = useState(null);
  const [recentChanges, setRecentChanges] = useState([]);
  const [loadingChanges, setLoadingChanges] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    // Initialize viewMode from localStorage during state initialization
    try {
      const storedViewMode = localStorage.getItem("viewMode");
      return storedViewMode === "list" ? "list" : "grid";
    } catch (error) {
      console.warn("Error reading viewMode from localStorage:", error);
      return "grid"; // fallback to default
    }
  });
  const [isViewModeInitialized, setIsViewModeInitialized] = useState(false);
  // Removed refreshKey as it's no longer needed
  // Ensure viewMode is stored in localStorage

  // Fetch Sites from the backend
  const fetchSites = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/dashboard/home");

      // Backend returns: { user: { name, email, role, sites: [...] } }
      if (response && response.user && response.user.sites) {
        setSites(response.user.sites);
        // Only show success message if sites were found
        if (response.user.sites.length > 0) {
          showInfo(
            `Loaded ${response.user.sites.length} site${
              response.user.sites.length > 1 ? "s" : ""
            }`
          );
        }
      } else {
        setSites([]);
        console.warn("No sites data received from backend");
      }
    } catch (error) {
      console.error("Error fetching sites:", error);
      showError("Failed to load sites. Please refresh the page.");
      setSites([]); // Set empty array on error
    } finally {
      setLoading(false); // Always set loading to false
    }
  }, [showInfo, showError]);

  // Fetch recent changes from change tracking API
  const fetchRecentChanges = useCallback(async () => {
    try {
      setLoadingChanges(true);
      // Get recent changes with limit of 10
      const response = await api.get("/api/change-tracking/recent?limit=10");
      
      if (response && response.data) {
        setRecentChanges(response.data);
      } else {
        setRecentChanges([]);
      }
    } catch (error) {
      console.error("Error fetching recent changes:", error);
      setRecentChanges([]);
    } finally {
      setLoadingChanges(false);
    }
  }, []);

  // Mark that viewMode has been initialized and fetch sites
  useEffect(() => {
    setIsViewModeInitialized(true);
    fetchSites();
    fetchRecentChanges();
  }, [user, fetchSites, fetchRecentChanges]); // Include fetchRecentChanges in dependencies

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdownId && !event.target.closest(`.${styles.dropdownContainer}`)) {
        setShowDropdownId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdownId]);

  // Update view mode in localStorage with error handling (only after initialization)
  useEffect(() => {
    if (isViewModeInitialized) {
      try {
        localStorage.setItem("viewMode", viewMode);
      } catch (error) {
        console.warn("Error saving viewMode to localStorage:", error);
      }
    }
  }, [viewMode, isViewModeInitialized]); // Add new site handler
  const addNewSite = async (siteName) => {
    try {
      setIsAddingSite(true);
      setError("");

      const response = await api.post("/api/dashboard/home/addsite", {
        sitename: siteName.trim(),
      });

      // Backend returns: { message: 'Site created successfully', site: savedSite }
      if (response && response.site) {
        await fetchSites(); // Refresh the site list after adding a new site
        setShowAddSiteModal(false);
        setNewSiteName("");
        showSuccess(`Site "${siteName.trim()}" created successfully!`);
        console.log("Site created successfully:", response.site);
      } else {
        setError("Failed to create site. Please try again.");
        showError("Failed to create site. Please try again.");
      }
    } catch (error) {
      console.error("Error adding new site:", error);
      const errorMessage =
        error.message || "Failed to create site. Please try again.";
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsAddingSite(false);
    }
  };

  // Delete site handler with enhanced multi-step confirmation
  const deleteSite = async (site) => {
    console.log("Delete function called for site:", site.sitename);
    
    // First confirmation dialog with strong warning
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
    console.log("First confirmation result:", firstConfirm);
    if (!firstConfirm) return;

    // Second confirmation requiring exact site name typing
    const siteName = window.prompt(
      `🔒 FINAL SAFETY CHECK:\n\n` +
      `To confirm this PERMANENT deletion, you must type the EXACT site name below.\n\n` +
      `Site name to delete: "${site.sitename}"\n\n` +
      `Type the site name exactly as shown above:`
    );
    console.log("Site name entered:", siteName, "Expected:", site.sitename);
    
    if (siteName !== site.sitename) {
      if (siteName !== null) { // User didn't cancel
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

    // Third and final confirmation
    const finalConfirm = window.confirm(
      `🚨 LAST CHANCE TO CANCEL\n\n` +
      `You have correctly typed the site name.\n` +
      `Site "${site.sitename}" will be PERMANENTLY DELETED.\n\n` +
      `This is your FINAL opportunity to cancel.\n\n` +
      `Click OK to DELETE FOREVER or Cancel to abort.`
    );
    console.log("Final confirmation result:", finalConfirm);
    if (!finalConfirm) return;

    console.log("Starting deletion process for site ID:", site._id);
    setDeletingSiteId(site._id);

    try {
      const response = await api.delete("/api/dashboard/delete-site", {
        siteName: site.sitename,
        siteId: site._id,
        createdBy: site.createdBy,
      });

      console.log("Delete response:", response);
      if (response) {
        // Refresh the site list after deletion
        await fetchSites();
        showSuccess(`Site "${site.sitename}" deleted successfully!`);
        console.log("Site deleted successfully");
      }
    } catch (error) {
      console.error("Error deleting site:", error);
      const errorMessage =
        error.message || "Failed to delete site. Please try again.";
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setDeletingSiteId(null);
      console.log("Delete process completed");
    }
  }; // Handle modal form submission
  const handleAddSiteSubmit = (e) => {
    e.preventDefault();
    if (newSiteName.trim()) {
      addNewSite(newSiteName);
    } else {
      const errorMessage = "Site name is required";
      setError(errorMessage);
      showError(errorMessage);
    }
  }; // Handle modal close
  const handleCloseModal = () => {
    setShowAddSiteModal(false);
    setNewSiteName("");
    setError("");
  };

  return (
    <div className={styles.homeContainer}>
      {/* ENHANCED MODERN HERO SECTION */}
      <div className={styles.heroSection}>
        <div className={styles.heroBackground}>
          <div className={styles.heroShape1}></div>
          <div className={styles.heroShape2}></div>
          <div className={styles.heroShape3}></div>
        </div>

        <div className={styles.heroContent}>
          <div className={styles.heroMain}>
            <div className={styles.heroInfo}>
              <div className={styles.welcomeSection}>
                <div className={styles.greetingBadge}>
                  <svg
                    className={styles.greetingIcon}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"
                      fill="currentColor"
                    />
                  </svg>
                  <span>
                    Good{" "}
                    {new Date().getHours() < 12
                      ? "Morning"
                      : new Date().getHours() < 18
                      ? "Afternoon"
                      : "Evening"}
                  </span>
                </div>

                <h1 className={styles.heroTitle}>
                  Welcome back, <br />
                  <span className={styles.userName}>
                    {user?.name || user?.email || "User"}
                  </span>
                </h1>

                <p className={styles.heroSubtitle}>
                  Manage your financial dashboard and track site progress with
                  real-time insights
                </p>
              </div>

              <div className={styles.heroStats}>
                <div className={styles.statItem}>
                  <div className={styles.statIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V7"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M3 7L12 14L21 7"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  <div className={styles.statContent}>
                    <span className={styles.statNumber}>{sites.length}</span>
                    <span className={styles.statLabel}>Active Sites</span>
                  </div>
                </div>

                <div className={styles.statDivider}></div>

                <div className={styles.statItem}>
                  <div className={styles.statIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M8 12L11 15L16 9"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className={styles.statContent}>
                    <span className={styles.statNumber}>
                      {loading ? "..." : "Live"}
                    </span>
                    <span className={styles.statLabel}>System Status</span>
                  </div>
                </div>

                <div className={styles.statDivider}></div>

                <div className={styles.statItem}>
                  <div className={styles.statIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 2L15.09 8.26L22 9L17 14L18.18 21L12 17.77L5.82 21L7 14L2 9L8.91 8.26L12 2Z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  <div className={styles.statContent}>
                    <span className={styles.statNumber}>
                      {user?.role || "User"}
                    </span>
                    <span className={styles.statLabel}>Role</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.heroActions}>
              <button
                className={styles.primaryButton}
                onClick={() => setShowAddSiteModal(true)}
                disabled={loading}
              >
                <svg
                  className={styles.buttonIcon}
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M12 5v14m-7-7h14"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Create New Site</span>
              </button>
              <div className={styles.quickActions}>
                <button
                  className={styles.quickActionBtn}
                  title="Refresh Data"
                  onClick={() => window.location.reload()}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 12A9 9 0 0 1 12 3C16.97 3 21 7.03 21 12S16.97 21 12 21"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M3 12L7 8M3 12L7 16"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                <LogoutButton />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT SECTION */}
      <div className={styles.mainContainer}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Your Sites</h2>{" "}
          <div className={styles.sectionControls}>
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewButton} ${
                  viewMode === "grid" ? styles.active : ""
                }`}
                onClick={() => setViewMode("grid")}
                title="Grid View"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M10 3H3v7h7V3zM21 3h-7v7h7V3zM21 14h-7v7h7v-7zM10 14H3v7h7v-7z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </button>
              <button
                className={`${styles.viewButton} ${
                  viewMode === "list" ? styles.active : ""
                }`}
                onClick={() => setViewMode("list")}
                title="List View"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 12h18M3 6h18M3 18h18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>{" "}
        <div className={styles.mainContent}>
          <div
            className={viewMode === "grid" ? styles.siteGrid : styles.siteList}
          >
            {loading ? (
              <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <p className={styles.loadingText}>Loading your sites...</p>
              </div>
            ) : sites.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9 12l2 2 4-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className={styles.emptyTitle}>No sites yet</h3>
                <p className={styles.emptyDescription}>
                  Create your first site to get started with managing your
                  projects
                </p>
                <button
                  className={styles.primaryButton}
                  onClick={() => setShowAddSiteModal(true)}
                >
                  <svg
                    className={styles.buttonIcon}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 5v14m-7-7h14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Create Your First Site
                </button>
              </div>
            ) : (
              sites.map((site, index) => (
                <div
                  key={site._id}
                  className={styles.siteCard}
                  style={{ "--i": index }}
                >
                  <div className={styles.cardHeader}>
                    {" "}
                    <div className={styles.cardIcon}>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <polyline
                          points="9,22 9,12 15,12 15,22"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div className={styles.cardActions}>
                      <Link
                        to={`/site/${site._id}`}
                        className={styles.viewButton}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                          <circle
                            cx="12"
                            cy="12"
                            r="3"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                        </svg>
                      </Link>
                      <div className={styles.dropdownContainer}>
                        <button
                          className={styles.moreButton}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowDropdownId(showDropdownId === site._id ? null : site._id);
                          }}
                          title="More options"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="1" fill="currentColor"/>
                            <circle cx="12" cy="5" r="1" fill="currentColor"/>
                            <circle cx="12" cy="19" r="1" fill="currentColor"/>
                          </svg>
                        </button>
                        {showDropdownId === site._id && (
                          <div className={styles.dropdownMenu}>
                            <button
                              className={styles.dropdownItem}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowDropdownId(null);
                                // Navigate to site edit (placeholder for now)
                                window.location.href = `/site/${site._id}`;
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Edit Site
                            </button>
                            <hr className={styles.dropdownDivider} />
                            <button
                              className={styles.dropdownItemDanger}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowDropdownId(null);
                                deleteSite(site);
                              }}
                              disabled={deletingSiteId === site._id}
                            >
                              {deletingSiteId === site._id ? (
                                <div className={styles.miniSpinner}></div>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                  <line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
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

                    <div className={styles.cardDetails}>
                      <div className={styles.cardDetail}>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <circle
                            cx="12"
                            cy="7"
                            r="4"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span>{site.createdBy}</span>
                      </div>
                      <div className={styles.cardDetail}>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <rect
                            x="3"
                            y="4"
                            width="18"
                            height="18"
                            rx="2"
                            ry="2"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                          <line
                            x1="16"
                            y1="2"
                            x2="16"
                            y2="6"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                          <line
                            x1="8"
                            y1="2"
                            x2="8"
                            y2="6"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                          <line
                            x1="3"
                            y1="10"
                            x2="21"
                            y2="10"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                        </svg>
                        <span>
                          {site.createdAt
                            ? new Date(site.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                }
                              )
                            : "N/A"}
                        </span>
                      </div>
                    </div>

                    <div className={styles.cardFooter}>
                      <span className={styles.cardStatus}>
                        <div className={styles.statusDot}></div>
                        Active
                      </span>
                      <Link
                        to={`/site/${site._id}`}
                        className={styles.cardLink}
                      >
                        View Details
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M5 12h14m-7-7l7 7-7 7"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RECENT CHANGES SECTION */}
        <div className={styles.recentChangesSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Recent Changes</h2>
            <div className={styles.sectionControls}>
              <button
                className={styles.refreshButton}
                onClick={fetchRecentChanges}
                disabled={loadingChanges}
                title="Refresh recent changes"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 12A9 9 0 0 1 12 3C16.97 3 21 7.03 21 12S16.97 21 12 21"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M3 12L7 8M3 12L7 16"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className={styles.recentChangesContent}>
            {loadingChanges ? (
              <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <p className={styles.loadingText}>Loading recent changes...</p>
              </div>
            ) : recentChanges.length === 0 ? (
              <div className={styles.emptyChanges}>
                <div className={styles.emptyChangesIcon}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className={styles.emptyChangesTitle}>No recent changes</h3>
                <p className={styles.emptyChangesDescription}>
                  No changes have been made recently across your sites
                </p>
              </div>
            ) : (
              <div className={styles.changesGrid}>
                {recentChanges.map((change, index) => (
                  <div
                    key={change.serialNumber}
                    className={styles.changeCard}
                    style={{ "--i": index }}
                  >
                    <div className={styles.changeHeader}>
                      <div className={styles.changeSerialBadge}>
                        #{change.serialNumber}
                      </div>
                      <div className={styles.changeDate}>
                        {new Date(change.correctionDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>

                    <div className={styles.changeContent}>
                      <div className={styles.employeeInfo}>
                        <h4 className={styles.employeeName}>
                          {change.employeeName || change.employeeID}
                        </h4>
                        <span className={styles.employeeId}>
                          {change.employeeID}
                        </span>
                      </div>

                      <div className={styles.changeDetails}>
                        <div className={styles.changeRemark}>
                          {change.remark || "No description provided"}
                        </div>
                        
                        <div className={styles.changeStats}>
                          {change.changesCount && (
                            <span className={styles.changeStat}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                <path
                                  d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              {change.changesCount} field{change.changesCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          
                          {change.changeTypes && change.changeTypes.length > 0 && (
                            <div className={styles.changeTypes}>
                              {change.changeTypes.map((type, i) => (
                                <span key={i} className={`${styles.changeType} ${styles[`changeType${type.charAt(0).toUpperCase() + type.slice(1)}`]}`}>
                                  {type}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={styles.changeFooter}>
                        <span className={styles.changedBy}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle
                              cx="12"
                              cy="7"
                              r="4"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          {change.correctedBy}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* ADD SITE MODAL */}
        {showAddSiteModal && (
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
                  disabled={isAddingSite}
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
                    value={newSiteName}
                    onChange={(e) => setNewSiteName(e.target.value)}
                    placeholder="Enter site name (e.g., Construction Site A)"
                    className={styles.siteInput}
                    disabled={isAddingSite}
                    autoFocus
                    required
                  />
                </div>

                {error && <div className={styles.errorMessage}>{error}</div>}

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.cancelButton}
                    onClick={handleCloseModal}
                    disabled={isAddingSite}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={isAddingSite || !newSiteName.trim()}
                  >
                    {isAddingSite ? (
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
    </div>
  );
};

export default Home;
