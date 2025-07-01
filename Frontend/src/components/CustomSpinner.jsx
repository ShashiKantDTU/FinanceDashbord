import React from 'react';
import styles from './CustomSpinner.module.css';

/**
 * CustomSpinner Component - Triangle ball spinner animation
 * 
 * @param {Object} props - Component props
 * @param {number} props.size - Size of the spinner (default: 60)
 * @param {string} props.color - Color of the spinner balls (default: #3b82f6)
 * @param {boolean} props.visible - Whether spinner is visible (default: true)
 * @param {string} props.className - Additional CSS classes
 * @returns {JSX.Element} Custom spinner component
 */
const CustomSpinner = ({ 
  size = 60, 
  color = '#3b82f6', 
  visible = true, 
  className = '',
  ...props 
}) => {
  if (!visible) return null;

  const ballSize = size * 0.15; // Ball size relative to spinner size
  const containerStyle = {
    '--spinner-size': `${size}px`,
    '--ball-size': `${ballSize}px`,
    '--spinner-color': color,
  };

  return (
    <div 
      className={`${styles.spinnerContainer} ${className}`}
      style={containerStyle}
      {...props}
    >
      <div className={styles.triangleSpinner}>
        <div className={`${styles.ball} ${styles.ball1}`}></div>
        <div className={`${styles.ball} ${styles.ball2}`}></div>
        <div className={`${styles.ball} ${styles.ball3}`}></div>
      </div>
    </div>
  );
};

export default CustomSpinner;
