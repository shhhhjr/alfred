# Alfred AI

Alfred AI is a personal assistant web app for students, built with Next.js 14, Prisma, PostgreSQL, and NextAuth.

## Phase 1 status

- App Router scaffold with dashboard/chat/calendar/tasks/email/jobs/settings routes
- Credentials auth (register + login) backed by Prisma `User` model
- Core Prisma schema for users, tasks, events, email accounts, jobs, and activity logs
- Dark dashboard shell with sidebar and top bar
- Security foundation with AES-256 token encryption helper

## Local setup

**Important:** Run all npm commands from the project root (`alfred-ai/`). Running npm from another directory (e.g. your home folder) will fail with `ENOENT: no such file or directory`.

1. Install dependencies:

```bash
cd alfred-ai   # or: cd /path/to/Alfred/alfred-ai
npm install
```

2. Create env file:

```bash
cp .env.example .env.local
```

3. Fill required env vars in `.env.local`:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `ENCRYPTION_KEY` (64 hex chars)

4. Generate Prisma client and run migration:

```bash
npm run prisma:generate
npm run prisma:migrate
```

5. Start dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.
