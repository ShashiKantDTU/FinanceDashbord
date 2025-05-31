import styles from './Home.module.css'
import {Link} from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LogoutButton from '../components/LogoutButton'
import { dashboardAPI } from '../utils/api'
import { useState, useEffect } from 'react'

const Home = () => {

    const { user } = useAuth()
    const [sites, setSites] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Fetch Sites from the backend
    const fetchSites = async () => {
        try {
            setLoading(true)
            setError(null)
            const response = await dashboardAPI.getHomeData()
            if (response && response.user && response.user.sites) {
                setSites(response.user.sites)
            }
        } catch (error) {
            console.error("Error fetching sites:", error)
            setError("Failed to fetch sites")
        } finally {
            setLoading(false)
        }
    }

    // Add new site
    const addSite = async (sitename) => {
        try {
            const response = await dashboardAPI.addSite(sitename)
            if (response) {
                // Refresh sites list after adding
                fetchSites()
            }
        } catch (error) {
            console.error("Error adding site:", error)
            setError("Failed to add site")
        }
    }

    // Handle add site button click
    const handleAddSite = () => {
        const sitename = prompt("Enter site name:")
        if (sitename && sitename.trim()) {
            addSite(sitename.trim())
        }
    }    // Fetch sites on component mount
    useEffect(() => {
        fetchSites()
    }, [])
      return (
        <div className={styles.homeContainer}>        
           {/* HEADER SECTION */}
           <header className={styles.header}>
            <div className={styles.headerContent}>
                <div className={styles.titleSection}>
                    <h1 className={styles.mainTitle}>Financial Dashboard</h1>
                    <p className={styles.subtitle}>Welcome back, <span className={styles.userName}>{user?.name || user?.email || 'User'}</span></p>
                </div>
                <div className={styles.headerActions}>
                    <LogoutButton />
                </div>
            </div>
           </header>

           {/* MAIN CONTENT SECTION */}
           <main className={styles.mainSection}>
                <div className={styles.contentHeader}>
                    <div className={styles.sectionInfo}>
                        <h2 className={styles.sectionTitle}>Your Sites</h2>
                        <p className={styles.sectionDescription}>Manage and monitor your financial sites</p>
                    </div>
                    <button className={styles.addSiteButton} onClick={handleAddSite}>
                        <span className={styles.buttonIcon}>+</span>
                        <span className={styles.buttonText}>Add New Site</span>
                    </button>
                </div>

                <div className={styles.contentBody}>
                    {loading && (
                        <div className={styles.loadingState}>
                            <div className={styles.loadingSpinner}></div>
                            <p>Loading your sites...</p>
                        </div>
                    )}
                    
                    {error && (
                        <div className={styles.errorState}>
                            <p>{error}</p>
                        </div>
                    )}

                    {!loading && !error && (
                        <div className={styles.sitesGrid}>
                            {sites.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <div className={styles.emptyIcon}>📊</div>
                                    <h3>No sites yet</h3>
                                    <p>Create your first site to get started with financial tracking</p>
                                    <button className={styles.emptyActionButton} onClick={handleAddSite}>
                                        Create First Site
                                    </button>
                                </div>
                            ) : (                                sites.map((site, index) => (
                                    <Link to={`/site/${site._id}`} className={styles.siteCardLink} key={site._id}>
                                        <article className={styles.siteCard} style={{"--delay": index * 0.1 + "s"}}>
                                            <div className={styles.cardGradientOverlay}></div>
                                            <div className={styles.cardPattern}></div>
                                            
                                            <div className={styles.cardHeader}>
                                                <div className={styles.siteInfo}>
                                                    <h3 className={styles.siteName}>{site.sitename}</h3>
                                                    <div className={styles.siteMetrics}>
                                                        <span className={styles.metricBadge}>
                                                            <span className={styles.metricIcon}>🏢</span>
                                                            <span className={styles.metricText}>Enterprise</span>
                                                        </span>
                                                        <span className={styles.metricBadge}>
                                                            <span className={styles.metricIcon}>⚡</span>
                                                            <span className={styles.metricText}>Live</span>
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className={styles.siteStatus}>
                                                    <div className={styles.statusIndicator}>
                                                        <span className={styles.statusDot}></span>
                                                        <span className={styles.statusText}>Active</span>
                                                    </div>
                                                    <div className={styles.siteActions}>
                                                        <button className={styles.actionButton} onClick={(e) => e.preventDefault()}>
                                                            <span className={styles.actionIcon}>⚙️</span>
                                                        </button>
                                                        <button className={styles.actionButton} onClick={(e) => e.preventDefault()}>
                                                            <span className={styles.actionIcon}>📊</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className={styles.cardBody}>
                                                <div className={styles.statsSection}>
                                                    <div className={styles.statItem}>
                                                        <div className={styles.statIcon}>💰</div>
                                                        <div className={styles.statContent}>
                                                            <span className={styles.statValue}>₹2.4M</span>
                                                            <span className={styles.statLabel}>Revenue</span>
                                                        </div>
                                                        <div className={styles.statTrend}>
                                                            <span className={styles.trendUp}>+12%</span>
                                                        </div>
                                                    </div>
                                                    <div className={styles.statItem}>
                                                        <div className={styles.statIcon}>👥</div>
                                                        <div className={styles.statContent}>
                                                            <span className={styles.statValue}>148</span>
                                                            <span className={styles.statLabel}>Employees</span>
                                                        </div>
                                                        <div className={styles.statTrend}>
                                                            <span className={styles.trendUp}>+5</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className={styles.detailsSection}>
                                                    <div className={styles.siteDetail}>
                                                        <div className={styles.detailIcon}>🔑</div>
                                                        <div className={styles.detailContent}>
                                                            <span className={styles.detailLabel}>Site ID</span>
                                                            <span className={styles.detailValue}>{site._id.slice(-8).toUpperCase()}</span>
                                                        </div>
                                                        <button className={styles.copyButton} onClick={(e) => {
                                                            e.preventDefault();
                                                            navigator.clipboard.writeText(site._id);
                                                        }}>
                                                            📋
                                                        </button>
                                                    </div>
                                                    
                                                    <div className={styles.siteDetail}>
                                                        <div className={styles.detailIcon}>👤</div>
                                                        <div className={styles.detailContent}>
                                                            <span className={styles.detailLabel}>Created by</span>
                                                            <span className={styles.detailValue}>{site.createdBy}</span>
                                                        </div>
                                                        <div className={styles.userAvatar}>
                                                            {site.createdBy.charAt(0).toUpperCase()}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className={styles.siteDetail}>
                                                        <div className={styles.detailIcon}>📅</div>
                                                        <div className={styles.detailContent}>
                                                            <span className={styles.detailLabel}>Created</span>
                                                            <span className={styles.detailValue}>
                                                                {new Date(site.createdAt).toLocaleDateString('en-US', {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    year: 'numeric'
                                                                })}
                                                            </span>
                                                        </div>
                                                        <div className={styles.timeAgo}>
                                                            {Math.floor((new Date() - new Date(site.createdAt)) / (1000 * 60 * 60 * 24))} days ago
                                                        </div>
                                                    </div>
                                                    
                                                    <div className={styles.siteDetail}>
                                                        <div className={styles.detailIcon}>🔄</div>
                                                        <div className={styles.detailContent}>
                                                            <span className={styles.detailLabel}>Last updated</span>
                                                            <span className={styles.detailValue}>
                                                                {new Date(site.updatedAt).toLocaleDateString('en-US', {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    year: 'numeric'
                                                                })}
                                                            </span>
                                                        </div>
                                                        <div className={styles.updateIndicator}>
                                                            <span className={styles.pulseIndicator}></span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className={styles.progressSection}>
                                                    <div className={styles.progressHeader}>
                                                        <span className={styles.progressLabel}>Site Completion</span>
                                                        <span className={styles.progressValue}>78%</span>
                                                    </div>
                                                    <div className={styles.progressBar}>
                                                        <div className={styles.progressFill} style={{"--progress": "78%"}}></div>
                                                    </div>
                                                    <div className={styles.progressTasks}>
                                                        <span className={styles.tasksComplete}>7 of 9 tasks complete</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className={styles.cardFooter}>
                                                <div className={styles.footerLeft}>
                                                    <div className={styles.quickActions}>
                                                        <button className={styles.quickAction}>📊 Analytics</button>
                                                        <button className={styles.quickAction}>💼 Manage</button>
                                                    </div>
                                                </div>
                                                <div className={styles.footerRight}>
                                                    <span className={styles.viewSiteText}>View Details</span>
                                                    <span className={styles.arrowIcon}>→</span>
                                                </div>
                                            </div>
                                        </article>
                                    </Link>
                                ))
                            )}
                        </div>
                    )}
                </div>
           </main>
        </div>

    )
}

export default Home