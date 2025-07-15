import { useState } from 'react';
import styles from './Home.module.css';

const AddSiteModal = ({ onClose, onSubmit }) => {
  const [siteName, setSiteName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!siteName.trim()) {
      setError('Site name is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit(siteName.trim());
    } catch (err) {
      setError(err.message || 'Failed to create site');
      setIsSubmitting(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Create New Site</h2>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            disabled={isSubmitting}
            type="button"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.inputGroup}>
            <label htmlFor="siteName">Site Name</label>
            <input
              id="siteName"
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="Enter site name (e.g., Construction Site A)"
              className={styles.siteInput}
              disabled={isSubmitting}
              autoFocus
              required
            />
          </div>

          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting || !siteName.trim()}
            >
              {isSubmitting ? (
                <>
                  <div className={styles.spinner}></div>
                  Creating...
                </>
              ) : (
                'Create Site'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddSiteModal;