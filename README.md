# ap_be — Admin Portal Backend (Next.js Route Handlers + Prisma + MongoDB)

This repository contains the backend API for the Admin Portal (SVA / Admin Dashboard), implemented using **Next.js App Router Route Handlers** (serverless-friendly), **Prisma** (MongoDB), and **JWT cookie authentication**.

The API returns responses in a consistent envelope format:

```json
{
  "statusCode": 200,
  "success": true,
  "message": "OK",
  "meta": { "page": 1, "limit": 12, "total": 50 },
  "data": {}
}