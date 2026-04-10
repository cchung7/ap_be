# ap_be

Backend API for the AP project, implemented with **Next.js App Router Route Handlers**, **Prisma**, **MongoDB**, and **JWT cookie authentication**.

This backend serves authenticated API endpoints for:

- auth/session management
- profile management
- admin dashboard data
- admin user management
- admin event management
- member dashboard/profile data
- event registration and check-in flows
- recent activity logging
- contact form handling

---

## Stack

- **Next.js** route handlers
- **TypeScript**
- **Prisma**
- **MongoDB**
- **JWT** for auth
- **HTTP-only cookies** for session transport

---

## Architecture Overview

This backend uses **Next.js route handlers** under `app/api/**` rather than an Express server.

### Core patterns

- **Route handlers** accept requests and return `NextResponse`
- **Prisma** handles database access
- **JWT** is used for authentication
- **Auth cookies** are HTTP-only and scoped at the root path
- **Shared helpers** centralize auth, response formatting, error handling, and CORS

### Important shared libraries

- `src/lib/prisma.ts` — Prisma client singleton
- `src/lib/jwt.ts` — token generation and verification
- `src/lib/auth.ts` — `optionalAuth()` and `requireAuth()`
- `src/lib/authCookies.ts` — cookie set/clear helpers
- `src/lib/authSession.ts` — session duration and expiry helpers
- `src/lib/sendResponse.ts` — standardized API response envelope
- `src/lib/withApiHandler.ts` — centralized try/catch wrapper
- `src/lib/handleError.ts` — error normalization
- `src/lib/cors.ts` — CORS and preflight helpers
- `src/lib/zodSchemas.ts` — request validation schemas

---

## Authentication Model

Authentication is cookie-based.

### Session behavior

- JWT is stored in an **HTTP-only cookie**
- session expiry is driven by:
  - `AUTH_SESSION_EXPIRES_IN`, or
  - `JWT_EXPIRES_IN`, falling back to `12h`
- the backend supports a **sliding session** pattern
- `/api/auth/me` acts as the bounded refresh point
- if a user is inactive beyond the configured window, the session expires and the user must sign in again

### Current default

If no session env override is provided, the backend defaults to:

- **12-hour session lifetime**

---

## Auth Endpoints

### `POST /api/auth/login`

Authenticates a user and sets the auth cookie.

Behavior:
- validates email/password
- verifies password hash
- blocks suspended and pending accounts
- issues JWT
- sets auth cookie

### `POST /api/auth/logout`

Clears the auth cookie.

### `GET /api/auth/me`

Returns the currently authenticated user or `me: null`.

Behavior:
- resolves auth from cookie
- clears stale/invalid cookies when appropriate
- refreshes the JWT/cookie for the bounded sliding session

---

## Example Response Envelope

Most endpoints return a consistent response format:

```json
{
  "statusCode": 200,
  "success": true,
  "message": "OK",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 50
  },
  "data": {}
}