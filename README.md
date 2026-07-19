# Dairy Stream Cloud

Dairy Stream Cloud is a full-stack dairy delivery management application with a Node.js/Express backend, React/Vite frontend, Supabase persistence, Razorpay payments, Redis-backed marketplace workers, and Capacitor Android support.

## Project Structure

```text
Dairy-Stream-Cloud/
├── Backend/        Express API, workers, services, SQL migrations
├── Frontend/       React/Vite app, Capacitor Android project
├── scripts/        Root development helpers
├── .github/        CI and keep-alive workflows
└── docker-compose.yml
```

## Development

Install dependencies in each package:

```bash
npm install
npm --prefix Backend install
npm --prefix Frontend install
```

Run both apps from the repository root:

```bash
npm run dev
```

Run only one side:

```bash
npm run dev:backend
npm run dev:frontend
```

## Build

Build the frontend:

```bash
npm run build
```

Build and sync the Android project:

```bash
npm run build:android
```

## Environment

Keep local secrets out of git. Use:

- `Backend/.env.example`
- `Frontend/.env.example`

Production and container configuration is kept in:

- `docker-compose.yml`
- `Backend/Dockerfile`
- `Frontend/Dockerfile`
- `Frontend/nginx.conf`
- `Frontend/capacitor.config.ts`
