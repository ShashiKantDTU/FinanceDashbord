# 🚀 Finance Dashboard Backend API Documentation

A comprehensive guide to using the Finance Dashboard Backend API with detailed explanations, examples, and best practices.

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication Routes](#authentication-routes)
   - [Login Route](#login-route)
3. [API Response Format](#api-response-format)
4. [Error Handling](#error-handling)
5. [Frontend Integration Examples](#frontend-integration-examples)

---

## 🏗️ Getting Started

### Base URL
```
http://localhost:5000
```

### Content Type
All requests should include the following header:
```
Content-Type: application/json
```

### Authentication
Protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## 🔐 Authentication Routes

All authentication routes are prefixed with `/api/auth`

### 🔑 Login Route

**Endpoint:** `POST /api/auth/login`

**Description:** Authenticates users (both Admins and Supervisors) and returns a JWT token for accessing protected routes.

#### Request Details

**URL:** `http://localhost:5000/api/auth/login`

**Method:** `POST`

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "yourpassword"
}
```

#### Request Body Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | ✅ Yes | User's email address or supervisor's userId |
| `password` | string | ✅ Yes | User's password (hashed for admins, plain text for supervisors) |

#### Response Examples

**✅ Successful Login (Admin User):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY0ZjJhNWI0ZTRiMGM3MmI4YzhiNDU2NyIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJuYW1lIjoiSm9obiBEb2UiLCJyb2xlIjoiQWRtaW4iLCJpYXQiOjE2OTQ2ODEyMzQsImV4cCI6MTY5NTI4NjAzNH0.abc123xyz789",
  "user": {
    "id": "64f2a5b4e4b0c72b8c8b4567",
    "name": "John Doe",
    "email": "admin@example.com",
    "role": "Admin"
  }
}
```

**✅ Successful Login (Supervisor User):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY0ZjJhNWI0ZTRiMGM3MmI4YzhiNDU2OCIsImVtYWlsIjoiamFuZXNtaXRoMSIsIm5hbWUiOiJKYW5lIFNtaXRoIiwicm9sZSI6IlN1cGVydmlzb3IiLCJpYXQiOjE2OTQ2ODEyMzQsImV4cCI6MTY5NTI4NjAzNH0.def456uvw012",
  "user": {
    "id": "64f2a5b4e4b0c72b8c8b4568",
    "name": "Jane Smith",
    "email": "janesmith1",
    "role": "Supervisor"
  }
}
```

**❌ Error Response (Invalid Credentials):**
```json
{
  "message": "Invalid email or password"
}
```

#### How The Login System Works

1. **Admin Authentication:**
   - System first checks if the provided email exists in the `User` collection
   - If found, compares the provided password with the stored hashed password using bcrypt
   - If valid, generates a JWT token with Admin role and user information

2. **Supervisor Authentication:**
   - If no admin user is found, system checks the `Supervisor` collection using the email as `userId`
   - Compares the plain text password directly (supervisors use simple 6-digit passwords)
   - If valid, generates a JWT token with Supervisor role and supervisor information

3. **JWT Token Generation:**
   - Token contains user ID, email, name, and role
   - Default expiration: 7 days
   - Signed with server's secret key

#### Status Codes

| Code | Status | Description |
|------|--------|-------------|
| `200` | ✅ OK | Login successful |
| `400` | ❌ Bad Request | Invalid email or password |
| `500` | ❌ Internal Server Error | Database connection issues or server errors |

#### Frontend Implementation Example

**JavaScript/Fetch API:**
```javascript
const loginUser = async (email, password) => {
  try {
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        password: password
      })
    });

    const data = await response.json();

    if (response.ok) {
      // Store the token for future requests
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      console.log('Login successful:', data.user);
      return data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Login error:', error.message);
    throw error;
  }
};

// Usage example
loginUser('admin@example.com', 'password123')
  .then(response => {
    // Redirect to dashboard or update UI
    window.location.href = '/dashboard';
  })
  .catch(error => {
    // Show error message to user
    alert('Login failed: ' + error.message);
  });
```

**React Hook Example:**
```javascript
import { useState } from 'react';

const useLogin = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = async (credentials) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { login, loading, error };
};

// Component usage
const LoginForm = () => {
  const { login, loading, error } = useLogin();
  const [formData, setFormData] = useState({ email: '', password: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(formData);
      // Handle successful login
    } catch (error) {
      // Error is already handled by the hook
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData({...formData, email: e.target.value})}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={formData.password}
        onChange={(e) => setFormData({...formData, password: e.target.value})}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  );
};
```

**Axios Example:**
```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

const authAPI = {
  login: async (credentials) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, credentials);
      
      // Store token
      localStorage.setItem('authToken', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  }
};

