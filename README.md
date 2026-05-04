# Start-up

Monorepo for the wholesale app: a **NestJS** API and **Next.js** web client.

## Repository layout

| Directory   | Description                                      |
| ----------- | ------------------------------------------------ |
| [`backend`](backend/README.md) | NestJS API, Prisma, PostgreSQL                   |
| [`web`](web/README.md)         | Next.js frontend                                 |

## Prerequisites

- Node.js (see each package for version hints)
- PostgreSQL for the API

## Quick start

### 1. Backend

From `backend/`:

1. Copy [`backend/.env.example`](backend/.env.example) to `.env` and set `DATABASE_URL`, `JWT_SECRET`, and other values as needed.
2. Install dependencies and apply the database schema (see [`backend/README.md`](backend/README.md) for Prisma migrations and admin setup).

```bash
cd backend
npm install
# prisma migrate / generate as documented in backend/README.md
npm run start:dev
```

The API listens on the port in `PORT` (see `.env`; example uses `3000`, your local file may differ).

### 2. Web

From `web/`:

1. Copy [`web/.env.example`](web/.env.example) to `.env.local` (or equivalent).
2. Point `NEXT_PUBLIC_API_BASE_URL` at your API when using HTTP mode; align `NEXT_PUBLIC_GOOGLE_CLIENT_ID` with the backend `GOOGLE_CLIENT_ID`.

```bash
cd web
npm install
npm run dev
```

The app is served at [http://localhost:3000](http://localhost:3000) by default.

## Documentation

- [Backend README](backend/README.md) — NestJS scripts, tests, admin login, deployment notes  
- [Web README](web/README.md) — Next.js dev server and deployment  
