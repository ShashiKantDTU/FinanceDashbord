import React from 'react';
import CustomSpinner from './CustomSpinner';

/**
 * Loading Component - Centralized loading component for the application
 * Now uses custom spinner instead of external library
 */
const Loading = ({ size = 60, color = '#3b82f6' }) => {
  return <CustomSpinner size={size} color={color} />;
};

export default Loading;