import styles from "./Home.module.css";

const StatsCard = ({
  title,
  value,
  subtitle,
  icon,
  color = "primary",
  index,
}) => (
  <div
    className={`${styles.statsCard} ${
      styles[`statsCard${color.charAt(0).toUpperCase() + color.slice(1)}`] || ""
    }`}
    style={{
      animationDelay: `${index * 0.1}s`,
    }}
  >
    <div
      className={`${styles.statsCardIcon} ${
        styles[
          `statsCardIcon${color.charAt(0).toUpperCase() + color.slice(1)}`
        ] || styles.statsCardIcon
      }`}
    >
      {icon}
    </div>
    <div className={styles.statsCardContent}>
      <p className={styles.statsCardValue}>{value}</p>
      <p className={styles.statsCardTitle}>{title}</p>
      {subtitle && <p className={styles.statsCardSubtitle}>{subtitle}</p>}
    </div>
  </div>
);

export default StatsCard;
