import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ToastProvider";
import api from "../utils/api";

import DashboardHeader from "./DashboardHeader";
import SiteList from "./SiteList";
import AddSiteModal from "./AddSiteModal";
import EditSiteModal from "./EditSiteModal";
import CustomSpinner from '../components/CustomSpinner';
import styles from './Home.module.css';
import logo from '../assets/LoginPageLogo.png';

const Home = () => {
  const { user } = useAuth();
  const { showSuccess, showError, showInfo } = useToast();

  const [state, setState] = useState({
    loading: true,
    sites: [],
    searchTerm: "",
    sortBy: "name",
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [siteBeingEdited, setSiteBeingEdited] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    try {
      const storedViewMode = localStorage.getItem("viewMode");
      return storedViewMode === "list" ? "list" : "grid";
    } catch (error) {
      console.warn("Error reading viewMode from localStorage:", error);
      return "grid";
    }
  });

  const updateState = useCallback((updates) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const fetchSites = useCallback(async () => {
    try {
      updateState({ loading: true });
      const response = await api.get("/api/dashboard/home");

      if (response && response.user && response.user.sites) {
        updateState({ sites: response.user.sites });
        if (response.user.sites.length > 0) {
          showInfo(
            `Loaded ${response.user.sites.length} site${response.user.sites.length > 1 ? "s" : ""
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
    fetchSites();
  }, [fetchSites]);

  useEffect(() => {
    try {
      localStorage.setItem("viewMode", viewMode);
    } catch (error) {
      console.warn("Error saving viewMode to localStorage:", error);
    }
  }, [viewMode]);

  const addNewSite = useCallback(async (siteName) => {
    try {
      const response = await api.post("/api/dashboard/home/addsite", {
        sitename: siteName.trim(),
      });

      if (response && response.site) {
        updateState({
          sites: [...state.sites, response.site]
        });
        setIsModalOpen(false);
        showSuccess(`Site "${siteName.trim()}" created successfully!`);
        console.log("Site created successfully:", response.site);
      } else {
        throw new Error("Failed to create site. Please try again.");
      }
    } catch (error) {
      console.error("Error adding new site:", error);
      const errorMessage = error.message || "Failed to create site. Please try again.";
      showError(errorMessage);
      throw error;
    }
  }, [showSuccess, showError, updateState, state.sites]);

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

    try {
      const response = await api.delete("/api/dashboard/delete-site", {
        siteName: site.sitename,
        siteId: site._id,
        createdBy: site.createdBy,
      });

      if (response) {
        updateState({
          sites: state.sites.filter(s => s._id !== site._id)
        });
        showSuccess(`Site "${site.sitename}" deleted successfully!`);
      }
    } catch (error) {
      console.error("Error deleting site:", error);
      const errorMessage = error.message || "Failed to delete site. Please try again.";
      showError(errorMessage);
    }
  }, [showSuccess, showError, updateState, state.sites]);

  // Handler to open edit modal
  const handleEditSite = useCallback((site) => {
    setSiteBeingEdited(site);
    setIsEditModalOpen(true);
  }, []);

  // Handler to update site name in state (now with API call)
  const handleEditSiteSubmit = useCallback(async (newName) => {
    if (!siteBeingEdited) return;
    try {
      const response = await api.put('/api/dashboard/edit-site-name', {
        siteId: siteBeingEdited._id,
        newSiteName: newName
      });
      if (response && response.site) {
        updateState({
          sites: state.sites.map(s =>
            s._id === siteBeingEdited._id ? response.site : s
          )
        });
        showSuccess(`Site name updated to "${response.site.sitename}"`);
      } else {
        throw new Error('No site returned from server');
      }
    } catch (error) {
      const errorMessage = error.message || 'Failed to update site name. Please try again.';
      showError(errorMessage);
    } finally {
      setIsEditModalOpen(false);
      setSiteBeingEdited(null);
    }
  }, [siteBeingEdited, state.sites, updateState, showSuccess, showError]);

  const filteredAndSortedSites = useMemo(() => {
    let filtered = state.sites;

    if (state.searchTerm) {
      filtered = filtered.filter(site =>
        site.sitename.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
        site.createdBy.toLowerCase().includes(state.searchTerm.toLowerCase())
      );
    }

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

  if (state.loading) {
    return (
      <div className={styles.loadingContainer}>
        <CustomSpinner size={80} color="#26a69a" />
        <p style={{ marginTop: '1rem', fontSize: '1.1rem', color: '#848d97' }}>
          Loading your sites...
        </p>
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.auroraBackground}></div>

      <DashboardHeader
        user={user}
        searchTerm={state.searchTerm}
        onSearchChange={(e) => updateState({ searchTerm: e.target.value })}
        sortBy={state.sortBy}
        onSortChange={(e) => updateState({ sortBy: e.target.value })}
        onAddSiteClick={() => setIsModalOpen(true)}
      />

      <main className={styles.mainContent}>
        <SiteList
          sites={filteredAndSortedSites}
          onDeleteSite={deleteSite}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onEditSite={handleEditSite}
        />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerBranding}>
            <div className={styles.footerLogo}>
              <img
                src={logo}
                alt="SiteHaazri.in Logo"
                className={styles.footerLogoImage}
              />
              <span className={styles.footerBrandName}>SiteHaazri.in</span>
            </div>
            <p className={styles.footerTagline}>
              Streamline your site management with powerful tools and insights
            </p>
          </div>
          <div className={styles.footerInfo}>
            <p className={styles.footerCopyright}>
              © 2025 SiteHaazri.in. All rights reserved.
            </p>
            <p className={styles.footerVersion}>
              Version 1.0.0
            </p>
          </div>
        </div>
      </footer>

      {isModalOpen && (
        <AddSiteModal
          onClose={() => setIsModalOpen(false)}
          onSubmit={addNewSite}
        />
      )}
      {isEditModalOpen && siteBeingEdited && (
        <EditSiteModal
          isOpen={isEditModalOpen}
          onClose={() => { setIsEditModalOpen(false); setSiteBeingEdited(null); }}
          onSubmit={handleEditSiteSubmit}
          site={siteBeingEdited}
        />
      )}
    </div>
  );
};

export default Home;
