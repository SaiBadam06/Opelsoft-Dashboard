# OpelSoft Staffing Dashboard

Internal dashboard for managing candidates, vendors, requirements, submissions,
interviews, placements, and tasks.

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with the seeded
admin (see `.env.local` → `SEED_ADMIN_*`).

## Database reset / fresh setup

If you ever reset the DB, the full sequence is:

1. Run migrations **0001 → 0002 → 0003 → 0004** in the Supabase SQL Editor
   (files under `supabase/migrations/`).
2. `npm run seed` — creates the admin account.
3. `npm run seed:all` — loads everything else (candidates, vendors, requirements,
   submissions, interviews, placements, tasks).

(`npm run dev` also prints this sequence as a reminder.)

## Useful scripts

- `npm run dev` — development server
- `npm run build` / `npm start` — production build & run
- `npm run test` — unit tests (Vitest)
- `npm run seed` / `npm run seed:candidates` / `npm run seed:all` — seed data
