# Dairy Stream Cloud Production Architecture Blueprint

Target: 100,000 customers, 10,000 concurrent users, 50,000 daily deliveries, 5,000 agents, and 1M API requests/day with 9-10/10 security, scalability, reliability, performance, and maintainability.

This is the target design. It separates API, worker, cache, queue, database, and observability responsibilities so the platform can scale beyond a single Express process.

## 1. Architecture Review And Required Fixes

| Area | Current score | Target score | Exact fix required |
|---|---:|---:|---|
| Database schema | 6/10 | 10/10 | Add session/security tables, stronger constraints, hot-path composite indexes, monthly partitions for high-volume tables, retention jobs, and archive tables. |
| API architecture | 6/10 | 9/10 | Split API into stateless services: auth, customer, admin, agent, marketplace, billing, notification, and read-model/dashboard modules. |
| Authentication | 6/10 | 10/10 | Use short-lived access tokens, rotating refresh tokens, hashed token storage, session revocation, Redis session cache, and device/session audit. |
| Authorization | 5/10 | 9/10 | Add role/tenant checks in middleware plus Supabase RLS for direct database defense in depth. |
| Notifications | 6/10 | 9/10 | Move email, WhatsApp, push, and reminders to BullMQ workers with retries and dead-letter queues. |
| Billing | 6/10 | 9/10 | Make billing generation idempotent, batched, transactional, and worker-driven. |
| Delivery generation | 5/10 | 9/10 | Replace API-process cron loops with dedicated workers, batch inserts, distributed locks, and partition-aware queries. |
| Agent workflows | 6/10 | 9/10 | Use route/task read models, cached agent assignment queries, offline sync idempotency keys, and location write throttling. |
| Dashboard queries | 5/10 | 9/10 | Use dashboard summary tables/materialized views plus Redis read-through cache. Avoid dashboard fan-out. |
| Deployment | 5/10 | 10/10 | Use load-balanced stateless APIs, worker services, Redis, managed Postgres, CDN/object storage, CI/CD, staging, backup, and observability. |

## 2. Security 10/10

Required libraries:

- `express-rate-limit` or Redis-backed custom limiter using `rate-limiter-flexible`
- `ioredis`
- `bullmq`
- `argon2` or keep `bcrypt` with cost 12 after load testing
- `helmet`
- `cors`
- `csrf-csrf`
- `zod` or `joi`
- `@sentry/node`
- `@opentelemetry/sdk-node`
- `pino`

Exact implementation plan:

1. Access tokens expire in 10-15 minutes.
2. Refresh tokens expire in 14-30 days and rotate on every refresh.
3. Store only SHA-256 hashes of refresh tokens in `auth_sessions`.
4. Store revoked access token JTIs in Redis until access-token expiry.
5. Add `session_version` to users/admins/agents so password change can invalidate all sessions.
6. Replace in-memory OTPs with `otp_challenges`; hash OTP codes and enforce attempt counters.
7. Password reset and email verification tokens remain database-backed, one-time, hashed in production.
8. Enforce Redis-backed rate limits by route group, actor, IP, device, and tenant.
9. Add audit logs for login, refresh, logout, password reset, payment verification, admin actions, and bank changes.
10. Keep Supabase service role only on the backend. Never expose it to frontend code.
11. Enable RLS on core tables if direct Supabase access is introduced; otherwise use it as defense in depth.
12. Add strict request validation and output shaping. Avoid `select("*")` in hot or sensitive paths.
13. Put admin routes behind elevated MFA for high-risk actions.
14. Store secrets in Vercel/host secret manager or cloud secret manager, not `.env` files in production.

Required middleware:

- `requestId`
- `securityHeaders`
- `corsPolicy`
- `csrfProtection` for cookie/session routes
- `requestBodyLimit`
- `zodValidate`
- `redisRateLimit`
- `jwtAuthenticate`
- `tenantAuthorize`
- `roleAuthorize`
- `auditEvent`
- `errorHandler`

Database changes:

- `auth_sessions`
- `auth_token_revocations`
- `otp_challenges`
- `api_rate_limit_events`
- `admin_action_audit_logs`
- `tenant_api_keys`
- stronger indexes and partitions from [PRODUCTION_HARDENING_MIGRATIONS.sql](../Backend/sql/PRODUCTION_HARDENING_MIGRATIONS.sql)

## 3. Scalability 10/10

Target architecture:

```text
Client/PWA
  |
CDN + WAF + TLS
  |
Load Balancer
  |
+--------------------+       +----------------------+
| Stateless API Pods | <---> | Redis cache/session  |
+--------------------+       +----------------------+
  |       |                    |
  |       +--> BullMQ queues --+--> Worker services
  |                              - email/WhatsApp/push
  |                              - billing
  |                              - delivery generation
  |                              - reconciliation
  |                              - OCR/payment verification
  |
Supabase/Postgres primary
  |
Read replicas + partitioned high-volume tables
  |
Object storage + CDN for screenshots/assets
```

Queue architecture:

