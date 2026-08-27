# Solar Telemetry Technical Test

Implementasi full-stack untuk technical test yang menggabungkan form frontend, Express backend, telemetry simulator, scheduled CSV collection, data cleansing, dan SQL assessment.

## Dokumentasi

- [Dokumentasi Setup and Run Demo](docs/Dokumentasi%20Setup%20and%20Run%20Demo.pdf)
- [Dokumentasi Technical Configuration](docs/Dokumentasi%20Technical%20Configuration.pdf)

## Quick Start

```bash
git clone https://github.com/glenkusuma/https://github.com/glenkusuma/20260824-techtest.git
cd 20260824-techtest

nvm install 22
nvm use 22
npm ci
npm run setup
```

Akses development:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend health: http://localhost:3000/health
- API documentation: http://localhost:3000/api-docs

## Recommended Demo - Docker / Podman Compose

Reset ke baseline lalu jalankan demo dua hari virtual:

```bash
npm run setup:reset
npm run demo:compose
```

Selama demo, buka:

- [http://localhost:5173/?demo=1](http://localhost:5173/?demo=1)
- [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- folder [.runtime/cron](.runtime/cron)

Setelah assertion PASS, service tetap hidup agar hasil dapat diperiksa. Tekan `Ctrl+C` ketika review selesai; script kemudian melakukan Compose shutdown.

### Cleanup automation demo

Jalankan **setelah** demo aplikasi dihentikan:

```bash
npm run setup:reset
npm run test:cleanup:compose
```

Test ini memverifikasi scheduled collector configuration dan cleanup file yang lebih tua dari 30 hari melalui containerized automation path.

## npm-only Demo

Jika Docker/Podman tidak tersedia:

```bash
npm run setup:reset
npm run demo
```

Mode ini tetap mendemonstrasikan frontend, backend, simulator, collector, failure recovery, dan artifact generation. Namun recurring automation daemon tidak dijalankan seperti pada container, sehingga Compose tetap menjadi jalur demo yang direkomendasikan.

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

Stack utama: Node.js 22, npm workspaces, TypeScript/ESM, Vue 3 + Vite + Pinia, Express 5 + Zod + SQLite, supercronic, Docker/Podman Compose.
