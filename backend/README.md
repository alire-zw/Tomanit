# Tomanit Backend | بک‌اند تومانیت

API for the Tomanit Telegram mini-app (TRON exchange & invoices).

## Requirements

- Node.js 20+
- npm
- MySQL (XAMPP) or PostgreSQL

## Setup

```bash
cd backend
cp .env.example .env
npm install
npm run db:push
npm run dev
```

Default MySQL (XAMPP, empty root password):

```
DB_PROVIDER=mysql
DATABASE_URL="mysql://root@localhost:3306/tomanit"
```

Switch to PostgreSQL with minimal changes:

1. Set `DB_PROVIDER=postgresql` and matching `DATABASE_URL` in `.env`
2. Run `npm run db:sync && npm run db:push`

## Run

Development (hot reload):

```bash
npm run dev
```

Production build:

```bash
npm run build
npm start
```

Default URL: `http://localhost:4321` (change with `PORT` in `.env`)

Health check: `GET http://localhost:4321/api/health`

## Auth

Mini App only: send `Authorization: tma <initData>` (or `X-Telegram-Init-Data`) on protected routes.
Users are upserted from live Telegram identity — no demo accounts.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | tsx watch |
| `npm run build` | compile TypeScript |
| `npm start` | run `dist/index.js` |
| `npm run db:push` | sync Prisma schema to SQLite |
| `npm run db:generate` | generate Prisma client |

Database file: `prisma/dev.db` (when `DATABASE_URL=file:./dev.db`).
