# API Response Standards

**Version:** 2.0
**Last Updated:** 2025-02-01
**Status:** Active

---

## Overview

All OrangeCat API endpoints follow a standardized response format to ensure consistency, predictability, and ease of client-side error handling.

---

## Standard Response Format

### Success Response

```typescript
{
  "success": true,
  "data": T,  // The actual response data
  "metadata": {
    "timestamp": "2025-02-01T10:30:45.123Z",
    // Optional pagination
    "page"?: number,
    "limit"?: number,
    "total"?: number
  }
}
```

### Error Response

```typescript
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details"?: any  // Optional additional context
  },
  "metadata": {
    "timestamp": "2025-02-01T10:30:45.123Z"
  }
}
```

---

## HTTP Status Codes

| Code    | Meaning               | When to Use                               |
| ------- | --------------------- | ----------------------------------------- |
| **200** | OK                    | Successful GET/PUT/DELETE                 |
| **201** | Created               | Successful POST (resource created)        |
| **204** | No Content            | Successful DELETE (no response body)      |
| **400** | Bad Request           | Invalid input, validation error           |
| **401** | Unauthorized          | Authentication required or failed         |
| **403** | Forbidden             | Authenticated but not authorized          |
| **404** | Not Found             | Resource doesn't exist                    |
| **409** | Conflict              | Resource already exists, duplicate action |
| **422** | Unprocessable Entity  | Validation failed (specific fields)       |
| **429** | Too Many Requests     | Rate limit exceeded                       |
| **500** | Internal Server Error | Unexpected server error                   |
| **503** | Service Unavailable   | Temporary outage or maintenance           |

---

## Error Codes

### Authentication & Authorization

- `UNAUTHORIZED` - No valid auth token
- `FORBIDDEN` - Insufficient permissions
- `INVALID_TOKEN` - Token expired or malformed

### Validation

- `VALIDATION_ERROR` - Generic validation failure
- `BAD_REQUEST` - Malformed request
- `MISSING_PARAMS` - Required parameter missing
- `INVALID_ID` - Invalid UUID or identifier format

### Resources

- `NOT_FOUND` - Resource doesn't exist
- `CONFLICT` - Resource already exists
- `DUPLICATE` - Duplicate entry (specific case of conflict)

### Rate Limiting

- `RATE_LIMITED` - Too many requests
- `RATE_LIMIT_EXCEEDED` - Alternative code for rate limiting

### Server Errors

- `INTERNAL_ERROR` - Unexpected server error
- `DATABASE_ERROR` - Database operation failed
- `SERVICE_UNAVAILABLE` - Service temporarily unavailable

---

## Response Helper Functions

### Server-Side (TypeScript)

```typescript
import {
  apiSuccess,
  apiCreated,
  apiNoContent,
  apiBadRequest,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiConflict,
  apiValidationError,
  apiRateLimited,
  apiInternalError,
  apiServiceUnavailable,
} from '@/lib/api/standardResponse';

// Success responses
return apiSuccess(data);
return apiSuccess(data, { cache: 'SHORT' });
return apiCreated(newResource);
return apiNoContent();

// Error responses
return apiBadRequest('Invalid input');
return apiUnauthorized();
return apiNotFound('User not found');
return apiConflict('Username already taken');
return apiValidationError('Validation failed', { fields: [...] });
return apiRateLimited('Too many requests', 60); // retry after 60s
return apiInternalError('Something went wrong');
```

### Client-Side (TypeScript)

```typescript
interface ApiResponse<T> {
  success: true;
  data: T;
  metadata?: {
    timestamp: string;
    page?: number;
    limit?: number;
    total?: number;
  };
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
  };
}

// Type guard
function isApiSuccess<T>(response: any): response is ApiResponse<T> {
  return response.success === true;
}

// Usage
const response = await fetch('/api/profile');
const json = await response.json();

if (isApiSuccess<Profile>(json)) {
  console.log('Profile:', json.data);
} else {
  console.error('Error:', json.error.message);
  // Handle specific errors
  if (json.error.code === 'RATE_LIMITED') {
    // Show rate limit message
  }
}
```

---

## Caching

### Cache Control Headers

All GET endpoints should include appropriate cache headers:

```typescript
// Use cache presets
import { CACHE_PRESETS } from '@/lib/api/standardResponse';

return apiSuccess(data, {
  cache: 'SHORT', // 1 min CDN, 5 min stale
});

return apiSuccess(data, {
  cache: 'MEDIUM', // 5 min CDN, 30 min stale
});

return apiSuccess(data, {
  cache: 'LONG', // 1 hour CDN, 24 hours stale
});

// Or custom
return apiSuccess(data, {
  cache: 's-maxage=120, stale-while-revalidate=600',
});
```

### Cache Presets

| Preset     | CDN Cache | Stale While Revalidate | Use Case                      |
| ---------- | --------- | ---------------------- | ----------------------------- |
| **NONE**   | No cache  | N/A                    | Real-time data, user-specific |
| **SHORT**  | 1 minute  | 5 minutes              | Frequently changing data      |
| **MEDIUM** | 5 minutes | 30 minutes             | Moderately static data        |
| **LONG**   | 1 hour    | 24 hours               | Rarely changing data          |
| **STATIC** | 1 day     | 1 week                 | Static content                |

---

## Rate Limiting

