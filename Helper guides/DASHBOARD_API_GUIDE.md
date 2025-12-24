# Dashboard API Guide for Frontend Developers

Base URL: `[Backend_URL]/api/dashboard`

This guide covers all dashboard-related endpoints for managing sites, user home data, and settings.

---

## 🚀 Quick Summary

| Feature | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Home (v1)** | `GET` | `/home` | Basic user info & sites |
| **Home (v2)** | `GET` | `/v2/home` | Enhanced home with employee counts |
| **Add Site** | `POST` | `/home/addsite` | Create a new site |
| **Delete Site** | `DELETE` | `/delete-site` | Delete a site |
| **Edit Site Name** | `PUT` | `/edit-site-name` | Rename a site |
| **Activate Sites** | `POST` | `/sites/activate` | Bulk activate/deactivate sites |
| **Toggle WhatsApp** | `PUT` | `/toggle-whatsapp-reports` | Enable/disable WhatsApp reports |
| **Update WA Phone** | `PUT` | `/update-whatsapp-phone` | Change WhatsApp report number |

> [!IMPORTANT]
> All endpoints require `Authorization: Bearer <token>` header.

---

## 1. Home Endpoints

### A. Get Home (v1)
Basic dashboard data.

- **Endpoint:** `/home`
- **Method:** `GET`

**Response:**
```json
{
  "user": {
    "name": "User Name",
    "role": "Admin",
    "sites": [
      { "_id": "...", "sitename": "Site A", "createdAt": "..." }
    ]
  }
}
```

### B. Get Home (v2) ⭐ Recommended
Enhanced payload with employee counts and summary.

- **Endpoint:** `/v2/home`
- **Method:** `GET`

**Response:**
```json
{
  "success": true,
  "data": {
    "userName": "User Name",
    "userRole": "Admin",
    "sites": [
      {
        "_id": "...",
        "sitename": "Site A",
        "createdAt": "...",
        "isActive": true,
        "employeeCount": 15
      }
    ],
    "summary": {
      "totalSites": 2,
      "totalEmployees": 45
    }
  }
}
```

---

## 2. Site Management

### A. Add Site
Creates a new site for the user.

- **Endpoint:** `/home/addsite`
- **Method:** `POST`

**Request Body:**
```json
{
  "sitename": "New Site Name"
}
```

**Response (Success):**
```json
{
  "message": "Site created successfully",
  "site": {
    "_id": "...",
    "sitename": "New Site Name",
    "owner": "...",
    "createdBy": "User Name"
  }
}
```

**Error Cases:**
- `400`: Site name is required
- `403`: Site limit reached for current plan
- `404`: User not found

---

### B. Delete Site
Deletes a site and all associated employees/supervisors.

- **Endpoint:** `/delete-site`
- **Method:** `DELETE`

**Request Body:**
```json
{
  "siteName": "Site Name",
  "siteId": "site_object_id"
}
```

**Response:**
```json
{
  "message": "Site deleted successfully"
}
```

**Error Cases:**
- `403`: No permission to delete
- `404`: Site not found

---

### C. Edit Site Name
Renames an existing site (Admin only).

- **Endpoint:** `/edit-site-name`
- **Method:** `PUT`

**Request Body:**
```json
{
  "siteId": "site_object_id",
  "newSiteName": "Updated Site Name"
}
```

**Response:**
```json
{
  "message": "Site name updated successfully",
  "site": { ... }
}
```

---

### D. Activate Sites (Bulk)
Activates selected sites and optionally creates new ones. Deactivates all others.

- **Endpoint:** `/sites/activate`
- **Method:** `POST`

**Request Body:**
```json
{
  "createSites": ["New Site 1", "New Site 2"], // Names of new sites to create
  "selectedExistingSiteIds": ["id1", "id2"]    // IDs of existing sites to keep active
}
```

**Response:**
```json
{
  "success": true,
  "message": "Active sites updated successfully.",
  "data": {
    "plan": "pro",
    "limit": 3,
    "activatedSiteIds": ["id1", "id2", "new_id"],
    "createdSiteIds": ["new_id"]
  }
}
```

**Restrictions:**
- Allowed only on 1st of the month (IST) or within 24 hours of plan purchase.
- Subject to plan limits.

**Error Cases:**
- `403`: "Site activation is only allowed within 24 hours of purchase or on the 1st of the month (IST)."
- `403`: "Your [Plan] plan allows only [N] active sites."

---

## 3. User Settings

### A. Toggle WhatsApp Reports
Enables or disables WhatsApp report delivery.

- **Endpoint:** `/toggle-whatsapp-reports`
- **Method:** `PUT`

**Request Body:**
```json
{
  "enabled": true  // or false
}
```

**Response:**
```json
{
  "success": true
}
```

---

### B. Update WhatsApp Phone
Changes the phone number for WhatsApp reports.

- **Endpoint:** `/update-whatsapp-phone`
- **Method:** `PUT`

**Request Body:**
```json
{
  "phone": "+919876543210"
}
```

**Response:**
```json
{
  "success": true
}
```

---

## 🛡️ Error Handling

| Code | Meaning |
| :--- | :--- |
| `400` | Bad Request (Missing/invalid fields) |
| `401` | Unauthorized (Missing/invalid token) |
| `403` | Forbidden (Plan limits, permissions) |
| `404` | Not Found (User/Site) |
| `500` | Internal Server Error |
