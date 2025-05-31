import { useState } from 'react';
import styles from './SidebarCard.module.css';

const SidebarCard = ({ 
  title, 
  icon, 
  isActive = false, 
  onClick, 
  isCollapsed = false 
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (onClick) {
      onClick(title);
    }
  };

  return (
    <div 
      className={`${styles.sidebarCard} ${isActive ? styles.active : ''} ${isCollapsed ? styles.collapsed : ''}`}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={styles.cardContent}>
        <div className={styles.iconContainer}>
          {icon}
        </div>
        {!isCollapsed && (
          <div className={styles.textContainer}>
            <span className={styles.cardTitle}>{title}</span>
          </div>
        )}
      </div>
      
      {/* Tooltip for collapsed state */}
      {isCollapsed && isHovered && (
        <div className={styles.tooltip}>
          {title}
        </div>
      )}
      
      {/* Active indicator */}
      {isActive && <div className={styles.activeIndicator}></div>}
    </div>
  );
};

export default SidebarCard;