### Response Headers

When rate limited, responses include:

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704114645000
Retry-After: 42

{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please slow down.",
    "details": {
      "limit": 10,
      "remaining": 0,
      "resetTime": 1704114645000,
      "retryAfter": 42
    }
  },
  "metadata": {
    "timestamp": "2025-02-01T10:30:45.123Z"
  }
}
```

### Rate Limit Types

| Endpoint Type        | Window     | Max Requests | Rate Limiter              |
| -------------------- | ---------- | ------------ | ------------------------- |
| **General API**      | 15 minutes | 100          | `rateLimit(request)`      |
| **Social Actions**   | 1 minute   | 10           | `rateLimitSocial(userId)` |
| **Write Operations** | 1 minute   | 30           | `rateLimitWrite(userId)`  |

---

## Pagination

### Request Parameters

```
GET /api/projects?page=2&limit=20
```

### Response Format

```typescript
{
  "success": true,
  "data": [...],  // Array of items
  "metadata": {
    "timestamp": "2025-02-01T10:30:45.123Z",
    "page": 2,
    "limit": 20,
    "total": 157  // Total count of all items
  }
}
```

### Helper Function

```typescript
return apiSuccessPaginated(items, page, limit, total);
```

---

## Examples

### GET Request - Success

**Request:**

```
GET /api/profile
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "username": "alice",
    "name": "Alice Smith",
    "email": "alice@example.com",
    "bio": "Bitcoin enthusiast",
    "created_at": "2024-01-15T10:00:00Z"
  },
  "metadata": {
    "timestamp": "2025-02-01T10:30:45.123Z"
  }
}
```

### POST Request - Created

**Request:**

```
POST /api/projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Bitcoin Education",
  "description": "Teaching Bitcoin basics",
  "goal_amount": 10000,
  "currency": "SATS"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "project-uuid",
    "title": "Bitcoin Education",
    "description": "Teaching Bitcoin basics",
    "goal_amount": 10000,
    "currency": "SATS",
    "status": "draft",
    "created_at": "2025-02-01T10:30:45.123Z"
  },
  "metadata": {
    "timestamp": "2025-02-01T10:30:45.123Z"
  }
}
```

### Error - Validation Failed

**Request:**

```
POST /api/social/follow
Authorization: Bearer <token>
Content-Type: application/json

{
  "following_id": "invalid-id"
}
```

**Response:**

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid user ID format"
  },
  "metadata": {
    "timestamp": "2025-02-01T10:30:45.123Z"
  }
}
```

### Error - Rate Limited

**Request:**

```
POST /api/social/follow
Authorization: Bearer <token>
(11th request in 1 minute)
```

**Response:**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many follow requests. Please slow down.",
    "details": {
      "retryAfter": 45
    }
  },
  "metadata": {
    "timestamp": "2025-02-01T10:30:45.123Z"
  }
}
```

---

## Migration Guide

### From Old Format

**Old (Non-Standard):**

```typescript
// Different formats across endpoints
return NextResponse.json({ wallets: data });
return NextResponse.json({ success: true, message: '...' });
return NextResponse.json({ error: '...' }, { status: 400 });
```

**New (Standard):**

```typescript
// Consistent format everywhere
return apiSuccess(data);
return apiSuccess({ message: '...' });
return apiBadRequest('...');
```

### Client-Side Changes

**Old:**

```typescript
const response = await fetch('/api/wallets');
const data = await response.json();
// data.wallets or data.success or data.error - inconsistent!
```

**New:**

```typescript
const response = await fetch('/api/wallets');
const json = await response.json();

if (json.success) {
  const wallets = json.data; // Always .data
} else {
  const error = json.error; // Always .error
  console.error(error.code, error.message);
}
```

---

## Testing

### Unit Tests

```typescript
import { apiSuccess, apiBadRequest } from '@/lib/api/standardResponse';

describe('API Response Standards', () => {
  it('should format success response correctly', () => {
    const response = apiSuccess({ id: 1, name: 'Test' });
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data).toEqual({ id: 1, name: 'Test' });
    expect(json.metadata.timestamp).toBeDefined();
  });

  it('should format error response correctly', () => {
    const response = apiBadRequest('Invalid input');
    const json = await response.json();

    expect(json.success).toBe(false);
    expect(json.error.code).toBe('BAD_REQUEST');
    expect(json.error.message).toBe('Invalid input');
  });
});
```

---

## Best Practices

1. **Always use helper functions** - Don't manually create `NextResponse.json()`
2. **Include cache headers** - All GET endpoints should specify caching
3. **Use structured logging** - Log errors with context before returning
4. **Validate early** - Return errors before performing expensive operations
5. **Be specific with error codes** - Use semantic codes, not generic `ERROR`
6. **Include retry hints** - For rate limits, include `Retry-After` header
7. **Document new endpoints** - Add examples to this document

---

## Related Documentation

- [Public API Conventions](./CONVENTIONS.md) - versioning, error codes, rate limits
- [Error Handling](../../development/error-handling.md)
- Rate limits: `src/lib/rate-limit.ts`

---

## Changelog

### Version 2.0 (2025-02-01)

- Added standardized response format
- Introduced cache presets
- Added rate limiting standards
- Updated error codes
- Added migration guide

### Version 1.0 (2024-10-01)

- Initial API documentation
- Basic response patterns
