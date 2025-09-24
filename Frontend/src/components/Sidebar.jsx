import styles from "./Sidebar.module.css";
import SidebarCard from "./SidebarCard";
import {
  FaBars,
  FaHome,
  FaChartLine,
  FaWallet,
  FaCog,
  FaUser,
  FaBell,
  FaHistory,
} from "react-icons/fa";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router";

const Sidebar = ({ activeSection, onSectionChange }) => {
  // Check if screen is small (mobile/tablet)
  const isSmallScreen = () => window.innerWidth <= 768;

  const [sidebarstatus, setSidebarStatus] = useState(() => {
    // For small screens, always start closed
    if (isSmallScreen()) {
      return "close";
    }
    const savedSidebarStatus = localStorage.getItem("sidebarStatus");
    return savedSidebarStatus || "open";
  });

  useEffect(() => {
    // Only save to localStorage if not on small screen
    if (!isSmallScreen()) {
      localStorage.setItem("sidebarStatus", sidebarstatus);
    }
  }, [sidebarstatus]);

  // Handle window resize to force close sidebar on small screens
  useEffect(() => {
    const handleResize = () => {
      if (isSmallScreen() && sidebarstatus !== "close") {
        setSidebarStatus("close");
      }
    };

    window.addEventListener("resize", handleResize);

    // Check on mount
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [sidebarstatus]);

  const sidebarRef = useRef(null);
  const timeoutRef = useRef(null);
  const siteID = useParams().siteID;
  // Navigation items
  const navigationItems = [
    { title: "Home", icon: <FaHome />, path: `/` },
    {
      title: "Attendance",
      icon: <FaChartLine />,
      path: `/attendance/${siteID}`,
    },
    { title: "Payments", icon: <FaWallet />, path: `/payments/${siteID}` },
    {
      title: "Site Expenses",
      icon: <FaChartLine />,
      path: `/site-expenses/${siteID}`,
    },
    {
      title: "Change Tracking",
      icon: <FaHistory />,
      path: `/change-tracking/${siteID}`,
    },
    {
      title: "Manage Supervisors",
      icon: <FaUser />,
      path: `/settings/${siteID}`,
    },
  ];

  // Store event handler references so they can be properly removed
  const handleMouseEnter = useCallback(() => {
    // Don't open sidebar on small screens
    if (isSmallScreen()) return;

    if (sidebarstatus === "close") {
      setSidebarStatus("open");

      // Set a timeout to auto-close if mouse leaves too quickly
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        const sidebar = sidebarRef.current;
        if (sidebar && sidebarstatus === "open") {
          // Check if mouse is still over the sidebar
          const rect = sidebar.getBoundingClientRect();
          const isMouseOver =
            document.elementFromPoint(
              rect.left + rect.width / 2,
              rect.top + rect.height / 2
            ) === sidebar ||
            sidebar.contains(
              document.elementFromPoint(
                rect.left + rect.width / 2,
                rect.top + rect.height / 2
              )
            );
          if (!isMouseOver) {
            setSidebarStatus("close");
          }
        }
      }, 100); // 100ms delay
    }
  }, [sidebarstatus]);

  const handleMouseLeave = useCallback(() => {
    if (sidebarstatus === "open") {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setSidebarStatus("close");
    }
  }, [sidebarstatus]);

  // Add a more robust mouse tracking system
  const handleMouseMove = useCallback(
    (e) => {
      const sidebar = sidebarRef.current;
      if (!sidebar || sidebarstatus === "Force-open") return;

      const rect = sidebar.getBoundingClientRect();
      const isMouseInside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (!isMouseInside && sidebarstatus === "open") {
        setSidebarStatus("close");
      }
    },
    [sidebarstatus]
  );

  useEffect(() => {
    const sidebar = sidebarRef.current;

    if (!sidebar) return;

    // Remove all existing event listeners first
    sidebar.removeEventListener("mouseenter", handleMouseEnter);
    sidebar.removeEventListener("mouseleave", handleMouseLeave);
    document.removeEventListener("mousemove", handleMouseMove);

    if (sidebarstatus === "Force-open") {
      sidebar.style.width = "250px";
      // Don't add any event listeners for Force-open state
    } else if (sidebarstatus === "close") {
      sidebar.style.width = "40px";
      // Only add hover events on larger screens
      if (!isSmallScreen()) {
        sidebar.addEventListener("mouseenter", handleMouseEnter);
      }
    } else if (sidebarstatus === "open") {
      sidebar.style.width = "250px";
      // Only add hover events on larger screens
      if (!isSmallScreen()) {
        sidebar.addEventListener("mouseleave", handleMouseLeave);
        // Add global mousemove listener to catch fast mouse movements
        document.addEventListener("mousemove", handleMouseMove);
      }
    }

    // Cleanup function to remove event listeners when component unmounts
    return () => {
      sidebar.removeEventListener("mouseenter", handleMouseEnter);
      sidebar.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mousemove", handleMouseMove);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [sidebarstatus, handleMouseEnter, handleMouseLeave, handleMouseMove]);

  const handleCardClick = (cardTitle) => {
    if (onSectionChange) {
      onSectionChange(cardTitle);
    }
    const selectedItem = navigationItems.find(
      (item) => item.title === cardTitle
    );
    if (selectedItem) {
      window.location.href = selectedItem.path;
    }
  };

  const handleHamburgerClick = () => {
    // On small screens, only allow Force-open or close states
    if (isSmallScreen()) {
      if (sidebarstatus === "Force-open") {
        setSidebarStatus("close");
      } else {
        setSidebarStatus("Force-open");
      }
      return;
    }

    // Normal behavior for larger screens
    if (sidebarstatus === "open") {
      setSidebarStatus("Force-open");
    } else if (sidebarstatus === "close") {
      setSidebarStatus("Force-open");
    } else {
      setSidebarStatus("close");
    }
  };

  // Hamburger icon
  const hamburgerIcon = <FaBars className={styles.hamburgerIcon} />;
  return (
    <>
      <div
        ref={sidebarRef}
        className={styles.sidebar}
        aria-label="Navigation sidebar"
        role="navigation"
      >
        <div className={styles.sidebartop}>
          <div className={styles.logoContainer}>
            {sidebarstatus !== "close" && (
              <span className={styles.logoText}>Finance</span>
            )}
          </div>
          <button
            onClick={handleHamburgerClick}
            aria-label="Toggle sidebar navigation"
            aria-expanded={sidebarstatus !== "close"}
          >
            {hamburgerIcon}
          </button>
        </div>

        <div className={styles.navigationSection}>
          {navigationItems.map((item, index) => (
            <SidebarCard
              key={index}
              title={item.title}
              icon={item.icon}
              isActive={activeSection === item.title}
              onClick={handleCardClick}
              isCollapsed={sidebarstatus === "close"}
            />
          ))}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
