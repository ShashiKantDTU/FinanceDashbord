import StatsCard from './StatsCard';
import styles from './Home.module.css';

const StatsGrid = ({ sites }) => {
  const totalSites = sites.length;
  
  const stats = [
    {
      title: "Total Sites",
      value: totalSites,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      )
    }
  ];

  return (
    <div className={styles.statsGrid}>
      {stats.map((stat, index) => (
        <StatsCard 
          key={stat.title}
          title={stat.title} 
          value={stat.value}
          icon={stat.icon}
          index={index}
        />
      ))}
    </div>
  );
};

export default StatsGrid;
