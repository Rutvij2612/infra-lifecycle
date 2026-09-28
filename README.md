# Infrastructure Lifecycle Platform

Tracks the full lifecycle of government-owned infrastructure (hospitals, highways, bridges, ...)
from planning and construction through operation, maintenance, end-of-life and decommissioning.

**Stack:** React + TypeScript + Vite + Tailwind CSS · Node.js + Express + TypeScript · PostgreSQL (Supabase)
**Deploy:** Frontend → Vercel · Backend → Render · Database → Supabase

## Structure

```
infra-lifecycle/
├── backend/                  Express + TypeScript REST API
│   └── src/
│       ├── config/           env + PostgreSQL pool
│       ├── db/               query helpers (query, queryOne, withTransaction) + row types
│       ├── repositories/     SQL data access (assets, lifecycle) - add more per module
│       ├── scripts/          migrate.ts, seed.ts
│       ├── middleware/       404 + error handler
│       ├── routes/           /api router + health check
│       └── modules/          auth, users, assets, lifecycle,
│                             activities, maintenance, reports, analytics
│   └── db/
│       ├── migrations/       001_init_schema.sql (plain SQL, applied in order)
│       └── seeds/            001_dev_seed.sql (fictional dev data)
└── frontend/                 React + Vite + Tailwind
    └── src/
        ├── lib/              API client
        ├── components/       shared components (empty)
        ├── pages/            route pages (empty)
        └── features/         one folder per module (empty)
```

## Prerequisites

Node.js 20+ and npm.

## Run locally

Frontend and backend run independently. Use two terminals.

### Backend (http://localhost:4000)

```bash
cd backend
cp .env.example .env      # then edit DATABASE_URL and set JWT_SECRET
npm install
npm run db:setup          # migrate + seed (dev only)
npm run dev
```

- `GET http://localhost:4000/api/health` – service health
- `GET http://localhost:4000/api/health/db` – checks the database connection
- All other `/api/*` routes require a login token (see **Authentication & roles** below).

The API starts even without `DATABASE_URL`; only `/api/health/db` reports it as unconfigured.

### Frontend (http://localhost:5173)

```bash
cd frontend
cp .env.example .env      # optional in dev
npm install
npm run dev
```

In dev, Vite proxies `/api` to `http://localhost:4000`, so no extra configuration is needed.

## Build checks

```bash
cd backend && npm run build      # tsc -> dist/
cd frontend && npm run build     # tsc -b && vite build
```

From the repo root: `npm run install:all` and `npm run build` do the same for both.

## Database

Plain SQL migrations (no ORM). Set `DATABASE_URL` in `backend/.env` first, then:

```bash
cd backend
npm run db:migrate   # applies db/migrations/*.sql once each (tracked in schema_migrations)
npm run db:seed      # DEV ONLY: truncates all app tables and loads sample data
npm run db:setup     # migrate + seed
```

Migrations: `001_init_schema.sql`, `002_auth.sql` (adds `users.password_hash` + case-insensitive unique email),
`003_field_responsibilities.sql` (adds `responsibility_type` enum + `asset_responsibilities`, see "Field Officer responsibility").

Tables: `departments`, `users`, `infrastructure_assets` (current lifecycle status),
`lifecycle_events` (full history), `activities`, `activity_assignments`, `inspections`,
`maintenance_records`, `asset_responsibilities`. Foreign keys are `RESTRICT` (no cascading deletes) so history is never lost;
deactivate users (`is_active = false`) instead of deleting them. `db:seed` refuses to run when `NODE_ENV=production`.

To add a schema change, add `004_<name>.sql` to `backend/db/migrations/` and run `npm run db:migrate`.

## Environment variables

Backend (`backend/.env`):

| Variable       | Purpose                                                        |
| -------------- | -------------------------------------------------------------- |
| `PORT`         | API port (default `4000`)                                      |
| `NODE_ENV`     | `development` / `production`                                   |
| `CORS_ORIGIN`  | Comma-separated allowed frontend origins                       |
| `DATABASE_URL` | Supabase PostgreSQL connection string                          |
| `DATABASE_SSL` | `true` (default, needed for Supabase) or `false` for local PG  |
| `JWT_SECRET`   | **Required.** Random string, 32+ chars; API won't start in production without it |
| `JWT_EXPIRES_IN` | Token lifetime, default `8h`                                 |

