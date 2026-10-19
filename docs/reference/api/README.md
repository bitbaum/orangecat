---
created_date: 2025-06-05
last_modified_date: 2025-06-05
last_modified_summary: Added documentation standards including creation and modification dates
---

# �� API Documentation

## REST API Reference for OrangeCat

---

## 📋 Overview

OrangeCat provides a comprehensive REST API for managing Bitcoin fundraising projects, user profiles, and authentication. All API endpoints follow RESTful conventions and return JSON responses.

**Base URL**: `/api/`  
**Authentication**: JWT tokens via Supabase Auth  
**Rate Limiting**: Applied per endpoint

---

## 🔐 Authentication

All protected endpoints require authentication via JWT tokens:

```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

---

## 📚 API Sections

### **📜 Public API (`/api/v1/`)**

- [Public API Conventions](CONVENTIONS.md) - Versioning, error codes, idempotency, rate limits
- Route tree and contract: `src/app/api/v1/README.md`
- [Buying on OrangeCat as a machine](../../api/AGENTS.md) - Paying entities over HTTP
- [Response Standards](response-standards.md) - The `{ success, data }` envelope

### **🤖 AI Chat**

- [Chat API](./chat.md) - AI assistant integration using Google Gemini

---

## 🎯 Quick Start

### **1. Authentication**

```javascript
// Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password"
}
```

### **2. Get Profile**

```javascript
// Get current user profile
GET /api/profile
Authorization: Bearer {token}
```

### **3. Create Campaign**

```javascript
// Create new project
POST /api/projects
Authorization: Bearer {token}
{
  "title": "My Campaign",
  "description": "Campaign description",
  "goal_amount": 1000000
}
```

---

## 📊 Response Format

### **Success Response**

```javascript
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### **Error Response**

```javascript
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

---

## 🔒 Security

- **Input Validation** - All inputs validated and sanitized
- **Rate Limiting** - Protection against abuse
- **CORS** - Configured for secure cross-origin requests
- **HTTPS Only** - All API calls must use HTTPS in production

---

## 📈 Rate Limits

| Endpoint Type   | Limit        | Window   |
| --------------- | ------------ | -------- |
| Authentication  | 5 requests   | 1 minute |
| Profile Updates | 10 requests  | 1 minute |
| File Uploads    | 3 requests   | 1 minute |
| General API     | 100 requests | 1 minute |

---

## 🐛 Error Codes

| Code                  | Description              |
| --------------------- | ------------------------ |
| `AUTH_REQUIRED`       | Authentication required  |
| `INVALID_TOKEN`       | Invalid or expired token |
| `VALIDATION_ERROR`    | Input validation failed  |
| `RATE_LIMIT_EXCEEDED` | Too many requests        |
| `RESOURCE_NOT_FOUND`  | Resource not found       |
| `PERMISSION_DENIED`   | Insufficient permissions |

---

## 📚 Related Documentation

- [Authentication System](../../security/auth_system.md) - Complete auth flow
- [Security Guidelines](../../security/SECURITY.md) - Security best practices
- [Development Setup](../../development/SETUP.md) - Local API development
