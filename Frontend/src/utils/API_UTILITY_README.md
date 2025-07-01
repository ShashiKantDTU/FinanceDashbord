# API Utility Documentation

## Overview
The API utility (`api.js`) provides a centralized, authenticated HTTP client for the Finance Dashboard frontend. It handles authentication tokens, error management, and provides both specialized and generic API functions.

## Table of Contents
- [Installation & Setup](#installation--setup)
- [Configuration](#configuration)
- [Authentication Flow](#authentication-flow)
- [Core Functions](#core-functions)
- [API Functions](#api-functions)
- [Error Handling](#error-handling)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Installation & Setup

### Prerequisites
- React/Vite project
- Environment variables support
- localStorage available

### Import
```javascript
import api, { authAPI } from '../utils/api.js';
```

## Configuration

### Environment Variables
Create a `.env` file in your project root:
```env
VITE_API_BASE_URL=http://localhost:5000
```

### Default Configuration
- **Base URL**: `http://localhost:5000` (fallback)
- **Content-Type**: `application/json`
- **Authentication**: Bearer token from localStorage

## Authentication Flow

### Token Management
```javascript
// Token is automatically retrieved from localStorage
const token = localStorage.getItem('token');

// Automatically included in headers when available
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}` // Only if token exists
}
```

### Auto-Logout on 401
```javascript
// Automatic handling of unauthorized requests
if (response.status === 401) {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
  return null;
}
```

## Core Functions

### `getAuthToken()`
Retrieves the authentication token from localStorage.

```javascript
const token = getAuthToken();
// Returns: string | null
```

### `createAuthHeaders()`
Creates HTTP headers with authentication token.

```javascript
const headers = createAuthHeaders();
// Returns: {
//   'Content-Type': 'application/json',
//   'Authorization': 'Bearer <token>' // if token exists
// }
```

### `apiRequest(endpoint, options)`
Generic API request function with error handling.

```javascript
const response = await apiRequest('/api/endpoint', {
  method: 'POST',
  body: JSON.stringify(data)
});
```

**Parameters:**
- `endpoint` (string): API endpoint path
- `options` (object): Fetch options (method, body, etc.)

**Returns:** Promise resolving to response data or null

## API Functions

### Authentication API (`authAPI`)

#### Login
```javascript
const response = await authAPI.login({
  email: 'user@example.com',
  password: 'password123'
});

// Response: { token, user, message }
```

#### Register
```javascript
const response = await authAPI.register({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'password123'
});
```

#### Forgot Password
```javascript
const response = await authAPI.forgotPassword('user@example.com');
// Sends password reset email
```

#### Reset Password
```javascript
const response = await authAPI.resetPassword('reset-token', 'newPassword123');
```

#### Get Profile
```javascript
const profile = await authAPI.getProfile();
// Returns: user profile data
```

#### Verify Token
```javascript
const isValid = await authAPI.verifyToken();
// Returns: token validation result
```

#### Supervisor Management

##### Create Supervisor
```javascript
const supervisor = await authAPI.createSupervisor('Supervisor Name', 'site-id');
// Returns: { username, password, message }
```

##### Delete Supervisor
```javascript
const result = await authAPI.deleteSupervisor({
  username: 'supervisor-username',
  siteId: 'site-id'
});
```

##### Change Supervisor Password
```javascript
const result = await authAPI.changeSupervisorPassword({
  username: 'supervisor-username',
  siteId: 'site-id'
});
// Returns: { newPassword, message }
```

##### Toggle Supervisor Status
```javascript
const result = await authAPI.toggleSupervisorStatus({
  username: 'supervisor-username',
  siteId: 'site-id'
});
```

### Generic API (`api`)

#### GET Request
```javascript
const data = await api.get('/api/sites');
const userProfile = await api.get('/api/auth/profile');
```

#### POST Request
```javascript
const response = await api.post('/api/sites', {
  sitename: 'New Site',
  description: 'Site description'
});
```

#### PUT Request
```javascript
const response = await api.put('/api/sites/123', {
  sitename: 'Updated Site Name'
});
```

#### DELETE Request
```javascript
// Without body
const response = await api.delete('/api/sites/123');

// With body
const response = await api.delete('/api/sites/delete', {
  siteId: '123',
  confirm: true
});
```

## Error Handling

### Automatic Error Handling
```javascript
try {
  const data = await api.get('/api/endpoint');
  // Handle success
} catch (error) {
  // Error is automatically logged to console
  console.error('Request failed:', error.message);
}
```

### HTTP Status Codes
- **200-299**: Success - returns response data
- **401**: Unauthorized - auto-logout and redirect to login
- **Other errors**: Throws error with message

### Error Response Format
```javascript
// Successful response
{
  data: {...},
  message: "Success message"
}

// Error response (thrown as Error)
{
  message: "Error description",
  status: 400
}
```

## Usage Examples

### Complete Login Flow
```javascript
import api, { authAPI } from '../utils/api.js';

const handleLogin = async (credentials) => {
  try {
    const response = await authAPI.login(credentials);
    
    // Store token and user data
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    
    // Redirect to dashboard
    window.location.href = '/dashboard';
  } catch (error) {
    console.error('Login failed:', error.message);
    // Show error to user
  }
};
```

### Fetching Sites with Error Handling
```javascript
const [sites, setSites] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');

const fetchSites = async () => {
  try {
    setLoading(true);
    setError('');
    
    const response = await api.get('/api/dashboard/sites');
    setSites(response.sites || []);
  } catch (error) {
    setError('Failed to load sites. Please try again.');
    console.error('Error fetching sites:', error);
  } finally {
    setLoading(false);
  }
};
```

### Creating a New Site
```javascript
const addSite = async (siteName) => {
  try {
    const response = await api.post('/api/dashboard/sites', {
      sitename: siteName,
      createdBy: user.username
    });
    
    // Update UI with new site
    setSites(prev => [...prev, response.site]);
    showSuccess('Site created successfully!');
  } catch (error) {
    showError('Failed to create site: ' + error.message);
  }
};
```

### Using with React Hooks
```javascript
const useAPI = (endpoint) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await api.get(endpoint);
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [endpoint]);

  return { data, loading, error };
};

// Usage
const { data: sites, loading, error } = useAPI('/api/dashboard/sites');
```

## Best Practices

### 1. Error Handling
Always wrap API calls in try-catch blocks:
```javascript
try {
  const data = await api.get('/api/endpoint');
  // Handle success
} catch (error) {
  // Handle error appropriately
  showErrorToast(error.message);
}
```

### 2. Loading States
Show loading indicators during API calls:
```javascript
const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  setLoading(true);
  try {
    await api.post('/api/endpoint', data);
  } catch (error) {
    // Handle error
  } finally {
    setLoading(false);
  }
};
```

### 3. Token Management
Don't manually manage tokens - the utility handles this automatically:
```javascript
// ❌ Don't do this
const headers = {
  'Authorization': `Bearer ${localStorage.getItem('token')}`
};

// ✅ Do this instead
const data = await api.get('/api/endpoint');
// Token is automatically included
```

### 4. Environment Variables
Always use environment variables for API URLs:
```javascript
// ❌ Don't hardcode URLs
const API_URL = 'http://localhost:5000';

// ✅ Use environment variables
const API_URL = import.meta.env.VITE_API_BASE_URL;
```

### 5. Consistent Error Messages
Use consistent error handling patterns:
```javascript
const handleAPIError = (error, defaultMessage = 'Something went wrong') => {
  const message = error.message || defaultMessage;
  showErrorToast(message);
  console.error('API Error:', error);
};
```

## Troubleshooting

### Common Issues

#### 1. 401 Unauthorized Errors
**Symptoms:** Automatic logout, redirected to login
**Causes:**
- Expired token
- Invalid token
- Token not found in localStorage

**Solutions:**
- Check token expiration in backend
- Verify token format
- Ensure login stores token correctly

#### 2. CORS Errors
**Symptoms:** Network errors, blocked requests
**Causes:**
- Backend CORS not configured
- Wrong API base URL

**Solutions:**
```javascript
// Check environment variable
console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL);

// Verify backend CORS settings
// Backend should allow frontend origin
```

#### 3. Network Errors
**Symptoms:** Request failed, connection refused
**Causes:**
- Backend server not running
- Wrong port/URL
- Network connectivity issues

**Solutions:**
- Verify backend is running
- Check API_BASE_URL in environment
- Test endpoint directly in browser/Postman

#### 4. JSON Parse Errors
**Symptoms:** Unexpected token errors
**Causes:**
- Backend returning HTML instead of JSON
- Invalid response format

**Solutions:**
```javascript
// Debug response
const apiRequest = async (endpoint, options = {}) => {
  const response = await fetch(url, config);
  
  // Log response for debugging
  console.log('Response status:', response.status);
  console.log('Response headers:', response.headers);
  
  const text = await response.text();
  console.log('Response text:', text);
  
  try {
    const data = JSON.parse(text);
    return data;
  } catch (error) {
    console.error('JSON parse error:', error);
    throw new Error('Invalid response format');
  }
};
```

### Debug Mode
Enable detailed logging for debugging:
```javascript
// Add to top of api.js for debugging
const DEBUG = import.meta.env.VITE_DEBUG_API === 'true';

const apiRequest = async (endpoint, options = {}) => {
  if (DEBUG) {
    console.log('API Request:', {
      endpoint,
      options,
      url: `${API_BASE_URL}${endpoint}`
    });
  }
  
  // ... rest of function
  
  if (DEBUG) {
    console.log('API Response:', data);
  }
  
  return data;
};
```

### Performance Monitoring
Track API performance:
```javascript
const apiRequest = async (endpoint, options = {}) => {
  const startTime = performance.now();
  
  try {
    const result = await fetch(url, config);
    const endTime = performance.now();
    
    console.log(`API ${endpoint} took ${endTime - startTime} milliseconds`);
    return result;
  } catch (error) {
    const endTime = performance.now();
    console.error(`API ${endpoint} failed after ${endTime - startTime} milliseconds`);
    throw error;
  }
};
```

## Security Considerations

### 1. Token Storage
- Tokens are stored in localStorage (consider httpOnly cookies for production)
- Tokens are automatically cleared on 401 errors
- No manual token exposure in code

### 2. Request Security
- Always use HTTPS in production
- Validate data before sending
- Don't log sensitive information

### 3. Error Information
- Don't expose sensitive error details to users
- Log detailed errors for developers only
- Use generic error messages for users

---

**Last Updated:** June 30, 2025
**Version:** 1.0.0
**Maintainer:** Finance Dashboard Team