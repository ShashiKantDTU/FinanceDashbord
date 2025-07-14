// API utility functions for handling authenticated requests

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token');
};

// Create headers with auth token
const createAuthHeaders = () => {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
};

// Generic API request function
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: createAuthHeaders(),
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    // Only redirect on 401 if user was previously authenticated and now gets unauthorized
    // This handles cases like expired tokens, but not login failures
    if (response.status === 401) {
      const isAuthEndpoint = endpoint.includes('/auth/login') || 
                            endpoint.includes('/auth/register') || 
                            endpoint.includes('/auth/forgot-password') ||
                            endpoint.includes('/auth/loginv2')|| 
                            endpoint.includes('/auth/reset-password');
      
      // If this is an auth endpoint (login, register, etc.), don't redirect - let the error bubble up
      if (isAuthEndpoint) {
        const data = await response.json();
        throw new Error(data.message || 'Authentication failed');
      }
      
      // For non-auth endpoints, this means the user's session expired - redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return null;
    }

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong');
    }

    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// Auth API functions
export const authAPI = {
  login: async (credentials) => {
    return apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  otplogin: async (token) => {
    return apiRequest('/api/auth/otplogin',{
      method : 'POST',
      body: JSON.stringify(token),
    });
  },

  register: async (userData) => {
    return apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  forgotPassword: async (email) => {
    return apiRequest('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  resetPassword: async (token, password) => {
    return apiRequest('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  getProfile: async (siteId) => {
    const endpoint = siteId ? `/api/auth/profile/${siteId}` : '/api/auth/profile/';
    return apiRequest(endpoint);
  },

  verifyToken: async () => {
    return apiRequest('/api/auth/verify');
  },

  // Supervisor credential management
  createSupervisor: async (name, siteId) => {
    return apiRequest('/api/auth/supervisor-credentials/create', {
      method: 'POST',
      body: JSON.stringify({ name, siteId }),
    });
  },

  deleteSupervisor: async (supervisor) => {
    return apiRequest('/api/auth/supervisor-credentials/delete/', {
      method: 'DELETE',
      body: JSON.stringify({ supervisor }),
    });
  },

  changeSupervisorPassword: async (supervisor) => {
    return apiRequest('/api/auth/supervisor-credentials/change-password', {
      method: 'POST',
      body: JSON.stringify({ supervisor }),
    });
  },

  toggleSupervisorStatus: async (supervisor) => {
    return apiRequest('/api/auth/supervisor-credentials/toggle-status', {
      method: 'POST',
      body: JSON.stringify({ supervisor }),
    });
  },
};

// Generic API functions
export const api = {
  get: (endpoint, options = {}) => {
    // Handle query parameters
    if (options.params) {
      const searchParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value);
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        endpoint += (endpoint.includes('?') ? '&' : '?') + queryString;
      }
    }
    return apiRequest(endpoint, options);
  },
  post: (endpoint, data) => apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  put: (endpoint, data) => apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (endpoint, data) => apiRequest(endpoint, {
    method: 'DELETE',
    ...(data && { body: JSON.stringify(data) }),
  }),
};

export default api;
