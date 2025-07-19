import StatsCard from './StatsCard';
import styles from './Home.module.css';

const StatsGrid = ({ sites }) => {
  const totalSites = sites.length;
  const recentSites = sites.filter(site => {
    const createdDate = new Date(site.createdAt);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return createdDate >= weekAgo;
  }).length;
  
  const activeSites = sites.filter(site => site.status !== 'inactive').length;
  
  const stats = [
    {
      title: "Total Sites",
      value: totalSites,
      subtitle: "All managed sites",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      color: "primary"
    },
    {
      title: "Active Sites",
      value: activeSites,
      subtitle: "Currently operational",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
          <path d="M8 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      color: "success"
    },
    {
      title: "Recent Sites",
      value: recentSites,
      subtitle: "Added this week",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      color: "info"
    }
  ];

  return (
    <div className={styles.statsGrid}>
      {stats.map((stat, index) => (
        <StatsCard 
          key={stat.title}
          title={stat.title} 
          value={stat.value}
          subtitle={stat.subtitle}
          icon={stat.icon}
          color={stat.color}
          index={index}
        />
      ))}
    </div>
  );
};

export default StatsGrid;
