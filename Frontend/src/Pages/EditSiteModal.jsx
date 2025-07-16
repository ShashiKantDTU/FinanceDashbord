import React, { useState, useEffect } from "react";
import styles from "./Home.module.css";

const EditSiteModal = ({ isOpen, onClose, onSubmit, site }) => {
  const [siteName, setSiteName] = useState(site?.sitename || "");
  const [error, setError] = useState("");

  useEffect(() => {
    setSiteName(site?.sitename || "");
    setError("");
  }, [site]);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    if (!siteName.trim()) {
      setError("Site name cannot be empty.");
      return;
    }
    if (siteName.trim() === site.sitename) {
      setError("No changes detected.");
      return;
    }
    // Placeholder for API call
    onSubmit(siteName.trim());
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2>Edit Site Name</h2>
        <form onSubmit={handleSave} className={styles.modalForm}>
          <input
            type="text"
            value={siteName}
            onChange={e => setSiteName(e.target.value)}
            placeholder="Enter new site name"
            autoFocus
            className={styles.modalInput || styles.siteInput}
          />
          {error && <div className={styles.modalError || styles.errorMessage}>{error}</div>}
          <div className={styles.modalActions}>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Cancel
            </button>
            <button type="submit" className={styles.saveButton || styles.submitButton}>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditSiteModal; 