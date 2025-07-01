import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useToast } from '../components/ToastProvider';
import { authAPI } from '../utils/api';
import styles from './Settings.module.css';
import { useParams } from 'react-router-dom';
import CustomSpinner from '../components/CustomSpinner';

const Settings = () => {
    const { siteID } = useParams();
    const { showSuccess, showError, showInfo } = useToast();

    // State management
    const [supervisors, setSupervisors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showActionModal, setShowActionModal] = useState(false);
    const [showCredentialsModal, setShowCredentialsModal] = useState(false);
    const [selectedSupervisor, setSelectedSupervisor] = useState(null);
    const [actionType, setActionType] = useState(''); // 'changePassword', 'toggleStatus', 'delete', 'viewCredentials'
    
    // Form state for creating a new supervisor
    const [newSupervisorName, setNewSupervisorName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [visiblePasswords, setVisiblePasswords] = useState({}); // Track password visibility per supervisor

    // Load supervisors from user profile
    useEffect(() => {
        const loadSupervisors = async () => {
            setLoading(true);
            try {
                console.log('Loading supervisors for site:', siteID);
                // Get user profile which contains supervisors array
                const response = await authAPI.getProfile(siteID);
                if (response && response.user) {
                    // The supervisors array should now be populated with full supervisor objects
                    setSupervisors(response.user.supervisors || []);
                } else {
                    setSupervisors([]);
                }
            } catch (error) {
                console.error('Failed to load supervisors:', error);
                showError(error.message || 'Failed to load supervisor profiles');
                setSupervisors([]);
            } finally {
                setLoading(false);
            }
        };

        loadSupervisors();
    }, [siteID, showError]);

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // --- Handlers for actions ---

    const handleCreate = async () => {
        if (!newSupervisorName.trim()) {
            showError('Supervisor name is required.');
            return;
        }
        
        if (!siteID) {
            showError('Site ID is required to create supervisor.');
            return;
        }
        
        setIsSubmitting(true);
        
        try {
            const response = await authAPI.createSupervisor(newSupervisorName.trim(), siteID);
            
            if (response && response.supervisor) {
                // Add the new supervisor to the list
                setSupervisors(prev => [response.supervisor, ...prev]);
                setShowCreateModal(false);
                setNewSupervisorName('');
                showSuccess(`Successfully created profile for ${response.supervisor.profileName}. Username: ${response.supervisor.userId}, Password: ${response.supervisor.password}`);
            }
        } catch (error) {
            console.error('Failed to create supervisor:', error);
            showError(error.message || 'Failed to create supervisor profile');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAction = async () => {
        if (!selectedSupervisor || !actionType) return;

        setIsSubmitting(true);
        
        try {
            switch (actionType) {
                case 'changePassword': {
                    const response = await authAPI.changeSupervisorPassword({
                        userId: selectedSupervisor.userId
                    });
                    
                    if (response && response.newPassword) {
                        // Update supervisor in local state with new password
                        setSupervisors(prev =>
                            prev.map(sup =>
                                sup._id === selectedSupervisor._id
                                    ? { ...sup, password: response.newPassword, updatedAt: new Date().toISOString() }
                                    : sup
                            )
                        );
                        showSuccess(`Password for ${selectedSupervisor.profileName} has been reset to: ${response.newPassword}`);
                    }
                    break;
                }
                
                case 'toggleStatus': {
                    const response = await authAPI.toggleSupervisorStatus({
                        userId: selectedSupervisor.userId
                    });
                    
                    if (response && response.supervisor) {
                        // Update supervisor status in local state
                        setSupervisors(prev =>
                            prev.map(sup =>
                                sup._id === selectedSupervisor._id
                                    ? { ...sup, status: response.supervisor.status, updatedAt: response.supervisor.updatedAt }
                                    : sup
                            )
                        );
                        showInfo(`Status for ${selectedSupervisor.profileName} has been updated to ${response.supervisor.status}.`);
                    }
                    break;
                }
                
                case 'delete': {
                    await authAPI.deleteSupervisor({
                        userId: selectedSupervisor.userId
                    });
                    
                    // Remove supervisor from local state
                    setSupervisors(prev => prev.filter(sup => sup._id !== selectedSupervisor._id));
                    showSuccess(`${selectedSupervisor.profileName} has been deleted.`);
                    break;
                }
                
                default:
                    break;
            }
        } catch (error) {
            console.error(`Failed to ${actionType} supervisor:`, error);
            showError(error.message || `Failed to ${actionType} supervisor`);
        } finally {
            setIsSubmitting(false);
            setShowActionModal(false);
            setSelectedSupervisor(null);
        }
    };

    const openActionModal = (supervisor, type) => {
        setSelectedSupervisor(supervisor);
        setActionType(type);
        setShowActionModal(true);
    };

    // Toggle password visibility for a specific supervisor
    const togglePasswordVisibility = (supervisorId) => {
        setVisiblePasswords(prev => ({
            ...prev,
            [supervisorId]: !prev[supervisorId]
        }));
    };

    // View credentials in modal
    const viewCredentials = (supervisor) => {
        setSelectedSupervisor(supervisor);
        setShowCredentialsModal(true);
    };

    // --- Render Functions ---

    const renderActionModal = () => {
        if (!showActionModal || !selectedSupervisor) return null;

        const details = {
            changePassword: {
                title: 'Change Password',
                message: `Are you sure you want to reset the password for "${selectedSupervisor.profileName}"? A new password will be generated.`,
                buttonText: 'Reset Password',
                buttonClass: styles.changeBtn,
            },
            toggleStatus: {
                title: selectedSupervisor.status === 'active' ? 'Deactivate Supervisor' : 'Activate Supervisor',
                message: `Are you sure you want to ${selectedSupervisor.status === 'active' ? 'deactivate' : 'activate'} "${selectedSupervisor.profileName}"?`,
                buttonText: selectedSupervisor.status === 'active' ? 'Deactivate' : 'Activate',
                buttonClass: styles.toggleBtn,
            },
            delete: {
                title: 'Delete Supervisor Profile',
                message: `Are you sure you want to permanently delete "${selectedSupervisor.profileName}"? This action cannot be undone.`,
                buttonText: 'Delete',
                buttonClass: styles.deleteBtn,
            },
        }[actionType];

        return (
            <div className={styles.modalOverlay}>
                <div className={styles.modalContent}>
                    <h2>{details.title}</h2>
                    <p>{details.message}</p>
                    <div className={styles.modalActions}>
                        <button onClick={() => setShowActionModal(false)} disabled={isSubmitting} className={styles.cancelButton}>
                            Cancel
                        </button>
                        <button onClick={handleAction} disabled={isSubmitting} className={`${styles.submitButton} ${details.buttonClass}`}>
                            {isSubmitting ? <div className={styles.miniSpinner}></div> : details.buttonText}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderCreateModal = () => {
        if (!showCreateModal) return null;
        return (
            <div className={styles.modalOverlay}>
                <div className={styles.modalContent}>
                    <h2>Create New Supervisor Profile</h2>
                    <p>Enter a profile name to create a new supervisor with custom permissions.</p>
                    <div className={styles.formGroup}>
                        <label htmlFor="supervisorName">Profile Name</label>
                        <input
                            id="supervisorName"
                            type="text"
                            value={newSupervisorName}
                            onChange={(e) => setNewSupervisorName(e.target.value)}
                            placeholder="e.g., Main Gate Supervisor"
                            disabled={isSubmitting}
                        />
                    </div>
                    <div className={styles.modalActions}>
                        <button onClick={() => setShowCreateModal(false)} disabled={isSubmitting} className={styles.cancelButton}>
                            Cancel
                        </button>
                        <button onClick={handleCreate} disabled={isSubmitting || !newSupervisorName} className={styles.submitButton}>
                            {isSubmitting ? <div className={styles.miniSpinner}></div> : 'Create Profile'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderCredentialsModal = () => {
        if (!showCredentialsModal || !selectedSupervisor) return null;
        
        // Convert permissions object to array for display
        const permissionEntries = Object.entries(selectedSupervisor.permissions || {});
        
        const formatPermissionName = (key) => {
            return key.split('_').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
        };
        
        return (
            <div className={styles.modalOverlay}>
                <div className={styles.modalContent}>
                    <h2>Supervisor Credentials</h2>
                    <p>Profile details for "{selectedSupervisor.profileName}"</p>
                    
                    <div className={styles.credentialsDisplay}>
                        <div className={styles.credentialsGrid}>
                            <div className={styles.credentialsSection}>
                                <h3>Basic Information</h3>
                                <div className={styles.credentialField}>
                                    <label>User ID:</label>
                                    <div className={styles.credentialValue}>
                                        <span className={styles.credentialText}>{selectedSupervisor.userId}</span>
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(selectedSupervisor.userId);
                                                showSuccess('User ID copied to clipboard!');
                                            }}
                                            className={styles.copySmallBtn}
                                        >
                                            📋
                                        </button>
                                    </div>
                                </div>
                                
                                <div className={styles.credentialField}>
                                    <label>Password:</label>
                                    <div className={styles.credentialValue}>
                                        <span className={styles.credentialText}>
                                            {visiblePasswords[selectedSupervisor._id] ? selectedSupervisor.password : '••••••••••'}
                                        </span>
                                        <button 
                                            onClick={() => togglePasswordVisibility(selectedSupervisor._id)}
                                            className={styles.copySmallBtn}
                                            style={{ marginRight: '0.5rem' }}
                                        >
                                            {visiblePasswords[selectedSupervisor._id] ? '👁️' : '👁️‍🗨️'}
                                        </button>
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(selectedSupervisor.password);
                                                showSuccess('Password copied to clipboard!');
                                            }}
                                            className={styles.copySmallBtn}
                                        >
                                            📋
                                        </button>
                                    </div>
                                </div>
                                
                                <div className={styles.credentialField}>
                                    <label>Created By:</label>
                                    <span className={styles.credentialText}>{selectedSupervisor.createdBy}</span>
                                </div>
                            </div>
                            
                            <div className={styles.permissionsSection}>
                                <h3>Permissions</h3>
                                <div className={styles.permissionsList}>
                                    {permissionEntries.length > 0 ? (
                                        permissionEntries.map(([key, value]) => (
                                            <div key={key} className={styles.permissionItem}>
                                                <span className={styles.permissionName}>
                                                    {formatPermissionName(key)}
                                                </span>
                                                <span className={`${styles.permissionStatus} ${value ? styles.granted : styles.denied}`}>
                                                    {value ? '✓ Granted' : '✗ Denied'}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className={styles.noPermissions}>No permissions set</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className={styles.modalActions}>
                        <button 
                            onClick={() => {
                                setShowCredentialsModal(false);
                                setSelectedSupervisor(null);
                            }} 
                            className={styles.cancelButton}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className={styles.settingsContainer}>
            <Sidebar />
            <main className={styles.settingsContent}>
                <header className={styles.pageHeader}>
                    <div className={styles.titleSection}>
                        <h1>Settings</h1>
                        <p>Manage supervisor profiles and permissions for Site ID: {siteID}</p>
                    </div>
                    <button className={styles.createButton} onClick={() => setShowCreateModal(true)} disabled={loading}>
                        <span>&#43;</span> Create New
                    </button>
                </header>

                <section className={styles.contentSection}>
                    {loading ? (
                        <div className={styles.loadingState}>
                            <CustomSpinner size={70} color="#3b82f6" />
                        </div>
                    ) : supervisors.length === 0 ? (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>&#128272;</div>
                            <h3>No Supervisor Profiles Found</h3>
                            <p>Get started by creating the first supervisor profile for this site.</p>
                            <button className={styles.emptyActionButton} onClick={() => setShowCreateModal(true)}>
                                Create Profile
                            </button>
                        </div>
                    ) : (
                        <div className={styles.supervisorsList}>
                            {supervisors.map(sup => (
                                <div key={sup._id} className={styles.supervisorCard}>
                                    <div className={styles.cardHeader}>
                                        <div className={styles.supervisorInfo}>
                                            <h3>{sup.profileName}</h3>
                                            <span className={styles.username}>{sup.userId}</span>
                                        </div>
                                        <span className={`${styles.statusBadge} ${sup.status === 'active' ? styles.active : styles.inactive}`}>
                                            <span className={styles.statusDot}></span>
                                            {sup.status || 'active'}
                                        </span>
                                    </div>
                                    <div className={styles.cardDetails}>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Created On</span>
                                            <span className={styles.detailValue}>{formatDate(sup.createdAt)}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Created By</span>
                                            <span className={styles.detailValue}>{sup.createdBy}</span>
                                        </div>
                                    </div>
                                    <div className={styles.cardActions}>
                                        <button className={`${styles.actionBtn} ${styles.view}`} onClick={() => viewCredentials(sup)}>
                                            View Credentials
                                        </button>
                                        <button className={`${styles.actionBtn} ${styles.change}`} onClick={() => openActionModal(sup, 'changePassword')}>
                                            Reset Password
                                        </button>
                                        <button className={`${styles.actionBtn} ${styles.toggle}`} onClick={() => openActionModal(sup, 'toggleStatus')}>
                                            {(sup.status || 'active') === 'active' ? 'Deactivate' : 'Activate'}
                                        </button>
                                        <button className={`${styles.actionBtn} ${styles.delete}`} onClick={() => openActionModal(sup, 'delete')}>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
            {renderCreateModal()}
            {renderActionModal()}
            {renderCredentialsModal()}
        </div>
    );
};

export default Settings;
