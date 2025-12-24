# Authentication API Guide for Frontend Developers

Base URL: `[Backend_URL]/api/auth`

This guide details all authentication-related endpoints, including Standard Email/Password Login, OTP Login (Phone), Truecaller Login, and User Management.

---

## 🚀 Quick Summary

| Feature | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Login (Email)** | `POST` | `/login` | Admin & Supervisor login via Email/Password |
| **OTP Send** | `POST` | `/otp/send` | Send OTP to phone number |
| **OTP Verify** | `POST` | `/otp/verify` | Verify OTP & Login/Register |
| **OTP Resend** | `POST` | `/otp/resend` | Resend OTP |
| **Firebase Login**| `POST` | `/otplogin` | Login using Firebase ID Token |
| **Truecaller** | `POST` | `/truecallerlogin`| Login using Truecaller SDK |
| **Profile** | `GET` | `/profile` | Get current user details |
| **Register** | `POST` | `/register` | Register new user (Email/Pass) |
| **Forgot Pass** | `POST` | `/forgot-password` | Initiate password reset |
| **Reset Pass** | `POST` | `/reset-password` | Complete password reset |

---

## 1. Phone Authentication (OTP)

### A. Send OTP
Sends a 6-digit OTP to the specified phone number via WhatsApp.

- **Endpoint:** `/otp/send`
- **Method:** `POST`
- **Access:** Public

**Request Body:**
```json
{
  "phoneNumber": "+919876543210" // Must include country code
}
```

**Response (Success):**
```json
{
  "message": "OTP sent successfully...",
  "whatsAppStatus": "sent", // 'sent', 'skipped', 'failed'
  "expiresInSeconds": 600
}
```

**Notes:**
- **Test Number:** `+919876543210` use OTP `123456`.
- Rate limits apply (cooldown 60s).

### B. Verify OTP & Login
Verifies the OTP. If valid, logs the user in. **Auto-registers** the user if they don't exist (triggers "Pro" plan trial).

- **Endpoint:** `/otp/verify`
- **Method:** `POST`
- **Access:** Public

**Request Body:**
```json
{
  "phoneNumber": "+919876543210",
  "otp": "123456",
  "acquisition": {} // Optional: Marketing acquisition data
}
```

**Response (Success):**
```json
{
  "message": "OTP login successful",
  "token": "eyJhbGciOi...",
  "user": {
    "id": "60d5f...",
    "name": "User Name",
    "phoneNumber": "+919876543210",
    "role": "Admin",
    "whatsAppReportsEnabled": true,
    "whatsAppReportPhone": "+919876543210",
    "language": "en"
  }
}
```

### C. Resend OTP
Resends the existing OTP if compatible or extends validity.

- **Endpoint:** `/otp/resend`
- **Method:** `POST`

**Request Body:**
```json
{
  "phoneNumber": "+919876543210"
}
```

---

## 2. Standard Authentication (Email/Password)

### A. Login
Supports both **Admins** (User model) and **Supervisors** (Supervisor model).

- **Endpoint:** `/login`
- **Method:** `POST`
- **Access:** Public

**Request Body:**
```json
{
  "email": "admin@example.com", // OR Supervisor UserID (e.g., "janesmith1")
  "password": "secretpassword"
}
```

**Response (Admin):**
```json
{
  "message": "Login successful",
  "token": "eyJhb...",
  "user": {
    "id": "...",
    "name": "Admin Name",
    "email": "admin@example.com",
    "role": "Admin"
  }
}
```

**Response (Supervisor):**
```json
{
  "message": "Login successful",
  "token": "eyJhb...",
  "user": {
    "id": "...",
    "name": "Supervisor Name",
    "role": "Supervisor",
    "siteid": "651f...",           // Site Object ID
    "siteName": "Main Site",       // Site Name string
    "isActive": true,              // Boolean status
    "siteStatus": "Active",        // String status
    "language": "en"
  }
}
```

### B. Register (Email)
Registers a new Admin account.

- **Endpoint:** `/register`
- **Method:** `POST`

**Request Body:**
```json
{
  "name": "New User",
  "email": "new@example.com",
  "password": "strongpassword"
}
```

---

## 3. Social & SDK Integrations

### A. Firebase OTP Login
Used if the frontend handles OTP via Firebase SDK and sends the ID token to backend.

- **Endpoint:** `/otplogin`
- **Method:** `POST`

**Request Body:**
```json
{
  "token": "firebase_id_token_here",
  "acquisition": {} // Optional
}
```

### B. Truecaller Login
Used for Truecaller SDK integration.

- **Endpoint:** `/truecallerlogin`
- **Method:** `POST`

**Request Body:**
```json
{
  "authorizationCode": "...",
  "codeVerifier": "...",
  "acquisition": {} // Optional
}
```

---

## 4. User Profile

### Get Profile
Fetches the currently logged-in user's details.

- **Endpoint:** `/profile/:siteId?`
- **Method:** `GET`
- **Headers:** `Authorization: Bearer <token>`

**Parameters:**
- `siteId` (Optional): If provided, filters the returned supervisors list to only those belonging to this site.

**Response:**
```json
{
  "message": "Profile retrieved successfully",
  "user": {
    "_id": "...",
    "name": "...",
    "email": "...",
    "supervisors": [ ... ]
  }
}
```

---

## 5. Password Management

### A. Forgot Password
- **Endpoint:** `/forgot-password`
- **Method:** `POST`
- **Body:** `{ "email": "user@example.com" }`

### B. Reset Password
- **Endpoint:** `/reset-password`
- **Method:** `POST`
- **Body:** `{ "token": "reset_token_from_email", "password": "new_password" }`

---

## 6. Supervisor Management (Admin Only)

These endpoints require an Admin Token.

| Endpoint | Method | Body | Description |
| :--- | :--- | :--- | :--- |
| `/supervisor-credentials/create` | `POST` | `{ "name": "...", "siteId": "..." }` | Create new supervisor |
| `/supervisor-credentials/delete/` | `DELETE` | `{ "supervisor": { "userId": "..." } }` | Delete supervisor |
| `/supervisor-credentials/change-password` | `POST` | `{ "supervisor": { "userId": "..." } }` | Reset supervisor password (generates random) |
| `/supervisor-credentials/toggle-status` | `POST` | `{ "supervisor": { "userId": "..." } }` | Toggle Active/Inactive |

---

## 🛡️ Error Handling
Standard error response structure:
```json
{
  "message": "Error description here",
  "error": "Detailed error info (optional)"
}
```
- **400**: Bad Request (Missing fields, invalid data)
- **401**: Unauthorized (Invalid/Expired Token)
- **404**: Not Found
- **500**: Server Error