| Queue | Producer | Worker | Retry policy |
|---|---|---|---|
| `notifications` | API/billing/delivery | Notification worker | 7 attempts, exponential backoff, DLQ |
| `billing` | cron/orchestrator | Billing worker | idempotent monthly bill generation |
| `deliveries` | cron/orchestrator/admin | Delivery worker | idempotent daily generation |
| `payments` | API/webhook | Payment worker | reconciliation-safe retries |
| `ocr` | payment uploads | OCR worker | bounded concurrency |
| `marketplace:webhooks` | webhook API | Marketplace worker | ordered by event ID |
| `audit` | all services | Audit worker | fire-and-forget with fallback sync insert |

Scaling limits:

| Component | Target capacity |
|---|---:|
| API service | 1,000-2,000 RPM per 2 vCPU instance after cache/index fixes |
| Worker service | Horizontally scaled by queue depth |
| Redis | 50k+ ops/sec on managed Redis tier |
| Postgres primary | Write workload, partitioned high-volume tables |
| Read replicas | Dashboard/history/report reads |
| CDN/object storage | Screenshots, product images, static frontend |

Cache invalidation:

- `customer_dashboard:{customerId}:{dairyId}` TTL 30-90s; invalidate on delivery/payment/subscription changes.
- `admin_dashboard:{dairyId}` TTL 30s; invalidate after billing/delivery/payment writes.
- `products:{dairyId}` TTL 5-15m; invalidate on product mutation.
- `app_settings` TTL 5m; invalidate on settings upsert.
- `dairy_profile:{dairyId}` TTL 5m; invalidate on dairy mutation.

## 4. Database 10/10

High-volume tables:

- `deliveries`: partition by `delivery_date` monthly.
- `payments`: partition by `created_at` monthly.
- `audit_logs`, `immutable_audit_logs`, `security_events`, `notification_events`: partition by `created_at` monthly.
- `ocr_processing_logs`: partition by `created_at` monthly if OCR volume grows.

Table changes by domain:

| Table | Missing columns/constraints/indexes |
|---|---|
| `customers` | `is_active`, `session_version`, unique normalized email/phone indexes, tenant-aware indexes. |
| `admins` | `session_version`, MFA columns, last login metadata. |
| `agents` | `session_version`, location status, status indexes. |
| `deliveries` | idempotency key, generated source, composite indexes by dairy/date/status and agent/date/status, partitioning. |
| `payments` | idempotency key, verification status, UTR indexes, customer/dairy/status/created composite index, partitioning. |
| `subscriptions` | dairy/status/approval/updated index, product item JSONB GIN index. |
| `monthly_bills` | customer/dairy/month uniqueness, dairy/status/due-date indexes. |
| `notification_events` | idempotency key, next attempt, provider event ID, status indexes, partitioning. |
| `audit_logs` | actor columns, correlation ID, immutable append-only policy for critical events. |
| `security_events` | partitioning, actor/session references, severity index. |

Exact SQL additions are in [PRODUCTION_HARDENING_MIGRATIONS.sql](../Backend/sql/PRODUCTION_HARDENING_MIGRATIONS.sql).

Archiving and retention:

- Keep financial ledgers and immutable audit logs for 7 years.
- Keep security events for 180-365 days in hot storage, then archive.
- Keep webhook logs for 365 days.
- Keep notification events for 180 days.
- Keep OCR logs for 90-180 days, archive screenshots separately.

## 5. Performance 10/10

Targets:

- p95 API latency below 300ms for cached dashboard/profile/history.
- p99 below 800ms under normal production load.
- Slow query threshold: 200ms warning, 500ms alert.

Expensive query fixes:

| Current pattern | Optimized pattern |
|---|---|
| Customer dashboard performs many Supabase calls | Single dashboard service reads Redis, then batched DB calls or summary table. |
| Admin dashboard scans deliveries/payments/subscriptions separately | `admin_daily_snapshots` or materialized view refreshed by workers. |
| Payment history broad reads | `payments(customer_id, dairy_id, status, created_at DESC)` plus pagination cursor. |
| Delivery history broad date scans | `deliveries(customer_id, delivery_date DESC)` and partition pruning. |
| Billing reports load thousands of rows | Pre-aggregate monthly bill totals by dairy/month/status. |
| Agent task list filters in application code | Query `deliveries(agent_id, delivery_date, status)` with narrow select. |

Mandatory API rules:

- Every list endpoint has cursor pagination.
- No operational endpoint returns more than 100 rows by default.
- No hot-path `select("*")`.
- Use `Promise.all` only for bounded independent calls.
- Prefer SQL/RPC for read-modify-write workflows that need consistency.

## 6. Reliability 10/10

Target uptime: 99.9%.

RTO/RPO:

| Failure | RTO | RPO |
|---|---:|---:|
| API instance failure | < 2 minutes | 0 |
| Worker failure | < 5 minutes | 0 if queues persisted |
| Redis failure | < 15 minutes | Sessions may require re-login unless Redis HA is enabled |
| Postgres primary failure | < 30 minutes | < 5 minutes with PITR |
| Region failure | 2-4 hours | 15 minutes depending on backup/replica strategy |

Reliability design:

