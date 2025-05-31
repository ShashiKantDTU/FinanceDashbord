import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const LogoutButton = ({ className = '', children = 'Logout' }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <button
      onClick={handleLogout}
      className={className}
      style={{
        background: 'rgba(239, 68, 68, 0.1)',
        color: '#f87171',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        padding: '0.5rem 1rem',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem'
      }}
      onMouseEnter={(e) => {
        e.target.style.background = 'rgba(239, 68, 68, 0.2)';
        e.target.style.borderColor = 'rgba(239, 68, 68, 0.5)';
      }}
      onMouseLeave={(e) => {
        e.target.style.background = 'rgba(239, 68, 68, 0.1)';
        e.target.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {children}
    </button>
  );
};

export default LogoutButton;
