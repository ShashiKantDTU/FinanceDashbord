import styles from './Sidebar.module.css';
import SidebarCard from './SidebarCard';
import { FaBars, FaHome, FaChartLine, FaWallet, FaCog, FaUser, FaBell } from "react-icons/fa";
import { useEffect, useState, useRef, use } from 'react';
import { useParams } from 'react-router';


const Sidebar = ({ activeSection, onSectionChange }) => {
    const [sidebarstatus, setSidebarStatus] = useState(() => {
        const savedSidebarStatus = localStorage.getItem('sidebarStatus');
        return savedSidebarStatus || 'open';
    });

    useEffect(() => {
        localStorage.setItem('sidebarStatus', sidebarstatus);
    }, [sidebarstatus]);
    const sidebarRef = useRef(null);
    const siteID = useParams().siteID;
    // Navigation items
    const navigationItems = [
        { title: 'Home', icon: <FaHome />, path: `/` },
        { title: 'Attendance', icon: <FaChartLine />, path: `/attendance/${siteID}` },
        { title: 'Payments', icon: <FaWallet />, path: `/payments/${siteID}` },
        { title: 'Settings', icon: <FaCog />, path: `/settings/${siteID}` },
    ];
    
    // Store event handler references so they can be properly removed
    const handleMouseEnter = () => {
        if (sidebarstatus === 'close') {
            setSidebarStatus('open');
        }
    };
    
    const handleMouseLeave = () => {
        if (sidebarstatus === 'open') {
            setSidebarStatus('close');
        }
    };

    useEffect(() => {
        const sidebar = sidebarRef.current;
        
        if (!sidebar) return;

        // Remove all existing event listeners first
        sidebar.removeEventListener('mouseenter', handleMouseEnter);
        sidebar.removeEventListener('mouseleave', handleMouseLeave);
        
        if (sidebarstatus === 'Force-open') {
            sidebar.style.width = '250px';
            // Don't add any event listeners for Force-open state
            
        } else if (sidebarstatus === 'close') {
            sidebar.style.width = '40px';
            sidebar.addEventListener('mouseenter', handleMouseEnter);
            
        } else if (sidebarstatus === 'open') {
            sidebar.style.width = '250px';
            sidebar.addEventListener('mouseleave', handleMouseLeave);
        }
        
        // Cleanup function to remove event listeners when component unmounts
        return () => {
            sidebar.removeEventListener('mouseenter', handleMouseEnter);
            sidebar.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, [sidebarstatus]);
    const handleCardClick = (cardTitle) => {
        if (onSectionChange) {
            onSectionChange(cardTitle);
        }
        const selectedItem = navigationItems.find(item => item.title === cardTitle);
        if (selectedItem) {
            window.location.href = selectedItem.path;
        }
    };

    const handleHamburgerClick = () => {
        if (sidebarstatus === 'open') {
            setSidebarStatus('Force-open');
        } else if (sidebarstatus === 'close') {
            setSidebarStatus('Force-open');
        }else {
            setSidebarStatus('close');
        }
    };
    

    // Hamburger icon
    const hamburgerIcon = <FaBars className={styles.hamburgerIcon} />;    return (
        <>
        <div ref={sidebarRef} className={styles.sidebar}>
            <div className={styles.sidebartop}>
                <div className={styles.logoContainer}>
                    {sidebarstatus !== 'close' && <span className={styles.logoText}>Finance</span>}
                </div>
                <button onClick={handleHamburgerClick}>{hamburgerIcon}</button>
            </div>
            
            <div className={styles.navigationSection}>{navigationItems.map((item, index) => (
                    <SidebarCard
                        key={index}
                        title={item.title}
                        icon={item.icon}
                        isActive={activeSection === item.title}
                        onClick={handleCardClick}
                        isCollapsed={sidebarstatus === 'close'}
                    />
                ))}
            </div>
        </div>
        
        </>
    )
}

export default Sidebar;