- All workers use idempotency keys.
- All external provider calls use retries with exponential backoff.
- All queues have dead-letter handling and replay tooling.
- API has circuit breakers for email, WhatsApp, OCR, payment provider, and Redis.
- Cron runs outside API instances and uses distributed locks.
- Database has daily full backups, PITR, and quarterly restore drills.

## 7. Observability 10/10

Logging:

- Structured JSON logs with `request_id`, `correlation_id`, `actor_id`, `dairy_id`, route, status, duration, and error code.
- PII redaction at logger boundary.

Metrics:

- API request count, p95/p99 latency, error rate.
- DB query latency and slow query count.
- Queue depth, job duration, retry count, DLQ count.
- Notification success/failure by provider.
- Billing/delivery generation success/failure.
- Payment reconciliation mismatch count.

Tracing:

- OpenTelemetry traces across API, queue producer, worker, Supabase call, Redis, and external provider.

Alert rules:

- API 5xx rate > 2% for 5 minutes.
- p95 latency > 500ms for 10 minutes.
- Queue depth increasing for 15 minutes.
- DLQ count > 0 for payment/billing/delivery queues.
- DB CPU > 80% for 10 minutes.
- Payment webhook failures > 5 in 5 minutes.
- Daily delivery generation incomplete by configured cutoff time.

Dashboards:

- Executive health
- API latency/errors
- Queue/worker health
- Database health
- Payment/reconciliation
- Notification provider health
- Security events
- Billing/delivery operations

Incident workflow:

1. Alert fires in Grafana/Sentry.
2. On-call checks dashboard and trace sample.
3. Stop or scale worker if queue causes DB pressure.
4. Replay DLQ after root cause is fixed.
5. Write incident note with timeline, customer impact, fix, and prevention.

## 8. DevOps 10/10

Deployment architecture:

```text
Nginx / Cloud Load Balancer
  |
API containers: 3+ replicas
Worker containers:
  - notification worker
  - billing worker
  - delivery worker
  - marketplace/payment worker
  - OCR worker
Redis HA
Managed Postgres/Supabase paid tier
Object storage + CDN
Prometheus + Grafana + Sentry + OpenTelemetry collector
```

CI/CD:

- Pull request: lint, unit tests, integration tests, migration syntax check.
- Staging deploy on merge to `develop`.
- Production deploy on tagged release/main approval.
- Run migrations before deploy with rollback plan.
- Canary release for API.
- Worker deploy with queue drain or graceful shutdown.

Infrastructure as Code:

- Terraform or Pulumi for cloud infra.
- Docker Compose for local.
- Separate `.env.staging` and `.env.production` in secret manager.

## 9. Code Quality 10/10

Target structure:

```text
Backend/
  src/
    app.js
    server.js
    config/
    modules/
      auth/
        domain/
        application/
        infrastructure/
        interfaces/http/
      customers/
      admins/
      agents/
      deliveries/
      billing/
      payments/
      notifications/
      marketplace/
    shared/
      db/
      cache/
      queue/
      auth/
      errors/
      logging/
      metrics/
      validation/
    workers/
      notification.worker.js
      billing.worker.js
      delivery.worker.js
      payment.worker.js
      ocr.worker.js
    jobs/
    tests/
```

Rules:

- Controllers only parse HTTP and return responses.
- Application services orchestrate use cases.
- Repositories own Supabase queries.
- Domain modules own validation and business invariants.
- Shared middleware is framework-level only.
- No route handler contains provider calls directly.

## 10. Final Scores After Implementing This Blueprint

| Category | Target score |
|---|---:|
| Security | 10/10 |
| Scalability | 10/10 |
| Reliability | 9.5/10 |
| Performance | 9.5/10 |
| Maintainability | 9/10 |

## Roadmap

7 days:

- Apply production hardening SQL.
- Move OTPs/reset/session state out of memory.
- Add Redis-backed rate limits.
- Add short-lived access tokens and refresh sessions.
- Add missing hot-path indexes.
- Add pagination caps to operational endpoints.

30 days:

- Split notification, billing, delivery, and payment reconciliation into BullMQ workers.
- Add dashboard Redis cache and summary read models.
- Add OpenTelemetry, Sentry, and structured logging.
- Add CI migration checks and staging environment.

90 days:

- Partition deliveries, payments, audit/security/notification tables.
- Add read replicas and route dashboards/history reads to replicas.
- Add DLQ replay tooling and worker dashboards.
- Add RLS policies for core tables.

180 days:

- Complete clean architecture module refactor.
- Add disaster recovery drills.
- Add multi-region backup/restore workflow.
- Add capacity/load tests for 100k customer scenario.
- Add tenant sharding plan if individual dairies become very large.

## Exact Answer

To confidently support 100,000 customers with enterprise-grade reliability and security, implement stateless APIs behind a load balancer, Redis-backed sessions/rate limits/cache, BullMQ worker services for every slow or bulk workflow, monthly partitioning for high-volume tables, read replicas for dashboards/history, strict token/session revocation, production RLS/audit logging, structured observability, CI/CD with staging, and disaster recovery with tested backups and queue replay.
