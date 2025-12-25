# Login System Documentation

## Finance Dashboard - Complete Authentication & Authorization Guide

This document provides a comprehensive overview of the authentication and authorization system used in the Finance Dashboard application. It covers all login methods, role-based access control, and protected endpoints.

---

## Table of Contents

1. [Authentication Overview](#authentication-overview)
2. [User Roles](#user-roles)
3. [Login Methods](#login-methods)
   - [OTP-Based Login (WhatsApp)](#1-otp-based-login-whatsapp)
   - [Firebase OTP Login](#2-firebase-otp-login)
   - [Truecaller Login](#3-truecaller-login)
   - [Email/Password Login (Admin)](#4-emailpassword-login-admin)
   - [Supervisor Login](#5-supervisor-login)
   - [Super Admin Login](#6-super-admin-login)
4. [JWT Token System](#jwt-token-system)
5. [Authentication Middleware](#authentication-middleware)
6. [Role-Based Access Control](#role-based-access-control)
7. [Protected Endpoints Reference](#protected-endpoints-reference)
8. [Password Management](#password-management)
9. [Session & Token Management](#session--token-management)
10. [Security Considerations](#security-considerations)

---

## Authentication Overview

The Finance Dashboard uses a **JWT (JSON Web Token)** based authentication system with multiple login methods to accommodate different user types and platforms:

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   User Request                                                  │
│        │                                                        │
│        ▼                                                        │
│   ┌─────────────┐                                               │
│   │ Login Route │                                               │
│   └──────┬──────┘                                               │
│          │                                                      │
│          ▼                                                      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              Verify Credentials                          │   │
│   │  ┌────────┐  ┌─────────┐  ┌──────────┐  ┌────────────┐  │   │
│   │  │  OTP   │  │Firebase │  │Truecaller│  │Email/Pass  │  │   │
│   │  └────────┘  └─────────┘  └──────────┘  └────────────┘  │   │
│   └──────────────────────┬──────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│                  ┌───────────────┐                              │
│                  │ Generate JWT  │                              │
│                  │    Token      │                              │
│                  └───────┬───────┘                              │
│                          │                                      │
│                          ▼                                      │
│                  ┌───────────────┐                              │
│                  │ Return Token  │                              │
│                  │ + User Data   │                              │
│                  └───────────────┘                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Roles

The system supports three distinct user roles:

### 1. Admin (Contractor/Owner)
- **Description**: Primary account holder who owns sites and manages employees
- **Role String**: `"Admin"`
- **Capabilities**:
  - Full CRUD access to all owned sites and employees
  - Create, manage, and delete supervisors
  - Access to billing and subscription features
  - View all reports and analytics
  - Manage site settings

### 2. Supervisor
- **Description**: Limited access user assigned to specific sites
- **Role String**: `"Supervisor"`
- **Capabilities**:
  - Access only to assigned sites
  - View and manage employee attendance
  - Generate reports for assigned sites
  - Cannot create other supervisors
  - Cannot access billing features
  - **Status Check**: Supervisor must have `status: 'active'` to authenticate

### 3. Super Admin (Internal)
- **Description**: Internal system administrator
- **Role String**: `"SUPER_ADMIN"`
- **Capabilities**:
  - Access to admin dashboard
  - View usage analytics and statistics
  - Manage cron jobs
  - Manual plan updates for users
  - View and resolve failed webhooks
  - System health monitoring

---

## Login Methods

### 1. OTP-Based Login (WhatsApp)

**Endpoint**: `POST /api/auth/otp/send` → `POST /api/auth/otp/verify`

This is the primary authentication method for mobile app users.

#### Flow:

```
┌──────────────────────────────────────────────────────────────────┐
│                     OTP LOGIN FLOW                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. Request OTP                                                 │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│   │   Client    │───▶│   Server    │───▶│   Redis (OTP Store) │  │
│   │ phoneNumber │    │ Generate    │    │   TTL: 10 minutes   │  │
│   └─────────────┘    │   6-digit   │    └─────────────────────┘  │
│                      │    OTP      │              │              │
│                      └──────┬──────┘              │              │
│                             │                     │              │
│                             ▼                     │              │
│                      ┌─────────────┐              │              │
│                      │  WhatsApp   │◀─────────────┘              │
│                      │  Send OTP   │                             │
│                      └─────────────┘                             │
│                                                                  │
│   2. Verify OTP                                                  │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│   │   Client    │───▶│   Server    │───▶│   Verify OTP        │  │
│   │ phoneNumber │    │ Compare OTP │    │   from Redis        │  │
│   │ + OTP       │    └──────┬──────┘    └─────────────────────┘  │
│   └─────────────┘           │                                    │
│                             ▼                                    │
│                      ┌─────────────┐                             │
│                      │ Create/Find │                             │
│                      │    User     │                             │
│                      └──────┬──────┘                             │
│                             │                                    │
│                             ▼                                    │
│                      ┌─────────────┐                             │
│                      │  Generate   │                             │
│                      │    JWT      │                             │
│                      └─────────────┘                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

#### Send OTP Request:
```javascript
POST /api/auth/otp/send
Content-Type: application/json

{
  "phoneNumber": "+919876543210"  // E.164 format
}
```

#### Send OTP Response:
```javascript
{
  "message": "OTP sent successfully. It will expire in 10 minutes.",
  "whatsAppStatus": "sent",
  "expiresInSeconds": 600
}
```

#### Verify OTP Request:
```javascript
POST /api/auth/otp/verify
Content-Type: application/json

{
  "phoneNumber": "+919876543210",
  "otp": "123456",
  "acquisition": {  // Optional - for tracking user source
    "source": "organic",
    "campaign": null
  }
}
```

#### Verify OTP Response:
```javascript
{
  "message": "OTP login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "User Name",
    "phoneNumber": "+919876543210",
    "whatsAppReportsEnabled": true,
    "whatsAppReportPhone": "+919876543210",
    "language": "en",
    "role": "Admin"
  }
}
```

#### Rate Limiting:
- **Cooldown**: 60 seconds between OTP requests for the same number
- **Max Sends**: 5 OTPs per hour per phone number
- **OTP TTL**: 10 minutes

#### Auto-Registration:
New users are automatically created with:
- **Plan**: `"pro"` (5-day trial)
- **isTrial**: `true`
- **whatsAppReportsEnabled**: `true`

---

### 2. Firebase OTP Login

**Endpoint**: `POST /api/auth/otplogin`

Used for authentication via Firebase Phone Auth (mobile apps).

#### Request:
```javascript
POST /api/auth/otplogin
Content-Type: application/json

{
  "token": "firebase_id_token_here",
  "acquisition": {  // Optional
    "source": "google_play"
  }
}
```

#### Response:
```javascript
{
  "message": "OTP login successful",
  "token": "jwt_token_here",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "+919876543210",
    "role": "Admin",
    "phoneNumber": "+919876543210",
    "language": "en"
  }
}
```

---

### 3. Truecaller Login

**Endpoint**: `POST /api/auth/truecallerlogin`

Quick login using Truecaller's OAuth flow.

#### Request:
```javascript
POST /api/auth/truecallerlogin
Content-Type: application/json

{
  "authorizationCode": "truecaller_auth_code",
  "codeVerifier": "pkce_code_verifier",
  "acquisition": {}  // Optional
}
```

#### Response:
```javascript
{
  "message": "OTP login successful",
  "token": "jwt_token_here",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "role": "Admin",
    "phoneNumber": "+919876543210",
    "language": "en"
  }
}
```

---

### 4. Email/Password Login (Admin)

**Endpoint**: `POST /api/auth/login`

Traditional email/password login for web users.

#### Request:
```javascript
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "user_password"
}
```

#### Response (Admin User):
```javascript
{
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Contractor",
    "role": "Admin",
    "phoneNumber": "+919876543210",
    "language": "en"
  }
}
```

---

### 5. Supervisor Login

**Endpoint**: `POST /api/auth/login` (Same endpoint as Admin)

Supervisors use a special username format: `{name}@sitehaazri.in`

#### Request:
```javascript
POST /api/auth/login
Content-Type: application/json

{
  "email": "john1@sitehaazri.in",  // Supervisor username
  "password": "123456"              // 6-digit numeric password
}
```

#### Response:
```javascript
{
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
    "id": "507f1f77bcf86cd799439012",
    "name": "John Supervisor",
    "role": "Supervisor",
    "siteid": "507f1f77bcf86cd799439013",
    "siteName": "Construction Site A",
    "isActive": true,
    "siteStatus": "Active",
    "language": "en"
  }
}
```

#### Supervisor Schema:
```javascript
{
  userId: String,        // Unique username (e.g., "john1@sitehaazri.in")
  password: String,      // Plain text 6-digit password
  profileName: String,   // Display name
  permissions: Map,      // Future permission flags
  site: [ObjectId],      // Assigned site(s)
  createdBy: String,     // Admin who created this supervisor
  status: "active" | "inactive",
  owner: ObjectId,       // Reference to the admin user
  language: "en" | "hi" | "hing"
}
```

#### Supervisor Credential Generation:
```javascript
// Auto-generated username format
const username = `${cleanName}${serial}@sitehaazri.in`;
// e.g., "john1@sitehaazri.in", "john2@sitehaazri.in"

// Auto-generated password
const password = Math.floor(100000 + Math.random() * 900000).toString();
// e.g., "847592"
```

---

### 6. Super Admin Login

**Endpoint**: `POST /api/super-admin/login`

Internal admin panel authentication (completely separate from user auth).

#### Request:
```javascript
POST /api/super-admin/login
Content-Type: application/json

{
  "username": "admin_username",
  "password": "admin_password"
}
```

#### Response:
```javascript
{
  "success": true,
  "message": "Login successful",
  "token": "super_admin_jwt_token",
  "expiresIn": "24h"
}
```

#### Configuration:
Super Admin credentials are stored in environment variables:
```env
SUPER_ADMIN_USERNAME=admin_username
SUPER_ADMIN_PASSWORD_HASH=$2a$10$...  # bcrypt hash
SUPER_ADMIN_JWT_SECRET=separate_secret_key
```

---

## JWT Token System

### Token Structure

#### Admin/Supervisor Token Payload:
```javascript
{
  id: "507f1f77bcf86cd799439011",   // User/Supervisor MongoDB ID
  email: "user@example.com",         // Optional for supervisors
  name: "User Name",
  role: "Admin" | "Supervisor",
  site: ["siteId1", "siteId2"],      // For supervisors only
  iat: 1703500000                    // Issued at timestamp
}
```

#### Super Admin Token Payload:
```javascript
{
  username: "admin",
  role: "SUPER_ADMIN",
  tokenType: "super_admin_access",
  iat: 1703500000,
  exp: 1703586400                    // 24 hours from issuance
}
```

### Token Characteristics

| Feature | Admin/Supervisor Token | Super Admin Token |
|---------|------------------------|-------------------|
| Expiration | Never expires | 24 hours |
| Secret | `JWT_SECRET` | `SUPER_ADMIN_JWT_SECRET` |
| Storage | Client-side | Client-side |
| Refresh | N/A | Re-login required |

---

## Authentication Middleware

### 1. `authenticateToken` Middleware

**Location**: `Backend/Middleware/auth.js`

This is the primary authentication middleware for all protected routes.

#### What It Does:

1. **Extract Token**: Reads `Bearer {token}` from `Authorization` header
2. **Verify JWT**: Validates token signature using `JWT_SECRET`
3. **Attach User Info**: Adds decoded user data to `req.user`
4. **Fetch Plan Info**: Retrieves subscription plan details from database
5. **Handle Supervisor Status**: Checks if supervisor is active
6. **Check Plan Expiration**: Auto-reverts expired trials/subscriptions to free plan
7. **Set Calculation Type**: Sets `calculationType` to `'special'` or `'normal'`

#### Request Object After Authentication:

```javascript
req.user = {
  // From JWT token
  id: "507f1f77bcf86cd799439011",
  email: "user@example.com",
  name: "User Name",
  role: "Admin",
  
  // From database lookup
  phoneNumber: "+919876543210",
  plan: "pro",
  planExpiresAt: Date,
  planActivatedAt: Date,
  billing_cycle: "monthly",
  isTrial: true,
  isCancelled: false,
  isGrace: false,
  purchaseToken: "google_purchase_token",
  enterpriseLimits: {},
  businessLimits: {},
  stats: {},
  whatsAppReportsEnabled: true,
  whatsAppReportPhone: "+919876543210",
  
  // Computed
  calculationType: "normal" | "special"
}
```

#### Error Responses:

```javascript
// No token provided
{ "error": "Access denied. No token provided." }  // 401

// Invalid token
{ "error": "Invalid token." }  // 401

// Expired token
{ "error": "Token expired. Please login again." }  // 401

// Inactive supervisor
{ "error": "Access denied. Supervisor account is inactive." }  // 403
```

---

### 2. `authorizeRole` Middleware

**Location**: `Backend/Middleware/auth.js`

Role-based authorization middleware (must be used after `authenticateToken`).

#### Usage:
```javascript
const { authenticateToken, authorizeRole } = require('../Middleware/auth');

// Only allow Admin users
router.post('/admin-only', 
  authenticateToken, 
  authorizeRole(['Admin']), 
  handler
);

// Allow both Admin and Supervisor
router.get('/data', 
  authenticateToken, 
  authorizeRole(['Admin', 'Supervisor']), 
  handler
);
```

#### Error Response:
```javascript
{ "error": "Access denied. Insufficient permissions." }  // 403
```

---

### 3. `authenticateAndTrack` Middleware

**Location**: `Backend/Middleware/usageTracker.js`

Combined middleware that provides authentication + API usage tracking.

#### What It Does:
1. Runs `authenticateToken` first
2. Runs `apiCallTracker` to monitor API usage limits
3. Runs `usageTracker` to log the API call

#### Usage:
```javascript
const { authenticateAndTrack } = require('../Middleware/usageTracker');

router.get('/employees', authenticateAndTrack, handler);
```

---

### 4. `authenticateSuperAdmin` Middleware

**Location**: `Backend/Middleware/superAdminAuth.js`

Separate authentication system for internal admin panel.

#### What It Does:
1. Validates token from `Authorization: Bearer {token}` header
2. Uses separate `SUPER_ADMIN_JWT_SECRET`
3. Checks role is `"SUPER_ADMIN"`
4. Attaches `req.superAdmin` object

#### Request Object After Authentication:
```javascript
req.superAdmin = {
  username: "admin",
  role: "SUPER_ADMIN",
  loginTime: 1703500000  // Unix timestamp
}
```

---

## Role-Based Access Control

### Access Control Matrix

| Endpoint Category | Admin | Supervisor | Super Admin |
|-------------------|-------|------------|-------------|
| Auth Routes (Login, Register) | ✅ | ✅ | ❌ |
| Profile Management | ✅ | ✅ | ❌ |
| Employee CRUD | ✅ | ✅ (Own Sites) | ❌ |
| Site Management | ✅ | ❌ | ❌ |
| Supervisor Management | ✅ | ❌ | ❌ |
| Report Generation | ✅ | ✅ (Own Sites) | ❌ |
| Billing/Subscription | ✅ | ❌ | ❌ |
| Usage Dashboard | ❌ | ❌ | ✅ |
| Cron Management | ❌ | ❌ | ✅ |
| Failed Webhooks | ❌ | ❌ | ✅ |
| Manual Plan Updates | ❌ | ❌ | ✅ |

### Role Checks in Code

#### Admin-Only Routes:
```javascript
// Check in route handler
if (!req.user || !req.user.id || !req.user.role || req.user.role !== "Admin") {
  return res.status(401).json({ message: "Unauthorized" });
}
```

#### Supervisor Site Access:
```javascript
// Supervisors can only access their assigned sites
if (req.user.role === 'Supervisor') {
  const supervisor = await Supervisor.findById(req.user.id);
  if (!supervisor.site.includes(requestedSiteId)) {
    return res.status(403).json({ message: "Access denied to this site" });
  }
}
```

---

## Protected Endpoints Reference

### Auth Routes (`/api/auth`)

| Endpoint | Method | Auth | Role | Description |
|----------|--------|------|------|-------------|
| `/otp/send` | POST | ❌ | - | Request OTP |
| `/otp/verify` | POST | ❌ | - | Verify OTP and login |
| `/otp/resend` | POST | ❌ | - | Resend existing OTP |
| `/register` | POST | ❌ | - | Email/password registration |
| `/login` | POST | ❌ | - | Email/password login |
| `/otplogin` | POST | ❌ | - | Firebase OTP login |
| `/truecallerlogin` | POST | ❌ | - | Truecaller OAuth login |
| `/forgot-password` | POST | ❌ | - | Request password reset |
| `/reset-password` | POST | ❌ | - | Reset password with token |
| `/profile/:siteId?` | GET | ✅ | All | Get user profile |
| `/verify` | GET | ✅ | All | Verify token validity |
| `/supervisor-credentials/create` | POST | ✅ | Admin | Create supervisor |
| `/supervisor-credentials/delete` | DELETE | ✅ | Admin | Delete supervisor |
| `/supervisor-credentials/change-password` | POST | ✅ | Admin | Change supervisor password |
| `/supervisor-credentials/toggle-status` | POST | ✅ | Admin | Activate/deactivate supervisor |
| `/update-name` | PUT | ✅ | All | Update display name |
| `/update-profile` | PUT | ✅ | All | Update name and language |

### Employee Routes (`/api/employee`)

| Endpoint | Method | Auth | Role | Description |
|----------|--------|------|------|-------------|
| `/addemployee` | POST | ✅ | All | Add new employee |
| `/deleteemployee` | DELETE | ✅ | All | Delete employee |
| `/bulk-deleteemployees` | POST | ✅ | All | Bulk delete employees |
| `/importemployees` | POST | ✅ | All | Import employees from previous month |
| `/allemployees` | GET | ✅ | All | Get all employees for site/month |
| `/availableforimport` | GET | ✅ | All | Check importable employees |
| `/allemployeelist` | GET | ✅ | All | Get all-time employee list |

### Dashboard Routes (`/api/dashboard`)

| Endpoint | Method | Auth | Role | Description |
|----------|--------|------|------|-------------|
| `/home` | GET | ✅ | All | Get dashboard data |
| `/v2/home` | GET | ✅ | All | Optimized dashboard data |

### Report Routes (`/api/reports`)

| Endpoint | Method | Auth | Role | Description |
|----------|--------|------|------|-------------|
| `/generate-payment-report` | POST | ✅ | All | Generate PDF payment report |
| Various Excel routes | Various | ✅ | All | Excel report generation |

### Subscription Routes (`/api/play-purchase`, `/api/razorpay`)

| Endpoint | Method | Auth | Role | Description |
|----------|--------|------|------|-------------|
| `/verify-android-purchase` | POST | ✅ | Admin | Verify Google Play purchase |
| `/plan` | GET | ✅ | Admin | Get current plan details |
| `/subscription-status` | GET | ✅ | Admin | Get Razorpay subscription status |

### Super Admin Routes (`/api/super-admin`, `/api/usage`)

| Endpoint | Method | Auth | Role | Description |
|----------|--------|------|------|-------------|
| `/login` | POST | ❌ | - | Super admin login |
| `/verify` | GET | ✅ SA | Super Admin | Verify super admin token |
| `/logout` | POST | ✅ SA | Super Admin | Logout |
| `/health` | GET | ❌ | - | Check if super admin is configured |
| `/dashboard` | GET | ✅ SA | Super Admin | Usage dashboard |
| `/user-endpoint-analytics` | GET | ✅ SA | Super Admin | Endpoint analytics |
| `/new-users` | GET | ✅ SA | Super Admin | New user stats |
| `/cron-jobs` | GET | ✅ SA | Super Admin | Cron job status |
| `/admin/manual-update` | POST | ✅ SA | Super Admin | Manual plan update |
| `/admin/failed-webhooks` | GET | ✅ SA | Super Admin | View failed webhooks |

**Legend**: ✅ = Required, ❌ = Not Required, SA = Super Admin Auth

---

## Password Management

### Admin Password Reset Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                  PASSWORD RESET FLOW                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. POST /api/auth/forgot-password                              │
│      { "email": "user@example.com" }                             │
│                        │                                         │
│                        ▼                                         │
│               ┌────────────────┐                                 │
│               │ Generate Token │                                 │
│               │ (crypto 32 hex)│                                 │
│               │  TTL: 1 hour   │                                 │
│               └────────┬───────┘                                 │
│                        │                                         │
│                        ▼                                         │
│               ┌────────────────┐                                 │
│               │ Send Email     │                                 │
│               │ with reset link│                                 │
│               └────────────────┘                                 │
│                                                                  │
│   2. POST /api/auth/reset-password                               │
│      { "token": "reset_token", "password": "new_password" }      │
│                        │                                         │
│                        ▼                                         │
│               ┌────────────────┐                                 │
│               │ Verify Token   │                                 │
│               │ Check Expiry   │                                 │
│               └────────┬───────┘                                 │
│                        │                                         │
│                        ▼                                         │
│               ┌────────────────┐                                 │
│               │ Hash Password  │                                 │
│               │ bcrypt(10)     │                                 │
│               │ Clear Token    │                                 │
│               └────────────────┘                                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Supervisor Password Management

Supervisors cannot reset their own passwords. Admins manage supervisor passwords:

```javascript
// Admin changes supervisor password
POST /api/auth/supervisor-credentials/change-password
Authorization: Bearer {admin_jwt_token}

{
  "supervisor": {
    "userId": "john1@sitehaazri.in"
  }
}

// Response
{
  "message": "Supervisor password changed successfully",
  "newPassword": "847592"  // New 6-digit password
}
```

---

## Session & Token Management

### Token Verification

```javascript
GET /api/auth/verify
Authorization: Bearer {jwt_token}

// Response
{
  "message": "Token is valid",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "User Name",
    "role": "Admin",
    "phoneNumber": "+919876543210",
    "language": "en"
  }
}
```

### Super Admin Token Verification

```javascript
GET /api/super-admin/verify
Authorization: Bearer {super_admin_token}

// Response
{
  "success": true,
  "message": "Token is valid",
  "admin": {
    "username": "admin",
    "role": "SUPER_ADMIN"
  }
}
```

---

## Security Considerations

### Password Security

| User Type | Password Storage | Hash Algorithm |
|-----------|-----------------|----------------|
| Admin | Hashed | bcrypt (10 rounds) |
| Supervisor | Plain text | N/A |
| Super Admin | Env variable hash | bcrypt (10 rounds) |

> ⚠️ **Note**: Supervisor passwords are stored in plain text for simplicity since they are auto-generated 6-digit codes meant for site workers. Consider migrating to hashed storage for enhanced security.

### Token Security

1. **Admin/User Tokens**: Never expire, signed with `JWT_SECRET`
2. **Super Admin Tokens**: Expire in 24 hours, signed with separate `SUPER_ADMIN_JWT_SECRET`
3. **Both secrets should be**:
   - At least 256 bits of entropy
   - Never committed to version control
   - Rotated periodically

### Rate Limiting

| Feature | Limit |
|---------|-------|
| OTP Send | 5 per hour per phone number |
| OTP Cooldown | 60 seconds between requests |
| OTP Validity | 10 minutes |

### CORS Configuration

```javascript
// Production allowed origins
allowedOrigins = [
  'https://app.sitehaazri.in',
  'https://sitehaazri.in',
  'https://sitehaazri-admin-dashboard.vercel.app',
  'https://partners.sitehaazri.in'
];

// Development (additional)
allowedOrigins.push('http://localhost:5173', 'http://localhost:8081', 'http://localhost:3000');
```

### Special User Handling

User with ID `683b167e47f3087645d8ba7f` receives special calculation privileges:
```javascript
if (req.user.id.toString() === '683b167e47f3087645d8ba7f') {
  req.user.calculationType = 'special';
}
```

---

## Quick Reference: Environment Variables

```env
# JWT Authentication
JWT_SECRET=your_jwt_secret

# Super Admin (Internal)
SUPER_ADMIN_USERNAME=admin
SUPER_ADMIN_PASSWORD_HASH=$2a$10$... # bcrypt hash
SUPER_ADMIN_JWT_SECRET=your_super_admin_secret

# Truecaller OAuth
TRUECALLER_CLIENT_ID=your_client_id

# Email Service (Password Reset)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

---

## Appendix: Code Examples

### Protecting a New Route (Admin Only)

```javascript
const { authenticateToken } = require('../Middleware/auth');

router.post('/admin-action', authenticateToken, async (req, res) => {
  // Check for Admin role
  if (!req.user || req.user.role !== 'Admin') {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  // Your route logic here
  res.json({ success: true });
});
```

### Protecting a Route (All Authenticated Users)

```javascript
const { authenticateAndTrack } = require('../Middleware/usageTracker');

router.get('/data', authenticateAndTrack, async (req, res) => {
  // req.user is available
  res.json({ userId: req.user.id });
});
```

### Creating a Super Admin Protected Route

```javascript
const { authenticateSuperAdmin } = require('../Middleware/superAdminAuth');

router.get('/admin/data', authenticateSuperAdmin, async (req, res) => {
  // req.superAdmin is available
  res.json({ admin: req.superAdmin.username });
});
```

---

*Last Updated: December 2024*
*Version: 1.0*
