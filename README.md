# LedgerX

Production-minded simulated payment platform focused on financial correctness, concurrency, idempotency and event-driven processing.

## Architecture
- **Web:** Next.js + TypeScript
- **API:** NestJS + Prisma + PostgreSQL
- **Worker:** BullMQ + Redis
- **Contracts:** shared TypeScript package
- **Quality:** automated tests + GitHub Actions

> LedgerX uses simulated money only. It is an engineering portfolio project, not a real payment processor.

## Roadmap
Double-entry ledger, wallets, transfers, idempotency keys, signed webhooks with retries, async jobs, audit trail and observability.

## Local setup
```bash
docker compose up -d
npm install
npm run prisma:generate
npm run dev
```
