import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SubscriptionModal.module.css';

const SubscriptionModal = ({ isOpen, onClose, currentEmployeeCount = 0 }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleUpgradeClick = () => {
    // Navigate to payments/subscription page
    navigate('/payments');
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>🚀 Upgrade Required</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className={styles.modalBody}>
          <div className={styles.limitInfo}>
            <div className={styles.limitIcon}>⚠️</div>
            <h3>Employee Limit Reached</h3>
            <p>
              You currently have <strong>{currentEmployeeCount}</strong> employees for this month.
              Free plan users are limited to <strong>20 employees per month</strong>.
            </p>
          </div>

          <div className={styles.upgradeOptions}>
            <h4>Upgrade to unlock more employees:</h4>
            
            <div className={styles.planCard}>
              <div className={styles.planHeader}>
                <h5>Contractor Pro</h5>
                <div className={styles.planPrice}>₹299/month</div>
              </div>
              <ul className={styles.planFeatures}>
                <li>✅ Unlimited employees</li>
                <li>✅ Advanced reporting</li>
                <li>✅ Priority support</li>
                <li>✅ Export to Excel/PDF</li>
              </ul>
            </div>

            <div className={styles.planCard}>
              <div className={styles.planHeader}>
                <h5>Haazri Automate</h5>
                <div className={styles.planPrice}>₹499/month</div>
              </div>
              <ul className={styles.planFeatures}>
                <li>✅ Everything in Contractor Pro</li>
                <li>✅ Automated attendance tracking</li>
                <li>✅ GPS location tracking</li>
                <li>✅ Mobile app access</li>
                <li>✅ Real-time notifications</li>
              </ul>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelButton} onClick={onClose}>
            Maybe Later
          </button>
          <button className={styles.upgradeButton} onClick={handleUpgradeClick}>
            Upgrade Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionModal;