# 🥛 Dairy Stream Cloud

**Dairy Stream Cloud** is a production-grade, full-stack SaaS platform for running a modern dairy delivery and billing business — from doorstep milk subscriptions and daily delivery tracking to procurement, agent logistics, payments, and multi-tenant super-admin oversight.

Built as a monorepo with a **Node.js/Express** backend and a **React/Vite** frontend, it ships with real-time delivery tracking, subscription-based billing automation, UPI/Cashfree payment verification, WhatsApp/SMS notifications, Redis-backed background workers, and a Capacitor-wrapped Android app for delivery agents.

---

## ✨ Key Features

### For Customers
- Self-service registration, profile, and subscription management
- Daily/monthly delivery subscriptions with automated billing cycles
- Explore nearby dairies with location-based discovery and infinite scroll
- Live delivery agent tracking on a map (React Leaflet)
- Digital invoices, payment history, and online payments
- Push notifications and delivery status updates
- Explore and buy from local dairies without a subscription ("Buy Once")

### For Delivery Agents
- Mobile-first working dashboard (installable as an Android app via Capacitor)
- Building/route-based delivery task lists
- Real-time location sharing via Socket.IO
- Delivery history and performance tracking

### For Dairy Admins
- Central dashboard with live business intelligence (Recharts + Socket.IO)
- Customer, agent, supplier, and product management
- Procurement tracking and delivery oversight
- Agent performance analytics and monitoring
- Payment reconciliation and reporting
- Bank account verification (via Cashfree) for suppliers/agents

### For Super Admins (Platform Owner)
- Dedicated Super Admin authentication and dashboard, separate from dairy-admin logins
- Multi-dairy tenant management (onboard, monitor, manage dairies platform-wide)
- Subscription plan selection/configuration and coupon management
- Location-based analytics across all onboarded dairies
- Platform-wide monitoring, announcements, and support tools
- Centralized settings across all onboarded dairies

### Platform & Infrastructure
- **Real-time delivery tracking** via Socket.IO
- **Background job processing** with BullMQ + Redis (marketplace orders, reconciliation, WhatsApp retries)
- **Automated billing** — daily subscription automation and month-end billing via cron jobs
- **Payments** — direct UPI billing model with legacy Razorpay marketplace support, plus Cashfree bank verification
- **Notifications** — WhatsApp Cloud API, Twilio, Web Push, email (Nodemailer)
- **Security hardening** — API request signing, CORS allow-listing, CSRF protection, bot protection, rate limiting, SSRF guards, deterministic field-level encryption/decryption, fraud detection, and an audit ledger for marketplace transactions
- **Observability** — correlation IDs, structured logging, global error handling, health checks
- **Offline support & PWA** capabilities on the frontend
- **Android app** packaged via Capacitor for delivery agents

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS, React Router, Zod, Framer Motion |
| Mobile | Capacitor (Android), Vite PWA plugin |
| Backend | Node.js, Express 5 (ESM) |
| Database | Supabase (PostgreSQL) via `@supabase/supabase-js` and `pg` |
| Real-time | Socket.IO |
| Queues / Cache | Redis, BullMQ, ioredis |
| Payments | Razorpay, Cashfree (bank/UPI verification) |
| Messaging | Twilio, WhatsApp Cloud API, Web Push, Nodemailer |
| Media | Cloudinary |
| Auth | JWT (`jsonwebtoken`), bcryptjs |
| Testing | Node's built-in test runner (backend), Vitest + Testing Library (frontend) |
| Charts / Maps | Recharts, Leaflet / React Leaflet |
| Containers | Docker, Docker Compose, Nginx (frontend serving) |

---

## 📁 Project Structure

```text
Dairy-Stream-Cloud/
├── Backend/
│   ├── config/          # Supabase, Redis, env validation, loaders
│   ├── controllers/      # admin, agent, authentication, customer,
│   │                     # public, shared, superAdmin, suppliers
│   ├── middleware/        # auth, roles, security, observability, uploads
│   ├── routes/             # admin, agent, auth, customer, public,
│   │                        # superAdmin, location, index route hub
│   ├── services/            # business logic per domain + marketplace
│   │                          #   (queueing, fraud, reconciliation, audit ledger)
│   ├── socket/                # Socket.IO location handlers
│   ├── workers/                # Marketplace background worker
│   ├── scripts/                 # Reconciliation & order verification scripts
│   ├── sql/                      # Supabase migrations, production hardening, seeds
│   ├── tests/                      # Backend test suite
│   ├── utils/                       # Logger, crypto, port resolver, helpers
│   ├── eslint.config.js               # Backend ESLint rules
│   ├── Dockerfile
│   └── server.js                     # App entry point
│
├── Frontend/
│   ├── src/
│   │   ├── api/                # API client modules (customer, agent, etc.)
│   │   ├── components/          # customer, admin, agent, dairy, steps, common
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── pages/                   # customer, admin, super-admin, agent, public
│   │   ├── services/                 # Frontend service layer
│   │   ├── notifications/             # Push notification handling
│   │   ├── offline/                    # Offline/PWA support
│   │   ├── validators/                  # Zod schemas
│   │   └── utils/                        # Helpers + tests
│   ├── android/                          # Capacitor Android project
│   ├── public/
│   ├── capacitor.config.ts
│   ├── nginx.conf
│   └── Dockerfile
│
├── scripts/
│   └── dev.js               # Runs backend + frontend together in dev
│
├── .github/workflows/         # CI (lint, test, build) and keep-alive jobs
├── docker-compose.yml           # Frontend, backend, marketplace worker, Redis
├── package.json                   # Root scripts (dev/build/test orchestration)
└── README.md
```

---

## 👥 User Roles

The platform is built around five distinct roles, each with its own routes, controllers, and frontend experience:

1. **Customer** — subscribes to a dairy, tracks deliveries, manages payments
2. **Agent** — delivers milk/products, updates location, completes building/route tasks
3. **Supplier** — supplies products/produce to a dairy, with bank verification
4. **Admin** — runs a single dairy's operations (customers, agents, products, procurement, payments)
5. **Super Admin** — manages the platform across all onboarded dairies (plans, coupons, monitoring, support)

---

## 🚀 How to Run This Project

This section walks through everything needed to get Dairy Stream Cloud running locally, from a clean checkout to a working app in your browser.

### Step 0 — Prerequisites

Make sure you have the following installed before you start:

| Requirement | Version | Check with |
|---|---|---|
| Node.js | 22.x (matches CI) | `node -v` |
| npm | comes with Node | `npm -v` |
| Git | any recent version | `git --version` |
| A Supabase account/project | free tier is fine | — |
| Redis | optional locally (needed for queue/marketplace features) | `redis-server --version` |
| Docker & Docker Compose | optional, only if you want the containerized setup | `docker --version` |

You do **not** need Redis or Docker just to browse the app and its core delivery/billing flows — they're only required for the marketplace queue worker and containerized deployment.

---

### Step 1 — Clone the repository

```bash
git clone https://github.com/automaterealitylab/Dairy-Stream-Cloud.git
cd Dairy-Stream-Cloud
```

---

### Step 2 — Install dependencies

The repo is a monorepo with three separate `package.json` files: root, `Backend/`, and `Frontend/`. Install all three:

```bash
npm install                     # root-level scripts/tooling
npm --prefix Backend install     # Express API dependencies
npm --prefix Frontend install    # React/Vite app dependencies
```

This should complete without errors. If you hit peer-dependency warnings from npm, they're safe to ignore for local development.

---

### Step 3 — Set up your Supabase (PostgreSQL) project