Frontend (`frontend/.env`):

| Variable       | Purpose                                                      |
| -------------- | ------------------------------------------------------------ |
| `VITE_API_URL` | Backend base URL incl. `/api` in production; empty in dev    |

## Deployment notes

- **Backend (Render):** root dir `backend`, build `npm install && npm run build`, start `npm start`.
  Set `DATABASE_URL`, `CORS_ORIGIN` (your Vercel URL), `JWT_SECRET`, `NODE_ENV=production`.
  Run `npm run db:migrate` against the production database (never `db:seed`).
  Use Supabase's connection-pooling string (port 6543).
- **Frontend (Vercel):** root dir `frontend`, framework Vite. Set `VITE_API_URL=https://<render-app>.onrender.com/api`.

## Authentication & roles

Login: `POST /api/auth/login` with `{ "email", "password" }` -> `{ data: { token, user } }`.
Send the token as `Authorization: Bearer <token>` on every other request. `GET /api/auth/me` returns the
current user (with department). Passwords are bcrypt-hashed; the JWT (HS256, secret from `JWT_SECRET`) carries
only `sub` (user id), `role` and `email`. On every request the user is re-loaded from the database, so
deactivating a user or changing a role takes effect immediately. Wrong password, unknown email and inactive
account all return the same `401 INVALID_CREDENTIALS`.

Roles (`user_role` enum, unchanged from Checkpoint 02): `ADMIN`, `GOVERNMENT_OFFICER`, `FIELD_USER`.
All `/api` routes except `/health*` and `POST /auth/login` are authenticated by default.

| Capability                                            | ADMIN | GOVERNMENT_OFFICER | FIELD_USER |
| ----------------------------------------------------- | :---: | :----------------: | :--------: |
| View assets, lifecycle, inspections, maintenance      | all   | all                | assets they are responsible for (1) |
| Create / update assets                                | yes   | yes                | no         |
| Add lifecycle events (changes asset status)           | yes   | yes                | routine events for assets they are responsible for (2) |
| Create activities, assign / unassign users            | yes   | yes                | no         |
| Update any activity                                   | yes   | yes                | assigned only, status + progress only |
| View activities of an asset                           | all   | all                | assigned only |
| Submit inspections                                    | yes   | yes                | assets they are responsible for, as themselves |
| Submit maintenance / update records                   | yes   | yes                | assets with MAINTENANCE responsibility, own records only |
| Assign / remove Field Officer responsibility          | yes   | yes                | no         |
| View who is responsible for an asset                  | all   | all                | own assets |
| List users                                            | all   | active field users (read-only, to assign work) | no |
| Create / view / update users                          | yes   | no                 | no         |
| `GET /api/departments`                                | yes   | yes                | yes        |

(1) A field user can access an asset **only** if government has assigned them responsibility for it (see below).
Department membership and activity assignment grant no asset access (`src/middleware/assetAccess.ts` - one place to
change). (2) See the table below. `GET /api/activities/mine` lists a user's assigned activities. `created_by`,
`recorded_by` and `assigned_by` are always taken from the token; any value in the request body is ignored.

### Field Officer responsibility (Checkpoint 04.1)

Per the Pravi clarification, Field Officers are assigned project-wise. Government assigns a Field Officer
(`FIELD_USER`) to an asset in a capacity - `CONSTRUCTION` or `MAINTENANCE` - stored in `asset_responsibilities`
(`asset_id`, `user_id`, `responsibility_type`, `assigned_by`, `assigned_at`; unique per asset/user/type; the same
officer may hold both capacities; all foreign keys `RESTRICT`). That assignment is the only thing that grants a
Field Officer access to an asset; once assigned, routine updates need no further approval. It is **separate from
activity assignments** (task-level work): an officer needs no activity to work on their project, and an activity
assignment alone never grants asset access.