// Usage
authAPI.login({ email: 'user@example.com', password: 'password123' })
  .then(data => console.log('Logged in:', data.user))
  .catch(error => console.error('Login error:', error.message));
```

#### Security Considerations

1. **Password Handling:**
   - Admin passwords are hashed using bcrypt with salt rounds: 10
   - Supervisor passwords are stored as plain text (6-digit numbers for simplicity)
   - Never log or expose passwords in API responses

2. **Token Security:**
   - JWT tokens are signed with a secret key
   - Tokens expire after 7 days by default
   - Include role-based information for authorization

3. **Error Messages:**
   - Generic error messages for invalid credentials (security best practice)
   - No distinction between "user not found" vs "wrong password"

#### Testing the Login Route

**Using cURL:**
```bash
# Admin login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'

# Supervisor login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"janesmith1","password":"123456"}'
```

**Using Postman:**
1. Set method to `POST`
2. URL: `http://localhost:5000/api/auth/login`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
   ```json
   {
     "email": "admin@example.com",
     "password": "password123"
   }
   ```

---

## 📊 API Response Format

### Success Response Structure
```json
{
  "message": "Descriptive success message",
  "token": "JWT token (for auth endpoints)",
  "user": {
    "id": "user_id",
    "name": "User Name",
    "email": "user@example.com",
    "role": "Admin|Supervisor"
  }
}
```

### Error Response Structure
```json
{
  "message": "Error description",
  "error": "Detailed error message (development only)"
}
```

---

## ⚠️ Error Handling

### HTTP Status Codes

| Code | Status | Description |
|------|--------|-------------|
| `200` | OK | Request successful |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Invalid input data or credentials |
| `401` | Unauthorized | Authentication required or failed |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource not found |
| `500` | Internal Server Error | Server or database errors |

### Common Error Scenarios

1. **Missing required fields:**
   ```json
   {
     "message": "Email and password are required"
   }
   ```

2. **Invalid credentials:**
   ```json
   {
     "message": "Invalid email or password"
   }
   ```

3. **Server errors:**
   ```json
   {
     "message": "Error logging in",
     "error": "Database connection failed (development only)"
   }
   ```

---

## 🔧 Frontend Integration Examples

### Token Storage and Management

```javascript
// Utility functions for token management
const TokenManager = {
  // Store token
  setToken: (token) => {
    localStorage.setItem('authToken', token);
  },

  // Get token
  getToken: () => {
    return localStorage.getItem('authToken');
  },

  // Remove token
  removeToken: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  },

  // Check if token exists
  hasToken: () => {
    return !!localStorage.getItem('authToken');
  }
};

// Authenticated API request utility
const makeAuthenticatedRequest = async (url, options = {}) => {
  const token = TokenManager.getToken();
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    }
  };
  
  try {
    const response = await fetch(url, config);
    
    // Handle unauthorized responses
    if (response.status === 401) {
      TokenManager.removeToken();
      window.location.href = '/login';
      return null;
    }
    
    return response;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};
```

### Complete Login Flow Example

```javascript
const AuthService = {
  // Login function
  login: async (credentials) => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (response.ok) {
        // Store authentication data
        TokenManager.setToken(data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        return data;
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  },

  // Logout function
  logout: () => {
    TokenManager.removeToken();
    window.location.href = '/login';
  },

  // Get current user
  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return TokenManager.hasToken() && AuthService.getCurrentUser();
  }
};

// Usage in a React component
const LoginPage = () => {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await AuthService.login(credentials);
      console.log('Login successful:', result.user);
      
      // Redirect based on user role
      if (result.user.role === 'Admin') {
        window.location.href = '/admin-dashboard';
      } else {
        window.location.href = '/supervisor-dashboard';
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form onSubmit={handleLogin}>
        <h2>Login</h2>
        
        <input
          type="email"
          placeholder="Email"
          value={credentials.email}
          onChange={(e) => setCredentials({...credentials, email: e.target.value})}
          required
        />
        
        <input
          type="password"
          placeholder="Password"
          value={credentials.password}
          onChange={(e) => setCredentials({...credentials, password: e.target.value})}
          required
        />
        
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
        
        {error && <div className="error-message">{error}</div>}
      </form>
    </div>
  );
};
```

---

## 🔒 Next Steps

This documentation currently covers the **Login Route**. Additional routes will be documented including:

- User Registration (`POST /api/auth/register`)
- Password Reset (`POST /api/auth/forgot-password`)
- Token Verification (`GET /api/auth/verify`)
- User Profile (`GET /api/auth/profile`)
- Supervisor Management routes
- Dashboard routes
- Employee management routes

---

## 📞 Support

For questions or issues:
1. Check the error response for specific details
2. Verify the request format matches the examples
3. Ensure the server is running on `http://localhost:5000`
4. Check browser console for network errors

---

*Last updated: July 1, 2025*