1. Go to [supabase.com](https://supabase.com) and create a free project (or use an existing one).
2. From your Supabase project dashboard, go to **Project Settings → API** and note down:
   - **Project URL** → this becomes `SUPABASE_URL`
   - **anon public key** → this becomes `SUPABASE_ANON_KEY`
   - **service_role key** → this becomes `SUPABASE_SERVICE_ROLE_KEY` (keep this secret, it bypasses row-level security)
3. Go to the **SQL Editor** in Supabase and run the migration files from `Backend/sql/` **in this order**:
   ```text
   1. SUPABASE_MIGRATIONS.sql              (core schema: tables, relationships)
   2. PRODUCTION_HARDENING_MIGRATIONS.sql   (indexes, constraints, hardening)
   3. seed_customer_todays_delivery.sql     (optional — sample/seed data)
   ```
   Paste each file's contents into a new SQL query and run it, checking for errors before moving to the next.
4. (Optional) Use `DROP_UNUSED_TABLES.sql` only if you need to clean up leftover tables — review it before running, since it's destructive.

---

### Step 4 — Configure environment variables

Copy the example env files:

```bash
cp Backend/.env.example Backend/.env
cp Frontend/.env.example Frontend/.env
```

Now open `Backend/.env` and fill in the values that matter for your setup. At minimum, for the app to boot in development:

```env
PORT=4000
JWT_SECRET=replace_with_a_long_random_string
ACCESS_TOKEN_TTL=30d

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

DATA_ENCRYPTION_KEY=any_long_random_string
DET_IV_SALT=any_long_random_string
```

Everything else in `Backend/.env.example` (Cashfree, Razorpay, Twilio, WhatsApp Cloud API, Sentry, Redis, security hardening flags) is **optional for local development** — the app will run without them, but those specific features (bank verification, payments, notifications, background queues) won't work until configured. Leave them blank or use test/sandbox credentials from each provider.

In `Frontend/.env`, point the app at your local backend:

```env
VITE_API_BASE_URL=http://localhost:4000
```

> ⚠️ Never commit a real `.env` file. Only `.env.example` files should ever be pushed to git.

---

### Step 5 — (Optional) Start Redis

Only needed if you want to exercise the marketplace queue/worker features (`REDIS_ENABLED=true` in `Backend/.env`).

**Option A — via Docker (recommended):**
```bash
docker run -d --name dairy-redis -p 6379:6379 redis:7-alpine
```

**Option B — native install**, then just run:
```bash
redis-server
```

If you skip this step, leave `REDIS_ENABLED=false` in `Backend/.env` — the rest of the app works fine without it.

---

### Step 6 — Run the app in development

From the **repository root**, start both frontend and backend together:

```bash
npm run dev
```

This uses `scripts/dev.js` to launch both processes concurrently. You should see:
- The backend logging that it validated its runtime env and is listening (default `http://localhost:4000`)
- The Vite dev server printing a local URL (default `http://localhost:5173`)

**Or run them in two separate terminals** if you prefer separate logs:

```bash
# Terminal 1
npm run dev:backend     # Express API via nodemon, auto-restarts on file changes

# Terminal 2
npm run dev:frontend    # Vite dev server with hot module reload
```

---

### Step 7 — Verify it's working

1. Open your browser to **http://localhost:5173** — you should see the login/landing page.
2. Check backend health directly:
   ```bash
   curl http://localhost:4000/healthz
   ```
   A healthy response confirms the API, and its Supabase connection, are working.
3. Try registering a new dairy or customer account through the UI to confirm the frontend can reach the backend and the backend can write to Supabase.

---

### Step 8 — (Optional) Run the marketplace worker

If you're testing marketplace order processing and have Redis enabled:

```bash
npm --prefix Backend run workers:marketplace
```

This runs the BullMQ worker (`Backend/workers/marketplace.worker.js`) that processes queued marketplace jobs (orders, reconciliation, notification retries) outside the main API process.

---

### Step 9 — Run tests (optional but recommended)

```bash
npm run test              # both backend and frontend
npm run test:backend      # Node's built-in test runner
npm run test:frontend     # Vitest
npm run lint              # ESLint on the frontend
npm --prefix Backend run lint   # ESLint on the backend
```

---

### Common Issues

| Problem | Likely Cause / Fix |
|---|---|
| Backend crashes on startup with "Missing required runtime environment variables" | You're running with `NODE_ENV=production` without `JWT_SECRET`, `SUPABASE_URL`, or `SUPABASE_SERVICE_ROLE_KEY` set — fill these in `.env` |
| Frontend can't reach the API / CORS errors | Check `VITE_API_BASE_URL` in `Frontend/.env` matches the backend port, and that `CORS_ORIGINS` in `Backend/.env` includes your frontend's URL |
| "REDIS_URL" missing error | You set `REDIS_ENABLED=true` without a running Redis instance — either start Redis (Step 5) or set it back to `false` |
| Supabase queries failing | Double check the migrations from Step 3 ran successfully and your service role key is correct |

---

## 🏭 Building for Production

Build the frontend:
```bash
npm run build
```

Build and sync the Android app:
```bash
npm run build:android
```

### Docker
Spin up the full stack (frontend, backend, marketplace worker, Redis) with:
```bash
docker compose up --build
```

This brings up:
- `frontend` — served via Nginx
- `backend` — Express API with a `/healthz` health check
- `marketplace-worker` — background BullMQ worker for marketplace order processing
- `redis` — with persistence enabled

---

## 🧪 Testing & CI

```bash
npm run test                     # Runs backend and frontend test suites
npm run test:backend             # Node's built-in test runner
npm run test:frontend            # Vitest
npm run lint                     # ESLint (frontend)
npm --prefix Backend run lint    # ESLint (backend)
```

GitHub Actions CI (`.github/workflows/ci.yml`) runs on every push/PR to `main`/`master` as three parallel jobs:

- **Backend CI** (Syntax, Lint & Tests) — installs dependencies, checks `server.js` syntax (`node --check`), runs ESLint, then runs the backend test suite
- **Frontend CI** (Lint, Vitest & Build) — installs dependencies, runs ESLint, runs the Vitest suite, then does a production build
- **Android APK CI** (Java 17 & Gradle Build) — installs dependencies, builds the web app and syncs the Capacitor Android project, verifies the synced web assets exist, runs Gradle unit tests + lint (`testDebugUnitTest lintDebug`), builds a debug APK (`assembleDebug`), and uploads the APK as a downloadable build artifact (kept for 7 days)

A `keep-alive.yml` workflow is also included to periodically ping the deployed backend and prevent cold starts on free-tier hosting.

---

## 🔐 Security Highlights

- Field-level deterministic encryption/decryption for sensitive response data
- API request signing and CSRF protection (configurable via env flags)
- CORS origin allow-listing, bot protection, and SSRF guards
- Rate limiting on general API traffic, webhooks, and marketplace endpoints
- Razorpay webhook IP allow-listing and replay-window protection
- Fraud detection thresholds for high-value marketplace orders
- Optional security audit logging to the database

---

## 📦 Deployment Notes

Production and container configuration lives in:
- `docker-compose.yml`
- `Backend/Dockerfile`
- `Frontend/Dockerfile`
- `Frontend/nginx.conf`
- `Frontend/capacitor.config.ts` (Android packaging)

The backend exposes a `/healthz` endpoint used for container health checks and uptime monitoring.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes with clear messages
4. Ensure `npm run lint` and `npm run test` pass
5. Open a pull request

---

## 📄 License

No license file is currently present in this repository. Add a `LICENSE` file to clarify usage terms before external distribution.
