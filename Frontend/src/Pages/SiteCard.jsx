import { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './Home.module.css';

const SiteCard = ({ site, onDelete, index, viewMode = "grid" }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete();
    setIsDeleting(false);
  };

  const cardStyle = viewMode === "list" ? styles.siteCardList : styles.siteCard;

  return (
    <div 
      className={cardStyle}
      style={{
        animationDelay: `${index * 0.1}s`
      }}
    >
      <div className={styles.cardHeader}>
        <div className={styles.siteIcon}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </div>
        <div className={styles.cardActions}>
          <Link 
            to={`/site/${site._id}`} 
            className={styles.viewButton}
            title="View Site Details"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/>
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </Link>
          <div className={styles.dropdownContainer}>
            <button
              className={styles.moreButton}
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
              title="More options"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="1" fill="currentColor"/>
                <circle cx="12" cy="5" r="1" fill="currentColor"/>
                <circle cx="12" cy="19" r="1" fill="currentColor"/>
              </svg>
            </button>
            {showDropdown && (
              <div className={styles.dropdown}>
                <Link
                  to={`/site/${site._id}/edit`}
                  className={styles.dropdownItem}
                  onClick={() => setShowDropdown(false)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2"/>
                    <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Edit Site
                </Link>
                <hr className={styles.dropdownDivider} />
                <button
                  className={`${styles.dropdownItem} ${styles.danger}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDropdown(false);
                    handleDelete();
                  }}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <div className={styles.spinner}></div>
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
        <h3 className={styles.siteCardTitle}>{site.sitename}</h3>
        <div className={styles.siteCardMeta}>
          <span className={styles.metaItem}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2"/>
              <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
            </svg>
            {site.createdBy}
          </span>
          <span className={styles.metaItem}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
              <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/>
              <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/>
              <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
            </svg>
            {site.createdAt ? new Date(site.createdAt).toLocaleDateString("en-US", { 
              month: "short", 
              day: "numeric",
              year: "numeric"
            }) : "N/A"}
          </span>
        </div>
        <Link to={`/site/${site._id}`} className={styles.viewDetailsLink}>
          View Details →
        </Link>
      </div>
    </div>
  );
};

export default SiteCard;
