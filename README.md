# Technical Test - Solar Telemetry

Implementasi full-stack untuk technical test yang menggabungkan form frontend, Express backend, telemetry simulator, scheduled CSV collection, data cleansing, dan SQL assessment.

## Documentation

- [Documentation Setup and Run Demo](docs/Dokumentasi%20Setup%20and%20Run%20Demo.pdf)
- [Technical Configuration Documentation](docs/Dokumentasi%20Technical%20Configuration.pdf)

## Quick Start

```bash
git clone https://github.com/glenkusuma/20260824-techtest.git
cd 20260824-techtest

nvm install 22
nvm use 22
npm ci
npm run setup
```

Access development:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend health: http://localhost:3000/health
- API documentation: http://localhost:3000/api-docs

## Recommended Demo - Docker / Podman Compose

Reset to baseline and run the two-day virtual demo:

```bash
npm run setup:reset
npm run demo:compose
```

During the demo, open:

- [http://localhost:5173/?demo=1](http://localhost:5173/?demo=1)
- [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- folder [.runtime/cron](.runtime/cron)

After assertion, the service remains running so results can be checked. Press `Ctrl+C` when the review is finished; the script will then perform a Compose shutdown.

### Cleanup automation demo

Run **after** the application demo has been stopped:

```bash
npm run setup:reset
npm run test:cleanup:compose
```

This test verifies the scheduled collector configuration and cleans up files older than 30 days through a containerized automation path.

## npm-only Demo

If Docker/Podman is not available:

```bash
npm run setup:reset
npm run demo
```

This mode still demonstrates the frontend, backend, simulator, collector, failure recovery, and artifact generation. However, the recurring automation daemon is not run like in the container, so Compose remains the recommended demo path.

## SQL Assessment

```bash
sqlite3 assessment.db < sql/schema.sql
sqlite3 assessment.db < sql/seed.sql
sqlite3 assessment.db < sql/queries.sql
```

## Quality Check

```bash
npm run verify
```