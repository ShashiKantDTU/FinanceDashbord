# 🏠 Dashboard API Documentation

Complete documentation for all dashboard-related endpoints in the Finance Dashboard Backend API.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Site Data Structure](#site-data-structure)
3. [Dashboard Routes](#dashboard-routes)
   - [Get Dashboard Home](#1-get-dashboard-home)
   - [Add New Site](#2-add-new-site)
   - [Delete Site](#3-delete-site)
4. [Error Handling](#error-handling)
5. [Frontend Integration Examples](#frontend-integration-examples)
6. [Complete Dashboard Manager](#complete-dashboard-manager)

---

## 🏗️ Overview

**Base URL:** `http://localhost:5000`

**Route Prefix:** `/api/dashboard`

**Authentication:** All routes require JWT token in Authorization header.

**Content Type:** `application/json`

The dashboard routes handle user dashboard data, site management, and user profile information. These endpoints provide the core functionality for the main dashboard interface where users can view their sites and manage their workspace.

---

## 🏢 Site Data Structure

### Core Site Schema

```javascript
{
  "_id": "6833ff004bd307e45abbfb41",
  "sitename": "Construction Site A",
  "CustomProfile": [],                    // Array of custom profile references
  "owner": "64f2a5b4e4b0c72b8c8b4567",   // User ObjectId who owns the site
  "createdBy": "admin@company.com",       // Email of the creator
  "createdAt": "2025-07-01T10:30:00.000Z",
  "updatedAt": "2025-07-01T10:30:00.000Z"
}
```

### User Dashboard Data Structure

```javascript
{
  "name": "John Doe",
  "email": "admin@company.com",
  "role": "Admin",
  "sites": [
    {
      "_id": "6833ff004bd307e45abbfb41",
      "sitename": "Construction Site A",
      "createdBy": "admin@company.com",
      "owner": "64f2a5b4e4b0c72b8c8b4567",
      "createdAt": "2025-07-01T10:30:00.000Z",
      "updatedAt": "2025-07-01T10:30:00.000Z"
    },
    {
      "_id": "6833ff004bd307e45abbfb42",
      "sitename": "Office Building Project",
      "createdBy": "admin@company.com",
      "owner": "64f2a5b4e4b0c72b8c8b4567",
      "createdAt": "2025-06-15T08:15:00.000Z",
      "updatedAt": "2025-06-15T08:15:00.000Z"
    }
  ]
}
```

---

## 🔧 Dashboard Routes

### 1. Get Dashboard Home

**Endpoint:** `GET /api/dashboard/home`

**Description:** Retrieves user dashboard data including user profile information and all associated sites. This is the main endpoint for loading the dashboard interface.

#### Request Details

**URL:** `http://localhost:5000/api/dashboard/home`

**Method:** `GET`

**Headers:**
```json
{
  "Authorization": "Bearer <jwt-token>"
}
```

**No Request Body Required**

#### Response Examples

**✅ Successful Response:**
```json
{
  "user": {
    "name": "John Doe",
    "email": "admin@company.com",
    "role": "Admin",
    "sites": [
      {
        "_id": "6833ff004bd307e45abbfb41",
        "sitename": "Construction Site A",
        "createdBy": "admin@company.com",
        "owner": "64f2a5b4e4b0c72b8c8b4567",
        "createdAt": "2025-07-01T10:30:00.000Z",
        "updatedAt": "2025-07-01T10:30:00.000Z"
      },
      {
        "_id": "6833ff004bd307e45abbfb42",
        "sitename": "Office Building Project",
        "createdBy": "admin@company.com",
        "owner": "64f2a5b4e4b0c72b8c8b4567",
        "createdAt": "2025-06-15T08:15:00.000Z",
        "updatedAt": "2025-06-15T08:15:00.000Z"
      }
    ]
  }
}
```

**❌ Error Responses:**

```json
// 401 Unauthorized - No authentication
{
  "error": "Access denied. Authentication required."
}

// 404 Not Found - User not found
{
  "error": "User not found."
}
```

#### How It Works

1. **Authentication Check:** Verifies JWT token and extracts user information
2. **User Lookup:** Finds user in database using email from JWT token
3. **Site Population:** Populates all sites associated with the user using MongoDB populate
4. **Response:** Returns user profile data with all associated site information

#### Frontend Implementation

```javascript
const getDashboardHome = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/dashboard/home', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('Dashboard data loaded:', data.user);
      return data.user;
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Failed to load dashboard:', error);
    throw error;
  }
};

// Usage example
getDashboardHome()
  .then(userData => {
    console.log(`Welcome ${userData.name}!`);
    console.log(`You have ${userData.sites.length} sites`);
    
    // Display sites
    userData.sites.forEach(site => {
      console.log(`- ${site.sitename} (Created: ${new Date(site.createdAt).toLocaleDateString()})`);
    });
  })
  .catch(error => {
    if (error.message.includes('Authentication required')) {
      // Redirect to login
      window.location.href = '/login';
    } else {
      alert('Failed to load dashboard: ' + error.message);
    }
  });
```

#### React Component Example

```javascript
import { useState, useEffect } from 'react';

const Dashboard = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const data = await getDashboardHome();
        setUserData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) return <div>Loading dashboard...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="dashboard">
      <h1>Welcome, {userData.name}!</h1>
      <p>Role: {userData.role}</p>
      
      <div className="sites-section">
        <h2>Your Sites ({userData.sites.length})</h2>
        {userData.sites.length === 0 ? (
          <p>No sites found. Create your first site below.</p>
        ) : (
          <div className="sites-grid">
            {userData.sites.map(site => (
              <div key={site._id} className="site-card">
                <h3>{site.sitename}</h3>
                <p>Created: {new Date(site.createdAt).toLocaleDateString()}</p>
                <p>Owner: {site.createdBy}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
```

---

### 2. Add New Site

**Endpoint:** `POST /api/dashboard/home/addsite`

**Description:** Creates a new site and associates it with the authenticated user. The site will be linked to the user's account and appear in their dashboard.

#### Request Details

**URL:** `http://localhost:5000/api/dashboard/home/addsite`

**Method:** `POST`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt-token>"
}
```

**Request Body:**
```json
{
  "sitename": "New Construction Site"
}
```

#### Request Body Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sitename` | string | ✅ Yes | Name of the new site (must not be empty) |

#### Response Examples

**✅ Successful Creation:**
```json
{
  "message": "Site created successfully",
  "site": {
    "_id": "6833ff004bd307e45abbfb43",
    "sitename": "New Construction Site",
    "CustomProfile": null,
    "owner": "64f2a5b4e4b0c72b8c8b4567",
    "createdBy": "admin@company.com",
    "createdAt": "2025-07-01T10:30:00.000Z",
    "updatedAt": "2025-07-01T10:30:00.000Z"
  }
}
```

**❌ Error Responses:**

```json
// 400 Bad Request - Missing site name
{
  "error": "Site name is required."
}

// 401 Unauthorized - No authentication
{
  "error": "Access denied. Authentication required."
}

// 404 Not Found - User not found
{
  "error": "User not found."
}

// 500 Internal Server Error - Database error
{
  "error": "Error creating site",
  "details": "Database connection failed"
}

// 500 Internal Server Error - Error linking to user
{
  "error": "Error linking site to user",
  "details": "Failed to update user document"
}
```

#### How It Works

1. **Authentication Check:** Verifies JWT token and user permissions
2. **Input Validation:** Validates that sitename is provided and not empty
3. **User Lookup:** Finds the authenticated user in the database
4. **Site Creation:** Creates new site document with user as owner
5. **User Update:** Adds site reference to user's sites array
6. **Rollback on Error:** If user update fails, automatically removes orphaned site
7. **Response:** Returns created site data

#### Frontend Implementation

```javascript
const addNewSite = async (sitename) => {
  try {
    const response = await fetch('http://localhost:5000/api/dashboard/home/addsite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        sitename: sitename.trim()
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('Site created successfully:', data.site);
      return data.site;
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Failed to create site:', error);
    throw error;
  }
};

// Usage example
const createSite = async (siteName) => {
  if (!siteName || siteName.trim().length === 0) {
    alert('Please enter a site name');
    return;
  }
  
  try {
    const newSite = await addNewSite(siteName);
    alert(`Site "${newSite.sitename}" created successfully!`);
    
    // Refresh dashboard data
    const updatedDashboard = await getDashboardHome();
    console.log('Dashboard updated with new site');
    
    return newSite;
  } catch (error) {
    alert('Failed to create site: ' + error.message);
  }
};
```

#### React Form Component

```javascript
import { useState } from 'react';

const AddSiteForm = ({ onSiteAdded }) => {
  const [sitename, setSitename] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!sitename.trim()) {
      setError('Site name is required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const newSite = await addNewSite(sitename);
      setSitename(''); // Clear form
      
      // Notify parent component
      if (onSiteAdded) {
        onSiteAdded(newSite);
      }
      
      alert('Site created successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="add-site-form">
      <h3>Create New Site</h3>
      
      <div className="form-group">
        <label htmlFor="sitename">Site Name:</label>
        <input
          type="text"
          id="sitename"
          value={sitename}
          onChange={(e) => setSitename(e.target.value)}
          placeholder="Enter site name"
          required
          disabled={loading}
        />
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <button type="submit" disabled={loading || !sitename.trim()}>
        {loading ? 'Creating...' : 'Create Site'}
      </button>
    </form>
  );
};

// Usage in parent component
const DashboardWithAddSite = () => {
  const [userData, setUserData] = useState(null);
  
  const handleSiteAdded = async (newSite) => {
    // Refresh dashboard data to show new site
    try {
      const updatedData = await getDashboardHome();
      setUserData(updatedData);
    } catch (error) {
      console.error('Failed to refresh dashboard:', error);
    }
  };
  
  return (
    <div>
      <Dashboard userData={userData} />
      <AddSiteForm onSiteAdded={handleSiteAdded} />
    </div>
  );
};
```

---

### 3. Delete Site

**Endpoint:** `DELETE /api/dashboard/delete-site`

**Description:** Deletes a site from the system. Only the site owner, creator, or admin users can delete a site. This action also removes the site reference from the user's sites array.

#### Request Details

**URL:** `http://localhost:5000/api/dashboard/delete-site`

**Method:** `DELETE`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <jwt-token>"
}
```

**Request Body:**
```json
{
  "siteName": "Construction Site A",
  "siteId": "6833ff004bd307e45abbfb41",
  "createdBy": "admin@company.com"
}
```

#### Request Body Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `siteName` | string | ✅ Yes | Name of the site to delete (for confirmation) |
| `siteId` | string | ✅ Yes | MongoDB ObjectId of the site to delete |
| `createdBy` | string | ✅ Yes | Email of the user who created the site |

#### Response Examples

**✅ Successful Deletion:**
```json
{
  "message": "Site deleted successfully"
}
```

**❌ Error Responses:**

```json
// 400 Bad Request - Missing required fields
{
  "error": "Site name, site ID, and created by are required."
}

// 401 Unauthorized - No authentication
{
  "error": "Access denied. Authentication required."
}

// 403 Forbidden - No permission to delete
{
  "error": "You do not have permission to delete this site."
}

// 404 Not Found - User not found
{
  "error": "User not found."
}

// 404 Not Found - Site not found
{
  "error": "Site not found."
}

// 500 Internal Server Error - Database error
{
  "error": "Error deleting site",
  "details": "Database operation failed"
}
```

#### Permission Logic

The system allows site deletion if the user meets any of these criteria:

1. **Site Creator:** User's email matches the `createdBy` field
2. **Site Owner:** User's ID matches the `owner` field
3. **Admin Role:** User has admin role in the system

#### How It Works

1. **Authentication Check:** Verifies JWT token and user permissions
2. **Input Validation:** Validates all required fields are provided
3. **User Lookup:** Finds the authenticated user in the database
4. **Site Verification:** Checks if the site exists in the database
5. **Permission Check:** Verifies user has permission to delete the site
6. **Site Deletion:** Removes site from the sites collection
7. **User Update:** Removes site reference from user's sites array
8. **Response:** Confirms successful deletion

#### Frontend Implementation

```javascript
const deleteSite = async (siteData) => {
  try {
    const response = await fetch('http://localhost:5000/api/dashboard/delete-site', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        siteName: siteData.sitename,
        siteId: siteData._id,
        createdBy: siteData.createdBy
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('Site deleted successfully');
      return data;
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Failed to delete site:', error);
    throw error;
  }
};

// Usage example with confirmation
const deleteSiteWithConfirmation = async (site) => {
  const confirmDelete = window.confirm(
    `Are you sure you want to delete "${site.sitename}"?\n\n` +
    `This action cannot be undone and will remove all associated data.`
  );
  
  if (!confirmDelete) {
    return;
  }
  
  try {
    await deleteSite(site);
    alert(`Site "${site.sitename}" deleted successfully!`);
    
    // Refresh dashboard data
    const updatedDashboard = await getDashboardHome();
    console.log('Dashboard updated after deletion');
    
    return true;
  } catch (error) {
    if (error.message.includes('permission')) {
      alert('You do not have permission to delete this site.');
    } else {
      alert('Failed to delete site: ' + error.message);
    }
    return false;
  }
};
```

#### React Component for Site Management

```javascript
import { useState } from 'react';

const SiteCard = ({ site, onSiteDeleted }) => {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${site.sitename}"?`
    );
    
    if (!confirmDelete) return;
    
    setDeleting(true);
    
    try {
      await deleteSite({
        sitename: site.sitename,
        _id: site._id,
        createdBy: site.createdBy
      });
      
      // Notify parent component
      if (onSiteDeleted) {
        onSiteDeleted(site._id);
      }
      
      alert('Site deleted successfully!');
    } catch (error) {
      alert('Failed to delete site: ' + error.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="site-card">
      <div className="site-header">
        <h3>{site.sitename}</h3>
        <button 
          onClick={handleDelete}
          disabled={deleting}
          className="delete-button"
        >
          {deleting ? 'Deleting...' : '🗑️ Delete'}
        </button>
      </div>
      
      <div className="site-details">
        <p><strong>Created:</strong> {new Date(site.createdAt).toLocaleDateString()}</p>
        <p><strong>Created By:</strong> {site.createdBy}</p>
        <p><strong>Last Updated:</strong> {new Date(site.updatedAt).toLocaleDateString()}</p>
      </div>
    </div>
  );
};

// Enhanced Dashboard with delete functionality
const DashboardWithDelete = () => {
  const [userData, setUserData] = useState(null);
  
  const handleSiteDeleted = (deletedSiteId) => {
    // Update local state to remove deleted site
    setUserData(prevData => ({
      ...prevData,
      sites: prevData.sites.filter(site => site._id !== deletedSiteId)
    }));
  };
  
  return (
    <div className="dashboard">
      <h1>Welcome, {userData?.name}!</h1>
      
      <div className="sites-section">
        <h2>Your Sites ({userData?.sites?.length || 0})</h2>
        
        {userData?.sites?.length === 0 ? (
          <p>No sites found.</p>
        ) : (
          <div className="sites-grid">
            {userData.sites.map(site => (
              <SiteCard 
                key={site._id}
                site={site}
                onSiteDeleted={handleSiteDeleted}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
```

---

## ⚠️ Error Handling

### Standard Error Response Format

```json
{
  "error": "Error description",
  "details": "Additional error details (optional)"
}
```

### Common HTTP Status Codes

| Code | Status | Description |
|------|--------|-------------|
| `200` | OK | Request successful |
| `201` | Created | Site created successfully |
| `400` | Bad Request | Invalid input data or missing required fields |
| `401` | Unauthorized | Authentication required or failed |
| `403` | Forbidden | Insufficient permissions for the requested action |
| `404` | Not Found | User or site not found |
| `500` | Internal Server Error | Server or database errors |

### Error Handling Best Practices

```javascript
const handleDashboardErrors = (error, operation) => {
  console.error(`Dashboard ${operation} failed:`, error);
  
  switch (true) {
    case error.message.includes('Authentication required'):
      // Clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      break;
      
    case error.message.includes('User not found'):
      alert('User account not found. Please contact support.');
      break;
      
    case error.message.includes('Site not found'):
      alert('Site not found. It may have been deleted by another user.');
      // Refresh dashboard to get current state
      window.location.reload();
      break;
      
    case error.message.includes('permission'):
      alert('You do not have permission to perform this action.');
      break;
      
    case error.message.includes('required'):
      alert('Please fill in all required fields.');
      break;
      
    default:
      alert(`Operation failed: ${error.message}`);
  }
};

// Usage in API calls
const safeApiCall = async (apiFunction, operation) => {
  try {
    return await apiFunction();
  } catch (error) {
    handleDashboardErrors(error, operation);
    throw error;
  }
};

// Example usage
const loadDashboard = () => safeApiCall(getDashboardHome, 'load');
const createSite = (name) => safeApiCall(() => addNewSite(name), 'create site');
const removeSite = (site) => safeApiCall(() => deleteSite(site), 'delete site');
```

---

## 🔧 Frontend Integration Examples

### Complete Dashboard Manager

```javascript
class DashboardManager {
  constructor(token, baseURL = 'http://localhost:5000') {
    this.token = token;
    this.baseURL = baseURL;
  }

  async apiRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error(`API request failed [${endpoint}]:`, error);
      throw error;
    }
  }

  // Get dashboard home data
  async getDashboardHome() {
    const response = await this.apiRequest('/api/dashboard/home');
    return response.user;
  }

  // Add new site
  async addSite(sitename) {
    const response = await this.apiRequest('/api/dashboard/home/addsite', {
      method: 'POST',
      body: JSON.stringify({ sitename })
    });
    return response.site;
  }

  // Delete site
  async deleteSite(siteData) {
    await this.apiRequest('/api/dashboard/delete-site', {
      method: 'DELETE',
      body: JSON.stringify({
        siteName: siteData.sitename,
        siteId: siteData._id,
        createdBy: siteData.createdBy
      })
    });
    return true;
  }

  // Get user info only (without sites)
  async getUserInfo() {
    const dashboardData = await this.getDashboardHome();
    return {
      name: dashboardData.name,
      email: dashboardData.email,
      role: dashboardData.role
    };
  }

  // Get sites only
  async getSites() {
    const dashboardData = await this.getDashboardHome();
    return dashboardData.sites;
  }

  // Check if user can delete a site
  canDeleteSite(site, currentUserEmail, currentUserRole) {
    return (
      site.createdBy === currentUserEmail ||
      currentUserRole === 'admin' ||
      currentUserRole === 'Admin'
    );
  }

  // Bulk operations
  async addMultipleSites(siteNames) {
    const results = [];
    for (const sitename of siteNames) {
      try {
        const site = await this.addSite(sitename);
        results.push({ success: true, site, sitename });
      } catch (error) {
        results.push({ success: false, error: error.message, sitename });
      }
    }
    return results;
  }

  async deleteMultipleSites(sites) {
    const results = [];
    for (const site of sites) {
      try {
        await this.deleteSite(site);
        results.push({ success: true, siteId: site._id, sitename: site.sitename });
      } catch (error) {
        results.push({ success: false, error: error.message, siteId: site._id });
      }
    }
    return results;
  }
}

// Usage example
const dashboardManager = new DashboardManager(localStorage.getItem('token'));

// Complete dashboard application example
class DashboardApp {
  constructor() {
    this.manager = new DashboardManager(localStorage.getItem('token'));
    this.userData = null;
  }

  async initialize() {
    try {
      this.userData = await this.manager.getDashboardHome();
      this.render();
    } catch (error) {
      this.handleError(error);
    }
  }

  async addSite(sitename) {
    try {
      const newSite = await this.manager.addSite(sitename);
      console.log('Site added:', newSite);
      
      // Update local data
      this.userData.sites.push(newSite);
      this.render();
      
      return newSite;
    } catch (error) {
      this.handleError(error);
    }
  }

  async deleteSite(site) {
    if (!this.manager.canDeleteSite(site, this.userData.email, this.userData.role)) {
      alert('You do not have permission to delete this site.');
      return;
    }

    const confirmDelete = confirm(`Are you sure you want to delete "${site.sitename}"?`);
    if (!confirmDelete) return;

    try {
      await this.manager.deleteSite(site);
      console.log('Site deleted:', site.sitename);
      
      // Update local data
      this.userData.sites = this.userData.sites.filter(s => s._id !== site._id);
      this.render();
      
      return true;
    } catch (error) {
      this.handleError(error);
    }
  }

  render() {
    console.log('=== DASHBOARD ===');
    console.log(`Welcome, ${this.userData.name}! (${this.userData.role})`);
    console.log(`Email: ${this.userData.email}`);
    console.log(`Sites: ${this.userData.sites.length}`);
    
    this.userData.sites.forEach((site, index) => {
      console.log(`${index + 1}. ${site.sitename}`);
      console.log(`   Created: ${new Date(site.createdAt).toLocaleDateString()}`);
      console.log(`   By: ${site.createdBy}`);
    });
  }

  handleError(error) {
    if (error.message.includes('Authentication required')) {
      console.log('Session expired. Please login again.');
      localStorage.removeItem('token');
      // Redirect to login page
    } else {
      console.error('Dashboard error:', error.message);
    }
  }
}

// Initialize dashboard application
const dashboard = new DashboardApp();
dashboard.initialize();
```

### React Hook for Dashboard Management

```javascript
import { useState, useEffect, useCallback } from 'react';

const useDashboard = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const dashboardManager = new DashboardManager(localStorage.getItem('token'));

  // Load dashboard data
  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dashboardManager.getDashboardHome();
      setUserData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Add site
  const addSite = useCallback(async (sitename) => {
    try {
      const newSite = await dashboardManager.addSite(sitename);
      setUserData(prev => ({
        ...prev,
        sites: [...prev.sites, newSite]
      }));
      return newSite;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Delete site
  const deleteSite = useCallback(async (site) => {
    try {
      await dashboardManager.deleteSite(site);
      setUserData(prev => ({
        ...prev,
        sites: prev.sites.filter(s => s._id !== site._id)
      }));
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Load dashboard on mount
  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return {
    userData,
    loading,
    error,
    loadDashboard,
    addSite,
    deleteSite,
    canDeleteSite: (site) => dashboardManager.canDeleteSite(
      site,
      userData?.email,
      userData?.role
    )
  };
};

// Usage in React component
const DashboardComponent = () => {
  const {
    userData,
    loading,
    error,
    addSite,
    deleteSite,
    canDeleteSite
  } = useDashboard();

  const [newSiteName, setNewSiteName] = useState('');

  const handleAddSite = async (e) => {
    e.preventDefault();
    if (!newSiteName.trim()) return;

    try {
      await addSite(newSiteName);
      setNewSiteName('');
      alert('Site added successfully!');
    } catch (error) {
      alert('Failed to add site: ' + error.message);
    }
  };

  const handleDeleteSite = async (site) => {
    if (!canDeleteSite(site)) {
      alert('You do not have permission to delete this site.');
      return;
    }

    const confirmDelete = window.confirm(`Delete "${site.sitename}"?`);
    if (!confirmDelete) return;

    try {
      await deleteSite(site);
      alert('Site deleted successfully!');
    } catch (error) {
      alert('Failed to delete site: ' + error.message);
    }
  };

  if (loading) return <div>Loading dashboard...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="dashboard">
      <header>
        <h1>Welcome, {userData.name}!</h1>
        <p>Role: {userData.role} | Email: {userData.email}</p>
      </header>

      <section>
        <h2>Add New Site</h2>
        <form onSubmit={handleAddSite}>
          <input
            type="text"
            value={newSiteName}
            onChange={(e) => setNewSiteName(e.target.value)}
            placeholder="Site name"
            required
          />
          <button type="submit">Add Site</button>
        </form>
      </section>

      <section>
        <h2>Your Sites ({userData.sites.length})</h2>
        {userData.sites.length === 0 ? (
          <p>No sites found. Create your first site above.</p>
        ) : (
          <div className="sites-grid">
            {userData.sites.map(site => (
              <div key={site._id} className="site-card">
                <h3>{site.sitename}</h3>
                <p>Created: {new Date(site.createdAt).toLocaleDateString()}</p>
                <p>By: {site.createdBy}</p>
                
                {canDeleteSite(site) && (
                  <button 
                    onClick={() => handleDeleteSite(site)}
                    className="delete-btn"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
```

---

## 🎯 Best Practices

### 1. Authentication
- Always check for valid JWT tokens before making requests
- Handle authentication errors by redirecting to login
- Store tokens securely and remove on logout

### 2. Error Handling
- Implement comprehensive error handling for all scenarios
- Provide user-friendly error messages
- Log errors for debugging while protecting sensitive information

### 3. User Experience
- Show loading states during API operations
- Provide confirmation dialogs for destructive actions (site deletion)
- Update UI optimistically where appropriate

### 4. Performance
- Cache dashboard data when possible
- Update local state after successful operations to avoid unnecessary refetches
- Implement proper loading and error states

### 5. Security
- Validate user permissions before showing UI controls
- Double-check permissions on the backend
- Never expose sensitive data in error messages

---

## 📞 Support

For questions or issues with dashboard routes:
1. Check the error response for specific details
2. Verify JWT token validity and user permissions
3. Ensure request body format matches the documentation
4. Check network connectivity and server status
5. Verify site ownership and permissions for deletion operations

---

*Last updated: July 1, 2025*
