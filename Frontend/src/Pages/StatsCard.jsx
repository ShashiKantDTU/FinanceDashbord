import styles from './Home.module.css';

const StatsCard = ({ title, value, icon, index }) => (
  <div 
    className={styles.statsCard}
    style={{
      animationDelay: `${index * 0.2}s`
    }}
  >
    <div className={styles.statsCardIcon}>
      {icon}
    </div>
    <div className={styles.statsCardContent}>
      <p className={styles.statsCardValue}>{value}</p>
      <p className={styles.statsCardTitle}>{title}</p>
    </div>
  </div>
);

export default StatsCard;
