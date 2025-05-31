import styles from './Home.module.css'
import {Link} from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ToastProvider'
import { useState, useEffect } from 'react'
import LogoutButton from '../components/LogoutButton'
import api from '../utils/api'

const Home = () => {
    const { user } = useAuth()
    const { showSuccess, showError, showInfo } = useToast()
    
    const [loading, setLoading] = useState(true)
    const [sites, setSites] = useState([])
    const [showAddSiteModal, setShowAddSiteModal] = useState(false)
    const [newSiteName, setNewSiteName] = useState('')
    const [isAddingSite, setIsAddingSite] = useState(false)    
    const [error, setError] = useState('')
    const [deletingSiteId, setDeletingSiteId] = useState(null)
    const [viewMode, setViewMode] = useState(() => {
        // Initialize viewMode from localStorage during state initialization
        try {
            const storedViewMode = localStorage.getItem('viewMode');
            return storedViewMode === 'list' ? 'list' : 'grid';
        } catch (error) {
            console.warn('Error reading viewMode from localStorage:', error);
            return 'grid'; // fallback to default
        }
    })
    const [isViewModeInitialized, setIsViewModeInitialized] = useState(false)
    // Removed refreshKey as it's no longer needed
    // Ensure viewMode is stored in localStorage    // Fetch Sites from the backend
    const fetchSites = async () => {
      try {
        setLoading(true)
        const response = await api.get('/api/dashboard/home')
        
        // Backend returns: { user: { name, email, role, sites: [...] } }
        if (response && response.user && response.user.sites) {
          setSites(response.user.sites);
          // Only show success message if sites were found
          if (response.user.sites.length > 0) {
            showInfo(`Loaded ${response.user.sites.length} site${response.user.sites.length > 1 ? 's' : ''}`);
          }
        } else {
          setSites([]);
          console.warn('No sites data received from backend');
        }
      } catch (error) {
        console.error("Error fetching sites:", error);
        showError('Failed to load sites. Please refresh the page.');
        setSites([]); // Set empty array on error
      } finally {
        setLoading(false); // Always set loading to false
      }
    }    // Mark that viewMode has been initialized and fetch sites
    useEffect(() => {
        setIsViewModeInitialized(true);
        fetchSites();
    }, [user]); // Only depend on user for fetching sites
    
    // Update view mode in localStorage with error handling (only after initialization)
    useEffect(() => {
        if (isViewModeInitialized) {
            try {
                localStorage.setItem('viewMode', viewMode);
            } catch (error) {
                console.warn('Error saving viewMode to localStorage:', error);
            }
        }
    }, [viewMode, isViewModeInitialized]);// Add new site handler
    const addNewSite = async (siteName) => {
        try {
            setIsAddingSite(true)
            setError('')
            
            const response = await api.post('/api/dashboard/home/addsite', { 
                sitename: siteName.trim() 
            });
            
            // Backend returns: { message: 'Site created successfully', site: savedSite }
            if (response && response.site) {
                await fetchSites(); // Refresh the site list after adding a new site
                setShowAddSiteModal(false);
                setNewSiteName('');
                showSuccess(`Site "${siteName.trim()}" created successfully!`);
                console.log('Site created successfully:', response.site);
            } else {
                setError('Failed to create site. Please try again.');
                showError('Failed to create site. Please try again.');
            }
        } catch (error) {
            console.error('Error adding new site:', error);
            const errorMessage = error.message || 'Failed to create site. Please try again.';
            setError(errorMessage);
            showError(errorMessage);
        } finally {
            setIsAddingSite(false);
        }    }
    
    // Delete site handler
    const deleteSite = async (site) => {
        const confirmDelete = window.confirm(`Are you sure you want to delete "${site.sitename}"? This action cannot be undone.`);
        if (!confirmDelete) return;

        setDeletingSiteId(site._id);
        
        try {
            const response = await api.delete('/api/dashboard/delete-site', {
                siteName: site.sitename,
                siteId: site._id,
                createdBy: site.createdBy
            });

            if (response) {
                // Refresh the site list after deletion
                await fetchSites(); // Use fetchSites instead of refreshKey
                showSuccess(`Site "${site.sitename}" deleted successfully!`);
                console.log('Site deleted successfully');
            }
            
        } catch (error) {
            console.error('Error deleting site:', error);
            const errorMessage = error.message || 'Failed to delete site. Please try again.';
            setError(errorMessage);
            showError(errorMessage);
        } finally {
            setDeletingSiteId(null);
        }
    }    // Handle modal form submission
    const handleAddSiteSubmit = (e) => {
        e.preventDefault();
        if (newSiteName.trim()) {
            addNewSite(newSiteName);
        } else {
            const errorMessage = 'Site name is required';
            setError(errorMessage);
            showError(errorMessage);
        }
    }    // Handle modal close
    const handleCloseModal = () => {
        setShowAddSiteModal(false);
        setNewSiteName('');
        setError('');
    }

    return (
        <div className={styles.homeContainer}>
           {/* MODERN COMPACT HERO SECTION */}
           <div className={styles.heroSection}>
                <div className={styles.heroContent}>
                    <div className={styles.heroMain}>
                        <div className={styles.heroInfo}>
                            <div className={styles.welcomeSection}>
                                <h1 className={styles.heroTitle}>
                                    Welcome back, <span className={styles.userName}>{user?.name || user?.email || 'User'}</span>
                                </h1>
                                <p className={styles.heroSubtitle}>
                                    Manage your financial dashboard and track site progress
                                </p>
                            </div>
                            
                            <div className={styles.heroStats}>
                                <div className={styles.statItem}>
                                    <span className={styles.statNumber}>{sites.length}</span>
                                    <span className={styles.statLabel}>Active Sites</span>
                                </div>
                                <div className={styles.statDivider}></div>
                                <div className={styles.statItem}>
                                    <span className={styles.statNumber}>{loading ? '...' : 'Live'}</span>
                                    <span className={styles.statLabel}>Status</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className={styles.heroActions}>
                            <button 
                                className={styles.primaryButton}
                                onClick={() => setShowAddSiteModal(true)}
                                disabled={loading}
                            >
                                <svg className={styles.buttonIcon} width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M12 5v14m-7-7h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                New Site
                            </button>
                            <LogoutButton />
                        </div>
                    </div>
                </div>
           </div>

        {/* MAIN CONTENT SECTION */}
        <div className={styles.mainContainer}>
            <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Your Sites</h2>                <div className={styles.sectionControls}>
                    <div className={styles.viewToggle}>
                        <button 
                            className={`${styles.viewButton} ${viewMode === 'grid' ? styles.active : ''}`}
                            onClick={() => setViewMode('grid')}
                            title="Grid View"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path d="M10 3H3v7h7V3zM21 3h-7v7h7V3zM21 14h-7v7h7v-7zM10 14H3v7h7v-7z" stroke="currentColor" strokeWidth="2"/>
                            </svg>
                        </button>
                        <button 
                            className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
                            onClick={() => setViewMode('list')}
                            title="List View"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>            <div className={styles.mainContent}>                
                <div className={viewMode === 'grid' ? styles.siteGrid : styles.siteList}>
                {loading ? (
                    <div className={styles.loadingContainer}>
                        <div className={styles.loadingSpinner}></div>
                        <p className={styles.loadingText}>Loading your sites...</p>
                    </div>
                ) : sites.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <h3 className={styles.emptyTitle}>No sites yet</h3>
                        <p className={styles.emptyDescription}>Create your first site to get started with managing your projects</p>
                        <button 
                            className={styles.primaryButton}
                            onClick={() => setShowAddSiteModal(true)}
                        >
                            <svg className={styles.buttonIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 5v14m-7-7h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Create Your First Site
                        </button>
                    </div>
                ) : (
                    sites.map((site, index) => (
                        <div 
                            key={site._id}
                            className={styles.siteCard} 
                            style={{"--i": index}}
                        >
                            <div className={styles.cardHeader}>                                <div className={styles.cardIcon}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        <polyline points="9,22 9,12 15,12 15,22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </div>
                                <div className={styles.cardActions}>                                    <Link to={`/site/${site._id}`} className={styles.viewButton}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/>
                                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                                        </svg>
                                    </Link>
                                    <button 
                                        className={styles.deleteButton}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            deleteSite(site);
                                        }}
                                        disabled={deletingSiteId === site._id}
                                        title="Delete site"
                                    >
                                        {deletingSiteId === site._id ? (
                                            <div className={styles.miniSpinner}></div>
                                        ) : (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                <line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                                <line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                            
                            <div className={styles.cardContent}>
                                <h3 className={styles.cardTitle}>{site.sitename}</h3>
                                
                                <div className={styles.cardDetails}>
                                    <div className={styles.cardDetail}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                        <span>{site.createdBy}</span>
                                    </div>
                                    <div className={styles.cardDetail}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                                            <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/>
                                            <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/>
                                            <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
                                        </svg>
                                        <span>{site.createdAt ? new Date(site.createdAt).toLocaleDateString('en-US', { 
                                            year: 'numeric', 
                                            month: 'short', 
                                            day: 'numeric' 
                                        }) : 'N/A'}</span>
                                    </div>
                                </div>
                                
                                <div className={styles.cardFooter}>
                                    <span className={styles.cardStatus}>
                                        <div className={styles.statusDot}></div>
                                        Active
                                    </span>
                                    <Link to={`/site/${site._id}`} className={styles.cardLink}>
                                        View Details
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                            <path d="M5 12h14m-7-7l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))
                )}            
                </div>
            
        </div>

        {/* ADD SITE MODAL */}
        {showAddSiteModal && (
            <div className={styles.modalOverlay} onClick={handleCloseModal}>
                <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
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
                        
                        {error && (
                            <div className={styles.errorMessage}>
                                {error}
                            </div>
                        )}
                        
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
                                    'Create Site'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
        
        </div>
        
        </div>

    )
  }

export default Home