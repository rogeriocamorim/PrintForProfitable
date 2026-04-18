# AGENTS.md — PrintForProfitable

## What is this?
Self-hosted 3D print pricing calculator. React frontend + Express backend + PostgreSQL. Docker on Raspberry Pi (ARM64).

## Critical: Will break if you get wrong

- **Prisma v5 only.** v6/v7 removed `url` from datasource schema. Use `prisma@5` and `@prisma/client@5`.
- **Backend is CommonJS.** `"type": "commonjs"` in package.json, `"module": "commonjs"` in tsconfig. Dev: `tsx watch src/index.ts`.
- **Frontend is ESM.** `"type": "module"`, Vite 8, React 19. Tailwind v4 via `@tailwindcss/vite` plugin (no PostCSS config).
- **`/auth/me` must return `{ user }` wrapper**, not flat user object. Frontend `fetchUser` expects this. Breaking it silently logs users out on page reload.
- **OAuth routes are conditional.** Backend checks `if (process.env.GOOGLE_CLIENT_ID)` — returns 501 when missing. Frontend calls `GET /api/auth/providers` and hides buttons accordingly. Google/GitHub env vars exist but are **empty** in `.env`.
- **Docker postgres container**: `printforprofitable_postgres_1` (underscores). DB user: `pfp`, DB name: `printforprofitable`.
- **Admin impersonation tokens authenticate as the target user**, not as the admin. The `stop-impersonation` route MUST be placed above `router.use(isAuthenticated, requireSuperAdmin)` with its own `isAuthenticated` guard — otherwise 403.

## Architecture decisions (don't change without asking)

- **UserRole enum** (`USER`, `SUPER_ADMIN`) — not boolean `isAdmin`, not full RBAC.
- **Admin user updates**: single `PATCH /admin/users/:id` endpoint for role, active, name changes.
- **Settings API**: `PUT /admin/settings/:key` (key in URL param), `GET /admin/settings` returns flat key-value object.
- **Vite proxies `/api`** to backend `:3001` in dev. Frontend runs on `:5173`.
- **Auth**: Passport.js local strategy + JWT. OAuth strategies registered conditionally.

## File layout (key files only)

```
backend/
  .env                          # DATABASE_URL, JWT_SECRET, empty OAuth vars
  prisma/schema.prisma          # 10+ models + UserRole enum + PlatformSettings
  src/index.ts                  # Express entry, port 3001
  src/middleware/auth.ts         # isAuthenticated, requireSuperAdmin
  src/routes/auth.ts            # register, login, /me, /providers, OAuth
  src/routes/admin.ts           # stop-impersonation ABOVE requireSuperAdmin middleware
  src/routes/wizard.ts          # 4-step setup
  src/routes/farms.ts           # Farm CRUD
  src/routes/models.ts          # Model CRUD + file upload
  src/services/passport.ts      # Strategies (local + conditional Google/GitHub)

frontend/
  vite.config.ts                # /api proxy, @tailwindcss/vite plugin
  src/App.tsx                   # Router with /admin/* routes
  src/contexts/AuthContext.tsx   # Auth + impersonation + stopImpersonation
  src/components/AdminRoute.tsx  # Super admin guard
  src/pages/admin/              # AdminDashboard, AdminUsers, AdminFarms, AdminSettings
  src/pages/wizard/             # Steps 1-4 + WizardLayout
  src/pages/dashboard/          # Dashboard + DashboardLayout (has impersonation banner)
```

## Dev commands

```bash
cd backend && npm run dev          # tsx watch, port 3001
cd frontend && npm run dev         # Vite, port 5173
cd backend && npx prisma migrate dev
cd backend && npx prisma studio
docker compose up -d --build       # Full stack
```

## Promote user to Super Admin

```sql
docker exec printforprofitable_postgres_1 psql -U pfp -d printforprofitable \
  -c "UPDATE users SET role = 'SUPER_ADMIN' WHERE email = 'admin@test.com';"
```

## Test accounts (local dev)

| Email | Password | Role |
|-------|----------|------|
| admin@test.com | Admin123! | SUPER_ADMIN |
| user2@test.com | User123! | USER |

## Pricing formula

```
Material  = (filament_grams / spool_weight) * cost_per_spool
Electric  = (print_hours * printer_watts / 1000) * electricity_rate
Labor     = labor_hours * labor_rate
Total     = Material + Electric + Labor
Price     = Total / (1 - margin/100) + platform_fees + tax
```

## What's done

- Full auth (local + conditional OAuth), register → 4-step wizard → dashboard
- Dashboard with collapsible sidebar, dark navy/orange theme (#E8622C), Ubuntu font
- Admin: stats, user CRUD (search/pagination/role/active), farm listing, impersonation, settings
- Reusable UI: Button (CVA), Input (prefix/suffix), Card
- Docker Compose (postgres + backend + frontend/nginx), ARM64 compatible

## What's next

- Build out dashboard pages (currently placeholders)
- .3mf file parser
- Batch pricing, order tracking, analytics charts
- Test OAuth with real credentials
