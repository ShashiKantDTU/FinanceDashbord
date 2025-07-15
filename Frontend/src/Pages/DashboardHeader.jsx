import LogoutButton from "../components/LogoutButton_new";
import styles from './Home.module.css';

const DashboardHeader = ({ 
  user, 
  searchTerm, 
  onSearchChange, 
  sortBy, 
  onSortChange, 
  onAddSiteClick 
}) => (
  <header className={styles.header}>
    <div>
      <h1 className={styles.headerTitle}>Dashboard</h1>
      <p className={styles.headerSubtitle}>
        Welcome back, {user?.name || user?.email || "User"}
      </p>
    </div>
    <div className={styles.headerControls}>
      <input
        type="text"
        placeholder="Search sites..."
        value={searchTerm}
        onChange={onSearchChange}
        className={styles.searchInput}
      />
      <select 
        value={sortBy} 
        onChange={onSortChange} 
        className={styles.sortSelect}
      >
        <option value="name">Sort by Name</option>
        <option value="date">Sort by Date</option>
        <option value="creator">Sort by Creator</option>
      </select>
      <button 
        onClick={onAddSiteClick} 
        className={styles.addButton}
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
  </header>
);

export default DashboardHeader;
