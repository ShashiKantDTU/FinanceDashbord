import SiteCard from './SiteCard';
import styles from './Home.module.css';

const SiteList = ({ sites, onDeleteSite, viewMode = "grid", onViewModeChange }) => (
  <div className={styles.siteListContainer}>
    <div className={styles.siteListHeader}>
      <div className={styles.siteListTitleSection}>
        <h2 className={styles.sectionTitle}>Your Sites</h2>
        <span className={styles.siteCount}>
          {sites.length} site{sites.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      {onViewModeChange && (
        <div className={styles.viewModeToggle}>
          <button
            className={`${styles.viewModeButton} ${viewMode === "grid" ? styles.active : ''}`}
            onClick={() => onViewModeChange("grid")}
            title="Grid View"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M10 3H3v7h7V3zM21 3h-7v7h7V3zM21 14h-7v7h7v-7zM10 14H3v7h7v-7z" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Grid
          </button>
          <button
            className={`${styles.viewModeButton} ${viewMode === "list" ? styles.active : ''}`}
            onClick={() => onViewModeChange("list")}
            title="List View"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            List
          </button>
        </div>
      )}
    </div>
    
    {sites.length > 0 ? (
      <div className={viewMode === "grid" ? styles.siteGrid : styles.siteListView}>
        {sites.map((site, index) => (
          <SiteCard 
            key={site._id} 
            site={site} 
            onDelete={() => onDeleteSite(site)}
            index={index}
            viewMode={viewMode}
          />
        ))}
      </div>
    ) : (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateIcon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </div>
        <h3 className={styles.emptyStateTitle}>No sites found</h3>
        <p className={styles.emptyStateMessage}>
          Create your first site to get started with managing your projects
        </p>
      </div>
    )}
  </div>
);

export default SiteList;
