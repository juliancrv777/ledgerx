# LedgerX

Production-minded simulated payment platform focused on financial correctness, concurrency, security and event-driven delivery.

**Live demo:** https://ledgerx-seven.vercel.app  
**API:** https://ledgerx-0t5d.onrender.com/api/health

> LedgerX uses simulated money only. It is an engineering portfolio project, not a real payment processor.

## What it demonstrates

- Double-entry ledger with balanced financial transactions
- Serializable PostgreSQL transactions and concurrency conflict handling
- Idempotent funding and transfers with payload replay protection
- Transactional outbox for database/event consistency
- Redis + BullMQ asynchronous processing
- HMAC-SHA256 signed webhooks, exponential retries and dead-letter queue
- Endpoint-safe fanout: successful deliveries are not repeated when another endpoint fails
- Webhook SSRF defenses, HTTPS-only targets and redirect blocking
- JWT access tokens plus rotating refresh sessions in Secure HttpOnly cookies
- Refresh-token hashing, revocation and replay rejection
- Redis-backed API rate limiting
- Request IDs, structured logs, Prometheus metrics and readiness checks
- Automated unit and PostgreSQL financial E2E tests
- Docker-based local infrastructure and GitHub Actions CI

## Architecture

```text
Browser
  |
  v
Next.js / Vercel
  | same-origin /api proxy
  v
NestJS API / Render ---- PostgreSQL / Neon
  |                           |
  |                    double-entry ledger
  |                    + transactional outbox
  v
Redis / Upstash <---- BullMQ
  |
  v
Worker / Render
  |
  +---- signed webhooks ---> external HTTPS endpoints
  +---- failed after retries ---> DLQ
```

The API and worker run as supervised processes in the same Render service for the portfolio deployment. Queue keys use an isolated `ledgerx` prefix.

## Financial guarantees

Every ledger transaction is asserted to balance to zero. Transfer writes run at PostgreSQL `SERIALIZABLE` isolation and retry serialization conflicts. Idempotency keys are scoped to the initiating user and bound to a request fingerprint, preventing the same key from being reused with a different payload.

The E2E suite validates funding replay, transfer replay, payload mismatch rejection, insufficient/concurrent spending protection and the double-entry invariant.

## Authentication

Access tokens are short-lived and kept in browser memory. A random refresh token is stored only as a Secure HttpOnly cookie; the database stores its SHA-256 hash. Refreshing rotates the session and revokes the previous token. Logout revokes the active refresh session.

Production uses a same-origin Next.js API rewrite so the refresh cookie remains first-party.

## Webhook delivery

Transfers write outbox events atomically with financial state. The dispatcher publishes events to BullMQ. The worker signs deliveries with HMAC-SHA256, records every attempt, retries failures with exponential backoff and moves exhausted jobs to a dead-letter queue.

Webhook targets must use public HTTPS destinations. The API rejects private/reserved targets and the worker validates destinations again immediately before delivery and rejects redirects.

## Observability

- `/api/health/live` — process liveness
- `/api/health/ready` — PostgreSQL and Redis readiness
- `/api/metrics` — Prometheus metrics
- structured request and worker logs
- request correlation IDs

## Local setup

Requirements: Node.js 22+, Docker and Docker Compose.

```bash
docker compose up -d
npm install
npm run prisma:generate
npm run prisma:deploy -w @ledgerx/api
npm run dev -w @ledgerx/api
npm run dev -w @ledgerx/worker
npm run dev -w @ledgerx/web
```

For local development, configure `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` and `WEB_ORIGIN`. Never commit production credentials.

## Quality

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

GitHub Actions runs quality checks and the financial E2E suite against an isolated PostgreSQL service.

## Production validation

The deployed system has been exercised end-to-end with two independent accounts: simulated funding, atomic transfers, persisted balances, outbox dispatch, Redis/BullMQ processing and signed webhook delivery. Failure handling was also exercised with one successful endpoint and one HTTP 500 endpoint: the successful destination was delivered once while the failing destination retried five times before the job entered the DLQ.
