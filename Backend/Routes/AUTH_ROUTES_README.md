# 🔐 Authentication Routes Documentation

This document provides comprehensive documentation for all authentication and user management routes in the Finance Dashboard backend API.

## 📋 Table of Contents

1. [User Registration & Authentication](#user-registration--authentication)
2. [Password Management](#password-management)
3. [User Profile Management](#user-profile-management)
4. [Supervisor Management](#supervisor-management)
5. [Utility Routes](#utility-routes)
6. [Authentication Middleware](#authentication-middleware)
7. [Error Handling](#error-handling)

---

## 🔑 User Registration & Authentication

### 1. User Registration
**POST** `/auth/register`

Registers a new user account in the system.

#### Request Body:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

#### Response:
```json
{
  "message": "User registered successfully"
}
```

#### How it works:
1. Checks if user already exists with the provided email
2. Hashes the password using bcrypt
3. Creates new user record in database
4. Returns success message

#### Error Cases:
- `400`: User already exists
- `500`: Database or hashing errors

---

### 2. User Login
**POST** `/auth/login`

Authenticates users (both Admins and Supervisors) and returns JWT token.

#### Request Body:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Response (Admin):
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "60f7b1b3e4b0c72b8c8b4567",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "Admin"
  }
}
```

#### Response (Supervisor):
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "60f7b1b3e4b0c72b8c8b4567",
    "name": "Jane Smith",
    "email": "jane1",
    "role": "Supervisor"
  }
}
```

#### How it works:
1. First checks if email belongs to a User (Admin)
   - Compares hashed password using bcrypt
   - Generates JWT token with Admin role
2. If not found, checks if email belongs to a Supervisor
   - Compares plain text password (supervisors use simple passwords)
   - Generates JWT token with Supervisor role
3. Returns appropriate user data and token

#### Error Cases:
- `400`: Invalid email or password
- `500`: Database errors

---

## 🔒 Password Management

### 3. Forgot Password
**POST** `/auth/forgot-password`

Initiates password reset process by sending reset email.

#### Request Body:
```json
{
  "email": "user@example.com"
}
```

#### Response:
```json
{
  "message": "If an account with that email exists, password reset instructions have been sent."
}
```

#### How it works:
1. Validates email input
2. Finds user by email (case-insensitive)
3. Generates cryptographically secure reset token
4. Sets token expiry (1 hour from creation)
5. Saves token to user record
6. Sends password reset email with token
7. Returns generic success message (security feature)

#### Error Cases:
- `400`: Email not provided
- `500`: Email sending failed or database errors

---

### 4. Reset Password
**POST** `/auth/reset-password`

Completes password reset using token from email.

#### Request Body:
```json
{
  "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "password": "newpassword123"
}
```

#### Response:
```json
{
  "message": "Password has been successfully reset. You can now log in with your new password."
}
```

#### How it works:
1. Validates token and password input
2. Checks password length (minimum 4 characters)
3. Finds user with valid, non-expired reset token
4. Hashes new password
5. Updates user password and clears reset token
6. Saves changes to database

#### Error Cases:
- `400`: Missing token/password, password too short, invalid/expired token
- `500`: Database errors

---

## 👤 User Profile Management

### 5. Get User Profile
**GET** `/auth/profile`

Retrieves authenticated user's profile information.

#### Headers:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response:
```json
{
  "message": "Profile retrieved successfully",
  "user": {
    "id": "60f7b1b3e4b0c72b8c8b4567",
    "name": "John Doe",
    "email": "john@example.com",
    "site": ["60f7b1b3e4b0c72b8c8b4568"],
    "supervisors": ["60f7b1b3e4b0c72b8c8b4569"],
    "createdAt": "2023-07-21T10:30:00.000Z",
    "updatedAt": "2023-07-21T10:30:00.000Z"
  }
}
```

#### How it works:
1. Middleware validates JWT token
2. Extracts user ID from token
3. Fetches user from database (excluding password)
4. Returns user profile data

#### Error Cases:
- `401`: Invalid/missing token
- `404`: User not found
- `500`: Database errors

---

### 6. Verify Token
**GET** `/auth/verify`

Verifies if JWT token is valid and returns user info.

#### Headers:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response:
```json
{
  "message": "Token is valid",
  "user": {
    "id": "60f7b1b3e4b0c72b8c8b4567",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "Admin"
  }
}
```

#### How it works:
1. Middleware validates JWT token
2. If token is valid, returns decoded token data
3. Used for frontend to check authentication status

#### Error Cases:
- `401`: Invalid/expired/missing token

---

## 👥 Supervisor Management

### 7. Create Supervisor Credentials
**POST** `/auth/supervisor-credentials/create`

Creates new supervisor credentials (Admin only).

#### Headers:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Request Body:
```json
{
  "name": "Jane Smith",
  "siteId": "60f7b1b3e4b0c72b8c8b4568"
}
```

#### Response:
```json
{
  "message": "Supervisor credentials created successfully",
  "supervisor": {
    "_id": "60f7b1b3e4b0c72b8c8b4569",
    "userId": "janesmith1",
    "password": "123456",
    "profileName": "Jane Smith",
    "createdBy": "John Doe",
    "site": "60f7b1b3e4b0c72b8c8b4568",
    "status": "active",
    "createdAt": "2023-07-21T10:30:00.000Z"
  }
}
```

#### How it works:
1. Validates admin authentication and role
2. Validates supervisor name and site ID
3. Checks if site exists in database
4. Generates unique credentials:
   - Username: `cleanname + serialnumber` (e.g., "janesmith1")
   - Password: 6-digit random number
5. Creates supervisor record in database
6. Adds supervisor to admin's supervisors array
7. Returns supervisor details including credentials

#### Error Cases:
- `401`: Unauthorized (not admin)
- `400`: Missing name or siteId
- `404`: Site not found, User not found
- `500`: Database errors, credential generation errors

---

### 8. Delete Supervisor Credentials
**DELETE** `/auth/supervisor-credentials/delete/`

Deletes supervisor credentials (Admin only).

#### Headers:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Request Body:
```json
{
  "supervisor": {
    "userId": "janesmith1"
  }
}
```

#### Response:
```json
{
  "message": "Supervisor credentials deleted successfully"
}
```

#### How it works:
1. Validates admin authentication and role
2. Finds supervisor by userId (without deleting yet)
3. Fetches admin user from database to check permissions
4. Verifies admin owns this supervisor
5. Deletes supervisor from Supervisor collection
6. Removes supervisor from admin's supervisors array
7. Saves admin user record

#### Error Cases:
- `401`: Unauthorized (not admin)
- `403`: Forbidden (admin doesn't own this supervisor)
- `404`: Supervisor not found, User not found
- `500`: Database errors

---

### 9. Change Supervisor Password
**POST** `/auth/supervisor-credentials/change-password`

Changes supervisor's password (Admin only).

#### Headers:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Request Body:
```json
{
  "supervisor": {
    "userId": "janesmith1"
  }
}
```

#### Response:
```json
{
  "message": "Supervisor password changed successfully",
  "newPassword": "654321"
}
```

#### How it works:
1. Validates admin authentication and role
2. Validates userId in request body
3. Finds supervisor by userId
4. Fetches admin user to verify ownership
5. Generates new 6-digit random password
6. Updates supervisor password in database
7. Returns new password to admin

#### Error Cases:
- `401`: Unauthorized (not admin)
- `400`: Missing userId
- `403`: Forbidden (admin doesn't own this supervisor)
- `404`: Supervisor not found, User not found
- `500`: Database errors

---

### 10. Toggle Supervisor Status
**POST** `/auth/supervisor-credentials/toggle-status`

Toggles supervisor status between active/inactive (Admin only).

#### Headers:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Request Body:
```json
{
  "supervisor": {
    "userId": "janesmith1"
  }
}
```

#### Response:
```json
{
  "message": "Supervisor status changed to inactive",
  "supervisor": {
    "_id": "60f7b1b3e4b0c72b8c8b4569",
    "userId": "janesmith1",
    "profileName": "Jane Smith",
    "status": "inactive",
    "updatedAt": "2023-07-21T10:30:00.000Z"
  }
}
```

#### How it works:
1. Validates admin authentication and role
2. Validates userId in request body
3. Finds supervisor by userId
4. Fetches admin user to verify ownership
5. Toggles status (active ↔ inactive)
6. Saves supervisor record
7. Returns updated supervisor data

#### Error Cases:
- `401`: Unauthorized (not admin)
- `400`: Missing userId
- `403`: Forbidden (admin doesn't own this supervisor)
- `404`: Supervisor not found, User not found
- `500`: Database errors

---

## 🛠️ Utility Routes

### 11. Test Email (Development Only)
**POST** `/auth/test-email`

Tests email configuration (disabled in production).

#### Request Body:
```json
{
  "testEmail": "test@example.com"
}
```

#### Response:
```json
{
  "message": "Test email sent successfully",
  "note": "Check your email inbox"
}
```

#### How it works:
1. Checks if environment is not production
2. Uses provided email or defaults to "test@example.com"
3. Generates test token
4. Sends password reset email using email service
5. Returns success/failure response

#### Error Cases:
- `404`: Not available in production
- `500`: Email sending errors

---

## 🔐 Authentication Middleware

### JWT Token Structure
```json
{
  "id": "user_id",
  "email": "user@example.com", 
  "name": "User Name",
  "role": "Admin|Supervisor",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Token Usage
Include in request headers:
```
Authorization: Bearer <jwt_token>
```

### Token Expiry
- Default: 7 days
- Configurable via JWT_SECRET environment variable

---

## ⚠️ Error Handling

### Standard Error Response Format
```json
{
  "message": "Error description",
  "error": "Detailed error (development only)"
}
```

### HTTP Status Codes Used

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful operations |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Authentication required/failed |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server/database errors |

---

## 🔧 Frontend Integration Examples

### Login Function
```javascript
const login = async (email, password) => {
  try {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Store token
      localStorage.setItem('authToken', data.token);
      // Store user data
      localStorage.setItem('user', JSON.stringify(data.user));
      return data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};
```

### Authenticated API Calls
```javascript
const makeAuthenticatedRequest = async (url, options = {}) => {
  const token = localStorage.getItem('authToken');
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  };
  
  const response = await fetch(url, config);
  
  if (response.status === 401) {
    // Token expired, redirect to login
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.href = '/login';
    return;
  }
  
  return response;
};
```

### Create Supervisor
```javascript
const createSupervisor = async (name, siteId) => {
  try {
    const response = await makeAuthenticatedRequest('/auth/supervisor-credentials/create', {
      method: 'POST',
      body: JSON.stringify({ name, siteId })
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Create supervisor error:', error);
    throw error;
  }
};
```

---

## 🔒 Security Considerations

### Password Security
- User passwords: Hashed with bcrypt (salt rounds: 10)
- Supervisor passwords: Plain text (6-digit numeric for simplicity)
- Reset tokens: Cryptographically secure random bytes

### Token Security
- JWT signed with secret key
- 7-day expiration by default
- Include role-based access control

### Data Validation
- Email format validation
- Password length requirements
- Input sanitization and trimming
- SQL injection protection via Mongoose

### Error Messages
- Generic messages for security-sensitive operations
- Detailed errors only in development environment
- No exposure of internal system details

---

## 📝 Environment Variables Required

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key

# Database
MONGODB_URI=mongodb://localhost:27017/finance-dashboard

# Email Configuration (for password reset)
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-email-password

# Environment
NODE_ENV=development|production
```

---

## 🚀 Getting Started

1. **Install Dependencies**
   ```bash
   npm install express mongoose bcrypt jsonwebtoken crypto
   ```

2. **Set Environment Variables**
   - Copy `.env.example` to `.env`
   - Fill in required values

3. **Start Server**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

4. **Test Routes**
   - Use Postman or similar API testing tool
   - Start with user registration
   - Login to get JWT token
   - Use token for protected routes

---

## 📞 Support

For questions or issues with these routes:
1. Check the error response for specific details
2. Verify environment variables are set correctly
3. Ensure database connection is working
4. Check JWT token format and expiry

---

*Last updated: June 30, 2025*