| Endpoint (under `/api/assets/:id`)                                   | Who                                   |
| -------------------------------------------------------------------- | ------------------------------------- |
| `GET /responsibilities`                                              | admin, officer, responsible field officer |
| `POST /responsibilities` `{ user_id, responsibility_type }`           | admin, officer (assignee must be an active FIELD_USER) |
| `DELETE /responsibilities/:userId[?responsibility_type=TYPE]`         | admin, officer (no query = remove all of that user's capacities) |

What a responsible Field Officer may record as lifecycle events (`POST /lifecycle`, always `recorded_by` = self):
`CONSTRUCTION` -> `CONSTRUCTION_STARTED`, `CONSTRUCTION_PROGRESS`, `CONSTRUCTION_COMPLETED`, `INSPECTION`, `OTHER`;
`MAINTENANCE` -> `MAINTENANCE_STARTED`, `MAINTENANCE_COMPLETED`, `INSPECTION`, `OTHER`. `PLANNED`, `REHABILITATION`,
`END_OF_LIFE_ASSESSMENT` and `DECOMMISSIONED` remain admin / officer. Maintenance records need `MAINTENANCE`
responsibility; inspections need any responsibility. Third-party inspections use the existing inspection system
(no separate role; the Field Officer stays responsible).

### Lifecycle State Machine & Transition Rules (Checkpoint 06)

The platform enforces lifecycle state machine rules at the backend API layer. Any invalid transition returns HTTP 400 with structured error `{ "error": { "code": "INVALID_LIFECYCLE_TRANSITION", "message": "..." } }`.

```
PLANNED ────► UNDER_CONSTRUCTION ────► OPERATIONAL ◄───► UNDER_MAINTENANCE
                   │                       │                     │
                   ▼                       ▼                     ▼
          CONSTRUCTION PROGRESS      REHABILITATION /     END_OF_LIFE
                   │                 INSPECTIONS /               │
                   ▼                 MAINTENANCE                 ▼
         CONSTRUCTION COMPLETED                               DECOMMISSIONED (terminal)
```

**Key State Validation Rules:**
- `PLANNED`: Pre-construction phase. Allows `CONSTRUCTION_STARTED`. Forbids `DECOMMISSIONED`, `CONSTRUCTION_COMPLETED`, `CONSTRUCTION_PROGRESS`, condition inspections, and maintenance work.
- `UNDER_CONSTRUCTION`: Allows `CONSTRUCTION_PROGRESS`, `INSPECTION`, and `CONSTRUCTION_COMPLETED` (which automatically sets progress to 100% and moves state to `OPERATIONAL`). Forbids maintenance started/completed and decommissioning.
- `OPERATIONAL`: Allows `INSPECTION`, `MAINTENANCE_STARTED` (moves to `UNDER_MAINTENANCE`), `REHABILITATION`, `END_OF_LIFE_ASSESSMENT`, and `DECOMMISSIONED`. Forbids construction started/progress.
- `UNDER_MAINTENANCE`: Allows `MAINTENANCE_COMPLETED` (moves back to `OPERATIONAL`), `INSPECTION`, `REHABILITATION`, `END_OF_LIFE_ASSESSMENT`. Forbids starting duplicate maintenance.
- `DECOMMISSIONED`: Terminal lifecycle state. Rejects all subsequent lifecycle events, inspections, and maintenance work.

### Demo accounts (development only)

`npm run db:seed` gives **every** seeded user the password `Demo@12345` - never run it in production.

| Email                  | Role               | Notes                                                   |
| ---------------------- | ------------------ | ------------------------------------------------------- |
| `admin@demo.local`     | ADMIN              | Platform administrator                                 |
| `officer@demo.local`   | GOVERNMENT_OFFICER | Health & Family Welfare Department                      |
| `field@demo.local`     | FIELD_USER         | Health dept.; CONSTRUCTION responsibility for HOS-SRT-002 |
| `field2@demo.local`    | FIELD_USER         | Health dept.; MAINTENANCE responsibility for HOS-AMD-001 |
| `inactive@demo.local`  | FIELD_USER         | Deactivated - login is rejected                         |

### Smoke test

```bash
cd backend && npm run db:setup && npm run dev      # terminal 1 (fresh seed)
cd backend && npm run test:smoke                   # terminal 2
```
